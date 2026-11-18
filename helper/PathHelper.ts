import { SnackType, t_snack } from "./SnackHelper";
import { TranslatedText } from "./Language";

const fs = require('fs');

/** @class
 * @desc 用来提供便捷的路径操作，比如路径检查等。
 */
class PathHelper {
    constructor() {
        throw new Error("PathHelper can't be instantiated");
    }

    /** @function
     * @desc 检查一个目录是否存在
     * @param {string} dir - 目录路径
     * @param {boolean} [createIfNotExist] - 如果不存在是否创建
     * @param {boolean} [snackError] - 是否弹出 snack 错误提示
     * @param {TranslatedText} [dirName] - 目录的名称
     * @returns {boolean} 是否存在
     */
    static CheckDir(dir: string, createIfNotExist: boolean = false, snackError: boolean = true, dirName: TranslatedText) {
        let result = 1;
        // 检查dir是否不为空且为string
        if (!dir || typeof dir !== 'string') {
            result = 0;
        }
        else if (!fs.existsSync(dir)) {
            if (createIfNotExist) {
                fs.mkdirSync(dir, { recursive: true });
            } else {
                result = -1;
            }
        }

        // 检查是否为文件夹
        if (result === 1) {
            let stat = fs.statSync(dir);
            if (!stat.isDirectory()) {
                result = -2;
            }
        }

        if (result < 0) {
            // snack 错误提示
            let tt: TranslatedText = new TranslatedText("Unknown Error", "Lỗi không xác định");
            switch (result) {
                case 0:
                    tt = new TranslatedText(`❌[${dirName.get() || ""}] dir is invalid: ${dir}`, `❌[${dirName.get() || ""}] thư mục không hợp lệ: ${dir}`);
                    break;
                case -1:
                    tt = new TranslatedText(`❌[${dirName.get() || ""}] dir not found: ${dir}`, `❌[${dirName.get() || ""}] không tìm thấy thư mục: ${dir}`);
                    break;
                case -2:
                    tt = new TranslatedText(`❌[${dirName.get() || ""}] dir is not a directory: ${dir}`, `❌[${dirName.get() || ""}] không phải là thư mục: ${dir}`);
                    break;
                default:
                    break;
            }

            if (snackError && tt) {
                t_snack(tt, SnackType.error);
            }
        }

        return result === 1;
    }
}


export { PathHelper };