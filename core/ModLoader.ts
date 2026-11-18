// 用于加载 Mod，将其转换为 ModInfo 对象
import { ModData } from './ModHelper';
import { ModInfo } from './ModInfo';
import ModCache from './ModCache';
import type { ModCacheFile } from './ModCache';

const fs = require('fs');
const path = require('path');

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
        await Promise.all(this.modSourceFolders.map(async folder => {
            let mods = await fs.promises.readdir(folder, { withFileTypes: true });
            const seenFolders = new Set<string>();
            await Promise.all(mods.map(async mod => {
                if (mod.isDirectory()) {
                    let modPath = path.join(folder, mod.name);
                    seenFolders.add(mod.name);
                    const entry = cache.sources[folder] ? cache.sources[folder][mod.name] : undefined;
                    if (entry && await ModCache.isEntryValid(entry)) {
                        // 文件夹和 mod.json 都没动过：直接用缓存，不读盘。
                        let modInfo = ModInfo.fromCache(modPath, entry);
                        this.modsRaw.push(modInfo);
                        this.mods.push(ModData.fromCache(modInfo, entry).setModSourcePath(folder));
                        cachedCount++;
                        return;
                    }
                    // 新 mod，或者改过：完整加载一次，然后记进缓存。
                    let modInfo = new ModInfo(modPath);
                    this.modsRaw.push(modInfo);
                    let modData = ModData.fromModInfo(modInfo).setModSourcePath(folder);
                    this.mods.push(modData);
                    freshCount++;
                    if (this.updateCacheEntry(cache, folder, mod.name, modInfo, modData)) {
                        cacheDirty = true;
                    }
                }
            }
            ));
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
        const folder = path.dirname(modPath);
        let modData = ModData.fromModInfo(modInfo).setModSourcePath(folder);
        this.mods.push(modData);
        // 单个 mod 加载（比如刚导入的 mod）也要记进缓存，
        // 不然下次启动还得重新扫它。
        const cache = ModCache.load(ModInfo.ifKeepModNameAsModFolderName);
        if (this.updateCacheEntry(cache, folder, path.basename(modPath), modInfo, modData)) {
            ModCache.save(cache);
        }
        return {
            modInfo: modInfo,
            modData: modData
        };
    }

    public static getModByID(id: string): ModInfo | undefined {
        return this.modsRaw.find(mod => mod.id === id);
    }
}

// 测试一下
// ModLoader.addModSourceFolder("D:\\GameResource\\WWMI\\ModSource");
// ModLoader.loadMods();

export default ModLoader;