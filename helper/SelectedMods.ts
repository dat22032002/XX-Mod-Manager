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

// Reactive so any computed that reads it stays up to date.
export const selectedModIdSet = reactive(new Set<string>());

export function setSelectedModIds(ids: Iterable<string>): void {
    selectedModIdSet.clear();
    for (const id of ids) {
        if (id) selectedModIdSet.add(id);
    }
}
