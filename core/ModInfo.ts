import { SnackType, t_snack } from "../helper/SnackHelper";
import { TranslatedText } from "../helper/Language";
import { writeFileAtomicSync } from "../helper/SafeWrite";
import type { CachedModEntry } from "./ModCache";
const fs = require('fs');
const path = require('path');

enum ModMetaDataType {
    String,
    Number,
    Boolean,
    Array,
    Object
}

class ModMetaDataItem {
    public key: string;
    public value: any;
    public type: ModMetaDataType;

    constructor(key: string, value: any, type: ModMetaDataType) {
        this.key = key;
        this.value = value;
        this.type = type;
    }
}

class ModMetaData {
    public items: ModMetaDataItem[] = [];

    public add(key: string, value: any, type: ModMetaDataType) {
        this.items.push(new ModMetaDataItem(key, value, type));
    }

    public set<T>(key: string, value: T, type: ModMetaDataType) {
        const item = this.items.find(item => item.key === key);
        if (item) {
            item.value = value;
        } else {
            this.add(key, value, type);
        }
    }

    public get<T>(key: string): T | null {
        const item = this.items.find(item => item.key === key);
        if (item) {
            switch (item.type) {
                case ModMetaDataType.String:
                    return String(item.value) as T;
                case ModMetaDataType.Number:
                    return Number(item.value) as T;
                case ModMetaDataType.Boolean:
                    return Boolean(item.value) as T;
                case ModMetaDataType.Array:
                    return Array.isArray(item.value) ? item.value as T : null;
                case ModMetaDataType.Object:
                    return typeof item.value === 'object' && item.value !== null ? item.value as T : null;
                default:
                    return null;
            }
        }
        return null;
    }

    public copy(): ModMetaData {
        // 深拷贝
        const metaData = new ModMetaData();
        for (const item of this.items) {
            metaData.add(item.key, item.value, item.type);
        }
        return metaData;
    }
}

//- 直到ModInfo层，所有的数据都是和本地是一致的
//- 从 ModData 层开始，它会进行两件事情：
//- 1. 将格式转化为 Modata 的格式，以供前端使用
//- 2. 将确认图片到底是哪个文件
//- 3. 将图片转化为 缓存url 或者 base64
class ModInfo {
    // Chế độ áp dụng truyền thống (đổi tên thư mục để tắt/bật mod) hay
    // không — IManager ghi giá trị này từ config lúc mở app và mỗi khi
    // đổi cài đặt. Chỉ dùng để nhận biết tiền tố "disabled_" là trạng
    // thái tắt mod, không phải tên (xem folderNameToModName).
    public static ifUseTraditionalApply: boolean = false;

    // Tên mod lấy từ tên thư mục: ở chế độ thường thì tên mod CHÍNH LÀ
    // tên thư mục; ở chế độ truyền thống, tiền tố "disabled_" là trạng
    // thái tắt mod (do Apply tự thêm/bớt), không phải tên — bỏ ra trước
    // khi so sánh hay hiển thị.
    public static folderNameToModName(folderName: string): string {
        if (ModInfo.ifUseTraditionalApply && folderName.startsWith('disabled_')) {
            return folderName.slice('disabled_'.length);
        }
        return folderName;
    }

    public static modDataTemplate: ModMetaData = new ModMetaData();
    public static setModDataTemplate(template: ModMetaData) {
        ModInfo.modDataTemplate = template;
    }

    public id: string;
    public location: string;
    public modName: string;
    public newMod = false; // 是否是新的模块

    // 其他的数据为非核心数据，可以通过模板进行定义
    public metaData: ModMetaData = new ModMetaData();

    constructor(location: string) {
        this.location = location;
        this.modName = path.basename(location);
        this.metaData = ModInfo.modDataTemplate.copy();

        this.init(location);
    }

    // Build a ModInfo from a cache entry without touching the disk.
    // Only used when the folder and its mod.json are unchanged since the
    // entry was written, so the cached data is the same as a fresh read.
    public static fromCache(location: string, entry: CachedModEntry): ModInfo {
        const modInfo = Object.create(ModInfo.prototype) as ModInfo;
        modInfo.location = location;
        // Tên mod lấy từ tên thư mục (như lúc quét mới) — mục cache cũ có
        // thể còn tên lệch từ trước khi có đồng bộ 2 chiều. Ghi lại vào
        // mục cache trong bộ nhớ để lần lưu cache sau khớp luôn.
        modInfo.modName = ModInfo.folderNameToModName(path.basename(location));
        entry.modName = modInfo.modName;
        modInfo.id = entry.id;
        // Mục cache cũ có thể không có id: không có id thì mod không
        // vào được chỉ mục theo id, mọi chỗ tra theo id (đường dẫn thư
        // mục, áp dụng) đều rơi về đường đoán theo tên — sai khi tên
        // vừa đổi trong bộ nhớ (lỗi ENOENT lúc đổi tên, Đạt gặp 19/11).
        // Tạo id như lúc quét mới (init) rồi ghi lại vào mục cache để
        // lần lưu cache sau giữ luôn.
        if (!modInfo.id) {
            modInfo.generateID();
            entry.id = modInfo.id;
        }
        // A cached mod was already seen on an earlier launch, so it is
        // no longer new. (Fresh loads still report newMod in memory.)
        modInfo.newMod = false;
        modInfo.metaData = ModInfo.modDataTemplate.copy();

        // Deep-clone so live edits never mutate the cached copy in memory.
        const meta = JSON.parse(JSON.stringify(entry.meta || {}));
        for (const item of ModInfo.modDataTemplate.items) {
            const value = meta[item.key];
            // null means the stored value had the wrong type; keep the
            // template default, same as init() does for a bad mod.json.
            if (value !== undefined && value !== null) {
                modInfo.metaData.set(item.key, value, item.type);
            }
        }
        return modInfo;
    }

    private init(location: string) {
        let needSave = false;
        // Tên mod luôn đồng bộ với tên thư mục: đổi tên thư mục ngoài
        // Explorer thì lần tải sau app hiện tên mới (chiều ngược lại —
        // đổi tên trong app thì thư mục trên đĩa đổi theo — ở
        // setMetaDataFromJson). Trước đây 2 chiều này nằm sau cài đặt
        // "giữ tên mod giống tên thư mục" (mặc định tắt) nên tên hay lệch
        // nhau; giờ luôn bật, cài đặt đó đã bỏ.
        this.modName = ModInfo.folderNameToModName(path.basename(location));
        // 读取模块元数据
        const metaDataPath = path.join(location, 'mod.json');
        if (fs.existsSync(metaDataPath)) {
            const rawData = fs.readFileSync(metaDataPath, 'utf8');
            let metaData = {};
            try {
                metaData = JSON.parse(rawData);
            } catch (e) {
                console.error(`Không đọc được metadata của mod: ${metaDataPath}`, rawData);
                // File hỏng: giữ lại bản gốc thành .bak rồi mới tạo metadata
                // mặc định — không thì lần lưu sau (needSave) sẽ ghi đè mất dữ liệu cũ.
                try {
                    fs.renameSync(metaDataPath, metaDataPath + '.bak');
                } catch (bakErr) {
                    console.error(`Không sao lưu được file mod.json hỏng: ${metaDataPath}`, bakErr);
                }
                t_snack(new TranslatedText(
                    `Mod info file is corrupt, backed up as mod.json.bak: ${path.basename(location)}`,
                    `File thông tin của mod bị hỏng, đã sao lưu thành mod.json.bak: ${path.basename(location)}`),
                    SnackType.error);
            }

            // id 为必须的字段，如果没有则生成一个
            this.id = metaData['id'] || '';
            if (!this.id) {
                this.generateID();
                needSave = true;
            }

            // Tên lưu trong mod.json chỉ để so sánh: khác tên thư mục (vd
            // vừa đổi tên thư mục ngoài Explorer) thì ghi lại cho khớp.
            if (metaData['modName'] && metaData['modName'] !== this.modName) {
                needSave = true;
            }

            // 读取模板中定义的数据
            for (const item of ModInfo.modDataTemplate.items) {
                const value = metaData[item.key];
                if (value !== undefined) {
                    // this.metaData.set(item.key, value, item.type);

                    // 除了 array 和 object 类型，其他类型都直接赋值
                    if (item.type === ModMetaDataType.Array) {
                        // 如果是数组，则需要判断是否是数组
                        if (Array.isArray(value)) {
                            this.metaData.set(item.key, value, item.type);
                        }
                        else {
                            console.error(`Lỗi metadata của mod: ${item.key} không phải mảng`);
                            needSave = true;
                        }
                    }
                    else if (item.type === ModMetaDataType.Object) {
                        // 如果是对象，则需要判断是否是对象
                        if (typeof value === 'object' && value !== null) {
                            this.metaData.set(item.key, value, item.type);
                        }
                        else {
                            console.error(`Lỗi metadata của mod: ${item.key} không phải đối tượng`);
                            needSave = true;
                        }
                    }
                    else {
                        this.metaData.set(item.key, value, item.type);
                    }
                }
                else {
                    // 如果没有这个字段，则需要保存
                    needSave = true;
                }
            }
        }
        else {
            this.newMod = true;
            // 生成一个 id
            this.generateID();

            console.warn(`Không tìm thấy file metadata của mod: ${metaDataPath}`);
            needSave = true;
        }

        // 将模块元数据写入文件
        if (needSave) {
            this.saveMetaData();
        }
    }

    generateID() {
        // 生成一个随机的 id
        // id 由 mod文件夹内的文件的 hash 值生成

        // 生成一个 hash 值
        // hash 值的生成需要用到 crypto 模块
        const crypto = require('crypto');
        const hash = crypto.createHash('md5');
        hash.update(this.location);
        this.id = hash.digest('hex');
        return this.id;
    }

    public setMetaDataFromJson(json: JSON) {
        // 将 json 字符串转化为对象
        let metaData = {};
        // 处理一下，防止 json 解析失败
        // 这里使用了深拷贝，防止引用问题
        try {
            metaData = JSON.parse(JSON.stringify(json));
        } catch (e) {
            console.error(`Không đọc được metadata của mod: ${this.location}`, json);
        }

        //debug
        console.log(`Đặt metadata của mod: ${this.location}`, metaData);

        // id 为必须的字段，如果没有则生成一个
        this.id = metaData['id'] || '';
        if (!this.id) {
            metaData["id"] = this.generateID();
        }

        // Đổi tên mod trong app thì đổi luôn tên thư mục trên đĩa (đồng bộ
        // 2 chiều — chiều ngược lại ở init()). Ở chế độ truyền thống, mod
        // đang tắt giữ nguyên tiền tố "disabled_" (đổi tên không được làm
        // mod bật lại). Đổi tên thất bại (trùng tên, ổ lỗi) thì báo lỗi
        // để hộp sửa hiện "lưu thất bại" thay vì im lặng mất tên mới như
        // trước đây (bản cũ chỉ return, hộp vẫn tưởng đã lưu).
        if (metaData['name'] && metaData['name'] !== this.modName) {
            const newName = metaData['name'];
            const folderName = path.basename(this.location);
            const disabled = ModInfo.ifUseTraditionalApply && folderName.startsWith('disabled_');
            const newFolderName = disabled ? `disabled_${newName}` : newName;
            // debug
            console.log(`Đổi tên mod: ${this.modName} -> ${newName} in folder ${this.location}`);
            const newModFolderPath = path.join(path.dirname(this.location), newFolderName);
            // Trùng tên chỉ tính khi thư mục đích đã tồn tại VÀ không
            // phải là chính thư mục hiện tại: đổi tên chỉ khác chữ
            // hoa/thường trên Windows (ổ không phân biệt hoa/thường)
            // thì đường dẫn mới trỏ đúng vào thư mục hiện tại — đó là
            // đổi tên hợp lệ, không phải trùng (Đạt đổi (ACC) thành
            // (ac) bị chặn oan, 19/11).
            const sameFolder = process.platform === 'win32'
                ? newFolderName.toLowerCase() === folderName.toLowerCase()
                : newFolderName === folderName;
            if (!sameFolder && fs.existsSync(newModFolderPath)) {
                throw new Error(`Tên mod trùng lặp: ${newFolderName} đã tồn tại`);
            }
            try {
                fs.renameSync(this.location, newModFolderPath);
            } catch (e: any) {
                throw new Error(`Đổi tên thư mục mod thất bại: ${e.message}`);
            }
            this.modName = newName;
            this.location = newModFolderPath;
            // id保持不变
        }

        // 读取模板中定义的数据
        for (const item of ModInfo.modDataTemplate.items) {
            const value = metaData[item.key];
            if (value !== undefined) {
                this.metaData.set(item.key, value, item.type);
            }
        }


        // debug
        console.log(`Metadata của mod: ${this.location} from`, json, this);
    }

    public saveMetaData() {
        // 保存模块元数据到文件
        const metaDataPath = path.join(this.location, 'mod.json');
        const metaData = this.metaData.items.reduce((obj, item) => {
            switch (item.type) {
                case ModMetaDataType.String:
                    obj[item.key] = String(item.value);
                    break;
                case ModMetaDataType.Number:
                    obj[item.key] = Number(item.value);
                    break;
                case ModMetaDataType.Boolean:
                    obj[item.key] = Boolean(item.value);
                    break;
                case ModMetaDataType.Array:
                    obj[item.key] = Array.isArray(item.value) ? item.value : [];
                    break;
                case ModMetaDataType.Object:
                    obj[item.key] = typeof item.value === 'object' && item.value !== null ? item.value : {};
                    break;
                default:
                    obj[item.key] = item.value;
            }
            return obj;
        }, {});
        // 添加上 id 和 location 以及 modName
        metaData['id'] = this.id;
        metaData['location'] = this.location;
        metaData['modName'] = this.modName;
        // TC5: ghi qua file tạm rồi đổi tên — mất điện giữa chừng không làm hỏng mod.json.
        writeFileAtomicSync(metaDataPath, JSON.stringify(metaData, null, 4), 'utf8');
    }

    // Serialize the loaded state for the cache. Callers supply fresh stat
    // data (folder mtime, mod.json mtime + size) and the resolved preview
    // path, so later loads can tell whether this mod changed.
    public toCacheEntry(folderMtimeMs: number, modJsonMtimeMs: number, modJsonSize: number, previewPath: string): CachedModEntry {
        const meta: Record<string, any> = {};
        for (const item of ModInfo.modDataTemplate.items) {
            meta[item.key] = this.metaData.get(item.key);
        }
        return {
            location: this.location,
            folderMtimeMs: folderMtimeMs,
            modJsonMtimeMs: modJsonMtimeMs,
            modJsonSize: modJsonSize,
            id: this.id,
            modName: this.modName,
            meta: meta,
            previewPath: previewPath,
        };
    }

    public rename(newName: string, callback: (err: any) => void) {
        // 重命名mod
        // 确认location是否存在
        if (!fs.existsSync(this.location)) {
            console.error(`Mod không tồn tại: ${this.location}`);
            callback(new Error(`Mod không tồn tại: ${this.location}`));
            return false;
        }
        // 确认有无重复的文件夹名称
        const newModFolderName = newName;
        const newModFolderPath = path.join(path.dirname(this.location), newModFolderName);
        if (fs.existsSync(newModFolderPath)) {
            console.error(`Tên mod trùng lặp: ${newModFolderName} đã tồn tại`);
            callback(new Error(`Tên mod trùng lặp: ${newModFolderName} đã tồn tại`));
            return false;
        }
        // 重命名文件夹
        try{
            fs.renameSync(this.location, newModFolderPath);
        } catch (err) {
            console.error(`Đổi tên mod thất bại: ${this.location} -> ${newModFolderPath}`, err);
            callback(err);
            return false;
        }
        // Chỉ đổi đường dẫn, KHÔNG đổi modName theo tên thư mục: rename()
        // chỉ dùng cho cách áp dụng truyền thống (thêm/bớt tiền tố
        // "disabled_" để tắt/bật mod) — tên mod vẫn giữ nguyên.
        this.location = newModFolderPath;
        // TC11: id KHÔNG đổi khi đổi tên (id lưu trong mod.json, chỉ sinh từ
        // đường dẫn khi chưa có id) nên mod không rơi khỏi preset. Nhưng phải
        // lưu lại mod.json ngay để đường dẫn mới được ghi xuống đĩa — trước
        // đây rename() không lưu, mod.json vẫn giữ đường dẫn cũ cho tới lần
        // lưu sau. Lỗi lưu không làm hỏng lần đổi tên (thư mục đã đổi xong).
        try {
            this.saveMetaData();
        } catch (e) {
            console.error(`Đổi tên mod xong nhưng không lưu được mod.json mới: ${newModFolderPath}`, e);
        }
        return true;
    }
}

//测试代码
const modDataTemplate = new ModMetaData();
modDataTemplate.add('author', 'Unknown', ModMetaDataType.String);
modDataTemplate.add('character', 'Unknown', ModMetaDataType.String);
modDataTemplate.add('url', 'Unknown', ModMetaDataType.String);
modDataTemplate.add('tags', [], ModMetaDataType.Array);
modDataTemplate.add('category', 'Unknown', ModMetaDataType.String);
modDataTemplate.add('description', 'no description', ModMetaDataType.String);
modDataTemplate.add('hotkeys', [], ModMetaDataType.Array);
modDataTemplate.add('preview', 'Unknown', ModMetaDataType.String);
modDataTemplate.add('pinned', false, ModMetaDataType.Boolean);
ModInfo.setModDataTemplate(modDataTemplate);

// const modInfo = new ModInfo("E:\\1myProgramFile\\electron Files\\TestMod");
// console.log(modInfo.id);
// console.log(modInfo.metaData.get<string>('author'));
// console.log(modInfo.metaData.get<string>('character'));
// console.log(modInfo.metaData.get<string>('category'));
// console.log(modInfo.metaData.get<string>('tags'));
// console.log(modInfo.metaData.get<string>('hotkeys'));
// console.log(modInfo.metaData.get<string>('preview'));

export { ModInfo, ModMetaData, ModMetaDataItem, ModMetaDataType };