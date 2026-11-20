const fs = require("fs");
const path = require("path");
const { ipcRenderer } = require('electron');
import { ModInfo } from "./ModInfo";
import type { CachedModEntry } from "./ModCache";

import { EventType, EventSystem } from "../helper/EventSystem";
import { SnackType, snack, t_snack } from "../helper/SnackHelper";

import { ImageHelper } from "../helper/ImageHelper";
import ModLoader from "./ModLoader";
import { ModMetaDataType } from "./ModInfo";
import { tagFromPrefix, isValidTag } from "../helper/ModTag";
import type { ModTag } from "../helper/ModTag";

class ImageBase64 {
    private base64WithHeader: string = "";
    public get = () => this.base64WithHeader;
    public set = (base64WithHeader: string) => {
        this.base64WithHeader = base64WithHeader;
    }

    public withoutHeader = () => this.base64WithHeader.split(',')[1];
    public getExt = () => this.base64WithHeader.split(";")[0].split("/")[1];
    public clear = () => this.base64WithHeader = "";
    public isEmpty = () => this.base64WithHeader === "";

    constructor(base64WithHeader: string) {
        this.base64WithHeader = base64WithHeader;
    }
}

// Mô tả mod: thiếu hoặc là chữ mặc định cũ của app thì trả về rỗng
// (thẻ không hiện gì) thay vì hiện "no description" (Đạt dặn 20/11).
function normalizeDescription(desc: any): string {
    if (!desc || desc === 'no description') return '';
    return desc;
}

class ModData {
    public name: string;
    public character: string;
    public description: string;
    public url: string;
    public preview: string;
    public hotkeys: { key: string; description: string; }[];
    public pinned: boolean = false; // mod đã ghim (lên đầu danh sách) hay chưa
    // Tag phân loại mod (character/skin/weapon/effect/accessory), lưu
    // trong mod.json. Tag lạ/mất thì đoán theo tiền tố tên thư mục.
    public tag: ModTag = 'character';
    // Thời gian thêm mod vào kho (ms từ epoch) — dùng để sắp xếp theo thời
    // gian. Lấy theo GIỜ TẠO thư mục (birthtime), không lấy giờ sửa cuối:
    // app tự ghi lại mod.json lúc tải mod (khi file thiếu trường) nên giờ
    // sửa cuối của thư mục toàn bằng giờ mở app gần nhất, không còn nghĩa
    // là "mod mới thêm" nữa. 0 = chưa rõ (hệ thống file không có birthtime
    // và cũng không đo được giờ sửa).
    public addedMs: number = 0;
    // Dung lượng thư mục mod (byte) — cộng dồn mọi file trong thư mục.
    // -1 = chưa quét (quét nền xong mới có; lần sau lấy từ bộ nhớ sẵn).
    public sizeBytes: number = -1;

    private index = 0; // mod的id
    private static indexCount = 0; // mod的id计数器

    public id: string = ""; // mod的id

    private modSourcePath: string = ""; // mod的源路径
    private oldPreview = ""; // 旧的预览图的路径
    // public modPreviewBase64: string = ""; // mod的预览图的base64，不包含头部
    public modPreviewBase64WithHeader: ImageBase64 = new ImageBase64(""); // mod的预览图的base64，包含头部
    constructor(name: string, character: string, description: string, url: string, preview: string, hotkeys: { key: string; description: string; }[]) {
        this.name = name;
        this.character = character;
        this.description = description;
        this.url = url;
        this.preview = preview;
        this.hotkeys = hotkeys;

        this.modSourcePath = "";
        this.oldPreview = "";
        // this.modPreviewBase64 = "";
        this.modPreviewBase64WithHeader = new ImageBase64("");

        // 为每个mod生成一个id
        this.index = ModData.indexCount;
        ModData.indexCount++;
        //debug
        // const stackTrace = new Error();
        // console.log(`ℹ️ℹ️ℹ️ModData ${this.name} is being created`,this.id,stackTrace)

        // TC12: KHÔNG đăng ký bộ nghe windowSleep riêng cho mỗi mod nữa —
        // trước đây mỗi ModData tạo 1 bộ nghe mà không bao giờ hủy, mỗi lần
        // tải lại danh sách là thêm N bộ nghe cũ giữ xác ModData cũ (rò rỉ).
        // Giờ chỉ có 1 bộ nghe chung ở ModLoader, duyệt danh sách mod đang
        // sống và gọi clearPreviewCache() cho từng mod.
    }

    // Xóa bộ nhớ đệm ảnh bìa khi cửa sổ nghỉ (gọi từ bộ nghe chung ở ModLoader).
    public clearPreviewCache() {
        this.oldPreview = "";
        this.modPreviewBase64WithHeader.clear();
    }
    // 析构函数
    public destroy() {
        this.clearPreviewCache();

        // 释放资源
        ImageHelper.clearImageCache();

        // console.log(`🗑️🗑️🗑️ModData ${this.name} is being destroyed`,this.id);
    }

    setModSourcePath(modSourcePath: string) {
        this.modSourcePath = modSourcePath;
        return this;
    }
    getModSourcePath() {
        return this.modSourcePath;
    }

    public static fromJson(json: any): ModData {
        // mod 一定要有 name
        if (!json.name) {
            throw new Error("ModData.fromJson: name is required");
        }
        const modData = new ModData(
            json.name,
            json.character || "Unknown",
            normalizeDescription(json.description),
            json.url || "",
            json.preview || "",
            json.hotkeys || []
        );
        modData.pinned = !!json.pinned;
        modData.tag = isValidTag(json.tag) ? json.tag : tagFromPrefix(json.name);
        return modData;
    }
    public toJson(): any {
        return {
            name: this.name,
            character: this.character,
            description: this.description,
            url: this.url,
            preview: this.preview,
            hotkeys: this.hotkeys,
            pinned: this.pinned,
            tag: this.tag
        };
    }
    public static fromModInfo(modInfo: ModInfo): ModData {
        const modData = new ModData(
            JSON.parse(JSON.stringify(modInfo.metaData.get('name') || modInfo.modName)),
            JSON.parse(JSON.stringify(modInfo.metaData.get('character') || "Unknown")),
            JSON.parse(JSON.stringify(normalizeDescription(modInfo.metaData.get('description')))),
            JSON.parse(JSON.stringify(modInfo.metaData.get('url') || "no url")),
            "", // preview will be handled below
            JSON.parse(JSON.stringify(modInfo.metaData.get('hotkeys') || []))
        );

        modData.id = modInfo.id;
        modData.pinned = !!modInfo.metaData.get('pinned');
        const tag = modInfo.metaData.get<string>('tag');
        modData.tag = isValidTag(tag) ? tag : tagFromPrefix(modInfo.modName);

        ModData.handlePreview(modData, modInfo);
        return modData;
    }

    // Build a ModData from a cache entry without touching the disk.
    // Same field mapping and fallbacks as fromModInfo; the preview path
    // comes straight from the cache instead of a folder scan.
    public static fromCache(modInfo: ModInfo, entry: CachedModEntry): ModData {
        // Deep-clone so live edits never mutate the cached copy in memory.
        const meta = JSON.parse(JSON.stringify(entry.meta || {}));
        const modData = new ModData(
            modInfo.modName,
            meta.character || "Unknown",
            normalizeDescription(meta.description),
            meta.url || "no url",
            entry.previewPath || "",
            meta.hotkeys || []
        );
        modData.id = modInfo.id;
        modData.pinned = !!meta.pinned;
        modData.tag = isValidTag(meta.tag) ? meta.tag : tagFromPrefix(modInfo.modName);
        // Giá trị dự phòng: giờ sửa thư mục đã nằm sẵn trong cache (dùng
        // để kiểm tra mod có đổi không). ModLoader sẽ ghi đè bằng giờ tạo
        // thư mục thật (lấy lúc kiểm tra cache, không tốn thêm lần đọc đĩa).
        modData.addedMs = entry.folderMtimeMs || 0;
        modData.sizeBytes = entry.sizeBytes ?? -1;
        return modData;
    }

    static calcPreviewPath(modPath, previewName) {
        let previewPath = "";
        if (previewName) {
            // If there is a preview name, construct the path
            previewPath = path.join(modPath, previewName);
        }
        if (!previewPath || !fs.existsSync(previewPath) || !previewName) {
            // If no preview exists, search for a preview image in the mod folder
            const previewFiles = fs.readdirSync(modPath);
            const previewFile = previewFiles.find(file => file.startsWith('preview'));
            if (previewFile) {
                previewPath = path.join(modPath, previewFile);
            } else {
                // If no preview image is found, look for the first image file
                const imageFiles = previewFiles.filter(file =>
                    file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg') ||
                    file.endsWith('.gif') || file.endsWith('.bmp') || file.endsWith('.webp')
                );
                if (imageFiles.length > 0) {
                    previewPath = path.join(modPath, imageFiles[0]);
                }
            }
        }
        // If no preview is found after all attempts, set a default image
        if (!previewPath || !fs.existsSync(previewPath)) {
            previewPath = path.resolve('./src/assets/default.png');
        }

        return previewPath;
    }

    static handlePreview(modData:ModData, modInfo:ModInfo) {
        const previewName = modInfo.metaData.get('preview') || "";
        const modPath = ModLoader.getModByID(modData.id)?.location || modData.getModPathSync() || "";
        if (!modPath) {
            throw new Error("ModData.handlePreview: modPath is required, please call setModSourcePath() first");
        }
        const previewPath = ModData.calcPreviewPath(modPath, previewName);

        if (!modData.preview || !fs.existsSync(modData.preview)) {
            modData.preview = previewPath;
        }
    };

    public copy(): ModData {
        const newModData = new ModData(
            this.name,
            this.character,
            this.description,
            this.url,
            this.preview,
            // 这里需要深拷贝,不然传递的是一个引用
            JSON.parse(JSON.stringify(this.hotkeys))
        ).setModSourcePath(this.modSourcePath);
        newModData.id = this.id;
        newModData.index = this.index;
        newModData.pinned = this.pinned;
        newModData.tag = this.tag;

        return newModData;
    }
    public equals(modData: ModData): boolean {
        return JSON.stringify(this.toJson()) === JSON.stringify(modData.toJson());
    }

    public print(): string {
        let hotkeysString = "";
        this.hotkeys.forEach((hotkey) => {
            hotkeysString += `${hotkey.key} - ${hotkey.description}\n`;
        });
        return `🉑Name: ${this.name}\nCharacter: ${this.character}\nDescription: ${this.description}\nURL: ${this.url}\nPreview: ${this.preview}\nHotkeys:\n${hotkeysString}`;
    }

    //-========== 编辑预览图 ===========
    private async checkModSourcePath() {
        if (!this.modSourcePath) {
            throw new Error("ModData.checkModSourcePath: modSourcePath is required, please call setModSourcePath() first");
        }
        else if (!fs.existsSync(this.modSourcePath)) {
            throw new Error("ModData.checkModSourcePath: modSourcePath does not exist");
        }
    }

    public async setPreviewByPath(previewPath: string) {
        await this.checkModSourcePath();
        const modSourcePath = this.modSourcePath;

        // 将 previewPath 的 文件 复制到 modSourcePath 的 preview 文件夹下，并且将 mod 的 preview 属性设置为 previewPath，然后保存
        const previeFileName = path.basename(previewPath);
        // const previewDest = path.join(modSourcePath, this.name, previeFileName);
        const previewDest = path.join(this.getModPathSync(), previeFileName);
        // Nguồn và đích là cùng 1 file thì không sao chép: đổi tên mod
        // chỉ khác chữ hoa/thường trên Windows (ổ không phân biệt
        // hoa/thường) thì 2 đường dẫn khác chữ nhưng cùng 1 file — sao
        // chép đè lên chính nó vừa vô nghĩa vừa lỗi ENOENT (Đạt gặp
        // 19/11 khi đổi (ACC) thành (ac)). Vẫn cập nhật this.preview
        // xuống dưới để đường dẫn theo tên thư mục mới.
        const sameFile = process.platform === 'win32'
            ? path.resolve(previewPath).toLowerCase() === path.resolve(previewDest).toLowerCase()
            : path.resolve(previewPath) === path.resolve(previewDest);
        if (!sameFile) {
            fs.copyFileSync(previewPath, previewDest);
        }
        // Ảnh cũ còn nằm trong bộ nhớ đệm theo đường dẫn — đuổi cả đường
        // cũ lẫn đường mới ra để lần đọc sau không lấy nhầm ảnh cũ.
        ImageHelper.evictImage(this.preview);
        ImageHelper.evictImage(previewDest);
        this.preview = previewDest;

        // 清除旧的预览图
        this.oldPreview = "";
        // this.modPreviewBase64 = "";
        this.modPreviewBase64WithHeader.clear();

        // Trả về đường dẫn đích để nơi gọi đặt lại this.preview sau
        // editModInfo (editModInfo ghi đè preview bằng đường dẫn ảnh
        // đã chọn, xem handleSave trong dialogModInfo2.vue).
        return previewDest;
    }

    public async setPreviewByBase64(previewBase64: string) {
        // 检查是否有 modSourcePath
        await this.checkModSourcePath();

        const modSourcePath = this.modSourcePath;
        this.modPreviewBase64WithHeader.set(previewBase64);

        // const imageDest = path.join(modSourcePath, this.name, `preview.${this.modPreviewBase64WithHeader.getExt()}`);
        const imageDest = path.join(this.getModPathSync(), `preview.${this.modPreviewBase64WithHeader.getExt()}`);

        fs.writeFileSync(imageDest, this.modPreviewBase64WithHeader.withoutHeader(), 'base64');

        // Ảnh cũ còn nằm trong bộ nhớ đệm theo đường dẫn — đuổi cả đường
        // cũ lẫn đường mới ra để lần đọc sau không lấy nhầm ảnh cũ.
        ImageHelper.evictImage(this.preview);
        ImageHelper.evictImage(imageDest);

        //debug
        this.preview = imageDest;

        // 下次获取预览图时，直接返回这个base64
        this.oldPreview = imageDest;

        // snack提示
        snack(`Updated cover for ${this.name}`, SnackType.info);

        // 返回 图片的路径
        return imageDest;
    }

    //-========== 编辑mod信息 ===========
    public editModInfo(newModData: ModData) {
        this.name = newModData.name;
        this.character = newModData.character;
        this.description = newModData.description;
        this.url = newModData.url;
        this.preview = newModData.preview;
        this.hotkeys = newModData.hotkeys;
        this.tag = newModData.tag;

        this.oldPreview = "";
        this.modPreviewBase64WithHeader.clear();

        return this;
    }


    public async removeHotkey(key: string) {
        if (key === undefined) {
            console.log("ModData.removeHotkey: key is required");
            return;
        }
        const index = this.hotkeys.findIndex((hotkey) => hotkey.key === key);
        if (index !== -1) {
            this.hotkeys.splice(index, 1);
        }
    }

    //-========== 保存mod信息 ===========
    public async saveModInfo() {
        // 改用 modInfo 的 saveMetaData 方法来保存 mod 信息
        await this.checkModSourcePath();

        if (!this.id) {
            throw new Error("ModData.saveModInfo: id is required, please check if the mod is loaded");
        }
        const modInfo = ModLoader.getModByID(this.id);

        if (!modInfo) {
            throw new Error("ModData.saveModInfo: modInfo is not found, please check if the mod is loaded");
        }

        //debug
        console.log(`ModData.saveModInfo: ${this.name}`, this, this.toJson());

        // 保存 mod 信息，将this上所有的属性保存到 modInfo 上
        // 这里需要深拷贝，不然会传递引用
        const modInfoJson = JSON.parse(JSON.stringify(this.toJson()));
        // preview 不保存具体的路径，只保存文件名
        const previewName = path.basename(this.preview);
        modInfoJson.preview = previewName;

        //debug
        console.log(`ModData.saveModInfo: ${this.name}`, this, modInfoJson);
        // 保存 mod 信息
        const oldLocation = modInfo.location;
        modInfo.setMetaDataFromJson(modInfoJson);
        modInfo.saveMetaData();
        // Đổi tên thư mục thì ảnh bìa cũng dời theo (nó nằm trong thư mục
        // mod) — cập nhật đường dẫn ảnh trong bộ nhớ sang thư mục mới ngay:
        // để nó còn trỏ thư mục cũ đã không còn thì lần Lưu sau thấy ảnh
        // lệch sẽ sao chép từ đường dẫn cũ không tồn tại rồi báo lỗi đỏ
        // dù đổi tên đã xong (Đạt gặp 20/11, bản -5).
        if (modInfo.location !== oldLocation && this.preview) {
            const relative = path.relative(oldLocation, this.preview);
            if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
                ImageHelper.evictImage(this.preview);
                this.preview = path.join(modInfo.location, relative);
            }
        }
    }

    //-========== 获取mod信息 ===========
    // fullSize: the edit dialog / detail panel show the cover larger than
    // a card, so they use the full-size image; cards use the 250px thumbnail.
    public async getPreviewBase64(ifWithHeader: boolean = false, fullSize: boolean = false) {
        // 优化,改为使用ImageBase64类
        if (!this.preview) {
            return "";
        }
        if (this.preview === this.oldPreview && !this.modPreviewBase64WithHeader.isEmpty()) {
            return ifWithHeader ? this.modPreviewBase64WithHeader.get() : this.modPreviewBase64WithHeader.withoutHeader();
        }
        this.oldPreview = this.preview;
        if (ifWithHeader) {
            // 1s 后 清理缓存
            // setTimeout(() => {
            //     ImageHelper.clearImageCache();
            // }, 1000);
            //debug
            if (fullSize) {
                return ImageHelper.getFullImageUrlFromLocalPath(this.getModPreviewPath());
            }
            return ImageHelper.getImageUrlFromLocalPath(this.getModPreviewPath(), true);
        }

        this.modPreviewBase64WithHeader.set("data:image/png;base64," + await ipcRenderer.invoke('get-image', this.preview));
        return ifWithHeader ? this.modPreviewBase64WithHeader.get() : this.modPreviewBase64WithHeader.withoutHeader();
    }

    public getModPathSync() {
        if (!this.modSourcePath) {
            throw new Error("ModData.getModPathSync: modSourcePath is required, please call setModSourcePath() first");
        }
        else if (!fs.existsSync(this.modSourcePath)) {
            throw new Error("ModData.getModPathSync: modSourcePath does not exist");
        }

        // return path.join(this.modSourcePath, this.name);
        // 因为 name 不一定 是文件夹，所以这里需要使用ModInfo的location
        return ModLoader.getModByID(this.id)?.location || path.join(this.modSourcePath, this.name);
    }

    
    public async getModPath() {
        await this.checkModSourcePath();
        // return path.join(this.modSourcePath, this.name);
        // 因为 name 不一定 是文件夹，所以这里需要使用ModInfo的location
        const modData = ModLoader.getModByID(this.id);
        if (modData) {
            if (modData.location){
                return modData.location
            }
            else {
                console.warn(`Didn't find location of modData ${this.id}`);
                return path.join(this.modSourcePath, this.name);
            }
        }
        else {
            console.warn(`Can't get modData of ${this.id}`)
            return path.join(this.modSourcePath, this.name);
        }
    }

    public getModPreviewPath() {
        // 检查 this.preview 是否存在
        if (!this.preview || !fs.existsSync(this.preview)) {
            // 重新计算 preview
            this.preview = ModData.calcPreviewPath(this.getModPathSync(), this.preview);
            //debug
            console.log(`Recalculating preview path: ${this.preview}`);
        }
        return this.preview;
    }






    //-========== 触发事件 ===========
    public async triggerChanged() {
        EventSystem.trigger(EventType.modInfoChanged, this);
    }
    public async triggerCurrentModChanged() {
        EventSystem.trigger(EventType.currentModChanged, this);
    }
}

export { ModData };