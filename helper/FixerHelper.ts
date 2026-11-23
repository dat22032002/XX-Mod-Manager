// Trạng thái Mod Fixer dùng chung cho trang Cài đặt.
//
// Trang Cài đặt dùng v-if cho từng tab nên chuyển tab là tab Fixer bị
// tháo ra, ref cục bộ mất hết — kể cả đường dẫn thư mục tạm trong lúc
// Fixer đang mở. Trạng thái luồng sửa giữ ở đây (cấp module, reactive)
// để chuyển tab đi về vẫn còn nguyên. Mẫu theo UpdateHelper.
import { reactive } from 'vue';

export type FixerFlowStep =
    | 'idle'        // chưa bắt đầu
    | 'preparing'   // đang chép mod ra thư mục tạm
    | 'waiting'     // Fixer đang mở, đợi anh chạy xong + đóng lại
    | 'applying'    // đang kiểm tra bản đã sửa + chép về
    | 'done';       // đã báo kết quả

export interface FixerSuspect {
    modId: string;
    modName: string;
    location: string;
    matchedHashes: string[];
}

export interface FixerResult {
    modId: string;
    modName: string;
    status: 'fixed' | 'unchanged' | 'failed';
    backupPath?: string;
}

export interface FixerPrepared {
    tempDir: string;
    mods: { modId: string; modName: string; srcPath: string; tmpPath: string }[];
}

export const fixerState = reactive({
    // Đang kiểm tra bản mới của Fixer.
    checking: false,
    // Có bản Fixer mới (tag release) — rỗng khi chưa kiểm tra hoặc đã mới nhất.
    latestVersion: '',
    // Đang tải Fixer (0-100).
    downloading: false,
    downloadPercent: 0,
    // Đang quét mod nghi hỏng.
    scanning: false,
    // Đã quét xong lần nào chưa (để phân biệt "chưa quét" với "quét xong, 0 mod").
    scannedOnce: false,
    // Danh sách mod nghi hỏng từ lần quét gần nhất.
    suspects: [] as FixerSuspect[],
    // id của mod đã tick chọn trong danh sách.
    selectedIds: [] as string[],
    // Bước hiện tại của luồng sửa.
    flowStep: 'idle' as FixerFlowStep,
    // Tiến độ chép từng mod (lúc chép ra thư mục tạm + lúc chép về).
    // total = 0 khi chưa bắt đầu (giao diện hiện câu chung).
    progressDone: 0,
    progressTotal: 0,
    // Bản chép tạm đang sửa dở (null khi không sửa).
    prepared: null as FixerPrepared | null,
    // Kết quả từng mod của lần sửa gần nhất.
    results: [] as FixerResult[],
});
