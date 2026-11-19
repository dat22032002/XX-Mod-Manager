// 用于加载 Mod，将其转换为 ModInfo 对象
import { ModData } from './ModHelper';
import { ModInfo } from './ModInfo';
import ModCache from './ModCache';
import type { ModCacheFile } from './ModCache';
import { EventSystem, EventType } from '../helper/EventSystem';

const fs = require('fs');
const path = require('path');

// How many mods to build before yielding to the UI thread, so a fresh
// scan (first launch / Rescan) does not freeze the window. Same pattern
// and chunk size as ApplyMods.ts.
const LOAD_CHUNK_SIZE = 10;

// Let the UI thread breathe between chunks.
async function yieldToUI() {
    await new Promise(resolve => setTimeout(resolve, 0));
}

class ModLoader {
    public static modSourceFolders: string[] = [];
    static addModSourceFolder(folder: string) {
        // check一下是否存在
        if (folder === undefined || folder === null || folder === '') {
            console.warn('ModLoader.addModSourceFolder: folder is empty');
            return;
        }
        if (!fs.existsSync(folder)) {
            throw new Error(`ModLoader.addModSourceFolder: folder does not exist: ${folder}`);
        }
        // check一下是否是文件夹
        if (!fs.statSync(folder).isDirectory()) {
            throw new Error(`ModLoader.addModSourceFolder: folder is not a directory: ${folder}`);
        }
        if (!this.modSourceFolders.includes(folder))
            this.modSourceFolders.push(folder);
    }
    static removeModSourceFolder(folder: string) {
        this.modSourceFolders = this.modSourceFolders.filter(f => f !== folder);
    }


    // 加载 Mod
    static modsRaw: ModInfo[] = [];
    static mods: ModData[] = [];
    // id -> ModInfo lookup (HP8): getModByID used to be a linear .find()
    // over the whole list, called once per mod on fresh load and on Apply.
    // Updated wherever modsRaw changes (loadMods / loadMod); first mod
    // wins for a duplicated id, same as the old .find() did.
    private static modsById: Map<string, ModInfo> = new Map();
    private static afterLoadCallbacks: ((mods: ModData[]) => void)[] = [];

    static onAfterLoad(callback: (mods: ModData[]) => void) {
        if (typeof callback !== 'function') {
            throw new Error('ModLoader.onAfterLoad: callback must be a function');
        }
        this.afterLoadCallbacks.push(callback);
    }

    private static triggerAfterLoadCallbacks() {
        this.afterLoadCallbacks.forEach(callback => {
            try {
                callback(this.mods);
            } catch (error) {
                console.error('ModLoader.triggerAfterLoadCallbacks: error in callback', error);
            }
        });
    }

    static async loadMods(forceRescan: boolean = false) {
        // 检查一下调用堆栈
        console.trace('ModLoader.loadMods: called from', new Error());
        let startTime = Date.now();

        this.modsRaw = [];
        this.mods = [];
        this.modsById.clear();

        if (this.modSourceFolders.length === 0) {
            // throw new Error('ModLoader.loadMods: no mod source folder');
            console.warn('ModLoader.loadMods: no mod source folder');
            return [];
        }

        // "记住"：先读一次缓存。缓存缺失/损坏/过期时按没有缓存处理，
        // 走和以前一样的完整扫描，不会因此启动失败。
        const cache = forceRescan ? ModCache.fresh(ModInfo.ifKeepModNameAsModFolderName) : ModCache.load(ModInfo.ifKeepModNameAsModFolderName);
        let cacheDirty = forceRescan;
        let cachedCount = 0;
        let freshCount = 0;

        // 读取所有的 mod 文件夹
        // HP1: build mods in small chunks that yield to the UI thread.
        // The old code ran every mod's synchronous build (new ModInfo reads
        // mod.json, calcPreviewPath scans the folder) back-to-back inside
        // Promise.all callbacks, so a fresh scan froze the window as one
        // long block. Now each chunk first checks cache validity for its
        // mods concurrently (async stats), then does the synchronous builds
        // for that chunk, then yields — the window stays responsive.
        await Promise.all(this.modSourceFolders.map(async folder => {
            let mods = await fs.promises.readdir(folder, { withFileTypes: true });
            const seenFolders = new Set<string>();
            // TC10: thư mục recycleBin của plugin xóa mod không phải là mod —
            // loại khỏi danh sách quét (so khớp không phân biệt hoa thường vì
            // Windows không phân biệt). Mục cache cũ của nó cũng bị xóa ở
            // bước dọn cache bên dưới vì không còn nằm trong seenFolders.
            const modDirs = mods.filter(mod => mod.isDirectory() && mod.name.toLowerCase() !== 'recyclebin');
            for (let i = 0; i < modDirs.length; i += LOAD_CHUNK_SIZE) {
                const chunk = modDirs.slice(i, i + LOAD_CHUNK_SIZE);
                // Validity checks are async disk stats: run them together.
                const validity = await Promise.all(chunk.map(async mod => {
                    const entry = cache.sources[folder] ? cache.sources[folder][mod.name] : undefined;
                    return {
                        mod: mod,
                        entry: entry,
                        valid: entry ? await ModCache.isEntryValid(entry) : false,
                    };
                }));
                for (const { mod, entry, valid } of validity) {
                    let modPath = path.join(folder, mod.name);
                    seenFolders.add(mod.name);
                    if (valid && entry) {
                        // 文件夹和 mod.json 都没动过：直接用缓存，不读盘。
                        let modInfo = ModInfo.fromCache(modPath, entry);
                        this.modsRaw.push(modInfo);
                        this.addToIdIndex(modInfo);
                        this.mods.push(ModData.fromCache(modInfo, entry).setModSourcePath(folder));
                        cachedCount++;
                        continue;
                    }
                    // 新 mod，或者改过：完整加载一次，然后记进缓存。
                    // modInfo must be indexed before fromModInfo: handlePreview
                    // looks the mod up by id (getModByID).
                    let modInfo = new ModInfo(modPath);
                    this.modsRaw.push(modInfo);
                    this.addToIdIndex(modInfo);
                    let modData = ModData.fromModInfo(modInfo).setModSourcePath(folder);
                    this.mods.push(modData);
                    freshCount++;
                    if (this.updateCacheEntry(cache, folder, mod.name, modInfo, modData)) {
                        cacheDirty = true;
                    }
                }
                await yieldToUI();
            }
            // 缓存里有、盘上没了的文件夹：从缓存里删掉。
            const cachedFolders = cache.sources[folder];
            if (cachedFolders) {
                for (const folderName of Object.keys(cachedFolders)) {
                    if (!seenFolders.has(folderName)) {
                        delete cachedFolders[folderName];
                        cacheDirty = true;
                    }
                }
            }
        })).then(() => {
            console.log(`ModLoader.loadMods: loaded ${this.modsRaw.length} mods (${cachedCount} from cache, ${freshCount} fresh) in ${Date.now() - startTime}ms`);
        });

        if (cacheDirty) {
            ModCache.save(cache);
        }

        // 触发回调函数
        this.triggerAfterLoadCallbacks();
        // 返回 mod 列表

        return this.mods;
    }

    // 把一个刚完整加载过的 mod 记进缓存。返回 false 表示这次记不下来
    // （比如文件夹突然读不到了），下次启动再扫它一次就是了。
    private static updateCacheEntry(cache: ModCacheFile, folder: string, folderName: string, modInfo: ModInfo, modData: ModData): boolean {
        try {
            const folderStat = fs.statSync(modInfo.location);
            const modJsonPath = path.join(modInfo.location, 'mod.json');
            const modJsonStat = fs.existsSync(modJsonPath) ? fs.statSync(modJsonPath) : null;
            if (!cache.sources[folder]) {
                cache.sources[folder] = {};
            }
            cache.sources[folder][folderName] = modInfo.toCacheEntry(
                folderStat.mtimeMs,
                modJsonStat ? modJsonStat.mtimeMs : 0,
                modJsonStat ? modJsonStat.size : 0,
                modData.preview || ''
            );
            return true;
        } catch (e) {
            console.warn(`ModLoader.updateCacheEntry: cannot stat mod, skipping cache entry`, modInfo.location, e);
            return false;
        }
    }

    // 删除 mod 元数据缓存。下一次 loadMods() 会完整扫描一遍。
    public static clearCache(): boolean {
        return ModCache.clear();
    }

    static async loadMod(modPath: string) {
        if (modPath === undefined || modPath === null || modPath === '') {
            throw new Error('ModLoader.loadMod: modPath is empty');
        }
        if (!fs.existsSync(modPath)) {
            throw new Error(`ModLoader.loadMod: modPath does not exist: ${modPath}`);
        }
        // check一下是否是文件夹
        if (!fs.statSync(modPath).isDirectory()) {
            throw new Error(`ModLoader.loadMod: modPath is not a directory: ${modPath}`);
        }
        let modInfo = new ModInfo(modPath);
        this.modsRaw.push(modInfo);
        this.addToIdIndex(modInfo);
        const folder = path.dirname(modPath);
        let modData = ModData.fromModInfo(modInfo).setModSourcePath(folder);
        this.mods.push(modData);
        // 单个 mod 加载（比如刚导入的 mod）也要记进缓存，
        // 不然下次启动还得重新扫它。
        // HP6: load() now returns the in-memory cache (no disk re-read)
        // and save() only marks it dirty — importing many mods in a row
        // no longer rewrites the whole cache file per mod.
        const cache = ModCache.load(ModInfo.ifKeepModNameAsModFolderName);
        if (this.updateCacheEntry(cache, folder, path.basename(modPath), modInfo, modData)) {
            ModCache.save(cache);
        }
        return {
            modInfo: modInfo,
            modData: modData
        };
    }

    // Index one mod by id. First mod wins for a duplicated id, matching
    // the old .find() behavior of getModByID.
    private static addToIdIndex(modInfo: ModInfo): void {
        if (modInfo.id && !this.modsById.has(modInfo.id)) {
            this.modsById.set(modInfo.id, modInfo);
        }
    }

    public static getModByID(id: string): ModInfo | undefined {
        return this.modsById.get(id);
    }
}

// TC12: 1 bộ nghe windowSleep chung cho mọi mod — thay cho mỗi-ModData-1-bộ-nghe
// (trước đây đăng ký rồi không bao giờ hủy, rò rỉ theo mỗi lần tải lại).
// Chỉ duyệt danh sách mod đang sống nên ModData cũ không bị giữ lại.
EventSystem.on(EventType.windowSleep, () => {
    for (const mod of ModLoader.mods) {
        mod.clearPreviewCache();
    }
});

// 测试一下
// ModLoader.addModSourceFolder("D:\\GameResource\\WWMI\\ModSource");
// ModLoader.loadMods();

export default ModLoader;