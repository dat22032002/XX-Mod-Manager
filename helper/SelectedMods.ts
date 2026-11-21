// Shared record of which mods are currently selected ("clicked").
//
// Before windowing, the selected state lived only in the DOM: each card's
// `clicked` attribute, read back with querySelectorAll('.mod-item') whenever
// the app saved a preset, applied mods, or batch-set a character. Once cards
// unmount when scrolled out of view, unmounted cards are no longer in the
// DOM, so that read-back would silently drop their selections.
//
// This set is the single source of truth instead:
//   - modCard adds/removes its id whenever it is (un)clicked, and reads the
//     set when it mounts, so scrolling away and back keeps the selection.
//   - modCardManager resets the set whenever a preset is loaded, so cards
//     that are not mounted yet still get the preset's selection when they
//     mount.
//   - modCardSection reads the set for savePreset / Apply / batch-set.
import { reactive } from 'vue';
import type { ModData } from '../core/ModHelper';
import { TranslatedText } from './Language';
import { SnackType, t_snack } from './SnackHelper';
import { tagFromPrefix, isValidTag, isExclusiveTag } from './ModTag';
import type { ModTag } from './ModTag';

// Reactive so any computed that reads it stays up to date.
export const selectedModIdSet = reactive(new Set<string>());

export function setSelectedModIds(ids: Iterable<string>): void {
    selectedModIdSet.clear();
    for (const id of ids) {
        if (id) selectedModIdSet.add(id);
    }
}

//===================== một mod một tag mỗi nhân vật =====================
// Tag độc quyền (Character, Weapon, Effect): mỗi nhân vật chỉ bật cùng lúc
// 1 mod mỗi tag — bật mod mới thì mod cũ cùng nhân vật + cùng tag tự tắt.
// Tag không độc quyền (Skin, Accessory): bật bao nhiêu cũng được, không
// tắt mod nào. Mod chưa rõ nhân vật ("Unknown" hoặc trống) không bị luật
// này ràng buộc — không gom chúng lại với nhau được.

export function getModTag(mod: ModData): ModTag {
    if (isValidTag(mod.tag)) return mod.tag;
    return tagFromPrefix(mod.name);
}

function hasKnownCharacter(mod: ModData): boolean {
    const c = (mod.character || '').trim();
    return c !== '' && c.toLowerCase() !== 'unknown';
}

// Tắt các mod đang chọn cùng nhân vật + cùng tag với `mod`, trước khi mod
// này được thêm vào tập chọn. Trả về danh sách mod bị tắt (để báo cho người
// dùng biết). Không làm gì khi nhân vật chưa rõ hoặc tag không độc quyền.
export function evictSameTagMods(allMods: ModData[], mod: ModData): ModData[] {
    if (!hasKnownCharacter(mod)) return [];
    const tag = getModTag(mod);
    if (!isExclusiveTag(tag)) return [];
    const evicted: ModData[] = [];
    for (const other of allMods) {
        if (other.id === mod.id) continue;
        if (!selectedModIdSet.has(other.id)) continue;
        if (other.character !== mod.character) continue;
        if (getModTag(other) !== tag) continue;
        selectedModIdSet.delete(other.id);
        evicted.push(other);
    }
    return evicted;
}

//===================== hành động dùng chung (thẻ + hàng danh sách) =====================
// Bấm chọn/bỏ chọn 1 mod: bật thì tắt mod cũ cùng nhân vật + cùng tag
// độc quyền trước rồi báo rõ đã tắt mod nào (luật 1 mod/1 tag); tắt thì
// chỉ xóa khỏi tập chọn. Trả về trạng thái mới (true = đang bật). Thẻ
// lưới và hàng danh sách dùng chung hàm này để hành vi giống hệt nhau.
export function toggleModSelection(allMods: ModData[], mod: ModData): boolean {
    if (selectedModIdSet.has(mod.id)) {
        selectedModIdSet.delete(mod.id);
        return false;
    }
    const evicted = evictSameTagMods(allMods, mod);
    selectedModIdSet.add(mod.id);
    if (evicted.length > 0) {
        const tagWords = { character: ['Character', 'Nhân vật'], skin: ['Skin', 'Skin'], weapon: ['Weapon', 'Vũ khí'], effect: ['Effect', 'Hiệu ứng'], accessory: ['Accessory', 'Phụ kiện'] };
        const [tagEn, tagVi] = tagWords[getModTag(mod)];
        const names = evicted.map(m => m.name).join(', ');
        t_snack(new TranslatedText(
            `Turned off ${names} — only one ${tagEn} mod per character can be on`,
            `Đã tắt ${names} — mỗi nhân vật chỉ bật 1 mod ${tagVi} cùng lúc`
        ), SnackType.info);
    }
    return true;
}

//===================== bôi đen chọn nhiều mod (kéo khung) =====================
// Bôi đen CHỈ THÊM mod vào tập chọn, không bỏ chọn mod đã có (kể cả mod
// nằm ngoài khung vẫn giữ nguyên). Vàng: duyệt theo thứ tự hiển thị, mod
// sau cùng nhân vật + cùng tag độc quyền thắng mod trước (luật 1 mod/1
// tag, giống lúc tải preset) — gom tất cả mod bị tắt vào 1 thông báo duy
// nhất thay vì báo từng mod. Xanh: thêm thẳng, không có luật độc quyền.
export function selectModsInOrder(allMods: ModData[], mods: ModData[]): ModData[] {
    const evictedAll: ModData[] = [];
    for (const mod of mods) {
        if (selectedModIdSet.has(mod.id)) continue;
        evictedAll.push(...evictSameTagMods(allMods, mod));
        selectedModIdSet.add(mod.id);
    }
    if (evictedAll.length > 0) {
        const names = [...new Set(evictedAll.map(m => m.name))].join(', ');
        t_snack(new TranslatedText(
            `Turned off ${names} — only one mod per character and tag can be on`,
            `Đã tắt ${names} — mỗi nhân vật chỉ bật 1 mod mỗi loại cùng lúc`
        ), SnackType.info);
    }
    return evictedAll;
}

export function batchSelectMods(mods: ModData[]): void {
    for (const mod of mods) {
        batchSelectedModIdSet.add(mod.id);
    }
}

//===================== chọn làm hàng loạt (Ctrl+bấm) =====================
// Tập chọn RIÊNG cho thao tác hàng loạt (đặt nhân vật/tag): Ctrl+bấm
// thẻ để thêm/bớt mod, không tắt mod nào khác, không đụng tới tập
// chọn vàng (để Áp Dụng) — 2 tập độc lập, 1 mod có thể ở cả 2 tập.
// Chỉ sống trong phiên mở app, không lưu file, không vào preset.
export const batchSelectedModIdSet = reactive(new Set<string>());

// Thêm/bớt 1 mod khỏi tập chọn hàng loạt. Không có luật độc quyền —
// chọn bao nhiêu mod cùng nhân vật + cùng tag cũng được.
export function toggleBatchSelection(mod: ModData): boolean {
    if (batchSelectedModIdSet.has(mod.id)) {
        batchSelectedModIdSet.delete(mod.id);
        return false;
    }
    batchSelectedModIdSet.add(mod.id);
    return true;
}

// Ghim/bỏ ghim 1 mod, lưu ngay vào mod.json. Ghi lỗi thì trả lại trạng
// thái cũ để màn hình không lệch với file.
export async function toggleModPin(mod: ModData): Promise<void> {
    mod.pinned = !mod.pinned;
    try {
        await mod.saveModInfo();
    } catch (e) {
        mod.pinned = !mod.pinned;
        console.error('Failed to save pin state', e);
    }
}

// Đặt lại tập chọn từ danh sách id (lúc tải preset), áp dụng cùng luật:
// duyệt theo thứ tự, mod sau cùng nhân vật + cùng tag độc quyền sẽ thắng
// mod trước; tag không độc quyền (Skin, Accessory) giữ lại tất cả.
export function setSelectedModIdsExclusive(allMods: ModData[], ids: Iterable<string>): void {
    const byId = new Map<string, ModData>();
    for (const m of allMods) byId.set(m.id, m);
    const finalIds: string[] = [];
    const finalSet = new Set<string>();
    for (const id of ids) {
        if (!id || finalSet.has(id)) continue;
        const mod = byId.get(id);
        if (mod && hasKnownCharacter(mod)) {
            const tag = getModTag(mod);
            if (isExclusiveTag(tag)) {
                for (let i = finalIds.length - 1; i >= 0; i--) {
                    const prev = byId.get(finalIds[i]);
                    if (prev && prev.character === mod.character && getModTag(prev) === tag) {
                        finalSet.delete(finalIds[i]);
                        finalIds.splice(i, 1);
                    }
                }
            }
        }
        finalIds.push(id);
        finalSet.add(id);
    }
    setSelectedModIds(finalIds);
}
