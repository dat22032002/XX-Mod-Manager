// Tag của mod — chuẩn phân loại duy nhất từ 1.5.18 (Đạt quyết 20/11,
// thay hẳn cách nhận biết bằng tiền tố tên thư mục (WP)/(EF)/(ACC)).
// Mỗi mod gắn đúng 1 tag, lưu trong mod.json (trường `tag`).
//
// Luật bật/tắt theo tag (1 mod/nhân vật): Character, Weapon, Effect
// mỗi nhân vật chỉ bật 1 (bật mod mới thì mod cũ cùng tag tự tắt);
// Skin, Accessory và Other bật bao nhiêu cũng được. Other dành cho mod
// linh tinh không thuộc 5 loại kia (mod UI, mod NPC... — Đạt dặn 20/11).
// Tag này trước đây tên là 'etc', Đạt dặn đổi thành 'other' 22/11 —
// mod.json và bộ nhớ sẵn cũ còn 'etc' thì tự chuyển thành 'other' lúc
// đọc (migrateTag), lần lưu sau ghi lại luôn.

export type ModTag = 'character' | 'skin' | 'weapon' | 'effect' | 'accessory' | 'other';

export const MOD_TAGS: ModTag[] = ['character', 'skin', 'weapon', 'effect', 'accessory', 'other'];

// Tag "độc quyền": mỗi nhân vật chỉ bật 1 mod tag này cùng lúc.
const EXCLUSIVE_TAGS: ReadonlySet<ModTag> = new Set(['character', 'weapon', 'effect']);

export function isValidTag(value: unknown): value is ModTag {
    return typeof value === 'string' && (MOD_TAGS as string[]).includes(value);
}

// Chuyển tag cũ thành tag hiện tại: 'etc' thành 'other', tag hợp lệ
// giữ nguyên, giá trị lạ thì null (bên gọi tự đoán lại theo tiền tố).
export function migrateTag(value: unknown): ModTag | null {
    if (value === 'etc') return 'other';
    return isValidTag(value) ? value : null;
}

export function isExclusiveTag(tag: ModTag): boolean {
    return EXCLUSIVE_TAGS.has(tag);
}

// Đoán tag cho mod chưa có tag (mod cũ, lần đầu mở app sau khi lên bản
// tag) theo tiền tố tên thư mục: (WP) vũ khí, (EF) hiệu ứng, (ACC) phụ
// kiện, (skin) skin, còn lại là Character. Tên thư mục giữ nguyên, chỉ
// tag được ghi vào mod.json.
export function tagFromPrefix(folderName: string): ModTag {
    const name = (folderName || '').trim().toLowerCase();
    if (name.startsWith('(wp)')) return 'weapon';
    if (name.startsWith('(ef)')) return 'effect';
    if (name.startsWith('(acc)')) return 'accessory';
    if (name.startsWith('(skin)')) return 'skin';
    return 'character';
}

// Chuẩn hóa giá trị lọc theo loại đọc từ config cũ: 'outfit' (tên loại
// cũ trước khi có tag) thành 'character'; giá trị lạ thì về 'all'.
export function normalizeTypeFilter(value: unknown): string {
    if (value === 'outfit') return 'character';
    if (value === 'etc') return 'other';
    if (typeof value === 'string' && (['all', ...MOD_TAGS] as string[]).includes(value)) return value;
    return 'all';
}
