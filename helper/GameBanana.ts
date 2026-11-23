// Pure helpers cho tính năng GameBanana — không có I/O ở đây nên probe
// kiểm được mà không cần mạng. Mọi lần gọi mạng nằm trong IManager.
export const GB_ZZZ_GAME_ID = 19567;
export const GB_ZZZ_URL = 'https://gamebanana.com/games/19567';
export const GB_API_BASE = 'https://gamebanana.com/apiv11';
// Tác nhân trình duyệt gửi kèm mỗi lần hỏi Banana (Banana chặn yêu cầu
// không có tác nhân rõ ràng).
export const GB_USER_AGENT = 'XX-Mod-Manager/1.5.25';

export interface GbFile {
    id: number;
    name: string;
    size: number;
    // Ngày thêm file (giây từ epoch, như _tsDateAdded của Banana).
    dateAdded: number;
    downloadUrl: string;
    version: string;
    description: string;
    md5: string;
}

// Đọc mã mod từ link trang mod Banana — nhận cả trang thường
// (/mods/<id>, kèm hậu tố/tham số tùy ý) lẫn trang tải
// (/mods/download/<id>). Không phải link mod Banana thì trả null.
export function parseGameBananaModId(url: string): number | null {
    if (!url) return null;
    const match = url.match(/gamebanana\.com\/mods\/(?:download\/)?(\d+)/);
    if (!match) return null;
    const id = Number(match[1]);
    return Number.isFinite(id) && id > 0 ? id : null;
}

export function buildGameBananaModUrl(modId: number): string {
    return `https://gamebanana.com/mods/${modId}`;
}

// Chuẩn hóa 1 file trong _aFiles (apiv11) về GbFile — thiếu trường thì
// trả null để nơi gọi bỏ qua file đó thay vì văng lỗi.
export function normalizeGbFile(raw: any): GbFile | null {
    if (!raw || typeof raw !== 'object') return null;
    const id = Number(raw._idRow);
    const downloadUrl = typeof raw._sDownloadUrl === 'string' ? raw._sDownloadUrl : '';
    if (!Number.isFinite(id) || id <= 0 || !downloadUrl) return null;
    return {
        id: id,
        name: typeof raw._sFile === 'string' ? raw._sFile : '',
        size: typeof raw._nFilesize === 'number' ? raw._nFilesize : 0,
        dateAdded: typeof raw._tsDateAdded === 'number' ? raw._tsDateAdded : 0,
        downloadUrl: downloadUrl,
        version: typeof raw._sVersion === 'string' ? raw._sVersion : '',
        description: typeof raw._sDescription === 'string' ? raw._sDescription : '',
        md5: typeof raw._sMd5Checksum === 'string' ? raw._sMd5Checksum : '',
    };
}

// File mới nhất trong danh sách (ngày thêm lớn nhất; bằng nhau thì lấy
// file đứng sau — Banana trả file theo thứ tự ngày tăng dần nên file
// cuối thường cũng là file mới nhất). Danh sách rỗng thì null.
export function pickLatestGbFile(files: any[]): GbFile | null {
    if (!Array.isArray(files) || files.length === 0) return null;
    let latest: GbFile | null = null;
    for (const raw of files) {
        const file = normalizeGbFile(raw);
        if (!file) continue;
        if (!latest || file.dateAdded >= latest.dateAdded) {
            latest = file;
        }
    }
    return latest;
}
