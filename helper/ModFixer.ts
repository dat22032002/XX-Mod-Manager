// Pure helpers cho tính năng Mod Fixer — không có I/O ở đây nên probe
// kiểm được mà không cần mạng. Mọi lần gọi mạng nằm trong IManager.
export const FIXER_REPO = 'Vonksdesu/ZZZ-Mod-Fixer';
export const FIXER_API_LATEST = `https://api.github.com/repos/${FIXER_REPO}/releases/latest`;
// Nhánh chứa mã nguồn + bảng mã mới nhất của Fixer (README ở main ghi
// rõ: từ nay chỉ cập nhật code ở nhánh gui-version).
export const FIXER_DATA_BRANCH = 'gui-version';
export const FIXER_RAW_BASE = `https://raw.githubusercontent.com/${FIXER_REPO}/${FIXER_DATA_BRANCH}`;
// Tác nhân trình duyệt gửi kèm mỗi lần hỏi GitHub.
export const FIXER_USER_AGENT = 'XX-Mod-Manager/1.5.25';
// File ghi trạng thái Fixer để lại kế bên mod sau khi sửa (xem
// zzz-mod-fixer.py: FIXER_STATE_NAME) — có file này trong bản chép tạm
// nghĩa là Fixer đã đụng vào mod đó.
export const FIXER_STATE_FILE = '.zzz-fixer-state.json';

export interface FixerAsset {
    name: string;
    size: number;
    downloadUrl: string;
}

export interface FixerRelease {
    tag: string;
    name: string;
    publishedAt: string;
    asset: FixerAsset | null;
}

// Chọn file .exe trong 1 release của Fixer — mỗi release chỉ có 1 file
// .exe (vd zzz-mod-fixer-v3.3.exe); nếu có nhiều thì lấy file lớn nhất.
// Không có file .exe thì null.
export function pickFixerExeAsset(release: any): FixerAsset | null {
    const assets = release && Array.isArray(release.assets) ? release.assets : [];
    let best: FixerAsset | null = null;
    for (const raw of assets) {
        const name = typeof raw?.name === 'string' ? raw.name : '';
        const downloadUrl = typeof raw?.browser_download_url === 'string' ? raw.browser_download_url : '';
        if (!name.toLowerCase().endsWith('.exe') || !downloadUrl) continue;
        const size = typeof raw?.size === 'number' ? raw.size : 0;
        if (!best || size > best.size) {
            best = { name, size, downloadUrl };
        }
    }
    return best;
}

// Danh sách file .py chứa bảng mã (1 file/nhân vật hoặc skin) — lấy
// qua API contents (1 lần hỏi), rồi tải từng file qua raw.
export const FIXER_PYDATA_API = `https://api.github.com/repos/${FIXER_REPO}/contents/Source%20Codes/Assets/PlayerCharacterPYData?ref=${FIXER_DATA_BRANCH}`;
export const FIXER_PYDATA_RAW_BASE = `${FIXER_RAW_BASE}/Source%20Codes/Assets/PlayerCharacterPYData`;

// Tách bảng mã cũ từ nội dung 1 file .py trong PlayerCharacterPYData.
// Mỗi entry là 1 block keyed by mã hash 8 ký tự; chỉ entry nào có
// `update_hash` mới là mã CŨ (mã mới vẫn có entry riêng để thêm section
// còn thiếu — xem Anby.py: '496a781d' không có update_hash). Trả về map
// mã cũ -> mã mới (lowercase hex, không tiền tố).
export function parseFixerOldHashes(pyText: string): Record<string, string> {
    const out: Record<string, string> = {};
    if (!pyText) return out;
    const blockRe = /^        '([0-9a-f]{8})': \[/gm;
    const starts: { hash: string; index: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = blockRe.exec(pyText)) !== null) {
        starts.push({ hash: m[1], index: m.index });
    }
    const newHashRe = /update_hash,\s+\('([0-9a-f]{8})',|update_hash,\s+\{'new_hash':\s*'([0-9a-f]{8})'/;
    for (let i = 0; i < starts.length; i++) {
        const end = i + 1 < starts.length ? starts[i + 1].index : pyText.length;
        // Bỏ dòng chú thích (# ...) trong block: chữ "update_hash" có
        // thể xuất hiện trong chú thích (vd Lucy.py, Roxy.py) mà không
        // phải lệnh thật.
        const block = pyText.slice(starts[i].index, end)
            .split('\n').filter((l) => l.trim().indexOf('#') !== 0).join('\n');
        if (block.indexOf('update_hash') === -1) continue;
        const nm = newHashRe.exec(block);
        const next = nm ? (nm[1] || nm[2]) : '';
        if (next) out[starts[i].hash] = next;
    }
    return out;
}
export function normalizeFixerRelease(raw: any): FixerRelease | null {
    if (!raw || typeof raw !== 'object') return null;
    const tag = typeof raw.tag_name === 'string' ? raw.tag_name : '';
    if (!tag) return null;
    return {
        tag: tag,
        name: typeof raw.name === 'string' ? raw.name : tag,
        publishedAt: typeof raw.published_at === 'string' ? raw.published_at : '',
        asset: pickFixerExeAsset(raw),
    };
}
