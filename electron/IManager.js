// 这是一个单例式 Manager 类，用于 保存 管理 所有的 数据
// 所有的数据都从 这里 获取，包括 各种页面的样式，事件的触发，数据的获取等等
// 这样的话，方便将所有非核心功能 转化为 插件，方便管理和拓展

// 这个类应该 被划分到 渲染进程底下，但是 主进程也应该能够访问到这个类
const { ipcRenderer } = require('electron');

// require qua biến trung gian để Vite không phân tích tĩnh được tên module:
// 'path' là module Node, phải để Node require lúc chạy thay vì để Vite đóng gói.
const pathOsName = 'path'
const path = require(pathOsName);

// 导入fs
const fs = require('fs');

// 导入 libarchivejs
let Archive = window.Archive;
//! 下面两个变量是为了解决 vite 打包时，无法正确导入 wasm 文件的问题
import ArchiveWASM from './lib/libarchive.wasm?url';
import workerBound from './lib/worker-bundle.js?url';
import { ModInfo, ModMetaData, ModMetaDataItem, ModMetaDataType } from '../core/ModInfo';
import XXMMCore from '../core/XXMMCore';
import LogHandler from '../core/LogHandler';
import ModLoader from '../core/ModLoader';
import PresetHelper from '../core/PresetHelper';

// 导入 Language
import { Language, TranslatedText, setCurrentLanguage } from '../helper/Language';
// 导入 SnackHelper
import { t_snack, SnackType, snack } from '../helper/SnackHelper';
// 导入 EventSystem
import { EventType, EventSystem } from '../helper/EventSystem';
import { writeFileAtomicSync } from '../helper/SafeWrite';
// 导入 PluginLoader
import { IPluginLoader } from '../helper/PluginLoader';
// 导入 PathHelper
import { PathHelper } from '../helper/PathHelper';
// 导入 ModHelper
import { ModData } from '../core/ModHelper';
// 导入 DialogHelper
import { DialogID, DialogHelper } from '../helper/DialogHelper';

// // 导入 hmc-win32
// require qua biến trung gian như 'path' ở trên: hmc-win32 là module native,
// để Node require lúc chạy thay vì để Vite đóng gói.
const HMC_Name = 'hmc-win32';
const HMC = require(HMC_Name);

//-=================== 全局变量 ===================-//
let g_temp = {
    lastClickedMod: null,
    currentMod: null,
    currentCharacter: null,
    currentTab: 'mod',
    currentPreset: "default",
    wakeUped: false,
    ifDontSaveOnClose: false,
    applyResult: null,
    pendingConflicts: null,
};
let g_config = {
    firstLoad: true,
    language: 'en',
    theme: 'dark',
    modSourcePath: null,
    modTargetPath: null,
    presetPath: null,
    ifStartWithLastPreset: true,
    lastUsedPreset: null,
    defaultPresetModIds: [],
    bounds: {
        width: 800,
        height: 600,
        x: -1,
        y: -1,
    },
    ifUseTraditionalApply: false,
    cardWidth: 301,
    cardLayout: 'horizontal',
    cardWidthVertical: 250,
    cardWidthHorizontal: 301,
    cardFullImage: false,
    showChipCounts: false,
    modTypeFilter: 'all',
    modSortBy: 'default',
};
let g_data = {
    modList: [],
    presetList: [],
    characterList: [],
};

//-==================== vue 版本的全局变量 ====================//
import { ref, watch } from 'vue';
import { applyMods, applyModsTranditional, moveAppliedLink } from '../core/ApplyMods';
const g_temp_vue = {
    lastClickedMod: ref(null),
    currentMod: ref(null),
    currentCharacter: ref(null),
    currentTab: ref('mod'),
    currentPreset: ref('default'),
    wakeUped: ref(false),
    ifDontSaveOnClose: ref(false),
    applyResult: ref(null),
    pendingConflicts: ref(null),
};

const g_config_vue = {
    firstLoad: ref(true),
    language: ref('en'),
    theme: ref('dark'),
    modSourcePath: ref(null),
    modTargetPath: ref(null),
    presetPath: ref(null),
    ifStartWithLastPreset: ref(true),
    lastUsedPreset: ref(null),
    defaultPresetModIds: ref([]),
    bounds: ref({
        width: 800,
        height: 600,
        x: -1,
        y: -1,
    }),
    ifUseTraditionalApply: ref(false),
    cardWidth: ref(301),
    cardLayout: ref('horizontal'),
    cardWidthVertical: ref(250),
    cardWidthHorizontal: ref(301),
    cardFullImage: ref(false),
    showChipCounts: ref(false),
    modTypeFilter: ref('all'),
    modSortBy: ref('default'),
};

const g_data_vue = {
    modList: ref([]),
    presetList: ref([]),
    characterList: ref([]),
};


class IManager {
    //-==================== 单例 ====================
    static instance = null;
    static async getInstance() {
        if (IManager.instance) {
            return IManager.instance;
        }
        const iManager = new IManager();
        await iManager.waitInit();
        return iManager;
    }

    constructor(options = {}) {
        Archive = window.Archive;
        if (IManager.instance) {
            return IManager.instance;
        }
        IManager.instance = this;
        this.plugins = {};

        this.HMC = HMC

        // Chế độ khởi động nhẹ (cửa sổ cài đặt lần đầu / đổi cấu hình):
        // chỉ cần cài đặt, không cần danh sách mod hay plugin.
        this._lightInit = !!(options && options.light);

        // Promise hoàn thành khi init xong — waitInit() chờ promise này thay vì
        // hỏi cờ inited mỗi 10ms.
        this._initResolve = null;
        this._initPromise = new Promise((resolve) => { this._initResolve = resolve; });

        // 初始化
        this.init();
    }
    inited = false;

    anouncedFinishInit = false;
    async waitInit() {
        await this._initPromise;
        //debug
        if (!this.anouncedFinishInit) {
            console.log('✅====== waitInit done ======');
            this.anouncedFinishInit = true;
        }
        return this;
    }

    //-==================== 暴露依赖 ====================
    os = process.platform;
    HMC = null;
    ModData = ModData;
    TranslatedText = TranslatedText;
    LogHandler = LogHandler;
    // TC5: ghi file an toàn (qua file tạm rồi đổi tên) cho plugin dùng —
    // plugin tải lúc chạy bằng require nên không import được code core (TS
    // đã đóng gói), chỉ lấy được qua iManager này.
    writeFileAtomicSync = writeFileAtomicSync;


    //-==================== 核心数据 ====================

    // 核心数据，可以后面慢慢扩充，现在只将必要的数据放在这里
    // currentConfig = {
    //     name: null, // 当前配置的名称
    //     path: null, // 当前配置的路径
    // };
    // 对外暴露的 hmc 对象，使得插件可以直接调用 hmc 的方法
    // 从本地加载的配置项
    _config = {
        firstLoad: true, // 是否第一次加载
        language: 'en', // 语言
        theme: 'dark', // 主题
        modSourcePath: null, // mod的源路径
        modTargetPath: null, // mod的目标路径
        presetPath: null, // 预设路径
        ifStartWithLastPreset: true, // 是否启动时使用上次使用的预设
        lastUsedPreset: null, // 上次使用的预设,如果 ifStartWithLastPreset 为 true，则启动时使用这个预设
        defaultPresetModIds: [], // preset Mặc định没有文件 riêng，lựa chọn của nó lưu ở đây
        bounds: {
            width: 800,
            height: 600,
            x: -1,
            y: -1,
        },
        ifUseTraditionalApply: false, // 是否使用传统的应用方式
        cardWidth: 301, // Chiều rộng thẻ đang dùng (ngang mặc định 86% = 301px — Đạt dặn 20/11)
        cardLayout: 'horizontal', // Kiểu thẻ: 'vertical' (dọc 250×350) hay 'horizontal' (ngang 350×280)
        cardWidthVertical: 250, // Rộng riêng kiểu dọc (đổi qua lại thì nhớ — Đạt dặn 20/11)
        cardWidthHorizontal: 301, // Rộng riêng kiểu ngang (mặc định 86% = 301px)
        cardFullImage: false, // Thẻ hiện ảnh gốc thay vì ảnh thu nhỏ 250px (nút bên phải + — Đạt dặn 20/11)
        showChipCounts: false, // Chip nhân vật hiện số lượng mod trong ngoặc, vd Ellen (24) (công tắc trong bảng lọc — Đạt dặn 20/11)
        modTypeFilter: 'all', // Lọc theo loại mod: all/outfit/weapon/effect
        modSortBy: 'default', // Sắp xếp mod: default/name-asc/name-desc/time-desc/time-asc
    };

    // 程序运行时的数据
    // dataPath = ''; // 数据路径
    _data = {
        modList: [], // mod列表
        presetList: [], // 预设列表
        characterList: [], // 角色列表
    };

    // 临时数据，用于存储一些临时的数据
    _temp = {
        lastClickedMod: null, // 最后点击的mod，用于显示详情
        currentMod: null, // 当前mod
        currentCharacter: 'all', // 当前角色
        currentTab: 'mod', // 当前tab
        currentPreset: "default", // 当前预设
        wakeUped: false, // 是否 在唤醒状态
        ifDontSaveOnClose: false, // 是否在关闭时不保存配置
        applyResult: null, // 最后一次应用的结果，用于显示结果汇总对话框
        pendingConflicts: null, // Mod đụng nhau chờ xác nhận, hộp dialogConfirmConflict đọc lúc mở
    };

    //-==================== 设置数据 ====================
    config = new Proxy(this._config, {
        set: (target, key, value) => {
            if (target.hasOwnProperty(key)) {
                target[key] = value;
                g_config[key] = value;
                g_config_vue[key].value = value;
                return true;
            } else {
                console.error(`Invalid key: ${key}`);
                return false;
            }
        },
        get: (target, key) => {
            if (target.hasOwnProperty(key)) {
                return target[key];
            } else {
                console.error(`Invalid key: ${key}`);
                return null;
            }
        }
    });

    data = new Proxy(this._data, {
        set: (target, key, value) => {
            if (target.hasOwnProperty(key)) {
                target[key] = value;
                // 不保存 modList，因为 modList 是一个对象数组，如果 传来传去，会导致内存占用过大
                if (key === 'modList') {
                    // 打印 err
                    console.log(`data set: ${key}`, new Error());
                    // 如果 modList 变化，则 触发 modListChanged 事件
                    EventSystem.trigger(EventType.modListChanged, value);
                    return true;
                }
                g_data[key] = value;
                g_data_vue[key].value = value;
                return true;
            } else {
                console.error(`Invalid key: ${key}`);
                return false;
            }
        },
        get: (target, key) => {
            if (target.hasOwnProperty(key)) {
                return target[key];
            } else {
                console.error(`Invalid key: ${key}`);
                return null;
            }
        }
    });

    temp = new Proxy(this._temp, {
        set: (target, key, value) => {
            if (target.hasOwnProperty(key)) {
                if (!value) {
                    //debug
                    console.error('WTF,where give me null?');
                }
                target[key] = value;
                g_temp[key] = value;
                g_temp_vue[key].value = value;
                return true;
            } else {
                console.error(`Invalid key: ${key}`);
                return false;
            }
        },
        get: (target, key) => {
            if (target.hasOwnProperty(key)) {
                return target[key];
            } else {
                console.error(`Invalid key: ${key}`);
                return null;
            }
        }
    });


    //-==================== 内部方法 ====================
    snack = snack;
    t_snack = t_snack;

    async loadConfig() {
        const currentConfig = XXMMCore.getCurrentConfig();

        //如果为空，则使用默认配置，并覆盖本地配置
        // (currentConfig == {} 永远为 false：两个对象字面量不可能相等，
        // 所以损坏的配置文件以前会被当成正常配置而直接覆盖。)
        if (currentConfig == null || Object.keys(currentConfig).length === 0) {
            // snack('配置文件不存在');
            t_snack({
                vi: `Không đọc được file cấu hình, dùng cài đặt mặc định`,
                en: `Could not read the config file, using default settings`,
            }, SnackType.error);

            this.saveConfig();
            return;
        }

        // 这样会导致 较新的配置项 丢失，所以需要逐个赋值
        for (const key in currentConfig) {
            // Khóa lạ trong file (cài đặt đã bỏ ở bản mới, vd
            // ifKeepModNameAsModFolderName) thì bỏ qua lặng lẽ thay vì
            // báo lỗi — lần ghi config sau sẽ dọn nó khỏi file.
            if (!(key in this._config)) continue;
            try {
                this.config[key] = currentConfig[key];
            }
            catch (error) {
                console.log(`Loading config error: ${error}`);
                snack(`Loading config error: ${error}`);
            }
        }

        // Kiểu thẻ + rộng riêng từng kiểu (Đạt dặn 20/11):
        // - File mới toanh (không có khóa nào) → mặc định ngang 86% (301px).
        // - File cũ chưa có cardLayout: đoán kiểu theo rộng đã lưu (400 là
        //   cỡ ngang cũ test2 → ngang; còn lại → dọc, giữ nguyên rộng).
        // - File chưa có rộng riêng từng kiểu: kiểu đang dùng lấy rộng đã
        //   lưu (350 ngang là mặc định cũ → về 301 mặc định mới 86%),
        //   kiểu còn lại lấy mặc định của nó (dọc 250 / ngang 301).
        if (!('cardLayout' in currentConfig)) {
            if (currentConfig.cardWidth === 400) {
                this.config.cardLayout = 'horizontal';
                this.config.cardWidth = 301;
            } else if (typeof currentConfig.cardWidth === 'number') {
                this.config.cardLayout = 'vertical';
            }
        }
        if (!('cardWidthVertical' in currentConfig) || !('cardWidthHorizontal' in currentConfig)) {
            const layout = this.config.cardLayout;
            const w = this.config.cardWidth;
            const mine = (layout === 'horizontal' && (w === 350 || w === 400)) ? 301 : w;
            this.config.cardWidthVertical = layout === 'vertical' ? mine : 250;
            this.config.cardWidthHorizontal = layout === 'horizontal' ? mine : 301;
            this.config.cardWidth = mine;
        }

        //debug
        console.log('loadConfig adjust to:', this._config);

        // ModInfo cần biết có đang dùng cách áp dụng truyền thống không để
        // nhận biết tiền tố "disabled_" (xem ModInfo.folderNameToModName).
        ModInfo.ifUseTraditionalApply = this.config.ifUseTraditionalApply;
        watch(g_config_vue.ifUseTraditionalApply, (newValue) => {
            ModInfo.ifUseTraditionalApply = newValue;
            // debug
            console.log('ifUseTraditionalApply changed to:', newValue);
        });

        // Chỉ ghi lại file khi nội dung thật sự thay đổi — trước đây mỗi lần mở
        // app đều ghi lại toàn bộ file dù không đổi gì. File và _config dùng
        // chung một cách ghi (JSON.stringify 4 khoảng trắng) nên so sánh chuỗi
        // là đủ; file khác (thiếu khóa, khóa lạ, hỏng) vẫn được ghi lại như cũ.
        try {
            const configPath = XXMMCore.getConfigFilePath();
            const currentText = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : null;
            if (currentText !== JSON.stringify(this._config, null, 4)) {
                this.saveConfig();
            }
        } catch (e) {
            // Đọc/so sánh lỗi thì ghi lại như cũ cho chắc.
            this.saveConfig();
        }
    }

    newMods = [];

    async newLoadMods(forceRescan = false) {
        //debug
        console.log(`newLoadMods from ${this.config.modSourcePath}`);
        if (this.config.modSourcePath === null) {
            t_snack({
                vi: `Chưa đặt đường dẫn mod, hãy đặt đường dẫn mod trong Cài đặt>Cài đặt nâng cao`,
                en: `Mod path not defined, please set mod path in Settings>Advanced Settings`,
            }, SnackType.error);
            return;
        }
        if (!fs.existsSync(this.config.modSourcePath)) {
            t_snack({
                vi: `Đường dẫn mod không tồn tại, hãy kiểm tra lại đường dẫn`,
                en: `Mod path not exists, please check if the path is correct`,
            }, SnackType.error);
            return;
        }
        ModLoader.addModSourceFolder(this.config.modSourcePath);
        const loadModData = await ModLoader.loadMods(forceRescan);
    }

    // 清除 mod 缓存并重新扫描全部 mod（缓存损坏时的备用办法）。
    async rescanAllMods() {
        ModLoader.clearCache();
        await this.newLoadMods(true);
        t_snack({
            vi: `Đã quét lại toàn bộ mod`,
            en: `Rescanned all mods`,
        }, SnackType.info);
    }

    async afterModsLoad(){
        const loadModData = ModLoader.mods;
        const loadRawMods = ModLoader.modsRaw;
        // 如果 loadRawMods 中的mod 的 newMod 为 true，则将其设置为 false，并触发addMod事件
        // newMods 是 ModData 而不是 ModInfo 的数组
        this.newMods = loadModData.filter((modData) => {
            const rawMod = loadRawMods.find((raw) => raw.id === modData.id);
            return rawMod && rawMod.newMod;
        });

        // loadModData 是一个 ModData 的数组，直接赋值给 data.modList
        this.data.modList = loadModData;

        // 刷新 characterList
        await this.refreshCharacterList();

        //debug
        console.log(`Đã tải ${loadModData.length} mod, tổng cộng ${this.data.characterList.length} nhân vật, có ${this.newMods.length} mod mới`);
        return loadRawMods;
    }

    async refreshCharacterList() {
        // 加载 character
        const newList = Array.from(new Set(this.data.modList.map((mod) => mod.character))).sort();
        // Danh sách không đổi thì không gán lại — mỗi lần gán qua Proxy đều
        // kích hoạt Vue vẽ lại dải chip nhân vật. Trước đây hàm này dựng lại
        // + gán 2 lần (Set rồi Array) mỗi khi có sự kiện modInfoChanged.
        const oldList = this.data.characterList;
        if (oldList.length !== newList.length || oldList.some((c, i) => c !== newList[i])) {
            this.data.characterList = newList;
        }

        // 如果 currentCharacter 不为空，且 characterList 中不包含 currentCharacter，则将 currentCharacter 设置为 all
        // 'all' 和 'selected' 是 tab giả (không phải tên nhân vật) nên không bao giờ
        // có trong characterList — giữ nguyên tab, không ép về 'all' khi làm mới.
        // Chỉ ép về 'all' khi đang đứng ở tên nhân vật thật mà nhân vật đó đã
        // không còn mod nào trong kho nữa.
        if (this.temp.currentCharacter !== null
            && this.temp.currentCharacter !== 'all'
            && this.temp.currentCharacter !== 'selected'
            && !this.data.characterList.includes(this.temp.currentCharacter)) {
            this.setCurrentCharacter('all');
        }
    }

    async loadPresets() {
        PresetHelper.loadPresets([this.config.presetPath]);
        const data = PresetHelper.getPresetList();
        this.data.presetList = data;
    }

    async loadPreset(presetName) {
        if (presetName === 'default') {
            // Preset Mặc định không có file riêng: lựa chọn của nó lưu trong
            // config (defaultPresetModIds). Trả về object có getModIds()
            // giống Preset thật, chỉ giữ id còn tồn tại trong danh sách mod.
            const savedIds = this.config.defaultPresetModIds || [];
            const liveIds = this.data.modList.map((mod) => mod.id);
            return {
                getModIds: () => savedIds.filter((id) => liveIds.includes(id)),
            };
        }

        const preset = PresetHelper.getPresetByName(presetName);
        if (preset === null) {
            snack(`Preset ${presetName} not found`);
            return null;
        }
        console.log(`load preset ${presetName}`, preset, preset.modIds.length);
        return preset;
    }

    // Làm mới danh sách mod mà KHÔNG tải lại cả cửa sổ: quét lại thư mục mod
    // (phát hiện mod mới/xóa/đổi), cập nhật danh sách, giữ nguyên vị trí cuộn,
    // bộ lọc, ô tìm kiếm và lựa chọn.
    async refreshModList() {
        await this.loadPresets();
        await this.newLoadMods();
        EventSystem.trigger(EventType.refreshModList);
        t_snack({
            vi: `Đã làm mới danh sách mod`,
            en: `Mod list refreshed`,
        });
    }

    async getModInfo(modName) {
        // 改为直接从 data 中获取
        const data = this.data.modList.find((mod) => mod.name === modName);

        if (data == null) {
            // 如果 data 为空，则从文件中加载,并且将其添加到 modList 中
            return await this.loadModInfo(modName);
        }

        return data;
    }

    async getModInfoById(modId) {
        let data = this.data.modList.find((mod) => mod.id === modId);

        if (data == null) {
            // 如果只知道id无法找到mod，那么也没办法将其载入
            // 只能通过刷新所有的mod的方式才能够导入
            await this.newLoadMods();
            data = this.data.modList.find((mod) => mod.id === modId);
            if (data == null) {
                const tt = TranslatedText.fromObject({
                    vi: `Không tìm thấy mod có id ${modId}`,
                    en: `Cannot find mod with id ${modId}`,
                });
                t_snack(tt, SnackType.error);
                console.error(tt.get());
                return null;
            }
        }
        return data;
    }

    async loadModInfo(modName) {
        const { modInfo, modData } = await ModLoader.loadMod(path.join(this.config.modSourcePath, modName));

        if (modInfo == null) {
            const tt = TranslatedText.fromObject({
                vi: `Tải thông tin mod thất bại`,
                en: `Failed to load mod info`,
            });
            t_snack(tt, SnackType.error);
            console.error(tt.get(), modName);
            return null;
        }

        // 如果是新的 mod，则触发 addMod 事件
        if (modInfo.newMod) {
            //debug
            console.log(`new mod ${modName}`, modInfo);
            modInfo.newMod = false;
            EventSystem.trigger('addMod', modData);
        }

        // 将其添加到 modList 中，如果已经存在，则不添加
        if (!this.data.modList.find((mod) => mod.id === modData.id)) {
            //debug
            // 将之前的 modList 复制一遍（复制引用）
            this.data.modList.push(modData);
            //! 这里有点问题，我需要手动刷新一下
            console.log(`add mod ${modName} to modList`, this.data.modList.length);
        } else {
            //debug
            console.log(`mod ${modName} already exists`, this.data.modList.length);
        }

        // 刷新一下characterList (chỉ gán lại khi danh sách thật sự đổi)
        await this.refreshCharacterList();

        return modData;
    }


    async getImageBase64(imagePath) {
        // TC35: ảnh bìa bị xóa tay thì kênh IPC trả null (hoặc lỗi) —
        // không để lỗi lan lên hộp sửa mod.
        try {
            const data = await ipcRenderer.invoke('get-image', imagePath);
            return data;
        } catch (e) {
            console.error(`getImageBase64 failed for ${imagePath}`, e);
            return null;
        }
    }

    showDialog = DialogHelper.showDialog;
    dismissDialog = DialogHelper.dismissDialog;
    //-==================== 生命周期 ====================
    // 初始化
    async init() {
        let startTime = new Date().getTime();
        console.log('⏳>> loadConfig');
        await this.loadConfig();
        let endTime = new Date().getTime();
        console.log('✅>> loadConfig done, cost', endTime - startTime, 'ms');

        //-=============== 优先进行页面初始化 ===============-//
        //------ 设置窗口大小 -----
        this.setWindowBounds();
        console.log('✅>> setWindowBounds done');
        //------ 切换语言 -----
        this.trigger('languageChange', this.config.language);
        setCurrentLanguage(this.config.language);
        console.log('✅>> languageChange to', this.config.language);
        //------ 切换主题 -----
        this.trigger('themeChange', this.config.theme);
        console.log('✅>> themeChange to', this.config.theme);

        // 加载mod
        if (!this._lightInit) {
            startTime = new Date().getTime();
            // 挂载回调
            ModLoader.onAfterLoad(this.afterModsLoad.bind(this));
            await this.newLoadMods();
            endTime = new Date().getTime();
            console.log('✅>> loadMods done, cost', endTime - startTime, 'ms');

            // 加载预设
            await this.loadPresets();
            console.log('✅>> loadPresets done');
        } else {
            // Chế độ nhẹ: cửa sổ này không cần danh sách mod hay preset.
            console.log('✅>> light init: skip loadMods + loadPresets');
        }


        //debug
        console.log('✅>> init IManager done');
        this.inited = true;
        if (this._initResolve) {
            this._initResolve(this);
            this._initResolve = null;
        }

        if (!this._lightInit) {
            //----------------- 事件监听 -----------------
            EventSystem.on(EventType.modInfoChanged, async (mod) => {
                // characterList 变化 — chỉ dựng lại khi danh sách thật sự đổi
                // (đặt nhân vật hàng loạt bắn N sự kiện, không dựng lại N lần).
                await this.refreshCharacterList();
            });
            EventSystem.on(EventType.currentModChanged, (mod) => {
                this.temp.currentMod = mod;
            });
        }


        //调用 start 方法
        setTimeout(() => {
            this.trigger('initDone', this);
            // Chế độ nhẹ không tải plugin (cửa sổ này không cần plugin).
            if (!this._lightInit) {
                this.start();
            }
        }, 10);
    }

    // start 在 init 之后调用，在各个其他页面 绑定好事件之后调用
    async start() {
        // 加载插件
        await IPluginLoader.Init(this);
        console.log('✅>> loadPlugins done');
        EventSystem.trigger(EventType.pluginLoaded, this);

        //-------- 再次切换一次 语言和主题，因为有些页面可能在 init 之后才加载，所以需要再次切换一次
        this.trigger('languageChange', this.config.language);
        setCurrentLanguage(this.config.language);
        this.trigger('themeChange', this.config.theme);

        //-------- 如果有新添加的mod，则运行 addMod 事件
        if (this.newMods.length > 0) {
            this.newMods.forEach((mod) => {
                this.trigger('addMod', mod);
            });
        }
        //-------- currentMod 默认是 第一个mod
        if (this.data.modList.length > 0) {
            this.setCurrentMod(this.data.modList[0]);
            console.log('✅>> currentMod init', this.temp.currentMod);
        }

        //------ 如果开启了 ifStartWithLastPreset，则启动时使用上次使用的预设 -----
        if (this.config.ifStartWithLastPreset) {
            if (this.config.lastUsedPreset !== null) {
                //debug
                console.log('✅>> start with last preset:', this.config.lastUsedPreset);
                this.setCurrentPreset(this.config.lastUsedPreset);
            }
            else {
                //debug
                console.log('✅>> start with default preset');
                this.setCurrentPreset('default');
            }
        }
        else {
            //debug
            console.log('✅>> start with default preset');
            this.setCurrentPreset('default');
        }

        EventSystem.trigger(EventType.startDone, this);
    }
    //-==================== 对外接口 - 状态变更 ====================
    async setLastClickedMod(mod) {
        // 此方法已弃用，当调用的时候，抛出异常
        console.warn('setLastClickedMod is deprecated');
        throw new Error('setLastClickedMod is deprecated');
        this.temp.lastClickedMod = mod;
        this.trigger('lastClickedMod_Changed', mod);
    }

    async setLastClickedModByName(modName) {
        // 此方法已弃用，当调用的时候，抛出异常
        console.warn('setLastClickedModByName is deprecated');
        throw new Error('setLastClickedModByName is deprecated');
    }

    async setCurrentCharacter(character) {
        if (character === null) {
            //debug
            console.error('character is null');
            character = 'all';
        }
        this.temp.currentCharacter = character;
        this.trigger('currentCharacterChanged', character);
        //debug
        console.log(`currentCharacterChanged: ${character}`);
    }

    async setCurrentTab(tab) {
        this.temp.currentTab = tab;
        this.trigger('currentTabChanged', tab);

        //debug
        console.log(`currentTabChanged: ${tab}`);
    }

    async setCurrentPreset(presetName) {
        this.temp.currentPreset = presetName;
        this.trigger('currentPresetChanged', presetName);
    }

    async setCurrentMod(mod) {
        this.temp.currentMod = mod;
        this.trigger('currentModChanged', mod);
    }

    async setCurrentModByName(modName) {
        this.temp.currentMod = await this.getModInfo(modName);

        //debug
        console.log(`setCurrentModByName: ${modName}`, this.temp.currentMod, this.hashCode(this.temp.currentMod));
        this.trigger('currentModChanged', this.temp.currentMod);
    }

    async setCurrentModById(modId) {
        this.temp.currentMod = await this.getModInfoById(modId);
        if (this.temp.currentMod === null) {
            //debug
            console.error('mod not found', modId);
            return;
        }
        //debug
        console.log(`setCurrentModById: ${modId}`, this.temp.currentMod, this.hashCode(this.temp.currentMod));
        this.trigger('currentModChanged', this.temp.currentMod);
    }

    async toggledModByName(modName) {
        const mod = await this.getModInfo(modName);
        this.trigger('toggledMod', mod);
    }

    async setWindowBounds() {
        const bounds = this.config.bounds;
        //debug
        console.log('setWindowBounds:', bounds);
        ipcRenderer.invoke('set-bounds', JSON.stringify(bounds));
    }

    //-==================== 对外接口 - 数据处理 ====================


    //-==================== 对外接口 - 能力接口 ====================

    async startExe(exePath) {
        // 纠错
        if (!fs.existsSync(exePath)) {
            t_snack({ vi: 'Không tìm thấy file', en: 'File not found' });
            return;
        }
        this.HMC.openApp(exePath);
    }

    async runCommand(command) {
        const exec = require('child_process').exec;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return;
            }
            console.log(`stdout: ${stdout}`);
            console.error(`stderr: ${stderr}`);
        }
        );
    }

    async initAllData() {
        // Gửi đường dẫn config + preset ĐANG DÙNG để main process xóa đúng chỗ
        // (người dùng có thể dùng thư mục cấu hình tùy chỉnh, không phải mặc định).
        const result = await ipcRenderer.invoke('init-all-data', XXMMCore.getConfigFilePath(), this.config.presetPath);
        if (result && result.ok) {
            // 刷新页面
            location.reload();
        } else {
            // Xóa thất bại: báo lỗi, không reload (dữ liệu vẫn còn nguyên).
            t_snack({
                vi: `Xóa dữ liệu thất bại: ${(result && result.error) || 'lỗi không rõ'}`,
                en: `Failed to reset data: ${(result && result.error) || 'unknown error'}`,
            }, SnackType.error);
        }
    }

    async openUrl(url) {
        //debug
        console.log('open url:', url);
        if (url === '') {
            t_snack({ vi: 'Liên kết trống', en: 'Link is empty' });
            return;
        }
        ipcRenderer.invoke('open-url', url);
    }

    async changeUrl(url) {
        //debug
        console.log('change url from:', window.location.href, 'to:', url);
        // url 截取掉最后的 /index.html
        let toUrl = window.location.href.replace(/\/index.html$/, '');
        // 再截取掉最后的 /switchConfig
        toUrl = toUrl.replace(/\/switchConfig$/, '');
        // 防止最后为 / ，导致出现 // 的情况，所以再截取一次
        toUrl = toUrl.replace(/\/$/, ''); // 去掉最后的 /

        toUrl = toUrl + url + '/index.html';

        console.log('change url to:', toUrl);
        window.location.href = toUrl;
    }

    // 在桌面创建快捷方式 例如：
    // start "" "当前exe所在位置" --customConfig "当前配置文件夹"
    // 起始位置：当前 exe 所在文件夹
    // 目标位置：桌面
    async createAppShortCut(configPath) {
        const { app, shell } = require('electron');
        const path = require('path');

        const exePath = process.execPath;
        const exeDir = path.dirname(exePath);
        const desktopPath = await ipcRenderer.invoke('get-desktop-path');
        const command = `start "" "${exeDir}" --customConfig "${configPath}"`;
        console.log(`createAppShortCut from ${exeDir} to ${desktopPath} with command: ${command}`);

        // 创建快捷方式


        // 快捷方式名称和路径
        const configName = path.basename(configPath);
        const shortcutName = 'XXMM_' + configName + '.lnk';
        const shortcutPath = path.join(desktopPath, shortcutName);

        // 启动参数
        const args = `--customConfig "${configPath}"`;

        // 应用程序的根目录
        try {
            // 创建快捷方式
            await shell.writeShortcutLink(shortcutPath, 'create', {
                target: exePath,
                args: args,
                cwd: exeDir, // 设置工作目录为应用程序的根目录
                icon: exePath, // 可选：设置图标为应用程序图标
                iconIndex: 0 // 可选：图标索引，通常为0
            });

            console.log(`Shortcut created successfully at ${shortcutPath}`);
        } catch (error) {
            console.error('Failed to create shortcut:', error);
        }
    }

    //------ 文件拖拽 ------
    async handleDrop(event) {
        console.log('handleDrop', event);
        const items = event.dataTransfer.items;

        // 两个方法都试试看，我也不知道哪个会成功
        try {
            items[0].webkitGetAsEntry();
            await this.handleDropEntry(event);
        }
        catch (error) {
            this.handleDropFile(event);
        }
    }

    async handleDropEntry(event) {
        // webkitGetAsEntry 方法存在，说明是从本地文件夹拖入的文件
        // 从本地文件夹拖入的文件是 Entry 对象。
        const items = event.dataTransfer.items;

        // TC26: lặp qua TẤT CẢ item được thả, chạy tuần tự rồi báo tổng kết
        // số mod đã nhập. Trước đây chỉ dùng items[0], các mod sau bị bỏ
        // qua im lặng.
        let importedCount = 0;
        let skippedCount = 0;
        // Số mục THẬT (file/thư mục) người dùng thả — không tính các định
        // dạng clipboard. Kéo ảnh từ trình duyệt/Discord thì mỗi định dạng
        // (link, chữ, html...) cũng là 1 item nhưng webkitGetAsEntry()
        // trả null; trước đây mỗi cái null bị tính là 1 mục "bỏ qua" nên
        // kéo 1 ảnh mà app báo đỏ "Imported 0 mod(s), skipped 5 item(s)".
        let entryCount = 0;
        // Gói kéo từ trình duyệt chứa CẢ file ảnh CẢ link của cùng 1 ảnh:
        // chỉ xử lý 1 trong 2, không thì ảnh bị add 2 lần (báo "Updated
        // cover" 2 lần). Ưu tiên file; link chỉ dùng khi gói kéo không có
        // file ảnh nào và cũng không phải nhập mod.
        let handledImage = false;
        let handledMod = false;
        const urlItems = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i].webkitGetAsEntry();

            console.log('get entry from drag event', item);
            if (item == null) {
                // Không có Entry KHÔNG có nghĩa là không có file: kéo ảnh
                // từ trình duyệt/Discord thì file ảnh CÓ trong gói kéo
                // (getAsFile() lấy được) nhưng không có Entry vì nó không
                // nằm trên ổ đĩa máy. Đã kiểm chứng bằng cú kéo thật
                // 19/11: item file image/png có entry null nhưng getAsFile
                // trả file test.png đầy đủ — code cũ bỏ qua luôn nên ảnh
                // không được add (Đạt báo 19:22).
                const file = items[i].getAsFile ? items[i].getAsFile() : null;
                if (file) {
                    entryCount++;
                    const result = await this.handleDroppedFile(file);
                    if (result === 'image') handledImage = true;
                    else if (result === 'imported') { importedCount++; handledMod = true; }
                    else if (result === 'skipped') { skippedCount++; handledMod = true; }
                    else if (result === 'invalid') skippedCount++;
                    continue;
                }
                // Chỉ có link ảnh (không có file): giữ lại để xử lý sau
                // vòng lặp — chỉ tải khi gói kéo không có file ảnh nào.
                if (items[i].kind === 'string' && items[i].type === 'text/uri-list') {
                    entryCount++;
                    urlItems.push(items[i]);
                    continue;
                }
                // Định dạng clipboard khác (chữ, html...): bỏ qua im lặng,
                // không tính là "bỏ qua".
                continue;
            }
            entryCount++;
            try {
                if (item.isDirectory) {
                    // 如果拖入的是文件夹，则视为用户想要添加mod
                    console.log('Directory:', item.fullPath);
                    handledMod = true;
                    if (await this.handleFolderDrop(item)) {
                        importedCount++;
                    } else {
                        skippedCount++;
                    }
                    continue;
                }
                if (item.isFile) {
                    // 如果拖入的是文件，则视为用户想要更换mod的封面或者添加mod 压缩包
                    const file = items[i].getAsFile();
                    if (!file) {
                        skippedCount++;
                        continue;
                    }
                    const result = await this.handleDroppedFile(file);
                    if (result === 'image') handledImage = true;
                    else if (result === 'imported') { importedCount++; handledMod = true; }
                    else if (result === 'skipped') { skippedCount++; handledMod = true; }
                    else if (result === 'invalid') skippedCount++;
                }
            } catch (error) {
                console.error('handleDropEntry failed for item', i, error);
                snack('Failed to import dropped item: ' + error.message, 'error');
                skippedCount++;
            }
        }
        // Gói kéo chỉ có link ảnh (không có file ảnh, không nhập mod):
        // tải ảnh từ link đầu tiên rồi đổi cover như thả file ảnh.
        if (!handledImage && !handledMod && urlItems.length > 0) {
            urlItems[0].getAsString((url) => { this.handleImageUrlDrop(url); });
        }
        // Thả 1 mục thật thì mỗi đường xử lý đã tự báo; thả nhiều mục mới
        // báo tổng kết — và chỉ báo khi có mod được nhập hoặc có file
        // thật bị bỏ qua. Kéo mấy ảnh đổi cover thì thẻ đã đổi ngay trước
        // mắt, không cần báo "Imported 0 mod(s), skipped 0 item(s)".
        if (entryCount > 1 && (importedCount > 0 || skippedCount > 0)) {
            const t_message = {
                vi: `Đã nhập ${importedCount} mod, bỏ qua ${skippedCount} mục`,
                en: `Imported ${importedCount} mod(s), skipped ${skippedCount} item(s)`,
            }
            t_snack(t_message, importedCount > 0 ? 'success' : 'error');
        }
    }

    async handleDropFile(event) {
        // webkitGetAsEntry 方法不存在，说明是从网页拖入的文件
        // 从网页拖入的文件是 File 对象。
        try {
            const files = event.dataTransfer.files;
            // TC26: lặp qua tất cả file (trước đây chỉ files[0]).
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                //debug
                console.log(`get file from drag event ${file.name}`);
                if (file.type.startsWith('image/')) {
                    // 交给 handleImageDrop 处理
                    this.handleImageDrop(file);
                    continue;
                }
                console.log('File type:', file.type);
                snack('Invalid file type：' + file.type);
            }
        }
        catch (error) {
            console.log('Invalid drag event');
            snack('Invalid drag event');
        }
    }


    async handleImageDrop(file) {
        // 再次确认是否是图片文件
        if (!file.type.startsWith('image/')) {
            snack('Invalid image file');
            return;
        }
        // 因为electron的file对象不是标准的file对象，所以需要使用reader来读取文件
        const reader = new FileReader();
        reader.onload = (event) => {
            const imageUrl = event.target.result;
            // 这里的 imageUrl 是一个 base64 字符串，可以直接用于显示图片
            this.setModPreviewBase64ByName(imageUrl, this.temp.currentMod.name);
        };
        reader.readAsDataURL(file);
    }

    // Xử lý 1 file được thả (dùng chung cho cả 2 đường: file có Entry từ
    // thư mục máy, và file không Entry từ app khác). Ảnh → đổi cover;
    // file nén → nhập mod; còn lại → báo sai loại file.
    // Trả về 'image' | 'imported' | 'skipped' (file nén lỗi) | 'invalid'
    // (file không phải ảnh/nén).
    async handleDroppedFile(file) {
        if (file.type.startsWith('image/')) {
            // debug
            console.log(`Image file: ${file.name}`);
            // 交给 handleImageDrop 处理
            this.handleImageDrop(file);
            return 'image';
        }
        // 通过使用 libarchive 处理 压缩文件，它能够支持所有的压缩文件
        if (file.name.endsWith('.zip') || file.name.endsWith('.rar') || file.name.endsWith('.7z') || file.type === 'application/zip' || file.type === 'application/x-compressed' || file.type === 'application/x-tar' || file.type === 'application/x-gzip') {
            // debug
            console.log(`Zip file: ${file.name}`);
            // 交给 handleArchiveDrop 处理
            if (await this.handleArchiveDrop(file)) {
                return 'imported';
            }
            return 'skipped';
        }

        console.log('File type:', file.type);
        snack('Invalid file type：' + file.type);
        return 'invalid';
    }

    // Kéo ảnh mà gói kéo chỉ có link (không có file): tải ảnh từ link rồi
    // đổi cover như thả file ảnh. Link ảnh trên mạng (vd Discord CDN) cho
    // phép tải trực tiếp; tải lỗi thì báo rõ chứ không im lặng.
    async handleImageUrlDrop(url) {
        url = (url || '').trim().split(/\r?\n/)[0];
        if (!url) return;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const blob = await res.blob();
            if (!blob.type.startsWith('image/')) {
                snack('Invalid image file');
                return;
            }
            const name = url.split('/').pop().split(/[?#]/)[0] || 'dropped-image';
            this.handleImageDrop(new File([blob], name, { type: blob.type }));
        } catch (error) {
            console.error('handleImageUrlDrop failed for', url, error);
            snack('Failed to download image: ' + error.message, 'error');
        }
    }

    archivePassword = null;
    async waitForPassword() {
        this.archivePassword = null;
        this.showDialog('dialog-enter-password');
        return new Promise((resolve) => {
            const interval = setInterval(() => {
                if (this.archivePassword !== null) {
                    clearInterval(interval);
                    resolve(this.archivePassword);
                }
            }, 100);
        });
    }

    // Gộp nội dung thư mục nguồn vào thư mục đích theo từng mục (dùng
    // khi dời cả thư mục sẽ đụng tên — vd thư mục con trùng tên với
    // thư mục đích). Thư mục trùng tên thì gộp đệ quy; file trùng tên
    // thì bản trong thư mục nguồn đè lên (trường hợp này chỉ xảy ra
    // khi file nén gói trùng 1 bản mod — giữ lại 2 bản sẽ làm game
    // nạp trùng file .ini). Mục nào lỗi thì bỏ qua, dời tiếp mục khác.
    mergeDirInto(sourceDir, targetDir) {
        let items;
        try {
            items = fs.readdirSync(sourceDir, { withFileTypes: true });
        } catch (error) {
            console.error(`flattenSingleTopFolder: không đọc được thư mục ${sourceDir}: ${error}`);
            return;
        }
        for (const item of items) {
            const src = path.join(sourceDir, item.name);
            const dest = path.join(targetDir, item.name);
            try {
                if (item.isDirectory() && fs.existsSync(dest) && fs.statSync(dest).isDirectory()) {
                    this.mergeDirInto(src, dest);
                } else {
                    fs.renameSync(src, dest);
                }
            } catch (error) {
                console.error(`flattenSingleTopFolder: không dời được ${item.name}: ${error}`);
            }
        }
        try {
            fs.rmdirSync(sourceDir);
        } catch (error) {
            // Thư mục nguồn còn mục dời lỗi thì để nguyên, không phải lỗi chết.
        }
    }

    // 解压文件到指定目录的函数
    // Gỡ 1 thư mục bọc ngoài duy nhất sau khi giải nén zip thành công:
    // nhiều file zip gói mod trong 1 thư mục (vd "Mod/mod.ini") nên
    // giải nén ra thành "Mod/Mod/..." dư 1 cấp — app không tìm thấy
    // ảnh bìa (chỉ đọc mặt ngoài thư mục mod) và thư mục trông rối.
    // Chỉ gỡ khi thư mục đích có ĐÚNG 1 mục duy nhất và mục đó là thư
    // mục; có file nào khác ở mặt ngoài, hoặc 2+ thư mục, thì giữ
    // nguyên. Mục nào dời lỗi thì bỏ qua mục đó, dời tiếp mục khác —
    // không bỏ cả lần gỡ như trước. Thư mục con trùng tên với thư mục
    // đích (vd NormaSailorSukumizu trong NormaSailorSukumizu — dời cả
    // thư mục sẽ đụng đích là thư mục cha còn đồ nên văng ENOTEMPTY)
    // thì gộp nội dung vào thay vì dời cả thư mục.
    flattenSingleTopFolder(destinationPath) {
        let entries;
        try {
            entries = fs.readdirSync(destinationPath, { withFileTypes: true });
        } catch (error) {
            console.error(`flattenSingleTopFolder: không đọc được thư mục ${destinationPath}: ${error}`);
            return;
        }
        if (entries.length !== 1 || !entries[0].isDirectory()) return;
        const innerDir = path.join(destinationPath, entries[0].name);
        let innerEntries;
        try {
            innerEntries = fs.readdirSync(innerDir);
        } catch (error) {
            console.error(`flattenSingleTopFolder: không đọc được thư mục con ${innerDir}: ${error}`);
            return;
        }
        // Lượt 1: gộp các thư mục trùng tên TRƯỚC. Gộp trước thì nội
        // dung đã gộp còn nằm trong thư mục bọc để lượt 2 dời lên mặt
        // ngoài; gộp sau thì nội dung kẹt lại trong thư mục bọc, thư
        // mục bọc không xóa được.
        for (const name of innerEntries) {
            const src = path.join(innerDir, name);
            const dest = path.join(destinationPath, name);
            try {
                if (fs.existsSync(dest) && fs.statSync(src).isDirectory() && fs.statSync(dest).isDirectory()) {
                    this.mergeDirInto(src, dest);
                }
            } catch (error) {
                console.error(`flattenSingleTopFolder: không gộp được thư mục ${name}: ${error}`);
            }
        }
        // Lượt 2: đọc LẠI thư mục bọc (lượt 1 có thể đã gộp thêm mục
        // mới vào đây — vd file riêng chỉ có trong thư mục con trùng
        // tên) rồi dời tất cả lên mặt ngoài; mục nào lỗi thì bỏ qua
        // mục đó, dời tiếp mục khác.
        let remaining;
        try {
            remaining = fs.readdirSync(innerDir);
        } catch (error) {
            console.error(`flattenSingleTopFolder: không đọc được thư mục con ${innerDir}: ${error}`);
            return;
        }
        for (const name of remaining) {
            const src = path.join(innerDir, name);
            try {
                fs.renameSync(src, path.join(destinationPath, name));
            } catch (error) {
                console.error(`flattenSingleTopFolder: không dời được ${name}: ${error}`);
            }
        }
        try {
            fs.rmdirSync(innerDir);
        } catch (error) {
            console.error(`flattenSingleTopFolder: không xóa được thư mục rỗng ${innerDir}: ${error}`);
            return;
        }
        console.log(`flattenSingleTopFolder: đã gỡ thư mục bọc ngoài ${entries[0].name} trong ${destinationPath}`);
    }

    async extractArchive(archivePath, destinationPath) {
        // TC28: giới hạn tổng dung lượng sau giải nén — file nén vài GB hoặc
        // "bom nén" sẽ bị từ chối trước khi giải nén thay vì ngốn hết RAM.
        // Mod game thường dưới 1-2 GB; ngưỡng 4 GB đủ rộng cho mod lớn thật.
        const MAX_ARCHIVE_EXTRACT_BYTES = 4 * 1024 * 1024 * 1024;

        // 使用 libarchive 处理 zip 文件
        // 读取文件
        // TC29: file nén mở không được thì báo "file nén hỏng" và trả false —
        // không để lỗi văng ra ngoài làm kẹt hộp "đang tải" ở nơi gọi.
        let archiveReader;
        try {
            archiveReader = await Archive.open(archivePath);
        } catch (error) {
            console.error(`Failed to open archive: ${error}`);
            t_snack({
                vi: `File nén bị hỏng, không mở được`,
                en: `The archive is damaged and could not be opened`,
            }, 'error');
            return false;
        }

        console.debug("archive config", archiveReader, archiveReader.workerUrl);

        // TC28: extractSingleFile không tự tắt worker như extractFiles nên
        // phải đóng tay ở finally; mọi lỗi trong quá trình giải nén cũng
        // được gom về đây thay vì văng ra ngoài.
        let ifContainChinese = false;
        let ifSuccess = true;
        let ifEncrypted = false;
        // Entries skipped by the zip-slip guard (paths escaping the mod folder).
        let skippedEntries = [];
        try {
            ifEncrypted = await archiveReader.hasEncryptedData();

        if (ifEncrypted) {

            // 如果文件加密，则需要等待用户输入密码
            const password = await this.waitForPassword();
            // TC17: không in mật khẩu ra console/snack nữa. Chuỗi rỗng =
            // người dùng bấm Hủy (hoặc xác nhận với ô trống): dừng giải nén.
            if (password === null || password === '') {
                return false;
            }
            try {
                await archiveReader.usePassword(password);
            }
            catch (error) {
                // snack(`密码错误`);
                const t_message = {
                    vi: `Sai mật khẩu`,
                    en: `Incorrect password`,
                }
                t_snack(t_message, 'error');
                return false;
            }
        }

            // TC28: liệt kê trước (chỉ đọc tiêu đề, không giải nén nội dung),
            // cộng tổng dung lượng, vượt ngưỡng thì từ chối ngay.
            const entries = await archiveReader.getFilesArray();
            if (entries.length === 0) {
                console.error(`Error: Extract can't start. The archive may be damaged or is empty`);
                t_snack({
                    vi: `Không bắt đầu giải nén được, file nén có thể đã hỏng hoặc rỗng`,
                    en: `Unable to start extraction, the archive may be damaged or empty`,
                }, 'error');
                return false;
            }
            const totalSize = entries.reduce((sum, entry) => {
                const size = entry.file && typeof entry.file.size === 'number' ? entry.file.size : 0;
                return sum + size;
            }, 0);
            if (totalSize > MAX_ARCHIVE_EXTRACT_BYTES) {
                console.error(`Archive too large to extract: ${totalSize} bytes (limit ${MAX_ARCHIVE_EXTRACT_BYTES})`);
                t_snack({
                    vi: `File nén quá lớn sau khi giải nén (${(totalSize / 1024 / 1024 / 1024).toFixed(1)} GB, giới hạn 4 GB) nên không giải nén`,
                    en: `Archive is too large when extracted (${(totalSize / 1024 / 1024 / 1024).toFixed(1)} GB, limit 4 GB), extraction refused`,
                }, 'error');
                return false;
            }

            if (!fs.existsSync(destinationPath)) {
                fs.mkdirSync(destinationPath);
            }

            // Ghi 1 file đã giải nén ra đĩa (đường dẫn + chặn zip-slip giữ
            // nguyên như trước, chỉ đổi FileReader callback thành await).
            const writeEntry = async (entry) => {
                const filePath = path.join(destinationPath, entry.path);

                // Tên file/thư mục sau giải nén có ký tự lạ sẽ bị thay bằng *,
                // mà tên thư mục không chứa được * nên thay * thành _.
                const newFilePath = filePath.replace(/\*/g, '_');
                if (filePath !== newFilePath) {
                    ifContainChinese = true;
                }
                // Zip-slip guard: skip entries whose resolved path escapes the
                // destination folder (e.g. "../../evil.txt" in a malicious archive).
                // Checked on the final path (after the * replacement) and before
                // any folder is created.
                if (!PathHelper.isPathInside(destinationPath, newFilePath)) {
                    skippedEntries.push(entry.path);
                    console.error(`Skipped entry escaping the mod folder: ${entry.path}`);
                    return;
                }
                const dir = path.dirname(newFilePath);

                // Kiểm tra thư mục tồn tại chưa, chưa thì tạo.
                if (!fs.existsSync(dir) && dir !== '') {
                    fs.mkdirSync(dir, { recursive: true });
                }

                // entry.file là Blob nên phải chuyển thành Buffer mới ghi được.
                const buffer = Buffer.from(await entry.file.arrayBuffer());
                fs.writeFileSync(newFilePath, buffer);
            };

            // TC28: giải nén từng file một rồi ghi ra đĩa ngay — RAM chỉ giữ
            // 1 file tại 1 thời điểm thay vì cả file nén như extractFiles.
            // File nào lỗi thì đánh dấu thất bại rồi giải nén tiếp file sau.
            for (const entry of entries) {
                try {
                    const file = await archiveReader.extractSingleFile(entry.path);
                    await writeEntry({ file, path: entry.path });
                } catch (error) {
                    console.error(`Error extracting ${entry.path}: ${error}`);
                    snack(`Error: ${error}`, 'error');
                    ifSuccess = false;
                }
            }
        } catch (error) {
            console.error(`Error: ${error}`);
            snack(`Error: ${error}`, 'error');
            // 如果有密码可能是密码错误
            if (ifEncrypted) {
                const t_message = {
                    vi: `Sai mật khẩu`,
                    en: `Incorrect password`,
                }
                t_snack(t_message, 'error');
                return false;
            } else {
                // 没有密码可能是压缩包损坏，提示用户尝试手动解压
                const t_message = {
                    vi: `File nén có thể đã hỏng, hãy thử giải nén tay`,
                    en: `The archive may be damaged, try to extract it manually`,
                }
                t_snack(t_message, 'error');
                return false;
            }
        } finally {
            try {
                await archiveReader.close();
            } catch (_closeErr) {
                // Bỏ qua: worker đã tắt hoặc chưa kịp mở.
            }
        }

        // 如果解压出来的文件包含中文，则提示用户
        if (ifContainChinese) {
            // snack(`文件夹名不能包含中文`);
            const t_message = {
                vi: `Tên thư mục sau khi giải nén có ký tự đặc biệt, đã thay bằng _`,
                en: `Folder name cannot contain special characters, and has been replaced with _`,
            }
            t_snack(t_message, 'error');
        }

        // 如果解压失败，则提示用户
        if (!ifSuccess) {
            // snack(`解压失败`);
            const t_message = {
                vi: `Giải nén thất bại, hãy giải nén tay`,
                en: `Extraction failed, please extract manually`,
            }
            t_snack(t_message, 'error');

            // 删除解压的文件
            setTimeout(() => {
                fs.rmdirSync(destinationPath, { recursive: true });
                console.log(`Deleted folder: ${destinationPath}`);
            }, 1000);
            return false;
        }
        else {
            // 提示用户
            // snack(`解压成功`);
            const t_message = {
                vi: `Mod ${path.basename(destinationPath)} đã giải nén xong`,
                en: `Mod ${path.basename(destinationPath)} extracted successfully`,
            }
            t_snack(t_message);
            // Report entries the zip-slip guard skipped, so the user knows the
            // archive tried to write outside the mod folder.
            if (skippedEntries.length > 0) {
                const t_skipped = {
                    vi: `Đã bỏ qua ${skippedEntries.length} file cố ghi ra ngoài thư mục mod: ${skippedEntries.join(', ')}`,
                    en: `Skipped ${skippedEntries.length} file(s) trying to write outside the mod folder: ${skippedEntries.join(', ')}`,
                }
                t_snack(t_skipped, 'error');
            }

            // Gỡ thư mục bọc ngoài duy nhất nếu có (zip gói 1 thư
            // mục thì giải nén ra dư 1 cấp — xem flattenSingleTopFolder).
            this.flattenSingleTopFolder(destinationPath);

            return true;
        }
    }

    async handleArchiveDrop(file) {
        //debug
        console.log(`handle zip drop: ${file.name}`);

        // 解压到指定位置
        // modName 是文件名，不包含后缀
        const modName = file.name.slice(0, file.name.lastIndexOf('.'));
        const modPath = path.join(this.config.modSourcePath, modName);
        // 创建mod文件夹
        if (fs.existsSync(modPath)) {
            const t_message = {
                vi: `Mod ${modName} đã tồn tại`,
                en: `Mod ${modName} already exists`,
            }
            t_snack(t_message, 'error');
            return false;
        }

        this.showDialog('loading-dialog');

        // 解压文件
        // 使用 libarchive 处理 zip 文件
        //debug
        console.log(`extracting ${file.name} to ${modPath}`);

        // TC29: giải nén văng lỗi thì hộp "đang tải" vẫn phải tắt —
        // không thì người dùng kẹt mãi ở màn hình chờ.
        let ifSuccess = false;
        try {
            // Ghi lại thời gian giải nén.
            const startTime = new Date().getTime();
            ifSuccess = await this.extractArchive(file, modPath);
            const endTime = new Date().getTime();
            console.log(`extracted ${file.name} in ${endTime - startTime}ms`);
        } catch (e) {
            console.error(`handleArchiveDrop failed for ${file.name}`, e);
            t_snack({
                vi: `File nén bị hỏng, không giải nén được: ${file.name}`,
                en: `The archive is damaged and could not be extracted: ${file.name}`,
            }, 'error');
        } finally {
            this.dismissDialog('loading-dialog');
        }

        if (ifSuccess) {
            //- 不再需要完全刷新，只需要将新的mod添加到列表中
            // 读取 mod.json    
            const mod = await this.getModInfo(modName);
            console.log(`getModInfo:`, mod);

            // 如果 currentCharacter 不为空，且 mod 的 character 为 unknown，则将 mod 的 character 设置为 currentCharacter
            //debug
            console.log(`currentCharacter: ${this.temp.currentCharacter}`, mod.character);
            if (this.temp.currentCharacter !== null && this.temp.currentCharacter !== 'all' && this.temp.currentCharacter !== 'selected' && mod.character === 'Unknown') {
                mod.character = this.temp.currentCharacter;
                await mod.saveModInfo();
                mod.triggerChanged();
            }

            this.setCurrentCharacter(mod.character);


            this.setCurrentMod(mod);
            this.showDialog('edit-mod-dialog');
        }
        else {
            // 解压失败，删除文件夹
            if (fs.existsSync(modPath)) {
                fs.rmdirSync(modPath, { recursive: true });
                console.log(`Deleted folder: ${modPath}`);
            }
        }

        // TC26: trả về true/false để handleDropEntry đếm số mod đã nhập.
        return ifSuccess;
    }


    async handleZipDrop(file) {
        //debug
        console.log(`handle zip drop: ${file.name}`);
        //使用 libarchive 处理 zip 文件
        this.handleArchiveDrop(file);
        return;
    }

    async handleFolderDrop(item) {
        // 如果拖入的是文件夹，则视为用户想要添加一个mod
        // 检查是否已经存在同名的mod
        // debug
        console.log(`handle folder drop: ${item.fullPath}`);
        // 这里的 item.fullPath 是一个虚拟路径，以 / 开头，需要去掉
        const modName = item.fullPath.slice(1);
        // 如果 modList 中已经存在同名的mod，则提示用户
        if (this.data.modList.find((mod) => mod.name === modName)) {
            snack(`Mod ${modName} already exists`);
            return false;
        }
        // 将文件夹拷贝到 modSourceDir 中
        // 但是这里的 item 的 fullPath 是一个虚拟路径，无法直接使用 fs 进行操作
        // 但是我们可以递归读取每一个文件，然后将其拷贝到 modSourceDir 的对应位置
        this.showDialog('loading-dialog');
        // TC27: copy lỗi thì báo rõ + dọn thư mục dở dang, hộp chờ luôn được tắt.
        const copiedPath = path.join(this.config.modSourcePath, modName);
        try {
            await this.copyFolder(item, this.config.modSourcePath);
        } catch (e) {
            console.error(`Failed to import folder ${modName}`, e);
            t_snack({
                vi: `Nhập thư mục ${modName} thất bại: ${e.message || e}`,
                en: `Failed to import folder ${modName}: ${e.message || e}`,
            }, 'error');
            try {
                if (fs.existsSync(copiedPath)) {
                    fs.rmSync(copiedPath, { recursive: true, force: true });
                }
            } catch (cleanupErr) {
                console.error(`Failed to clean up partial folder ${copiedPath}`, cleanupErr);
            }
            return;
        } finally {
            // Tắt hộp chờ.
            this.dismissDialog('loading-dialog');
        }


        //debug
        console.log(`Copied folder: ${item.fullPath}`);

        //- 不再需要完全刷新，只需要将新的mod添加到列表中

        const mod = await this.getModInfo(modName);
        console.log(`getModInfo:`, mod);

        // 如果 currentCharacter 不为空，且 mod 的 character 为 unknown，则将 mod 的 character 设置为 currentCharacter
        //debug
        console.log(`currentCharacter: ${this.temp.currentCharacter}`, mod.character);
        if (this.temp.currentCharacter !== null && this.temp.currentCharacter !== 'all' && this.temp.currentCharacter !== 'selected' && mod.character === 'Unknown') {
            mod.character = this.temp.currentCharacter;
            await mod.saveModInfo();
            mod.triggerChanged();
        }

        this.setCurrentMod(mod);
        this.setCurrentCharacter(mod.character);

        this.showDialog('edit-mod-dialog');

        // getModInfo 遇到新的 mod 会触发 addMod 事件，所以这里不需要再次触发
        // TC26: trả về true để handleDropEntry đếm số mod đã nhập.
        return true;
    }

    async setFilter(character) {
        //debug
        console.log(`set filter: ${character}`);
        this.temp.currentCharacter = character;
        this.trigger('currentCharacterChanged', character);
    }

    // 递归复制文件夹
    async copyFolder(item, targetDir) {
        // debug
        console.log(`copy folder ${item.fullPath} to ${targetDir}`);
        const relativePath = item.fullPath.slice(1); // 去掉开头的 '/'
        const targetPath = path.join(targetDir, relativePath);

        if (item.isDirectory) {
            if (!fs.existsSync(targetPath)) {
                fs.mkdirSync(targetPath, { recursive: true });
            }
            // TC27: readEntries() theo đặc tả có thể chỉ trả 1 phần —
            // phải gọi lặp tới khi trả rỗng, không thì thư mục nhiều file sẽ mất file.
            const reader = item.createReader();
            for (;;) {
                const entries = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
                if (entries.length === 0) {
                    break;
                }
                for (const entry of entries) {
                    await this.copyFolder(entry, targetDir);
                }
            }
        } else if (item.isFile) {
            const file = await new Promise((resolve, reject) => item.file(resolve, reject));
            // TC27: chép theo từng khúc 8MB thay vì đọc trọn file vào RAM —
            // file mod vài GB không còn làm app ngốn RAM. Ghi ra file tạm rồi
            // đổi tên để file dở dang không bao giờ trông như file xong.
            const tmpPath = `${targetPath}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
            const CHUNK_SIZE = 8 * 1024 * 1024;
            const fd = fs.openSync(tmpPath, 'w');
            try {
                for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
                    const chunk = file.slice(offset, offset + CHUNK_SIZE);
                    const buffer = Buffer.from(await chunk.arrayBuffer());
                    fs.writeSync(fd, buffer);
                }
            } catch (e) {
                try { fs.closeSync(fd); } catch (_ignored) { /* bỏ qua */ }
                try { fs.unlinkSync(tmpPath); } catch (_ignored) { /* bỏ qua */ }
                throw e;
            }
            fs.closeSync(fd);
            fs.renameSync(tmpPath, targetPath);
            console.log(`Copied file from ${item.fullPath} to ${targetPath}`);
        }
    }

    //-------- 保存mod的预览图 --------
    async setModPreviewBase64ByName(previewBase64, modName) {
        // 将图片保存到modSource文件夹中，文件名为preview+后缀名，并且将其保存到mod.json中
        // 检查 modName 是否存在
        const modInfo = this.data.modList.find((mod) => mod.name === modName);
        if (!modInfo) {
            snack(`Mod ${modName} not found`);
            return;
        }
        //debug
        console.log(`update mod card cover of`, modInfo);
        // Phải chờ ghi xong mới báo đổi: setPreviewByBase64 là async (nó
        // await checkModSourcePath trước khi ghi file + cập nhật base64
        // trong bộ nhớ). Không await thì triggerChanged() chạy trước khi
        // ảnh mới được ghi, thẻ đọc lại vẫn thấy ảnh cũ.
        const modImageDest = await modInfo.setPreviewByBase64(previewBase64);

        // 保存到本地
        modInfo.saveModInfo();

        // 触发事件
        modInfo.triggerChanged();
        modInfo.triggerCurrentModChanged();

        return modImageDest;
    }

    //-==================== 对外接口 ====================
    async openNewWindow(windowPath) {
        await ipcRenderer.send('open-new-window', windowPath);
    }

    async savePresetByModNames(presetName, modNames) {
        PresetHelper.savePresetByName(presetName, modNames);
    }

    async savePresetByModIds(presetName,modIds){
        PresetHelper.savePresetById(presetName,modIds);
    }

    // Lưu lựa chọn của preset Mặc định vào config (nó không có file riêng).
    async saveDefaultPreset(modIds){
        this.config.defaultPresetModIds = [...modIds];
        this.saveConfig();
    }

    // Đổi tên mod trong app (chế độ thường) thì dời luôn liên kết trong
    // thư mục đích theo tên mới — hộp sửa mod gọi sau khi lưu xong. Chế
    // độ truyền thống không có liên kết nên không làm gì. Lỗi dời liên
    // kết chỉ báo cho biết (thư mục đã đổi tên xong, bấm Apply lại là
    // xong), không tính là lưu thất bại.
    moveAppliedLink(oldName, newName) {
        if (this.config.ifUseTraditionalApply) return true;
        const ok = moveAppliedLink(oldName, newName, this.config.modSourcePath, this.config.modTargetPath);
        if (!ok) {
            t_snack({
                vi: `Đã đổi tên mod nhưng chưa dời được liên kết trong thư mục đích — bấm Apply lại để áp dụng với tên mới`,
                en: `Mod renamed but its link in the target folder could not be moved — press Apply again to apply it under the new name`,
            }, 'error');
        }
        return ok;
    }

    async applyMods(modList, onProgress) {
        const modTargetPath = this.config.modTargetPath;
        const modSourcePath = this.config.modSourcePath;
        if (modTargetPath === null || modTargetPath === '') {
            t_snack({
                vi: 'Chưa đặt đường dẫn đích',
                en: 'Target path not set',
            }, 'error');
            return null;
        }
        if (modSourcePath === null || modSourcePath === '') {
            t_snack({
                vi: 'Chưa đặt đường dẫn nguồn',
                en: 'Source path not set',
            }, 'error');
            return null;
        }
        let result;
        try {
            if (this.config.ifUseTraditionalApply){
                result = await applyModsTranditional(modList, onProgress);
            }
            else {
                result = await applyMods(modList, modSourcePath, modTargetPath, onProgress);
            }
        } catch (err) {
            console.error('applyMods failed', err);
            t_snack({
                vi: `Áp dụng thất bại: ${err.message}`,
                en: `Apply failed: ${err.message}`,
            }, 'error');
            return null;
        }
        if (result === null) {
            // Pre-flight check failed; a message was already shown.
            return null;
        }
        
        this.trigger('modsApplied', modList);
        if (result.failures.length > 0) {
            // Show one summary with every failure instead of a success message,
            // so a failed link never looks like success.
            this.temp.applyResult = result;
            this.showDialog('dialog-apply-result');
        } else {
            t_snack({
                vi: 'Áp dụng thành công',
                en: 'Applied successfully',
            });
        }
        return result;
    }

    async addPreset(presetName) {
        const newPresetPath = path.join(this.config.presetPath, presetName + '.json');
        // TC5: ghi qua file tạm rồi đổi tên.
        writeFileAtomicSync(newPresetPath, JSON.stringify(this.data.modList));

        // 刷新预设列表
        await this.loadPresets();

        this.trigger('addPreset', presetName);

        setTimeout(() => {
            this.setCurrentPreset(presetName);
        }, 200);
    }

    // Xóa preset đang chọn (Đạt dặn 20/11): xóa file preset, làm mới
    // danh sách, quay về preset Mặc định (luôn có sẵn). Preset Mặc định
    // không có file riêng nên không xóa được. Lần ghi preset đang chờ
    // (nếu có) vô hại: lúc nó chạy thì preset hiện tại đã là Mặc định,
    // nó ghi lựa chọn mới vào Mặc định, không chạm file đã xóa.
    async deletePreset(presetName) {
        if (presetName === 'default') {
            t_snack({ vi: 'Không xóa được preset Mặc định', en: 'Cannot delete the Default preset' }, 'error');
            return;
        }
        const presetFile = path.join(this.config.presetPath, presetName + '.json');
        try {
            fs.unlinkSync(presetFile);
        } catch (err) {
            t_snack({ vi: `Xóa preset thất bại: ${err.message}`, en: `Failed to delete preset: ${err.message}` }, 'error');
            console.error('deletePreset failed', presetName, err);
            return;
        }
        await this.loadPresets();
        this.setCurrentPreset('default');
        t_snack({ vi: `Đã xóa preset ${presetName}`, en: `Preset ${presetName} deleted` });
    }

    async changePreview(modName, previewPath) {
        // 将 previewPath 的 文件 复制到 modSourcePath 的 preview 文件夹下，并且将 mod 的 preview 属性设置为 previewPath，然后保存

        // 从 data 中获取 mod
        const mod = this.data.modList.find((mod) => mod.name === modName);
        if (!mod) {
            snack(`Mod ${modName} not found`);
            return;
        }

        const previewFileName = path.basename(previewPath);
        const newPreviewPath = path.join(this.config.modSourcePath, modName, previewFileName);
        //debug
        console.log(`copy ${previewPath} to ${newPreviewPath}`);
        fs.copyFileSync(previewPath, newPreviewPath);
        mod.preview = newPreviewPath;

        // 保存
        mod.saveModInfo();
    }

    async saveConfig() {
        XXMMCore.saveCurrentConfig(this._config);
    }

    // Lúc đóng app (src/main.js onbeforeunload) gọi hàm này để lưu cài
    // đặt lần cuối (vị trí cửa sổ, preset đang dùng). Trước đây hàm này
    // KHÔNG tồn tại nên mỗi lần đóng app là 1 lỗi lặng TypeError và cài
    // đặt lúc đóng không được lưu (Đạt báo 19/11). saveCurrentConfig
    // vốn đã ghi đồng bộ (ghi file tạm rồi đổi tên) nên gọi thẳng là
    // xong trước khi cửa sổ đóng.
    saveConfigSync() {
        XXMMCore.saveCurrentConfig(this._config);
    }


    async getFilePath(fileName, fileType, defaultPath) {
        const filePath = await ipcRenderer.invoke('get-file-path', fileName, fileType, defaultPath);
        //debug
        console.log('=================================');
        console.log(filePath);
        if (filePath) {
            return filePath;
        }
        // Người dùng bấm Hủy trong hộp chọn: trả về chuỗi rỗng, không báo lỗi —
        // hủy chọn không phải lỗi, nơi gọi sẽ giữ nguyên đường dẫn cũ.
        return '';
    }

    async setConfig(key, value) {
        if (this.config[key] === undefined) {
            //debug
            console.log('Thuộc tính không xác định, hãy kiểm tra', key, this.config);
            t_snack({ vi: 'Thuộc tính không xác định, hãy kiểm tra', en: 'Unknown property, please check' });
            return;
        }
        this.config[key] = value;
        // 考虑 这里 要不要 增加一个 事件钩子，当 config 改变时，触发一个事件
        // 暂时没有这个需求
        this.saveConfig();
    }

    async setConfigFromDialog(key, fileType) {
        const filePath = await this.getFilePath(key, fileType);
        if (this.config[key] === undefined) {
            //debug
            console.log('Thuộc tính không xác định, hãy kiểm tra', key, this.config);
            t_snack({ vi: 'Thuộc tính không xác định, hãy kiểm tra', en: 'Unknown property, please check' });
            return '';
        }
        if (filePath && filePath.length > 0) {
            this.config[key] = filePath;
            this.saveConfig();
            return filePath;
        }
        else {
            t_snack({ vi: 'Chưa chọn file', en: 'No file selected' });
            return '';
        }
    }

    async setLanguage(language) {
        //debug
        console.log(`iManager current language: ${this.config.language}, set language: ${language}`);
        if (language !== 'vi' && language !== 'en') {
            t_snack({ vi: 'Ngôn ngữ không được hỗ trợ', en: 'Unsupported language' });
            return;
        }
        if (this.config.language === language) {
            return;
        }

        this.config.language = language;
        this.trigger('languageChange', language);
        setCurrentLanguage(language);
        //debug eventList
        console.log(this.eventList);
        this.saveConfig();
    }

    async setTheme(theme) {
        if (theme !== 'auto' && theme !== 'dark' && theme !== 'light') {
            t_snack({ vi: 'Giao diện không được hỗ trợ', en: 'Unsupported theme' });
            return;
        }
        if (this.config.theme === theme) {
            return;
        }

        this.config.theme = theme;
        this.trigger('themeChange', theme);
        this.saveConfig();
    }


    async moveAllFiles(sourcePath, targetPath) {
        const moveAllFiles = (srcDir, destDir) => {
            // 将 srcDir 下的所有文件移动到 destDir
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }

            const files = fs.readdirSync(srcDir);
            files.forEach(file => {
                const srcFile = path.join(srcDir, file);
                const destFile = path.join(destDir, file);
                fs.copyFileSync(srcFile, destFile);
                fs.unlinkSync(srcFile);
            });
        }

        moveAllFiles(sourcePath, targetPath);
    }

    //-==================== 事件管理 ====================
    on = EventSystem.on;
    trigger = EventSystem.trigger;

    static triggerWakeUp() {
        console.log('🌞wakeUp');
        EventSystem.trigger('wakeUp', this.instance);
    }

    //-===================== 插件 =====================
    //----------插件接口----------
    // 改为使用 IPluginLoader 的接口
    getPluginData = IPluginLoader.GetPluginData;
    setPluginData = IPluginLoader.SetPluginData;
    registerPluginConfig = IPluginLoader.RegisterPluginConfig;
    savePluginConfigSync = IPluginLoader.SaveAllPluginConfigSync;
    savePluginConfig = IPluginLoader.SaveAllPluginConfig;

    // 支持 css 在当前页面的插入/删除
    addCssWithHash(css) {
        const hash = this.hashCode(css);
        const existingStyle = document.getElementById(hash);
        if (existingStyle) {
            return;
        }
        const style = document.createElement('style');
        style.id = hash;
        style.innerHTML = css;
        document.head.appendChild(style);
    }

    removeCssWithHash(css) {
        const hash = this.hashCode(css);
        const style = document.getElementById(hash);
        if (style) {
            document.head.removeChild(style);
        }
    }

    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash |= 0; // Convert to 32bit integer
        }
        return hash.toString();
    }
}

function waitInitIManager() {
    return new Promise((resolve, reject) => {
        IManager.getInstance().then((iManager) => {
            iManager.waitInit().then(() => {
                resolve(iManager);
            });
        });
    });
}

// 只有同时满足 主进程那边确认这次是 初次加载 以及 这里 插件加载完成（也就是startdone）之后，才会触发 wakeUp 事件
// TC33: đếm bằng 2 cờ riêng + chặn kích hoạt 2 lần, thay cho bộ đếm
// chung == 2 — tín hiệu wakeUp tới 2 lần (tải lại trang, hẹn giờ dự phòng
// ở tiến trình chính) không còn làm lệch số đếm rồi mất luôn wakeUp nữa.
let wakeUpSignalReceived = false;
let startDoneReceived = false;
let wakeUpTriggered = false;
function maybeTriggerWakeUp() {
    if (wakeUpSignalReceived && startDoneReceived && !wakeUpTriggered) {
        wakeUpTriggered = true;
        IManager.triggerWakeUp();
    }
}
ipcRenderer.on('wakeUp', () => {
    wakeUpSignalReceived = true;
    maybeTriggerWakeUp();
    // 这里不应该是在initdone完成之后触发，应该是在 startdone 之后触发
});
EventSystem.on(EventType.startDone, () => {
    startDoneReceived = true;
    maybeTriggerWakeUp();
});

// send a ready event to main process
ipcRenderer.send('main-window-ready');

let sleepTimer = '';
let isSleeping = false;
// 失去焦点10s后进入睡眠模式
const sleepTimeOutTime = 10000;

ipcRenderer.on('windowBlur', () => {
    const tt = new TranslatedText("☁️windowBlur", "☁️Cửa sổ mất tiêu điểm");
    console.log(tt.get());
    t_snack(tt);
    EventSystem.trigger('windowBlur');

    sleepTimer = setTimeout(() => {
        EventSystem.trigger('windowSleep');
        isSleeping = true;
        const tt2 = new TranslatedText("💤windowSleep", "💤Cửa sổ nghỉ");
        console.log(tt2.get());
        t_snack(tt2);
    }, sleepTimeOutTime);
});

ipcRenderer.on('windowFocus', () => {
    const tt = new TranslatedText("👀windowFocus", "👀Cửa sổ được chọn");
    console.log(tt.get());
    if (isSleeping) {
        t_snack(tt);
        isSleeping = false;
        EventSystem.trigger('windowWake');
    }
    EventSystem.trigger('windowFocus');

    if (sleepTimer != '') {
        clearTimeout(sleepTimer);
    }
});

export default IManager;
export { waitInitIManager, g_temp, g_temp_vue, g_config, g_config_vue, g_data, g_data_vue };
