// Pure windowing math for the mod card grid ("vẽ từng phần").
//
// The grid used to mount every mod card at once; with hundreds of mods that
// dominated startup time. Now only the rows near the viewport are mounted
// (plus a small overscan buffer), and blank padding above/below the mounted
// rows keeps the scrollbar and scroll positions exactly as if the whole list
// were mounted.
//
// This file has no Vue and no DOM access: every function here is a pure
// computation over numbers, so the math can be checked headlessly.

// Card geometry, mirroring the CSS in modCardManager.vue / modCard.vue:
// grid-template-columns: repeat(auto-fill, 250px), gap 12px,
// grid-auto-rows 350px (normal) / 150px (compact).
export const CARD_WIDTH = 250;
export const CARD_GAP = 12;
export const ROW_HEIGHT_NORMAL = 350;
export const ROW_HEIGHT_COMPACT = 150;
// Extra rows mounted above and below the visible range, so fast scrolling
// does not show a blank gap before the next rows mount.
export const OVERSCAN_ROWS = 2;

/**
 * How many card columns fit in a container of the given width.
 * Mirrors `repeat(auto-fill, 250px)` with a 12px gap: a column needs
 * 250px plus one gap, except the last column which needs no trailing gap.
 */
export function computeColumns(containerWidth, cardWidth = CARD_WIDTH, gap = CARD_GAP) {
    if (!Number.isFinite(containerWidth) || containerWidth <= 0) return 1;
    return Math.max(1, Math.floor((containerWidth + gap) / (cardWidth + gap)));
}

/**
 * Which slice of a grid list to mount, and how much blank space to leave
 * above/below it so the total height and scroll positions stay exactly as
 * if the whole list were mounted.
 *
 * - itemCount: number of items in the (already filtered) list
 * - columns: cards per row
 * - rowHeight: height of one row in px (350 normal, 150 compact)
 * - gap: grid gap in px
 * - scrollOffset: how many px of the list's total height are scrolled past
 * - viewportHeight: visible height of the scroll area in px
 * - overscanRows: extra rows mounted above/below the visible range
 *
 * Returns { startIndex, endIndex, paddingTop, paddingBottom, totalRows }.
 * The mounted slice is items[startIndex .. endIndex).
 */
export function computeWindow({
    itemCount,
    columns,
    rowHeight,
    gap = CARD_GAP,
    scrollOffset = 0,
    viewportHeight = 0,
    overscanRows = OVERSCAN_ROWS,
}) {
    const safeColumns = Math.max(1, Math.floor(columns) || 1);
    const totalRows = Math.ceil(Math.max(0, itemCount) / safeColumns);
    if (totalRows === 0) {
        return { startIndex: 0, endIndex: 0, paddingTop: 0, paddingBottom: 0, totalRows: 0 };
    }
    const rowPitch = rowHeight + gap;
    const offset = Math.max(0, scrollOffset);
    const firstVisibleRow = Math.min(totalRows - 1, Math.floor(offset / rowPitch));
    const lastVisibleRow = Math.min(
        totalRows - 1,
        Math.floor((offset + Math.max(0, viewportHeight)) / rowPitch)
    );
    const startRow = Math.max(0, firstVisibleRow - overscanRows);
    const endRow = Math.min(totalRows - 1, lastVisibleRow + overscanRows);
    const startIndex = startRow * safeColumns;
    const endIndex = Math.min(itemCount, (endRow + 1) * safeColumns);
    // Blank space above = the hidden rows plus the gaps around them, so the
    // first mounted row lands exactly where it would in the full list; same
    // for the space below. paddingTop + mounted rows + paddingBottom always
    // adds up to the full list height.
    const paddingTop = startRow * rowPitch;
    const paddingBottom = (totalRows - 1 - endRow) * rowPitch;
    return { startIndex, endIndex, paddingTop, paddingBottom, totalRows };
}
