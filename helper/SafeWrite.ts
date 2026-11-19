// Ghi file an toàn (TC5): ghi ra file tạm trong cùng thư mục rồi đổi tên
// đè lên file gốc. Đổi tên là thao tác nguyên tử trên cả Windows lẫn
// Linux (fs.renameSync đè file đang tồn tại vẫn được trên Windows), nên
// mất điện/sập app giữa chừng chỉ để lại file tạm thừa — file gốc hoặc
// còn nguyên bản cũ, hoặc đã là bản mới đầy đủ, không bao giờ bị cắt dở.
//
// File tạm có tên dạng `<tên gốc>.tmp-<pid>-<ngẫu nhiên>`: không kết thúc
// bằng `.json` nên trình quét preset/mod không nhầm thành dữ liệu thật.

const fs = require('fs');
const path = require('path');

function tempPathFor(filePath: string): string {
    const random = Math.random().toString(36).slice(2, 10);
    return `${filePath}.tmp-${process.pid}-${random}`;
}

// Ghi đè file cũ thì cố đẩy dữ liệu xuống đĩa trước khi đổi tên —
// chỉ là lớp bảo vệ thêm, thất bại cũng không làm hỏng lần ghi.
function tryFsyncSync(fd: number): void {
    try {
        fs.fsyncSync(fd);
    } catch (e) {
        console.warn(`SafeWrite: fsync failed (ignored): ${e}`);
    }
}

// Bản đồng bộ: dùng cho mod.json, preset, config, cấu hình plugin, file ini.
export function writeFileAtomicSync(filePath: string, data: string | Buffer, encoding?: BufferEncoding): void {
    const tmpPath = tempPathFor(filePath);
    try {
        const fd = fs.openSync(tmpPath, 'w');
        try {
            if (typeof data === 'string') {
                fs.writeFileSync(fd, data, encoding || 'utf8');
            } else {
                fs.writeFileSync(fd, data);
            }
            tryFsyncSync(fd);
        } finally {
            fs.closeSync(fd);
        }
        fs.renameSync(tmpPath, filePath);
    } catch (e) {
        // Dọn file tạm dở dang, rồi để lỗi lan lên cho nơi gọi xử lý.
        try {
            if (fs.existsSync(tmpPath)) {
                fs.unlinkSync(tmpPath);
            }
        } catch (_cleanupErr) {
            // Bỏ qua: file tạm thừa là vô hại.
        }
        throw e;
    }
}

// Bản bất đồng bộ: dùng cho cache (ModCache ghi có trễ, không chặn UI).
// Các lần ghi vẫn phải nối đuôi nhau ở nơi gọi (ModCache đã có writeChain)
// vì 2 lần ghi cùng lúc sẽ đổi tên đè nhau.
export async function writeFileAtomic(filePath: string, data: string | Buffer, encoding?: BufferEncoding): Promise<void> {
    const tmpPath = tempPathFor(filePath);
    try {
        const handle = await fs.promises.open(tmpPath, 'w');
        try {
            if (typeof data === 'string') {
                await handle.writeFile(data, encoding || 'utf8');
            } else {
                await handle.writeFile(data);
            }
            try {
                await handle.sync();
            } catch (e) {
                console.warn(`SafeWrite: fsync failed (ignored): ${e}`);
            }
        } finally {
            await handle.close();
        }
        await fs.promises.rename(tmpPath, filePath);
    } catch (e) {
        try {
            await fs.promises.unlink(tmpPath);
        } catch (_cleanupErr) {
            // Bỏ qua: file tạm thừa là vô hại.
        }
        throw e;
    }
}

export default writeFileAtomicSync;
