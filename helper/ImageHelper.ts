import { EventSystem,EventType } from './EventSystem';
import ModCache from '../core/ModCache';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Cover thumbnails (HP2).
//
// The old code read every full-size cover into RAM (several MB each) and
// kept a blob URL for it for the whole session, so scrolling through a few
// hundred mods loaded every cover at full size and never reclaimed it.
// Now the first load of a cover generates a small thumbnail instead:
//
//   - 250px on the longest side, PNG, aspect preserved.
//   - Stored on disk under <userData>/thumb-cache/, named by a hash of the
//     source path + its mtime + size, so an edited cover regenerates.
//   - At most MAX_RAM_IMAGES blob URLs stay in RAM (LRU; evicted URLs are
//     revoked). The disk cache is pruned to MAX_DISK_THUMBS files.
//   - Generation is async with at most 4 images decoding at once, so
//     scrolling never blocks on it; concurrent requests for the same
//     image share one generation.
//   - ANY failure (unreadable file, undecodable image, no canvas, no
//     userData path, disk write error) falls back to the old behavior:
//     the full image is read and shown. The mod list never breaks
//     because of thumbnails.
//
// The public signature is unchanged: getImageUrlFromLocalPath still
// returns a Promise<string>, so no caller had to change.
const THUMB_MAX_DIM = 250;
const MAX_RAM_IMAGES = 150;
const MAX_DISK_THUMBS = 1000;
const PRUNE_TO_THUMBS = 800;
const THUMB_DIR_NAME = 'thumb-cache';
const MAX_CONCURRENT_GENERATIONS = 4;

const MIME_BY_EXT: { [ext: string]: string } = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
};

class ImageHelper {
    // Blob URLs by source image path. A Map (insertion-ordered) used as
    // an LRU: a hit moves the entry to the end, eviction drops the front.
    private static imageCache: Map<string, string> = new Map();
    // Generations already running, by source image path.
    private static pendingThumbs: Map<string, Promise<string>> = new Map();
    private static activeGenerations = 0;
    private static generationWaiters: Array<() => void> = [];
    // The disk cache is pruned at most once per session.
    private static pruneDone = false;

    public static async getImageUrlFromLocalPath(imagePath: string, ifCache: boolean = true) {
        if (ifCache) {
            const cached = this.imageCache.get(imagePath);
            if (cached) {
                // Refresh recency.
                this.imageCache.delete(imagePath);
                this.imageCache.set(imagePath, cached);
                return cached;
            }
        }
        // Thumbnails first; any failure falls back to the full image.
        try {
            const thumbUrl = await this.getThumbnailUrl(imagePath);
            if (thumbUrl) {
                this.storeInCache(imagePath, thumbUrl);
                return thumbUrl;
            }
        } catch (e) {
            console.warn(`ImageHelper: thumbnail failed for ${imagePath}, using full image`, e);
        }
        return this.getFullImageUrlFromLocalPath(imagePath);
    }

    // Full-size image URL (for the edit dialog / detail panel, which show
    // the cover larger than a card): the old behavior, still LRU-capped
    // in RAM. Cards use thumbnails; these views keep full quality.
    public static getFullImageUrlFromLocalPath(imagePath: string) {
        const bufffer = fs.readFileSync(imagePath);
        const blob = new Blob([bufffer], {type: "image/png"});
        const tempUrl = URL.createObjectURL(blob);
        this.storeInCache(imagePath, tempUrl);
        return tempUrl;
    }

    private static storeInCache(imagePath: string, url: string) {
        // Refresh position if already present.
        this.imageCache.delete(imagePath);
        this.imageCache.set(imagePath, url);
        // Evict least-recently-used URLs past the cap, freeing RAM.
        while (this.imageCache.size > MAX_RAM_IMAGES) {
            const oldest = this.imageCache.keys().next().value;
            if (oldest === undefined) {
                break;
            }
            const oldestUrl = this.imageCache.get(oldest);
            this.imageCache.delete(oldest);
            if (oldestUrl) {
                try {
                    URL.revokeObjectURL(oldestUrl);
                } catch (e) {
                    // Already revoked or invalid: nothing to free.
                }
            }
        }
    }

    public static async clearImageCache() {
        // 清空 创建的临时url
        for (const url of this.imageCache.values()) {
            URL.revokeObjectURL(url);
        }
        this.imageCache.clear();
    }

    // Returns the blob URL of the thumbnail for imagePath, generating and
    // caching it on disk when needed. Returns null when no thumbnail
    // applies (image already small, no disk cache available, or the
    // environment cannot decode images) — the caller then uses the full
    // image. Throws only on unexpected errors; the caller falls back too.
    private static async getThumbnailUrl(imagePath: string): Promise<string | null> {
        const thumbDir = this.getThumbDir();
        if (!thumbDir) {
            return null;
        }
        if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
            return null;
        }
        // Share one generation between concurrent requests for the same image.
        const pending = this.pendingThumbs.get(imagePath);
        if (pending) {
            return pending;
        }
        const job = this.generateThumbnail(imagePath, thumbDir);
        this.pendingThumbs.set(imagePath, job);
        try {
            return await job;
        } finally {
            this.pendingThumbs.delete(imagePath);
        }
    }

    private static getThumbDir(): string | null {
        try {
            const cachePath = ModCache.getCacheFilePath();
            if (!cachePath) {
                return null;
            }
            return path.join(path.dirname(cachePath), THUMB_DIR_NAME);
        } catch (e) {
            return null;
        }
    }

    private static async generateThumbnail(imagePath: string, thumbDir: string): Promise<string | null> {
        const stat = await fs.promises.stat(imagePath);
        // The key covers path + content version: editing the cover (new
        // mtime/size) produces a new key, so stale thumbnails are never used.
        const key = crypto.createHash('md5')
            .update(`${imagePath}|${stat.mtimeMs}|${stat.size}`)
            .digest('hex');
        const thumbPath = path.join(thumbDir, `${key}.png`);
        try {
            const thumbBuffer = await fs.promises.readFile(thumbPath);
            return URL.createObjectURL(new Blob([thumbBuffer], { type: 'image/png' }));
        } catch (e) {
            // No cached thumbnail yet: generate one below.
        }

        await this.acquireGenerationSlot();
        try {
            const buffer = await fs.promises.readFile(imagePath);
            const ext = path.extname(imagePath).toLowerCase();
            const blob = new Blob([buffer], { type: MIME_BY_EXT[ext] || '' });
            let bitmap: ImageBitmap;
            try {
                bitmap = await createImageBitmap(blob);
            } catch (e) {
                // Undecodable image (corrupt, unsupported format): no thumbnail.
                return null;
            }
            try {
                if (bitmap.width <= THUMB_MAX_DIM && bitmap.height <= THUMB_MAX_DIM) {
                    // Already small: a thumbnail would not save anything.
                    return null;
                }
                const scale = THUMB_MAX_DIM / Math.max(bitmap.width, bitmap.height);
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(bitmap.width * scale));
                canvas.height = Math.max(1, Math.round(bitmap.height * scale));
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return null;
                }
                ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                const thumbBlob = await new Promise<Blob | null>((resolve) => {
                    canvas.toBlob((b) => resolve(b), 'image/png');
                });
                if (!thumbBlob) {
                    return null;
                }
                // Save to disk for the next launch. Best-effort: a failed
                // write must not stop the image from showing.
                try {
                    await fs.promises.mkdir(thumbDir, { recursive: true });
                    const arrayBuffer = await thumbBlob.arrayBuffer();
                    await fs.promises.writeFile(thumbPath, Buffer.from(arrayBuffer));
                    this.pruneDiskCache(thumbDir);
                } catch (e) {
                    console.warn(`ImageHelper: cannot write thumbnail ${thumbPath}`, e);
                }
                return URL.createObjectURL(thumbBlob);
            } finally {
                bitmap.close();
            }
        } finally {
            this.releaseGenerationSlot();
        }
    }

    private static async acquireGenerationSlot(): Promise<void> {
        if (this.activeGenerations < MAX_CONCURRENT_GENERATIONS) {
            this.activeGenerations++;
            return;
        }
        await new Promise<void>((resolve) => {
            this.generationWaiters.push(resolve);
        });
        this.activeGenerations++;
    }

    private static releaseGenerationSlot(): void {
        this.activeGenerations--;
        const next = this.generationWaiters.shift();
        if (next) {
            next();
        }
    }

    // Keep the disk cache bounded: once per session, if it holds more
    // than MAX_DISK_THUMBS files, delete the oldest until PRUNE_TO_THUMBS
    // remain. Fire-and-forget; errors are swallowed.
    private static pruneDiskCache(thumbDir: string): void {
        if (this.pruneDone) {
            return;
        }
        this.pruneDone = true;
        fs.promises.readdir(thumbDir).then(async (files) => {
            if (files.length <= MAX_DISK_THUMBS) {
                return;
            }
            const withTime = [];
            for (const file of files) {
                try {
                    const stat = await fs.promises.stat(path.join(thumbDir, file));
                    withTime.push({ file: file, mtimeMs: stat.mtimeMs });
                } catch (e) {
                    // Vanished meanwhile: skip it.
                }
            }
            withTime.sort((a, b) => a.mtimeMs - b.mtimeMs);
            const toDelete = withTime.slice(0, withTime.length - PRUNE_TO_THUMBS);
            for (const entry of toDelete) {
                try {
                    await fs.promises.unlink(path.join(thumbDir, entry.file));
                } catch (e) {
                    // Already gone: nothing to do.
                }
            }
        }).catch(() => {
            // Pruning is best-effort; never break image loading.
        });
    }
}

EventSystem.on(EventType.windowSleep, async() => {
    ImageHelper.clearImageCache();
}
);

export { ImageHelper };
