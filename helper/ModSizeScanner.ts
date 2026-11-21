// Quét dung lượng thư mục mod ở chế độ nền.
//
// Mỗi mod là 1 thư mục (vài file tới vài GB). Cộng dồn dung lượng mọi
// file phải đọc đĩa nên KHÔNG làm lúc tải danh sách (làm chậm mở app):
// lần đầu mở app thì danh sách hiện trước, quét chạy nền sau, thẻ nào
// quét xong thì hiện số ngay thẻ đó (sự kiện modSizeReady).
// Số đã quét được nhớ vào bộ nhớ sẵn (mod-cache.json, cùng chỗ với các
// thông tin mod khác) nên lần sau mở app là có ngay, không quét lại.
// Thư mục đổi (thêm/bớt file) thì giờ sửa thư mục đổi theo, mục nhớ cũ
// hết hiệu lực, quét lại từ đầu — số không bao giờ cũ.
import ModCache from '../core/ModCache';
import type { ModData } from '../core/ModHelper';
import { EventSystem, EventType } from './EventSystem';

const fs = require('fs');
const path = require('path');

// Quét tối đa từng này thư mục cùng lúc — đủ nhanh mà không làm đĩa
// quay cuồng khi kho có vài trăm mod.
const SCAN_CONCURRENCY = 4;

// Dung lượng 1 thư mục (byte), cộng dồn mọi file kể cả thư mục con.
// Dùng lstat (không đi theo liên kết) để liên kết vòng không làm quét
// lặp vô tận. Lỗi (thư mục mất giữa chừng...) thì trả -1 = chưa rõ.
export async function folderSizeBytes(dir: string): Promise<number> {
    let total = 0;
    let entries;
    try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
        return -1;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        try {
            if (entry.isDirectory()) {
                const sub = await folderSizeBytes(full);
                if (sub < 0) return -1;
                total += sub;
            } else {
                total += (await fs.promises.lstat(full)).size;
            }
        } catch {
            return -1;
        }
    }
    return total;
}

// Số byte -> chữ hiển thị: "2 GB", "2.5 MB", "48 KB", "900 B".
// GB/MB lấy 1 số lẻ, bỏ ".0" thừa ("2.0 GB" thành "2 GB").
export function formatModSize(bytes: number): string {
    if (bytes === undefined || bytes === null || bytes < 0) return '';
    const GB = 1024 * 1024 * 1024;
    const MB = 1024 * 1024;
    const KB = 1024;
    const oneDecimal = (v: number) => {
        const s = v.toFixed(1);
        return s.endsWith('.0') ? s.slice(0, -2) : s;
    };
    if (bytes >= GB) return `${oneDecimal(bytes / GB)} GB`;
    if (bytes >= MB) return `${oneDecimal(bytes / MB)} MB`;
    if (bytes >= KB) return `${Math.round(bytes / KB)} KB`;
    return `${bytes} B`;
}

// Quét nền cho các mod chưa có dung lượng (sizeBytes < 0). Không chờ:
// gọi xong trả ngay, từng mod xong thì bắn sự kiện modSizeReady.
// Đang quét mà gọi thêm thì mod mới xếp hàng, quét xong đợt này thì
// quét tiếp đợt sau (không quét chồng 2 đợt).
let scanning = false;
let queued: ModData[] = [];
const queuedIds = new Set<string>();

export async function scanMissing(mods: ModData[]): Promise<void> {
    const missing = mods.filter(m => m && m.sizeBytes < 0 && !queuedIds.has(m.id));
    if (missing.length === 0) return;
    for (const m of missing) {
        queued.push(m);
        queuedIds.add(m.id);
    }
    if (scanning) return;
    scanning = true;
    try {
        while (queued.length > 0) {
            const batch = queued.splice(0, queued.length);
            for (const m of batch) queuedIds.delete(m.id);
            // Quét từng nhóm nhỏ, mỗi nhóm tối đa SCAN_CONCURRENCY mod
            // cùng lúc; xong nhóm thì nhường luồng hiển thị 1 nhịp.
            for (let i = 0; i < batch.length; i += SCAN_CONCURRENCY) {
                const chunk = batch.slice(i, i + SCAN_CONCURRENCY);
                await Promise.all(chunk.map(scanOne));
                await new Promise(r => setTimeout(r, 0));
            }
        }
    } finally {
        scanning = false;
    }
}

async function scanOne(mod: ModData): Promise<void> {
    let modPath = '';
    try {
        modPath = mod.getModPathSync();
    } catch {
        return;
    }
    if (!modPath) return;
    const size = await folderSizeBytes(modPath);
    if (size < 0) return;
    mod.sizeBytes = size;
    // Nhớ vào bộ nhớ sẵn để lần sau khỏi quét lại (ghi dồn, không chặn).
    try {
        const cache = ModCache.load();
        const source = cache.sources[path.dirname(modPath)];
        const entry = source ? source[path.basename(modPath)] : undefined;
        if (entry) {
            entry.sizeBytes = size;
            ModCache.save(cache);
        }
    } catch {
        // Nhớ không được thì thôi — lần sau quét lại, app vẫn chạy.
    }
    try {
        EventSystem.trigger(EventType.modSizeReady, mod);
    } catch {
        // Thẻ nghe sự kiện lỗi thì không được làm hỏng quét.
    }
}

const ModSizeScanner = { scanMissing, folderSizeBytes, formatModSize };
export default ModSizeScanner;
