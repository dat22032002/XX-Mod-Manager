// Phát hiện 2 mod đang bật cùng thay 1 thứ của game, để cảnh báo trước khi
// bấm Apply.
//
// Mỗi mod thay đồ/vũ khí/hiệu ứng bằng cách ghi đè 1 "mã" (hash) của game
// trong file .ini của nó: dòng `hash = ...` nằm trong mục
// [TextureOverride...] (hình) hoặc [ShaderOverride...] (bộ tô). Hai mod
// cùng ghi đè 1 mã = chúng giành nhau 1 thứ — game chỉ lấy 1 cái, cái kia
// lặng lẽ mất tác dụng.
//
// So sánh MÃ, không so sánh tên mục: 2 mod khác nhau có thể đặt tên mục
// khác nhau cho cùng 1 mã (so tên sẽ bỏ sót), hoặc trùng tên mục cho 2 mã
// khác nhau (so tên sẽ báo nhầm).
//
// Không tính là đụng (v1): [Constants] (biến riêng của từng mod, trùng tên
// mục là bình thường), [Key...] (phím tắt trùng là chuyện khác),
// [Resource...] (chưa xét).
const fs = require('fs');
const path = require('path');
import type { ModData } from '../core/ModHelper';

export interface ModConflict {
    hash: string;
    type: 'texture' | 'shader';
    modA: ModData;
    modB: ModData;
}

// Tìm mọi file .ini trong thư mục mod (đào cả thư mục con), bỏ qua
// desktop.ini và file tên bắt đầu bằng DISABLED — cùng quy ước với plugin
// recognizeModInfoPlugin.
function findIniFiles(folderPath: string, out: string[] = []): string[] {
    let entries: string[];
    try {
        entries = fs.readdirSync(folderPath);
    } catch {
        return out;
    }
    for (const file of entries) {
        const filePath = path.join(folderPath, file);
        let stat;
        try {
            stat = fs.statSync(filePath);
        } catch {
            continue;
        }
        if (stat.isDirectory()) {
            findIniFiles(filePath, out);
        } else if (file.endsWith('.ini') && file !== 'desktop.ini' && !file.toLowerCase().startsWith('disabled')) {
            out.push(filePath);
        }
    }
    return out;
}

// Các mã (hash) mà 1 mod ghi đè, đọc từ file .ini của nó. Mã chuẩn hóa về
// chữ thường, bỏ tiền tố 0x và chú thích sau dấu ';' để 2 cách viết cùng
// 1 mã vẫn khớp nhau.
export function extractModHashes(modPath: string): { hash: string; type: 'texture' | 'shader' }[] {
    const found = new Map<string, 'texture' | 'shader'>();
    for (const iniPath of findIniFiles(modPath)) {
        let text: string;
        try {
            text = fs.readFileSync(iniPath, 'utf-8');
        } catch {
            continue;
        }
        let currentType: 'texture' | 'shader' | null = null;
        for (const rawLine of text.split('\n')) {
            // Chú thích trong .ini bắt đầu bằng ';' — cắt trước khi đọc.
            const line = rawLine.split(';')[0].trim();
            if (line.startsWith('[') && line.endsWith(']')) {
                const section = line.slice(1, -1).trim().toLowerCase();
                if (section.startsWith('textureoverride')) currentType = 'texture';
                else if (section.startsWith('shaderoverride')) currentType = 'shader';
                else currentType = null;
                continue;
            }
            if (!currentType) continue;
            const m = line.match(/^hash\s*=\s*(.+)$/i);
            if (m) {
                const hash = m[1].trim().toLowerCase().replace(/^0x/, '');
                if (hash) found.set(`${currentType}:${hash}`, currentType);
            }
        }
    }
    return [...found.entries()].map(([key, type]) => ({ hash: key.split(':')[1], type }));
}

// Quét các mod đang bật, trả về từng cặp đụng nhau. Mod không có file .ini
// hoặc đọc lỗi thì bỏ qua lặng (không chặn Apply vì kiểm tra lỗi).
export async function checkConflicts(mods: ModData[]): Promise<ModConflict[]> {
    const seen = new Map<string, { mod: ModData; type: 'texture' | 'shader' }>();
    const conflicts: ModConflict[] = [];
    for (const mod of mods) {
        let modPath: string;
        try {
            modPath = await mod.getModPath();
        } catch {
            continue;
        }
        if (!modPath) continue;
        for (const { hash, type } of extractModHashes(modPath)) {
            const key = `${type}:${hash}`;
            const prev = seen.get(key);
            if (prev && prev.mod.id !== mod.id) {
                conflicts.push({ hash, type, modA: prev.mod, modB: mod });
            } else if (!prev) {
                seen.set(key, { mod, type });
            }
        }
    }
    return conflicts;
}
