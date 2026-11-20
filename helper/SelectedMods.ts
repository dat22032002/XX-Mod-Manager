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

// Reactive so any computed that reads it stays up to date.
export const selectedModIdSet = reactive(new Set<string>());

export function setSelectedModIds(ids: Iterable<string>): void {
    selectedModIdSet.clear();
    for (const id of ids) {
        if (id) selectedModIdSet.add(id);
    }
}

//===================== một mod một loại mỗi nhân vật =====================
// Mỗi nhân vật chỉ bật cùng lúc 1 mod mỗi loại: đồ (mặc định), vũ khí (tên
// bắt đầu "(WP)"), hiệu ứng (tên bắt đầu "(EF)"), phụ kiện (tên bắt đầu
// "(ACC)"). Bật mod mới thì mod cũ cùng nhân vật + cùng loại tự tắt. Mod
// chưa rõ nhân vật ("Unknown" hoặc trống) không bị luật này ràng buộc —
// không gom chúng lại với nhau được.

export type ModSlot = 'outfit' | 'weapon' | 'effect' | 'accessory';

export function getModSlot(mod: ModData): ModSlot {
    const name = (mod.name || '').trim().toLowerCase();
    if (name.startsWith('(wp)')) return 'weapon';
    if (name.startsWith('(ef)')) return 'effect';
    if (name.startsWith('(acc)')) return 'accessory';
    return 'outfit';
}

function hasKnownCharacter(mod: ModData): boolean {
    const c = (mod.character || '').trim();
    return c !== '' && c.toLowerCase() !== 'unknown';
}

// Tắt các mod đang chọn cùng nhân vật + cùng loại với `mod`, trước khi mod
// này được thêm vào tập chọn. Trả về danh sách mod bị tắt (để báo cho người
// dùng biết). Không làm gì khi nhân vật chưa rõ.
export function evictSameSlotMods(allMods: ModData[], mod: ModData): ModData[] {
    if (!hasKnownCharacter(mod)) return [];
    const slot = getModSlot(mod);
    const evicted: ModData[] = [];
    for (const other of allMods) {
        if (other.id === mod.id) continue;
        if (!selectedModIdSet.has(other.id)) continue;
        if (other.character !== mod.character) continue;
        if (getModSlot(other) !== slot) continue;
        selectedModIdSet.delete(other.id);
        evicted.push(other);
    }
    return evicted;
}

//===================== hành động dùng chung (thẻ + hàng danh sách) =====================
// Bấm chọn/bỏ chọn 1 mod: bật thì tắt mod cũ cùng nhân vật + cùng loại
// trước rồi báo rõ đã tắt mod nào (luật 1 mod/1 loại); tắt thì chỉ xóa
// khỏi tập chọn. Trả về trạng thái mới (true = đang bật). Thẻ lưới và
// hàng danh sách dùng chung hàm này để hành vi giống hệt nhau.
export function toggleModSelection(allMods: ModData[], mod: ModData): boolean {
    if (selectedModIdSet.has(mod.id)) {
        selectedModIdSet.delete(mod.id);
        return false;
    }
    const evicted = evictSameSlotMods(allMods, mod);
    selectedModIdSet.add(mod.id);
    if (evicted.length > 0) {
        const slotWords = { outfit: ['outfit', 'đồ'], weapon: ['weapon', 'vũ khí'], effect: ['effect', 'hiệu ứng'], accessory: ['accessory', 'phụ kiện'] };
        const [slotEn, slotVi] = slotWords[getModSlot(mod)];
        const names = evicted.map(m => m.name).join(', ');
        t_snack(new TranslatedText(
            `Turned off ${names} — only one ${slotEn} mod per character can be on`,
            `Đã tắt ${names} — mỗi nhân vật chỉ bật 1 mod ${slotVi} cùng lúc`
        ), SnackType.info);
    }
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
// duyệt theo thứ tự, mod sau cùng nhân vật + cùng loại sẽ thắng mod trước.
export function setSelectedModIdsExclusive(allMods: ModData[], ids: Iterable<string>): void {
    const byId = new Map<string, ModData>();
    for (const m of allMods) byId.set(m.id, m);
    const finalIds: string[] = [];
    const finalSet = new Set<string>();
    for (const id of ids) {
        if (!id || finalSet.has(id)) continue;
        const mod = byId.get(id);
        if (mod && hasKnownCharacter(mod)) {
            const slot = getModSlot(mod);
            for (let i = finalIds.length - 1; i >= 0; i--) {
                const prev = byId.get(finalIds[i]);
                if (prev && prev.character === mod.character && getModSlot(prev) === slot) {
                    finalSet.delete(finalIds[i]);
                    finalIds.splice(i, 1);
                }
            }
        }
        finalIds.push(id);
        finalSet.add(id);
    }
    setSelectedModIds(finalIds);
}
