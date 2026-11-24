// 用于加载 Mod，将其转换为 ModInfo 对象
import { ModData } from './ModHelper';
import { ModInfo } from './ModInfo';
import ModCache from './ModCache';
import type { ModCacheFile } from './ModCache';
import { EventSystem, EventType } from '../helper/EventSystem';
import ModSizeScanner from '../helper/ModSizeScanner';

const fs = require('fs');
const path = require('path');

// How many mods to build before yielding to the UI thread, so a fresh
// scan (first launch / Rescan) does not freeze the window. Same pattern
// and chunk size as ApplyMods.ts.
const LOAD_CHUNK_SIZE = 10;

// Let the UI thread breathe between chunks — 16ms (1 frame) so the
// browser actually PAINTS between chunks: with 0ms the load-progress
// text only sits in the DOM and the eye never sees it (same lesson as
// the Fixer progress, 1.5.25-test8).
//
// Adaptive (Dat 24/11): pause only when enough time passed since the
// last pause. A fresh-scan chunk takes 20-40ms of real work, so it
// still pauses after every chunk (same as before). A cached chunk
// takes ~2-3ms, so several chunks batch into one pause — the old fixed
// pause wasted ~16ms per 10 cached mods (~800ms on a 500-mod library).
// The progress text still paints: it updates before the pause, and
// pauses land at least every ~16ms of work.
let lastYieldAt = 0;
async function yieldToUI() {
    const now = Date.now();
    if (now - lastYieldAt < 16) return;
    await new Promise(resolve => setTimeout(resolve, 16));
    lastYieldAt = Date.now();
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
    // Chốt chống tải chồng (1.5.29): lần tải đang chạy thì lần gọi sau
    // nhận chung cùng 1 promise, không chạy thêm lần tải thứ hai. Trước
    // đây 2 lần tải chồng nhau sẽ cùng ghi vào modsRaw/mods — lần sau
    // xóa mảng trong lúc lần trước đang đẩy mod vào → danh sách thiếu
    // hoặc nhân đôi mod. Ngoại lệ nhỏ: quét lại ép buộc (forceRescan)
    // gọi lúc đang tải thì cũng nhận kết quả của lần tải đang chạy —
    // bấm Làm Mới thêm lần nữa sau khi tải xong là quét lại thật.
    private static loadInFlight: Promise<ModData[]> | null = null;

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

    static loadMods(forceRescan: boolean = false): Promise<ModData[]> {
        if (!this.loadInFlight) {
            this.loadInFlight = this.doLoadMods(forceRescan).finally(() => {
                this.loadInFlight = null;
            });
        }
        return this.loadInFlight;
    }

    private static async doLoadMods(forceRescan: boolean = false) {
        let startTime = Date.now();
        // Nhịp nghỉ linh hoạt: lần tải này bắt đầu với "chưa từng nghỉ"
        // nên khối đầu luôn nghỉ (dòng tiến độ vẽ ngay từ đầu).
        lastYieldAt = 0;

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
        const cache = forceRescan ? ModCache.fresh() : ModCache.load();
        let cacheDirty = forceRescan;
        let cachedCount = 0;
        let freshCount = 0;

        // Tiến độ tải (1.5.26): báo ra ngoài sau mỗi lần đọc xong 1 thư
        // mục mod + sau mỗi khối 10 mod để giao diện hiện "Đang tải mod
        // X/Y..." ngay chỗ thanh tiến độ lúc Apply. Tổng số tăng dần
        // theo từng thư mục đọc xong (thường chỉ có 1 thư mục mod).
        const loadProgress = { done: 0, total: 0 };
        const reportLoadProgress = () => {
            EventSystem.trigger(EventType.loadModsProgress, { done: loadProgress.done, total: loadProgress.total });
        };

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
            // Thư mục tạm .gb-tmp-* của lần cập nhật Banana dở dang (sập
            // giữa chừng) cũng không phải mod — loại luôn để không hiện
            // thành mod ma trong lưới (dọn đĩa do gbCleanStaleTempDirs lo).
            const modDirs = mods.filter(mod => mod.isDirectory() && mod.name.toLowerCase() !== 'recyclebin' && !mod.name.startsWith('.gb-tmp-'));
            // Đọc xong 1 thư mục thì biết thêm tổng số mod — báo ngay để
            // giao diện hiện tiến độ từ mod 0 (không đợi hết khối đầu).
            loadProgress.total += modDirs.length;
            reportLoadProgress();
            for (let i = 0; i < modDirs.length; i += LOAD_CHUNK_SIZE) {
                const chunk = modDirs.slice(i, i + LOAD_CHUNK_SIZE);
                // Validity checks are async disk stats: run them together.
                const validity = await Promise.all(chunk.map(async mod => {
                    const entry = cache.sources[folder] ? cache.sources[folder][mod.name] : undefined;
                    const checked = entry ? await ModCache.validateEntry(entry) : { valid: false, birthtimeMs: 0 };
                    return {
                        mod: mod,
                        entry: entry,
                        valid: checked.valid,
                        birthtimeMs: checked.birthtimeMs,
                    };
                }));
                for (const { mod, entry, valid, birthtimeMs } of validity) {
                    let modPath = path.join(folder, mod.name);
                    seenFolders.add(mod.name);
                    if (valid && entry) {
                        // 文件夹和 mod.json 都没动过：直接用缓存，不读盘。
                        let modInfo = ModInfo.fromCache(modPath, entry);
                        this.modsRaw.push(modInfo);
                        this.addToIdIndex(modInfo);
                        const modData = ModData.fromCache(modInfo, entry).setModSourcePath(folder);
                        // Giờ tạo thư mục lấy lúc kiểm tra cache ở trên —
                        // ghi đè giá trị dự phòng (giờ sửa) trong fromCache.
                        modData.addedMs = birthtimeMs || entry.folderMtimeMs || 0;
                        this.mods.push(modData);
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
                // Hết 1 khối thì báo tiến độ TRƯỚC khi nhường luồng —
                // giao diện cập nhật chữ rồi khung hình 16ms sau mới vẽ.
                loadProgress.done += chunk.length;
                reportLoadProgress();
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
        }).finally(() => {
            // Tải xong (kể cả khi lỗi giữa chừng — vd ổ đĩa lỗi lúc quét):
            // báo trạng thái cuối để giao diện tắt dòng tiến độ, không
            // kẹt lại dòng "Đang tải mod X/Y..." trên thanh dưới. Lỗi
            // (nếu có) vẫn lan ra như cũ — finally không nuốt lỗi.
            loadProgress.done = loadProgress.total;
            reportLoadProgress();
        });

        if (cacheDirty) {
            ModCache.save(cache);
        }

        // 触发回调函数
        this.triggerAfterLoadCallbacks();

        // Quét dung lượng nền cho mod chưa có số (không chờ — app vẫn
        // dùng bình thường, thẻ tự hiện số khi quét xong từng mod).
        ModSizeScanner.scanMissing(this.mods);

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
            // Giờ tạo thư mục vừa đo được ở trên — ghi luôn vào ModData để
            // sắp xếp theo thời gian thêm mod (không cần đo thêm lần nữa);
            // hệ thống file không có giờ tạo thì dùng giờ sửa cuối.
            modData.addedMs = folderStat.birthtimeMs || folderStat.mtimeMs;
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
        const cache = ModCache.load();
        if (this.updateCacheEntry(cache, folder, path.basename(modPath), modInfo, modData)) {
            ModCache.save(cache);
        }
        // Mod mới nhập chưa có dung lượng — quét nền riêng nó.
        ModSizeScanner.scanMissing([modData]);
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

    // Gỡ 1 mod khỏi danh sách gốc theo tên thư mục (khi xóa/hủy mod mà
    // không tải lại toàn bộ — vd discardNewMod): dọn cả modsRaw lẫn bảng
    // tra theo id, không thì mục ma còn lại làm các đường dùng modsRaw
    // (kiểm tra bản mới Banana, Apply) tưởng mod vẫn còn. Trùng id thì
    // mục còn lại thế chỗ trong bảng tra (theo luật "mục đầu thắng" của
    // addToIdIndex).
    public static removeModByFolder(folderName: string): void {
        const removed = this.modsRaw.find((m) => m.modName === folderName);
        if (!removed) return;
        this.modsRaw = this.modsRaw.filter((m) => m !== removed);
        if (removed.id && this.modsById.get(removed.id) === removed) {
            this.modsById.delete(removed.id);
            const next = this.modsRaw.find((m) => m.id === removed.id);
            if (next) this.modsById.set(next.id, next);
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