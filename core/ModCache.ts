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
import XXMMCore from './XXMMCore';

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
    keepModNameAsFolder: boolean;
    // source folder path -> mod folder name -> cached entry
    sources: Record<string, Record<string, CachedModEntry>>;
}

const CACHE_VERSION = 1;
const CACHE_FILE_NAME = 'mod-cache.json';

class ModCache {
    private static cacheFilePathCache: string | null | undefined = undefined;

    public static fresh(keepModNameAsFolder: boolean = false): ModCacheFile {
        return {
            version: CACHE_VERSION,
            keepModNameAsFolder: keepModNameAsFolder,
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

    public static load(keepModNameAsFolder: boolean): ModCacheFile {
        const cachePath = this.getCacheFilePath();
        const fresh = this.fresh(keepModNameAsFolder);
        if (!cachePath) {
            return fresh;
        }
        try {
            if (!fs.existsSync(cachePath)) {
                return fresh;
            }
            const raw = fs.readFileSync(cachePath, 'utf8');
            const parsed = JSON.parse(raw);
            // Any shape problem -> ignore the cache, full scan (self-healing).
            if (!parsed || parsed.version !== CACHE_VERSION || typeof parsed.sources !== 'object') {
                console.warn('ModCache: cache file outdated or corrupt, ignoring it');
                return fresh;
            }
            // The "keep mod name = folder name" setting changes resolved names,
            // so a cache written under the other setting is not reusable.
            if (parsed.keepModNameAsFolder !== keepModNameAsFolder) {
                console.log('ModCache: ifKeepModNameAsModFolderName changed, ignoring cache');
                return fresh;
            }
            return parsed as ModCacheFile;
        } catch (e) {
            console.warn('ModCache: failed to read cache file, ignoring it', e);
            return fresh;
        }
    }

    public static save(cache: ModCacheFile): void {
        const cachePath = this.getCacheFilePath();
        if (!cachePath) {
            return;
        }
        try {
            fs.writeFileSync(cachePath, JSON.stringify(cache), 'utf8');
        } catch (e) {
            // A failed cache write must not break the app; next launch
            // simply scans again.
            console.warn('ModCache: failed to write cache file', e);
        }
    }

    // Delete the cache file. The next load is a full scan.
    // Returns true when no cache file remains afterwards.
    public static clear(): boolean {
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
        try {
            const folderStat = await fs.promises.stat(entry.location);
            if (!folderStat.isDirectory()) {
                return false;
            }
            if (folderStat.mtimeMs !== entry.folderMtimeMs) {
                return false;
            }
            const modJsonStat = await fs.promises.stat(path.join(entry.location, 'mod.json'));
            return modJsonStat.mtimeMs === entry.modJsonMtimeMs
                && modJsonStat.size === entry.modJsonSize;
        } catch {
            return false;
        }
    }
}

export default ModCache;
