// Mod metadata cache ("nhớ sẵn").
//
// First launch scans every mod folder and remembers a summary here:
// <userData>/mod-cache.json (same folder as the app config).
// Later launches only re-read mods that actually changed:
//   - a folder that is new      -> full load, added to the cache
//   - a folder that is gone      -> dropped from the cache
//   - mod.json edited (mtime/size changed) or files added/removed
//     inside the folder (folder mtime changed) -> full load, cache updated
//   - everything else            -> rebuilt from the cache, no disk reads
//
// The cache must never break launch: any failure (missing/corrupt file,
// unreadable folder, no userData path) degrades to a full scan.
//
// Performance (HP6/HP20): the cache file is read from disk at most once
// per session. After the first load it lives in memory: load() returns the
// shared in-memory copy (so importing many mods no longer re-reads and
// re-writes the whole file per mod), and save() only marks it dirty and
// schedules one debounced asynchronous write. Writes are serialized
// through a promise chain, so a later save can never be overwritten by
// an earlier one still in flight. A pending write is flushed when the
// window goes to sleep; if the app is killed before the write lands,
// the next launch simply scans again — the cache is a pure optimization.
import XXMMCore from './XXMMCore';
import { EventSystem, EventType } from '../helper/EventSystem';
import { writeFileAtomic } from '../helper/SafeWrite';
import { isValidTag } from '../helper/ModTag';

const fs = require('fs');
const path = require('path');

export interface CachedModEntry {
    location: string;
    folderMtimeMs: number;
    modJsonMtimeMs: number;
    modJsonSize: number;
    id: string;
    modName: string;
    // Template metadata values (author, character, url, tags, category,
    // description, hotkeys, preview name) — same shape as mod.json.
    meta: Record<string, any>;
    // Resolved absolute preview image path (or the default image path).
    previewPath: string;
}

export interface ModCacheFile {
    version: number;
    // source folder path -> mod folder name -> cached entry
    sources: Record<string, Record<string, CachedModEntry>>;
}

const CACHE_VERSION = 1;
const CACHE_FILE_NAME = 'mod-cache.json';

class ModCache {
    private static cacheFilePathCache: string | null | undefined = undefined;

    // In-memory copy of the cache file (HP6): read once per session,
    // then load() returns this object and save() only marks it dirty.
    private static memoryCache: ModCacheFile | null = null;
    // True when memoryCache has changes not yet written to disk.
    private static dirty: boolean = false;
    // Timer for the debounced write (HP20). Null when none is pending.
    private static saveTimer: ReturnType<typeof setTimeout> | null = null;
    // Serializes disk writes so they can never overlap or reorder.
    private static writeChain: Promise<void> = Promise.resolve();
    // Bumped by clear(): a write scheduled before the clear must not
    // recreate the file after it was deleted.
    private static writeEpoch: number = 0;

    public static fresh(): ModCacheFile {
        return {
            version: CACHE_VERSION,
            sources: {},
        };
    }

    public static getCacheFilePath(): string | null {
        if (this.cacheFilePathCache !== undefined) {
            return this.cacheFilePathCache;
        }
        try {
            const dataPath = XXMMCore.getDataPathSync();
            this.cacheFilePathCache = dataPath ? path.join(dataPath, CACHE_FILE_NAME) : null;
        } catch (e) {
            console.warn('ModCache: cannot resolve user data path, cache disabled', e);
            this.cacheFilePathCache = null;
        }
        return this.cacheFilePathCache;
    }

    // Returns the in-memory cache when one is already loaded (no disk
    // read); otherwise reads the file once and keeps it. The returned
    // object is the shared live copy: callers may mutate it (ModLoader
    // does) and then call save() to persist it.
    public static load(): ModCacheFile {
        if (this.memoryCache) {
            return this.memoryCache;
        }
        const cachePath = this.getCacheFilePath();
        const fresh = this.fresh();
        if (!cachePath) {
            this.memoryCache = fresh;
            return fresh;
        }
        try {
            if (!fs.existsSync(cachePath)) {
                this.memoryCache = fresh;
                return fresh;
            }
            const raw = fs.readFileSync(cachePath, 'utf8');
            const parsed = JSON.parse(raw);
            // Any shape problem -> ignore the cache, full scan (self-healing).
            if (!parsed || parsed.version !== CACHE_VERSION || typeof parsed.sources !== 'object') {
                console.warn('ModCache: cache file outdated or corrupt, ignoring it');
                this.memoryCache = fresh;
                return fresh;
            }
            // File cache cũ có thể còn khóa keepModNameAsFolder (cài đặt đã
            // bỏ) — cứ dùng bình thường: tên mod luôn lấy từ tên thư mục
            // lúc tải (ModInfo.fromCache), tên lệch trong mục cache không
            // còn tác dụng.
            this.memoryCache = parsed as ModCacheFile;
            return this.memoryCache;
        } catch (e) {
            console.warn('ModCache: failed to read cache file, ignoring it', e);
            this.memoryCache = fresh;
            return fresh;
        }
    }

    // Mark the cache dirty and schedule one debounced asynchronous write
    // (HP20). Never blocks the UI thread. The JSON is serialized when the
    // write fires, so rapid successive saves collapse into a single write
    // of the latest state.
    public static save(cache: ModCacheFile): void {
        this.memoryCache = cache;
        this.dirty = true;
        this.scheduleSave();
    }

    private static scheduleSave(): void {
        if (this.saveTimer !== null) {
            return;
        }
        this.saveTimer = setTimeout(() => {
            this.saveTimer = null;
            this.flushWrite();
        }, 300);
    }

    // Write the pending changes now instead of waiting for the debounce.
    // Safe to call when nothing is pending.
    public static flush(): void {
        if (this.saveTimer !== null) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        this.flushWrite();
    }

    private static flushWrite(): void {
        if (!this.dirty || !this.memoryCache) {
            return;
        }
        const cachePath = this.getCacheFilePath();
        if (!cachePath) {
            return;
        }
        // Serialize now; the write itself is async and chained, so two
        // saves can never interleave on disk.
        const snapshot = JSON.stringify(this.memoryCache);
        const epoch = this.writeEpoch;
        this.dirty = false;
        this.writeChain = this.writeChain.then(() => {
            // The cache was cleared after this write was scheduled:
            // do not recreate the deleted file.
            if (epoch !== this.writeEpoch) {
                return;
            }
            // TC5: ghi cache qua file tạm rồi đổi tên (bản bất đồng bộ,
            // vẫn nối đuôi nhau qua writeChain như trước).
            return writeFileAtomic(cachePath, snapshot, 'utf8');
        }).catch((e) => {
            // A failed cache write must not break the app; next launch
            // simply scans again.
            console.warn('ModCache: failed to write cache file', e);
        });
    }

    // Delete the cache file. The next load is a full scan.
    // Returns true when no cache file remains afterwards.
    public static clear(): boolean {
        // Drop the in-memory copy and cancel any pending write first,
        // or a scheduled write could recreate the file right after this.
        this.memoryCache = null;
        this.dirty = false;
        this.writeEpoch++;
        if (this.saveTimer !== null) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        const cachePath = this.getCacheFilePath();
        if (!cachePath) {
            return false;
        }
        try {
            if (fs.existsSync(cachePath)) {
                fs.unlinkSync(cachePath);
            }
            return true;
        } catch (e) {
            console.warn('ModCache: failed to delete cache file', e);
            return false;
        }
    }

    // A cached entry is still valid when the mod folder and its mod.json
    // are untouched since the entry was written. Any doubt -> invalid.
    public static async isEntryValid(entry: CachedModEntry): Promise<boolean> {
        return (await this.validateEntry(entry)).valid;
    }

    // Kiểm tra cache còn đúng không. Trả kèm giờ tạo thư mục (birthtime)
    // lấy từ lần đo đã làm ở đây — dùng để sắp xếp theo thời gian thêm
    // mod, không tốn thêm lần đọc đĩa nào. birthtimeMs = 0 khi không đo được.
    public static async validateEntry(entry: CachedModEntry): Promise<{ valid: boolean; birthtimeMs: number }> {
        // Bản nhớ từ trước khi có tag (không có tag hợp lệ): coi như cũ,
        // quét mới để đoán tag theo tiền tố rồi ghi vào mod.json.
        if (!entry.meta || !isValidTag(entry.meta.tag)) {
            return { valid: false, birthtimeMs: 0 };
        }
        try {
            const folderStat = await fs.promises.stat(entry.location);
            const birthtimeMs = folderStat.birthtimeMs || 0;
            if (!folderStat.isDirectory()) {
                return { valid: false, birthtimeMs };
            }
            if (folderStat.mtimeMs !== entry.folderMtimeMs) {
                return { valid: false, birthtimeMs };
            }
            const modJsonStat = await fs.promises.stat(path.join(entry.location, 'mod.json'));
            return {
                valid: modJsonStat.mtimeMs === entry.modJsonMtimeMs
                    && modJsonStat.size === entry.modJsonSize,
                birthtimeMs,
            };
        } catch {
            return { valid: false, birthtimeMs: 0 };
        }
    }
}

// When the window goes to sleep, write out any pending cache changes
// instead of waiting for the debounce — the app may be closed while asleep.
EventSystem.on(EventType.windowSleep, async () => {
    ModCache.flush();
});

export default ModCache;
