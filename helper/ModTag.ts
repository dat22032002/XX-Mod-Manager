// Tag của mod — chuẩn phân loại duy nhất từ 1.5.18 (Đạt quyết 20/11,
// thay hẳn cách nhận biết bằng tiền tố tên thư mục (WP)/(EF)/(ACC)).
// Mỗi mod gắn đúng 1 tag, lưu trong mod.json (trường `tag`).
//
// Luật bật/tắt theo tag (1 mod/nhân vật): Character, Weapon, Effect
// mỗi nhân vật chỉ bật 1 (bật mod mới thì mod cũ cùng tag tự tắt);
// Skin và Accessory bật bao nhiêu cũng được.

export type ModTag = 'character' | 'skin' | 'weapon' | 'effect' | 'accessory';

export const MOD_TAGS: ModTag[] = ['character', 'skin', 'weapon', 'effect', 'accessory'];

// Tag "độc quyền": mỗi nhân vật chỉ bật 1 mod tag này cùng lúc.
const EXCLUSIVE_TAGS: ReadonlySet<ModTag> = new Set(['character', 'weapon', 'effect']);

export function isValidTag(value: unknown): value is ModTag {
    return typeof value === 'string' && (MOD_TAGS as string[]).includes(value);
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
    if (typeof value === 'string' && (['all', ...MOD_TAGS] as string[]).includes(value)) return value;
    return 'all';
}
