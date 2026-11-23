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

import { tokenizeName } from './CharacterGuess';

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

// Màu tên mod trên thẻ theo tag (Đạt dặn 23/11): mỗi tag 1 màu, đọc
// được trên nền tối của thẻ, phân biệt rõ nhau. Tránh xanh biển đậm
// (trùng viền chọn hàng loạt #2196F3) và đỏ (trùng viền chọn cả 2
// loại #F44336).
export const TAG_NAME_COLORS: Record<ModTag, string> = {
    character: '#FFD54F', // vàng hổ phách — loại chính, gần vàng của app
    skin: '#F48FB1',      // hồng — đồ hở/da
    weapon: '#FF8A65',    // cam — vũ khí
    effect: '#CE93D8',    // tím — hiệu ứng
    accessory: '#4DD0E1', // xanh lơ — phụ kiện
    other: '#AED581',     // xanh lá nhạt — linh tinh (UI/NPC/world)
};

// Bảng từ khóa đoán tag từ tên mod (Đạt dặn 23/11): chỉ đoán cho mod
// chưa được đặt tag. Khớp theo token (tách bằng tokenizeName — tách
// cả camelCase nên "AnbyBikini" vẫn tách được "bikini"), không phân
// biệt hoa thường, khớp đúng 1 tag thì đoán, 0 hoặc nhiều tag thì
// không đoán (không đoán bừa — giống luật của guessCharacterFromNames).
// Từ mơ hồ cố tình để ngoài bảng: bikini/swimsuit/lingerie/leotard
// là đồ hở nên về 'skin' theo tiền lệ fixture tags6; còn tên không có
// từ khóa nào (vd tên tiếng Trung) thì đoán không ra, tên giữ màu mặc
// định.
const TAG_KEYWORDS: Record<ModTag, string[]> = {
    character: ['outfit', 'costume', 'dress', 'maid', 'uniform', 'clothes', 'clothing', 'suit', 'casual', 'fashion', 'wear', 'kimono', 'jacket', 'coat', 'gown', 'robe', 'hoodie', 'sweater', 'shirt', 'pants', 'skirt', 'shorts', 'cheongsam', 'qipao', 'lolita', 'gothic', 'punk', 'school', 'nurse', 'police', 'santa', 'bunny', 'catgirl', 'witch'],
    skin: ['skin', 'recolor', 'recolour', 'texture', 'tattoo', 'nude', 'naked', 'bikini', 'swimsuit', 'lingerie', 'leotard', 'tan', 'pale', 'body', 'bare', 'topless'],
    weapon: ['sword', 'blade', 'katana', 'dagger', 'knife', 'gun', 'rifle', 'pistol', 'shotgun', 'smg', 'bow', 'arrow', 'spear', 'lance', 'axe', 'hammer', 'staff', 'wand', 'whip', 'cannon', 'scythe', 'claw', 'gauntlet', 'weapon', 'wp', 'chainsaw', 'baton', 'mace', 'crossbow', 'launcher', 'grenade', 'rocket', 'saber', 'sabre', 'rapier', 'halberd', 'trident', 'nunchaku', 'kunai', 'shuriken'],
    effect: ['effect', 'fx', 'vfx', 'glow', 'aura', 'particle', 'fire', 'flame', 'ice', 'frost', 'lightning', 'thunder', 'sparkle', 'shine', 'trail', 'shader', 'bloom', 'neon', 'explosion', 'smoke', 'magic', 'burst', 'ult', 'skill', 'element', 'electro', 'inferno', 'wind', 'storm'],
    accessory: ['accessory', 'acc', 'hat', 'cap', 'hair', 'glasses', 'earring', 'necklace', 'ring', 'bracelet', 'wings', 'wing', 'tail', 'ears', 'ear', 'horns', 'horn', 'mask', 'backpack', 'bag', 'charm', 'pin', 'badge', 'scarf', 'gloves', 'glove', 'socks', 'sock', 'shoes', 'shoe', 'boots', 'boot', 'headset', 'headphones', 'ribbon', 'bowtie', 'choker', 'collar', 'veil', 'crown', 'tiara'],
    other: ['ui', 'hud', 'menu', 'npc', 'world', 'map', 'background', 'icon', 'logo', 'font', 'loading', 'screen', 'cursor', 'sound', 'audio', 'music', 'voice', 'camera', 'minimap', 'shop', 'bangboo', 'hollow', 'environment', 'terrain', 'skybox', 'reshade'],
};

// Đoán tag từ tên mod (tên thư mục): khớp đúng 1 tag thì trả tag đó,
// 0 hoặc nhiều tag thì null (không đoán bừa).
export function guessTagFromName(folderName: string): ModTag | null {
    const tokens = new Set(tokenizeName(folderName || ''));
    if (tokens.size === 0) return null;
    const matched: ModTag[] = [];
    for (const tag of MOD_TAGS) {
        for (const kw of TAG_KEYWORDS[tag]) {
            if (tokens.has(kw)) { matched.push(tag); break; }
        }
    }
    return matched.length === 1 ? matched[0] : null;
}

// Chuẩn hóa giá trị lọc theo loại đọc từ config cũ: 'outfit' (tên loại
// cũ trước khi có tag) thành 'character'; giá trị lạ thì về 'all'.
export function normalizeTypeFilter(value: unknown): string {
    if (value === 'outfit') return 'character';
    if (value === 'etc') return 'other';
    if (typeof value === 'string' && (['all', ...MOD_TAGS] as string[]).includes(value)) return value;
    return 'all';
}
