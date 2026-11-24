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

// fileURLToPath (đổi file:// URL thành đường dẫn đĩa để đọc file wasm) —
// require qua biến trung gian như 'path' để Vite không phân tích tĩnh.
const urlModuleName = 'url';
const { fileURLToPath } = require(urlModuleName);

// Gọi mạng tới GameBanana bằng module Node (renderer fetch bị CORS chặn
// với gamebanana.com) — require qua biến trung gian như 'path'.
const httpsModuleName = 'https';
const https = require(httpsModuleName);
const httpModuleName = 'http';
const http = require(httpModuleName);

// Thư mục tạm của hệ điều hành (để file ảnh kéo từ khung Banana) —
// require qua biến trung gian như 'path'.
const osModuleName = 'os';
const os = require(osModuleName);

// Cờ chống chạy chồng cho kiểm tra/cập nhật Banana — ĐẶT Ở CẤP MODULE
// (không phải trường của instance): mỗi component tạo riêng 1 new
// IManager() nên cờ instance không chặn được nhau — kiểm tra tự động
// lúc mở app và kiểm tra bấm tay có thể chạy chồng, hỏi Banana trùng
// nhau. Module chỉ đóng gói 1 lần nên biến cấp module dùng chung cho
// mọi instance.
let gbChecking = false;
const gbUpdatingIds = new Set();

// File tạm của lần kéo ảnh gần nhất từ khung Banana — xóa khi bắt đầu
// lần kéo sau (xem gbStartDragImage). Cấp module như gbChecking vì mỗi
// component tạo riêng 1 IManager.
let gbDragTmpPath = null;

// Cờ chống chạy chồng cho Mod Fixer — CẤP MODULE như gbChecking (mỗi
// component tạo riêng 1 IManager nên cờ instance không chặn được nhau).
let fixerChecking = false;
let fixerDownloading = false;
let fixerScanning = false;
let fixerFixing = false;
// Cờ chống tải chồng cho XXMI Launcher (trình setup 1.5.30) — cấp module
// như fixerDownloading.
let xxmiDownloading = false;

// 导入 libarchivejs
let Archive = window.Archive;
//! 下面两个变量是为了解决 vite 打包时，无法正确导入 wasm 文件的问题
import ArchiveWASM from './lib/libarchive.wasm?url';
import workerBound from './lib/worker-bundle.js?url';
// node-unrar-js: giải nén .rar (libarchive không mở được rar mã hóa).
// Import wasm bằng ?url để Vite copy file vào dist/assets/unrar.wasm.
import { createExtractorFromData } from 'node-unrar-js';
import unrarWasmUrl from 'node-unrar-js/dist/js/unrar.wasm?url';
import { ModInfo, ModMetaData, ModMetaDataItem, ModMetaDataType } from '../core/ModInfo';
import XXMMCore from '../core/XXMMCore';
import LogHandler from '../core/LogHandler';
import ModLoader from '../core/ModLoader';
import PresetHelper from '../core/PresetHelper';

// 导入 Language
import { Language, TranslatedText, setCurrentLanguage } from '../helper/Language';
// 导入 SnackHelper
import { t_snack, SnackType, snack } from '../helper/SnackHelper';
import { guessCharacterFromNames } from '../helper/CharacterGuess';
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
// GameBanana: hàm thuần (đọc mã mod từ link, chọn file mới nhất) +
// quét dung lượng + bộ nhớ đệm ảnh (cập nhật bản mới xong thì đuổi ảnh
// bìa cũ, quét lại dung lượng).
import { parseGameBananaModId, pickLatestGbFile, GB_API_BASE, GB_USER_AGENT } from '../helper/GameBanana';
// Mod Fixer: hàm thuần (đọc release GitHub, tách bảng mã cũ từ file .py)
// + bảng mã cũ đóng gói kèm app (dự phòng khi không tải được từ GitHub)
// + đọc mã hash trong file .ini của mod (để quét mod nghi hỏng).
import { FIXER_API_LATEST, FIXER_PYDATA_API, FIXER_PYDATA_RAW_BASE, FIXER_STATE_FILE, normalizeFixerRelease, parseFixerOldHashes } from '../helper/ModFixer';
import fixerOldHashesBundled from '../helper/fixer-old-hashes.json';
import { XXMI_API_LATEST, normalizeXxmiRelease } from '../helper/SetupDetect';
import { extractModHashes } from '../helper/ConflictCheck';
import ModSizeScanner from '../helper/ModSizeScanner';
import { ImageHelper } from '../helper/ImageHelper';

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
    editingNewMod: false,
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
    fixerVersion: null, // Bản Fixer đã tải về (tag release, vd zzz-mod-fixer-v2.3.0)
    fixerFileName: null, // Tên file .exe Fixer đã tải về
    xxmiVersion: null, // Bản XXMI Launcher đã tải về (tag release, vd v2.5.0)
    xxmiInstallerFileName: null, // Tên file MSI XXMI Launcher đã tải về
    fixerSuspectIds: null, // id các mod nghi hỏng từ lần quét Fixer gần nhất (null = chưa quét bao giờ)
    showOnlySuspected: false, // Lưới Mod chỉ hiện mod nghi hỏng (công tắc trong bảng lọc — Đạt dặn 23/11)
    showConflictWarning: false, // Hiện hộp cảnh báo mod trùng nhau khi bấm Apply — mặc định TẮT, Đạt bật khi cần (23/11)
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
    editingNewMod: ref(false),
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
    fixerVersion: ref(null),
    fixerFileName: ref(null),
    xxmiVersion: ref(null),
    xxmiInstallerFileName: ref(null),
    fixerSuspectIds: ref(null),
    showOnlySuspected: ref(false),
    showConflictWarning: ref(false),
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
        fixerVersion: null, // Bản Fixer đã tải về (tag release, vd zzz-mod-fixer-v2.3.0)
        fixerFileName: null, // Tên file .exe Fixer đã tải về
    xxmiVersion: null, // Bản XXMI Launcher đã tải về (tag release, vd v2.5.0)
    xxmiInstallerFileName: null, // Tên file MSI XXMI Launcher đã tải về
        fixerSuspectIds: null, // id các mod nghi hỏng từ lần quét Fixer gần nhất (null = chưa quét bao giờ)
        showOnlySuspected: false, // Lưới Mod chỉ hiện mod nghi hỏng (công tắc trong bảng lọc — Đạt dặn 23/11)
        showConflictWarning: false, // Hiện hộp cảnh báo mod trùng nhau khi bấm Apply — mặc định TẮT, Đạt bật khi cần (23/11)
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
        editingNewMod: false, // Hộp sửa đang mở cho mod MỚI (vừa nhập vào) — hộp đọc lúc mở để không chọn sẵn tag (Đạt dặn 22/11)
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
        // Bảng tra id mod mới lập 1 lần (Đạt 24/11): bản cũ tìm tuyến
        // tính trong vòng lọc (O(n²)) — 500 mod = 250.000 lần so sánh
        // mỗi lần tải; bản này O(n), kết quả giống hệt (id là duy nhất).
        const newModIds = new Set(loadRawMods.filter((raw) => raw.newMod).map((raw) => raw.id));
        this.newMods = loadModData.filter((modData) => newModIds.has(modData.id));

        // loadModData 是一个 ModData 的数组，直接赋值给 data.modList
        this.data.modList = loadModData;

        // 刷新 characterList
        await this.refreshCharacterList();

        //debug
        console.log(`Đã tải ${loadModData.length} mod, tổng cộng ${this.data.characterList.length} nhân vật, có ${this.newMods.length} mod mới`);

        // Dọn thư mục tạm của lần cập nhật Banana dở dang (sập giữa chừng).
        this.gbCleanStaleTempDirs();

        // Kiểm tra bản mới Banana chạy nền sau khi mod đã tải xong
        // (không chặn app mở): đợi 2 giây để nhường lần vẽ đầu tiên.
        setTimeout(() => {
            this.checkGameBananaUpdates(false).catch((e) => {
                console.error('checkGameBananaUpdates failed', e);
            });
        }, 2000);

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

        // Dọn thư mục tạm Fixer còn sót từ lần chạy trước (tắt ngang
        // giữa chừng) để không rác lại ổ đĩa.
        try { this.fixerCleanupStaleTempDirs(); } catch (_e) { /* kệ */ }

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

    //-==================== Mod Fixer (1.5.25) ====================//
    // Tích hợp ZZZ Mod Fixer (Vonksdesu): kiểm tra/tải/mở đồ sửa mod
    // skin + quét mod nghi hỏng (đối chiếu mã trong .ini với bảng mã cũ
    // của Fixer) + sửa mod đã chọn trên bản chép tạm rồi chép về.
    // Mọi lần gọi mạng tái dùng gbFetchBuffer/gbFetchJson của Banana
    // (chịu chuyển hướng + thử lại 1 lần + ngắt khi 15s không có dữ liệu).
    //
    // CHÉP GỌN (1.5.25-test8, Đạt báo sửa 139 mod chờ rất lâu): Fixer
    // chỉ đọc/sửa file .ini + .buf nên ra thư mục tạm CHỈ chép 2 loại
    // đó (giữ đúng cấu trúc thư mục con), file hình KHÔNG chép — vừa
    // nhanh vừa nhẹ ổ đĩa. Bản dự phòng cũng chỉ 2 loại này (vì chỉ
    // chúng bị đổi). Lúc chép về chỉ chép file mới/đổi, file .ini/.buf
    // nào Fixer xóa khỏi bản tạm thì xóa khỏi bản gốc (CHỈ 2 loại này,
    // không bao giờ xóa file khác).

    // Liệt kê file .ini/.buf trong 1 thư mục mod (đệ quy) — trả Map
    // đường dẫn tương đối -> đường dẫn tuyệt đối. Fixer chỉ cần 2 loại
    // này; file hình/mod.json/khác không liệt kê.
    fixerListIniBufFiles(dir) {
        const out = new Map();
        const walk = (d) => {
            let entries;
            try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (_e) { return; }
            for (const e of entries) {
                const p = path.join(d, e.name);
                if (e.isDirectory()) walk(p);
                else if (e.isFile()) {
                    const ext = path.extname(e.name).toLowerCase();
                    if (ext === '.ini' || ext === '.buf') out.set(path.relative(dir, p), p);
                }
            }
        };
        walk(dir);
        return out;
    }

    // Liệt kê TẤT CẢ file trong 1 thư mục (đệ quy) — dùng lúc chép về
    // để thấy cả file Fixer tạo ra (vd sổ theo dõi .zzz-fixer-state.json).
    fixerListAllFiles(dir) {
        const out = new Map();
        const walk = (d) => {
            let entries;
            try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (_e) { return; }
            for (const e of entries) {
                const p = path.join(d, e.name);
                if (e.isDirectory()) walk(p);
                else if (e.isFile()) out.set(path.relative(dir, p), p);
            }
        };
        walk(dir);
        return out;
    }

    // Chép các file trong Map (đường dẫn tương đối -> tuyệt đối) sang
    // thư mục đích, giữ đúng cấu trúc thư mục con.
    fixerCopyFileMap(fileMap, destDir) {
        for (const [rel, src] of fileMap) {
            const dest = path.join(destDir, rel);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.copyFileSync(src, dest);
        }
    }

    // Thư mục cha của thư mục Mods — thư mục tạm đặt ở đây (cùng ổ với
    // Mods, Đạt báo 23/11 ổ C không đủ chỗ). TUYỆT ĐỐI KHÔNG đặt trong
    // thư mục Mods (app quét thư mục đó tìm mod, để trong sẽ bị nhận
    // nhầm thành mod). Không lấy được thì dùng thư mục tạm hệ thống.
    fixerTempParent() {
        const modsPath = this.config && this.config.modSourcePath;
        if (modsPath) {
            try {
                const parent = path.dirname(path.resolve(modsPath));
                if (parent && fs.existsSync(parent)) return parent;
            } catch (_e) { /* dùng tạm hệ thống */ }
        }
        return os.tmpdir();
    }

    // Dọn thư mục tạm Fixer còn sót (lần trước tắt ngang giữa chừng):
    // mọi thư mục tên bắt đầu xxmm-fixer- nằm cạnh thư mục Mods + trong
    // thư mục tạm hệ thống (bản cũ để ở đó). Chỉ xóa đúng tiền tố này,
    // không đụng thư mục khác. Chạy lúc app khởi động.
    fixerCleanupStaleTempDirs() {
        const parents = new Set();
        try { parents.add(this.fixerTempParent()); } catch (_e) { /* kệ */ }
        parents.add(os.tmpdir());
        for (const parent of parents) {
            let entries;
            try { entries = fs.readdirSync(parent, { withFileTypes: true }); } catch (_e) { continue; }
            for (const e of entries) {
                if (!e.isDirectory() || !e.name.startsWith('xxmm-fixer-')) continue;
                try { fs.rmSync(path.join(parent, e.name), { recursive: true, force: true }); } catch (_e) { /* kệ */ }
            }
        }
    }

    // Thư mục chứa file Fixer đã tải về (+ bảng mã cũ lưu đệm + bản dự
    // phòng của mod đã sửa): <userData>/tools/ZZZ-Mod-Fixer/.
    fixerToolsDir() {
        const dir = path.join(XXMMCore.getDataPathSync(), 'tools', 'ZZZ-Mod-Fixer');
        try { fs.mkdirSync(dir, { recursive: true }); } catch (_e) { /* lần sau thử lại */ }
        return dir;
    }

    // Đường dẫn file .exe Fixer đã tải về — chưa tải (hoặc file bị xóa
    // tay) thì null.
    fixerExePath() {
        const fileName = this.config.fixerFileName;
        if (!fileName) return null;
        const exePath = path.join(this.fixerToolsDir(), fileName);
        return fs.existsSync(exePath) ? exePath : null;
    }

    // Trạng thái Fixer cho giao diện.
    fixerStatus() {
        const exePath = this.fixerExePath();
        return {
            installed: !!exePath,
            version: this.config.fixerVersion || null,
            exePath: exePath,
            modsPath: this.config.modSourcePath || '',
        };
    }

    // Bản mới nhất của Fixer trên GitHub (kèm file .exe) — lỗi mạng hay
    // không có file .exe thì văng lỗi, nơi gọi tự bắt và báo.
    async fetchFixerRelease() {
        const release = normalizeFixerRelease(await this.gbFetchJson(FIXER_API_LATEST));
        if (!release || !release.asset) throw new Error('No Fixer release found');
        return release;
    }

    // Có bản Fixer mới không. Trả { latest, asset, updateAvailable } —
    // đang kiểm tra dở thì null (chống bấm trùng).
    async checkFixerUpdate() {
        if (fixerChecking) return null;
        fixerChecking = true;
        try {
            const release = await this.fetchFixerRelease();
            return {
                latest: release.tag,
                asset: release.asset,
                updateAvailable: release.tag !== this.config.fixerVersion,
            };
        } finally {
            fixerChecking = false;
        }
    }

    // Tải file .exe của bản mới nhất về thư mục tools (ghi file tạm rồi
    // đổi tên để file đang tải dở không bị tưởng là xong). onProgress
    // nhận (đã tải, tổng) để hiện %. Trả đường dẫn file — lỗi thì văng lỗi.
    async downloadFixer(onProgress = null) {
        if (fixerDownloading) return null;
        fixerDownloading = true;
        try {
            const release = await this.fetchFixerRelease();
            const buf = await this.gbFetchBuffer(release.asset.downloadUrl, onProgress);
            if (!buf || buf.length === 0) throw new Error('Empty download');
            const dir = this.fixerToolsDir();
            const tmpPath = path.join(dir, release.asset.name + '.download');
            const finalPath = path.join(dir, release.asset.name);
            fs.writeFileSync(tmpPath, buf);
            fs.renameSync(tmpPath, finalPath);
            // Xóa file .exe cũ (tên khác bản mới) để không còn 2 bản.
            if (this.config.fixerFileName && this.config.fixerFileName !== release.asset.name) {
                try { fs.unlinkSync(path.join(dir, this.config.fixerFileName)); } catch (_e) { /* kệ */ }
            }
            this.config.fixerVersion = release.tag;
            this.config.fixerFileName = release.asset.name;
            this.saveConfig();
            return finalPath;
        } finally {
            fixerDownloading = false;
        }
    }

    // Mở Fixer lên (không đợi đóng) — dùng cho nút "Mở Fixer". Trả false
    // khi chưa tải Fixer về hoặc mở lỗi.
    openFixer() {
        const exePath = this.fixerExePath();
        if (!exePath) return false;
        try {
            const { spawn } = require('child_process');
            const child = spawn(exePath, [], { detached: true, stdio: 'ignore' });
            child.unref();
            return true;
        } catch (e) {
            console.error('openFixer failed', e);
            return false;
        }
    }

    //-==================== Tải XXMI Launcher (trình setup 1.5.30) ====================//
    // Trình setup cho người mới (Đạt duyệt hướng A 24/11): chưa có XXMI
    // Launcher thì tải file cài đặt MSI chính thức từ repo SpectrumQT
    // (bản mới nhất đã kiểm chứng 24/11: v2.5.0, file MSI trực tiếp
    // ~99MB, không bọc zip) rồi mở trình cài đặt cho người dùng bấm
    // theo. Mẫu theo đúng downloadFixer: tải qua gbFetchBuffer (chịu
    // chuyển hướng + thử lại), ghi file tạm rồi đổi tên.
    // Trạng thái tải nằm ở module-level như fixerDownloading (tránh 2
    // lần tải chồng lên nhau khi người dùng bấm nút 2 lần).

    // Thư mục chứa file MSI đã tải: <userData>/tools/XXMI-Launcher/.
    xxmiToolsDir() {
        const dir = path.join(XXMMCore.getDataPathSync(), 'tools', 'XXMI-Launcher');
        try { fs.mkdirSync(dir, { recursive: true }); } catch (_e) { /* lần sau thử lại */ }
        return dir;
    }

    // Đường dẫn file MSI đã tải về — chưa tải (hoặc file bị xóa tay)
    // thì null.
    xxmiInstallerPath() {
        const fileName = this.config.xxmiInstallerFileName;
        if (!fileName) return null;
        const msiPath = path.join(this.xxmiToolsDir(), fileName);
        return fs.existsSync(msiPath) ? msiPath : null;
    }

    // Bản mới nhất của XXMI Launcher trên GitHub (kèm file MSI) — lỗi
    // mạng hay không có file MSI thì văng lỗi, nơi gọi tự bắt và báo.
    async fetchXxmiRelease() {
        const release = normalizeXxmiRelease(await this.gbFetchJson(XXMI_API_LATEST));
        if (!release || !release.asset) throw new Error('No XXMI release found');
        return release;
    }

    // Tải file MSI của bản mới nhất về thư mục tools. onProgress nhận
    // (đã tải, tổng) để hiện %. Trả đường dẫn file — lỗi thì văng lỗi.
    // Đã tải rồi (đúng tên file bản mới nhất) thì dùng lại, không tải nữa.
    async downloadXxmiInstaller(onProgress = null) {
        if (xxmiDownloading) return null;
        xxmiDownloading = true;
        try {
            const release = await this.fetchXxmiRelease();
            const existing = this.xxmiInstallerPath();
            if (existing && this.config.xxmiInstallerFileName === release.asset.name) {
                return existing;
            }
            const buf = await this.gbFetchBuffer(release.asset.downloadUrl, onProgress);
            if (!buf || buf.length === 0) throw new Error('Empty download');
            const dir = this.xxmiToolsDir();
            const tmpPath = path.join(dir, release.asset.name + '.download');
            const finalPath = path.join(dir, release.asset.name);
            fs.writeFileSync(tmpPath, buf);
            fs.renameSync(tmpPath, finalPath);
            // Xóa file MSI cũ (tên khác bản mới) để không còn 2 bản.
            if (this.config.xxmiInstallerFileName && this.config.xxmiInstallerFileName !== release.asset.name) {
                try { fs.unlinkSync(path.join(dir, this.config.xxmiInstallerFileName)); } catch (_e) { /* kệ */ }
            }
            this.config.xxmiVersion = release.tag;
            this.config.xxmiInstallerFileName = release.asset.name;
            this.saveConfig();
            return finalPath;
        } finally {
            xxmiDownloading = false;
        }
    }

    // Mở trình cài đặt MSI (không đợi đóng) — dùng cho nút "Mở trình cài
    // đặt". Trả false khi chưa tải MSI về hoặc mở lỗi.
    openXxmiInstaller() {
        const msiPath = this.xxmiInstallerPath();
        if (!msiPath) return false;
        try {
            const { spawn } = require('child_process');
            const child = spawn('msiexec.exe', ['/i', msiPath], { detached: true, stdio: 'ignore' });
            child.unref();
            return true;
        } catch (e) {
            console.error('openXxmiInstaller failed', e);
            return false;
        }
    }

    // Bảng mã cũ (mã cũ -> mã mới) để quét mod nghi hỏng. Thứ tự:
    // (1) bảng lưu đệm theo bản Fixer trong thư mục tools (đã tải từ
    // GitHub lần trước); (2) tải mới từ repo Fixer rồi lưu đệm;
    // (3) mạng lỗi thì dùng bảng đóng gói kèm app (749 mã, trích từ
    // bản v2.3.0). Trả Map.
    async fixerOldHashMap() {
        const version = this.config.fixerVersion || 'bundled';
        const cachePath = path.join(this.fixerToolsDir(), `old-hashes-${version}.json`);
        try {
            const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
            if (cached && typeof cached === 'object' && Object.keys(cached).length > 0) {
                return new Map(Object.entries(cached));
            }
        } catch (_e) { /* chưa có đệm: tải mới */ }
        try {
            const fresh = await this.fetchFixerOldHashMap();
            if (fresh.size > 0) {
                try { fs.writeFileSync(cachePath, JSON.stringify(Object.fromEntries(fresh))); } catch (_e) { /* kệ */ }
                return fresh;
            }
        } catch (e) {
            console.warn('fixerOldHashMap: fetch failed, using bundled table', e);
        }
        return new Map(Object.entries(fixerOldHashesBundled));
    }

    // Tải + tách bảng mã cũ từ repo Fixer (nhánh gui-version): hỏi API
    // lấy danh sách file .py, tải song song 10 file/lượt rồi tách entry
    // update_hash trong từng file.
    async fetchFixerOldHashMap() {
        const listing = await this.gbFetchJson(FIXER_PYDATA_API);
        const files = (Array.isArray(listing) ? listing : [])
            .filter((f) => f && typeof f.name === 'string' && f.name.endsWith('.py'))
            .map((f) => ({ name: f.name, url: `${FIXER_PYDATA_RAW_BASE}/${encodeURIComponent(f.name)}` }));
        if (files.length === 0) throw new Error('No fixer data files listed');
        const merged = new Map();
        const BATCH = 10;
        for (let i = 0; i < files.length; i += BATCH) {
            const batch = files.slice(i, i + BATCH);
            const texts = await Promise.all(batch.map((f) =>
                this.gbFetchBuffer(f.url).then((b) => b.toString('utf8')).catch((e) => {
                    console.warn(`fetchFixerOldHashMap: ${f.name} failed`, e);
                    return '';
                })
            ));
            for (const text of texts) {
                const entries = parseFixerOldHashes(text);
                for (const [oldHash, newHash] of Object.entries(entries)) {
                    if (!merged.has(oldHash)) merged.set(oldHash, newHash);
                }
            }
        }
        return merged;
    }

    // Quét mod nghi hỏng: mod nào còn mã cũ trong file .ini thì liệt kê.
    // CHỈ ĐỌC, không sửa gì. Trả mảng { modId, modName, location,
    // matchedHashes } — đang quét dở thì null.
    async fixerScanBrokenMods() {
        if (fixerScanning) return null;
        fixerScanning = true;
        try {
            const oldHashes = await this.fixerOldHashMap();
            const suspects = [];
            for (const modInfo of ModLoader.modsRaw) {
                const location = modInfo && modInfo.location;
                if (!location || !fs.existsSync(location)) continue;
                let hashes;
                try { hashes = extractModHashes(location); } catch (_e) { continue; }
                const matched = [...new Set(
                    hashes.map((h) => h.hash).filter((h) => oldHashes.has(h))
                )];
                if (matched.length > 0) {
                    suspects.push({
                        modId: modInfo.id,
                        modName: modInfo.modName,
                        location: location,
                        matchedHashes: matched,
                    });
                }
            }
            return suspects;
        } finally {
            fixerScanning = false;
        }
    }

    // Bước 1 — CHÉP (không cắt) các mod đã chọn ra thư mục tạm để Fixer
    // sửa trên bản chép. CHỈ chép file .ini/.buf (Fixer chỉ cần 2 loại
    // này), giữ đúng cấu trúc thư mục con — file hình không chép nên
    // nhanh hơn nhiều với mod nặng. Thư mục tạm đặt CẠNH thư mục Mods
    // (cùng ổ đĩa, Đạt báo ổ C không đủ chỗ; TUYỆT ĐỐI KHÔNG nằm trong
    // thư mục Mods vì app quét thư mục đó tìm mod). Trả { tempDir,
    // mods: [{ modId, modName, srcPath, tmpPath, origFiles: [đường dẫn
    // tương đối các file .ini/.buf lúc chép] }] } — đang sửa dở thì
    // văng lỗi (chống bấm trùng). onProgress(done, total) báo tiến độ
    // từng mod; nhường vòng lặp giữa 2 mod để giao diện kịp hiện tiến độ.
    async fixerPrepareFix(modIds, onProgress) {
        if (fixerFixing) throw new Error('Fix already in progress');
        fixerFixing = true;
        let tempDir = null;
        try {
            const selected = ModLoader.modsRaw.filter((m) =>
                modIds.includes(m.id) && m.location && fs.existsSync(m.location));
            if (selected.length === 0) throw new Error('No mods selected');
            try {
                tempDir = path.join(this.fixerTempParent(), `xxmm-fixer-temp-${Date.now()}`);
                fs.mkdirSync(tempDir, { recursive: true });
            } catch (_e) {
                // Không tạo được cạnh thư mục Mods (vd không có quyền
                // ghi): dùng thư mục tạm hệ thống làm dự phòng.
                tempDir = path.join(os.tmpdir(), `xxmm-fixer-temp-${Date.now()}`);
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const mods = [];
            let done = 0;
            for (const m of selected) {
                const tmpPath = path.join(tempDir, m.modName);
                const files = this.fixerListIniBufFiles(m.location);
                fs.mkdirSync(tmpPath, { recursive: true });
                this.fixerCopyFileMap(files, tmpPath);
                mods.push({ modId: m.id, modName: m.modName, srcPath: m.location, tmpPath: tmpPath,
                    origFiles: [...files.keys()] });
                done += 1;
                if (typeof onProgress === 'function') {
                    try { onProgress(done, selected.length); } catch (_e) { /* kệ */ }
                }
                // Nhường ~1 khung hình (16ms) để giao diện kịp VẼ tiến
                // độ — setTimeout(0) thì tác vụ chép tiếp theo chạy ngay
                // nên trình duyệt không có lúc nào vẽ, dòng tiến độ chỉ
                // nằm trong DOM mà mắt không thấy.
                await new Promise((r) => setTimeout(r, 16));
            }
            return { tempDir: tempDir, mods: mods };
        } catch (e) {
            if (tempDir) {
                try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_e) { /* kệ */ }
            }
            fixerFixing = false;
            throw e;
        }
    }

    // Bước 2 — mở Fixer lên và đợi nó đóng lại. Trả true khi Fixer đã
    // thoát (dù sửa hay không), false khi không mở được.
    fixerLaunchAndWait() {
        const exePath = this.fixerExePath();
        if (!exePath) return Promise.resolve(false);
        return new Promise((resolve) => {
            let child;
            try {
                const { spawn } = require('child_process');
                child = spawn(exePath, [], { stdio: 'ignore' });
            } catch (e) {
                console.error('fixerLaunchAndWait spawn failed', e);
                resolve(false);
                return;
            }
            child.on('error', (e) => {
                console.error('fixerLaunchAndWait error', e);
                resolve(false);
            });
            child.on('exit', () => resolve(true));
        });
    }

    // Hủy giữa chừng (không mở được Fixer...): dọn thư mục tạm, bỏ cờ.
    fixerAbortFix(prepared) {
        if (prepared && prepared.tempDir) {
            try { fs.rmSync(prepared.tempDir, { recursive: true, force: true }); } catch (_e) { /* kệ */ }
        }
        fixerFixing = false;
    }

    // Bước 3 — kiểm tra bản đã sửa trong thư mục tạm rồi thay bản gốc.
    // Mỗi mod: có đổi gì thì sao lưu bản gốc (CHỈ .ini/.buf — vì chỉ 2
    // loại này bị đổi nên đủ để khôi phục) rồi chép file mới/đổi từ bản
    // tạm về (kể cả file Fixer tạo ra như sổ theo dõi
    // .zzz-fixer-state.json); file .ini/.buf nào Fixer xóa khỏi bản tạm
    // thì xóa khỏi bản gốc (CHỈ 2 loại này, không bao giờ xóa file
    // khác). File hình không đụng tới nên nguyên vẹn. Không đổi gì thì
    // giữ nguyên bản gốc. Lỗi giữa chừng thì khôi phục từ bản sao lưu
    // — không mất mod. Trả mảng kết quả từng mod: { modId, modName,
    // status: 'fixed' | 'unchanged' | 'failed', backupPath? }. Xong thì
    // dọn thư mục tạm + tải lại danh sách mod. onProgress(done, total)
    // báo tiến độ từng mod.
    async fixerApplyFixed(prepared, onProgress) {
        const results = [];
        try {
            const backupRoot = path.join(this.fixerToolsDir(), 'backup');
            let done = 0;
            for (const mod of prepared.mods) {
                try {
                    // Bản gốc biến mất giữa chừng (người dùng/xóa lúc
                    // cửa sổ Fixer đang mở): báo không sửa được. KHÔNG
                    // chép về — chép về chỉ có .ini/.buf sẽ hồi sinh
                    // mod thiếu mod.json/hình (test4 cũng báo 'failed'
                    // vì chép sao lưu từ thư mục đã mất thì văng lỗi).
                    if (!fs.existsSync(mod.srcPath)) throw new Error('original folder vanished mid-flow: ' + mod.srcPath);
                    const changed = await this.fixerModChanged(mod);
                    if (!changed) {
                        results.push({ modId: mod.modId, modName: mod.modName, status: 'unchanged' });
                    } else {
                        // Sao lưu bản gốc TRƯỚC khi thay — CHỈ .ini/.buf
                        // (chép, không cắt).
                        const backupPath = path.join(backupRoot, `${mod.modName}-${Date.now()}`);
                        fs.mkdirSync(backupRoot, { recursive: true });
                        const srcFiles = this.fixerListIniBufFiles(mod.srcPath);
                        this.fixerCopyFileMap(srcFiles, backupPath);
                        const origSet = new Set(mod.origFiles || [...srcFiles.keys()]);
                        const tmpFiles = this.fixerListAllFiles(mod.tmpPath);
                        try {
                            // Chép file mới/đổi từ bản tạm về: chỉ .ini,
                            // .buf + sổ theo dõi của Fixer — không chép
                            // file lạ khác (vd thư mục dự phòng của
                            // Fixer nếu anh tick trong cửa sổ Fixer).
                            for (const [rel, tmpFile] of tmpFiles) {
                                const ext = path.extname(rel).toLowerCase();
                                if (ext !== '.ini' && ext !== '.buf' && path.basename(rel) !== FIXER_STATE_FILE) continue;
                                const dest = path.join(mod.srcPath, rel);
                                fs.mkdirSync(path.dirname(dest), { recursive: true });
                                fs.copyFileSync(tmpFile, dest);
                            }
                            // File .ini/.buf nào Fixer xóa khỏi bản tạm
                            // thì xóa khỏi bản gốc (CHỈ 2 loại này —
                            // origSet chỉ chứa .ini/.buf từ lúc chép).
                            for (const rel of origSet) {
                                if (!tmpFiles.has(rel)) {
                                    try { fs.rmSync(path.join(mod.srcPath, rel), { force: true }); } catch (_e) { /* kệ */ }
                                }
                            }
                        } catch (e) {
                            // Thay thất bại: khôi phục bản gốc từ bản
                            // sao lưu (chép .ini/.buf về) + xóa file mới
                            // đã chép dở (file có trong bản tạm mà gốc
                            // không có).
                            try { this.fixerCopyFileMap(this.fixerListIniBufFiles(backupPath), mod.srcPath); } catch (_e) { /* kệ */ }
                            for (const [rel] of tmpFiles) {
                                if (origSet.has(rel)) continue;
                                const ext = path.extname(rel).toLowerCase();
                                if (ext !== '.ini' && ext !== '.buf' && path.basename(rel) !== FIXER_STATE_FILE) continue;
                                try { fs.rmSync(path.join(mod.srcPath, rel), { force: true }); } catch (_e) { /* kệ */ }
                            }
                            throw e;
                        }
                        results.push({ modId: mod.modId, modName: mod.modName, status: 'fixed', backupPath: backupPath });
                    }
                } catch (e) {
                    console.error(`fixerApplyFixed(${mod.modName}) failed`, e);
                    results.push({ modId: mod.modId, modName: mod.modName, status: 'failed' });
                }
                done += 1;
                if (typeof onProgress === 'function') {
                    try { onProgress(done, prepared.mods.length); } catch (_e) { /* kệ */ }
                }
                // Nhường ~1 khung hình (16ms) để giao diện kịp VẼ tiến
                // độ — xem chú thích ở fixerPrepareFix.
                await new Promise((r) => setTimeout(r, 16));
            }
        } finally {
            try { fs.rmSync(prepared.tempDir, { recursive: true, force: true }); } catch (_e) { /* kệ */ }
            // Tải lại danh sách mod để lưới hiện đúng nội dung mới (mod
            // đã thay + mod đã mất giữa chừng) — chỉ xóa cache thì lưới
            // vẫn hiện danh sách cũ tới khi anh bấm Làm mới.
            try { await this.rescanAllMods(); } catch (_e) { /* kệ */ }
            fixerFixing = false;
        }
        return results;
    }

    // Bản chép tạm có khác bản gốc không: có file trạng thái của Fixer
    // thì chắc chắn đã sửa; không thì so CHỈ file .ini/.buf (bản tạm gọn
    // không có hình nên không so hình). Thêm/bớt file, đổi kích thước
    // hay đổi nội dung (băm SHA1 theo luồng để không ngốn RAM với file
    // .buf lớn) đều tính là đã sửa.
    async fixerModChanged(mod) {
        const srcPath = mod.srcPath;
        const tmpPath = mod.tmpPath;
        try {
            if (fs.existsSync(path.join(tmpPath, FIXER_STATE_FILE))) return true;
        } catch (_e) { /* tiếp tục so file */ }
        const origSet = new Set(mod.origFiles || [...this.fixerListIniBufFiles(srcPath).keys()]);
        const tmpFiles = this.fixerListIniBufFiles(tmpPath);
        if (tmpFiles.size !== origSet.size) return true;
        const hashFile = (p) => new Promise((resolve, reject) => {
            const hash = require('crypto').createHash('sha1');
            const stream = fs.createReadStream(p);
            stream.on('error', reject);
            stream.on('data', (d) => hash.update(d));
            stream.on('end', () => resolve(hash.digest('hex')));
        });
        for (const rel of origSet) {
            const tmpFile = tmpFiles.get(rel);
            if (!tmpFile) return true;
            try {
                const a = fs.statSync(path.join(srcPath, rel));
                const b = fs.statSync(tmpFile);
                if (a.size !== b.size) return true;
                if ((await hashFile(path.join(srcPath, rel))) !== (await hashFile(tmpFile))) return true;
            } catch (_e) {
                return true;
            }
        }
        return false;
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


    // Đặt bìa mod từ 1 file ảnh — đường dùng chung cho thả ảnh lên thẻ
    // (1.5.25 test3) và thả ảnh toàn app: đọc file thành base64 rồi ghi
    // bằng cơ chế bìa sẵn có (setModPreviewBase64ByName — ghi file
    // preview + thông báo "Updated cover" + vẽ lại thẻ). Trả true khi
    // ghi xong.
    setModCoverFromFile(file, modName) {
        return new Promise((resolve) => {
            if (!file || !file.type || !file.type.startsWith('image/')) {
                resolve(false);
                return;
            }
            // 因为electron的file对象不是标准的file对象，所以需要使用reader来读取文件
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    await this.setModPreviewBase64ByName(event.target.result, modName);
                    resolve(true);
                } catch (e) {
                    console.error('setModCoverFromFile failed', e);
                    resolve(false);
                }
            };
            reader.onerror = () => resolve(false);
            reader.readAsDataURL(file);
        });
    }

    async handleImageDrop(file) {
        // 再次确认是否是图片文件
        if (!file.type.startsWith('image/')) {
            snack('Invalid image file');
            return;
        }
        await this.setModCoverFromFile(file, this.temp.currentMod.name);
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
        // File .rar đi đường node-unrar-js riêng (libarchive không mở được
        // rar mã hóa — xem extractRarArchive); zip/7z/tar giữ nguyên đường
        // libarchive bên dưới. archivePath thực chất là File được thả vào
        // (xem handleArchiveDrop), không phải chuỗi đường dẫn.
        const archiveName = archivePath && archivePath.name ? archivePath.name : String(archivePath);
        if (archiveName.toLowerCase().endsWith('.rar')) {
            return this.extractRarArchive(archivePath, destinationPath);
        }

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
            // getFilesArray chỉ trả THƯ MỤC CHỨA trong entry.path (file ở
            // gốc thì path = ''), đường dẫn đầy đủ = thư mục + tên file.
            // extractSingleFile cần đúng đường dẫn đầy đủ mới khớp — gọi
            // với entry.path thì worker không khớp file nào, trả undefined
            // rồi văng TypeError 'fileData', nhập zip hỏng hoàn toàn
            // (phát hiện khi probe tính năng nhập mod mới 22/11).
            for (const entry of entries) {
                try {
                    const fullPath = entry.path + entry.file.name;
                    const file = await archiveReader.extractSingleFile(fullPath);
                    await writeEntry({ file, path: fullPath });
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

            // 删除解压的文件 — kiểm tra tồn tại trước vì handleArchiveDrop
            // cũng xóa ngay khi extractArchive trả false (không kiểm thì
            // lần xóa thứ 2 văng ENOENT không bắt được — thấy ở log probe
            // rar mã hóa 22/11).
            setTimeout(() => {
                if (fs.existsSync(destinationPath)) {
                    fs.rmdirSync(destinationPath, { recursive: true });
                    console.log(`Deleted folder: ${destinationPath}`);
                }
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

    // Nạp file wasm của node-unrar-js (Vite copy vào dist/assets/unrar.wasm
    // nhờ import ?url ở đầu file). App chạy từ file:// (kể cả trong asar)
    // nên đọc bằng fs — fetch bị Chromium chặn với file://. Chạy qua vite
    // dev server (http://) thì fetch. Chỉ nạp 1 lần rồi nhớ lại.
    async loadUnrarWasmBinary() {
        if (this._unrarWasmBinary) {
            return this._unrarWasmBinary;
        }
        const wasmUrl = new URL(unrarWasmUrl, window.location.href);
        let bytes;
        if (wasmUrl.protocol === 'file:') {
            bytes = fs.readFileSync(fileURLToPath(wasmUrl));
        } else {
            const res = await fetch(wasmUrl.href);
            if (!res.ok) {
                throw new Error(`Failed to load unrar wasm: HTTP ${res.status}`);
            }
            bytes = new Uint8Array(await res.arrayBuffer());
        }
        this._unrarWasmBinary = bytes;
        return bytes;
    }

    // Giải nén file .rar bằng node-unrar-js (WASM unrar đầy đủ).
    // libarchive đi kèm app KHÔNG mở được rar mã hóa (chuỗi trong wasm:
    // "RAR encryption support unavailable") — rar có mật khẩu văng lỗi
    // checksum rồi báo nhầm là "file nén hỏng" (Đạt báo 22/11; probe xác
    // nhận: rar thường + rar solid vẫn mở được bằng libarchive, chỉ rar
    // mã hóa là hỏng). Đường này mở được rar thường, solid, RAR5 lẫn rar
    // có mật khẩu (hỏi mật khẩu bằng đúng hộp thoại của đường zip). Chỉ
    // dùng cho .rar; zip/7z/tar giữ nguyên đường libarchive.
    async extractRarArchive(file, destinationPath) {
        // Ngưỡng dung lượng sau giải nén giống đường zip (TC28).
        const MAX_ARCHIVE_EXTRACT_BYTES = 4 * 1024 * 1024 * 1024;
        const isPasswordError = (err) => err && (err.reason === 'ERAR_MISSING_PASSWORD' || err.reason === 'ERAR_BAD_PASSWORD');

        let data;
        try {
            data = new Uint8Array(await file.arrayBuffer());
        } catch (error) {
            console.error(`Failed to read rar file: ${error}`);
            t_snack({
                vi: `Không đọc được file .rar`,
                en: `Could not read the RAR file`,
            }, 'error');
            return false;
        }

        // Chữ ký RAR ở đầu file (RAR5: 52 61 72 21 1A 07 01 00, RAR4:
        // ...07 00) — chỉ dùng để CHỌN thông báo lỗi sau khi unrar văng
        // lỗi (có chữ ký mà mở không được = file hỏng thật; không có chữ
        // ký = không phải file rar). Không dùng để chặn trước vì rar tự
        // giải nén (SFX) không có chữ ký ở đầu file nhưng unrar vẫn mở được.
        const looksLikeRar = data.length >= 8 && data[0] === 0x52 && data[1] === 0x61
            && data[2] === 0x72 && data[3] === 0x21 && data[4] === 0x1A && data[5] === 0x07
            && (data[6] === 0x00 || data[6] === 0x01) && data[7] === 0x00;

        let extractor;
        try {
            const wasmBinary = await this.loadUnrarWasmBinary();
            extractor = await createExtractorFromData({ wasmBinary, data });
        } catch (error) {
            console.error(`Failed to init unrar: ${error}`);
            t_snack({
                vi: `Không mở được file .rar, hãy giải nén tay`,
                en: `Could not open the RAR file, please extract it manually`,
            }, 'error');
            return false;
        }

        // Liệt kê trước (chỉ đọc tiêu đề): kiểm dung lượng + phát hiện mã hóa.
        // Rar mã hóa cả tiêu đề (-hp) thì liệt kê đã văng lỗi mật khẩu.
        let password = '';
        let headers;
        try {
            headers = [...extractor.getFileList().fileHeaders];
        } catch (error) {
            if (!isPasswordError(error)) {
                return this.reportRarError(error, looksLikeRar);
            }
            password = await this.waitForPassword();
            if (password === null || password === '') {
                return false;
            }
            try {
                const wasmBinary = await this.loadUnrarWasmBinary();
                extractor = await createExtractorFromData({ wasmBinary, data, password });
                headers = [...extractor.getFileList().fileHeaders];
            } catch (retryError) {
                return this.reportRarError(retryError, looksLikeRar);
            }
        }

        if (headers.length === 0) {
            console.error(`Error: RAR archive is empty`);
            t_snack({
                vi: `File .rar rỗng, không có gì để giải nén`,
                en: `The RAR file is empty, nothing to extract`,
            }, 'error');
            return false;
        }

        // Rar chỉ mã hóa dữ liệu (-p): tiêu đề đọc được, từng file gắn cờ
        // encrypted — hỏi mật khẩu trước khi giải nén (chưa hỏi ở trên).
        if (!password && headers.some((h) => h.flags.encrypted)) {
            password = await this.waitForPassword();
            if (password === null || password === '') {
                return false;
            }
        }

        const totalSize = headers.reduce((sum, h) => sum + (typeof h.unpSize === 'number' ? h.unpSize : 0), 0);
        if (totalSize > MAX_ARCHIVE_EXTRACT_BYTES) {
            console.error(`RAR too large to extract: ${totalSize} bytes (limit ${MAX_ARCHIVE_EXTRACT_BYTES})`);
            t_snack({
                vi: `File nén quá lớn sau khi giải nén (${(totalSize / 1024 / 1024 / 1024).toFixed(1)} GB, giới hạn 4 GB) nên không giải nén`,
                en: `Archive is too large when extracted (${(totalSize / 1024 / 1024 / 1024).toFixed(1)} GB, limit 4 GB), extraction refused`,
            }, 'error');
            return false;
        }

        if (!fs.existsSync(destinationPath)) {
            fs.mkdirSync(destinationPath);
        }

        let ifContainChinese = false;
        let skippedEntries = [];
        try {
            const { files } = extractor.extract(password ? { password } : {});
            for (const entry of files) {
                const header = entry.fileHeader;
                if (header.flags.directory) {
                    continue;
                }
                // Ghi ra đĩa: chặn zip-slip + thay * thành _ như đường zip.
                const filePath = path.join(destinationPath, header.name);
                const newFilePath = filePath.replace(/\*/g, '_');
                if (filePath !== newFilePath) {
                    ifContainChinese = true;
                }
                if (!PathHelper.isPathInside(destinationPath, newFilePath)) {
                    skippedEntries.push(header.name);
                    console.error(`Skipped entry escaping the mod folder: ${header.name}`);
                    continue;
                }
                const dir = path.dirname(newFilePath);
                if (!fs.existsSync(dir) && dir !== '') {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(newFilePath, Buffer.from(entry.extraction));
            }
        } catch (error) {
            // Giải nén lỗi giữa chừng: xóa thư mục dở dang rồi báo đúng lỗi.
            if (fs.existsSync(destinationPath)) {
                fs.rmdirSync(destinationPath, { recursive: true });
            }
            return this.reportRarError(error, looksLikeRar);
        }

        if (ifContainChinese) {
            t_snack({
                vi: `Tên thư mục sau khi giải nén có ký tự đặc biệt, đã thay bằng _`,
                en: `Folder name cannot contain special characters, and has been replaced with _`,
            }, 'error');
        }
        if (skippedEntries.length > 0) {
            t_snack({
                vi: `Đã bỏ qua ${skippedEntries.length} file cố ghi ra ngoài thư mục mod: ${skippedEntries.join(', ')}`,
                en: `Skipped ${skippedEntries.length} file(s) trying to write outside the mod folder: ${skippedEntries.join(', ')}`,
            }, 'error');
        }
        // Gỡ thư mục bọc thừa (PR #115): hàm này chưa có trên nhánh này,
        // ?. để sau khi gộp #115 thì đường rar cũng được gỡ như đường zip.
        this.flattenSingleTopFolder?.(destinationPath);
        t_snack({
            vi: `Mod ${path.basename(destinationPath)} đã giải nén xong`,
            en: `Mod ${path.basename(destinationPath)} extracted successfully`,
        });
        return true;
    }

    // Báo lỗi giải nén .rar theo đúng nguyên nhân (UnrarError có reason):
    // sai định dạng / hỏng thật / sai mật khẩu — thay cho thông báo chung
    // "file nén hỏng" gây hiểu lầm trước đây. Luôn trả false.
    // looksLikeRar = file có chữ ký RAR ở đầu (xem extractRarArchive):
    // ERAR_EREAD (đọc không được cấu trúc file nén) + có chữ ký = file rar
    // hỏng thật (vd tải về thiếu nửa); không có chữ ký = không phải rar
    // (vd byte ngẫu nhiên, file .zip đổi tên thành .rar).
    reportRarError(error, looksLikeRar) {
        const reason = error && error.reason;
        console.error(`RAR extraction failed: ${reason || error}`);
        if (reason === 'ERAR_BAD_ARCHIVE' || reason === 'ERAR_UNKNOWN_FORMAT'
            || (reason === 'ERAR_EREAD' && !looksLikeRar)) {
            t_snack({
                vi: `File này không phải file .rar hợp lệ`,
                en: `This file is not a valid RAR archive`,
            }, 'error');
        } else if (reason === 'ERAR_BAD_DATA' || reason === 'ERAR_EREAD') {
            t_snack({
                vi: `File .rar đã hỏng, không giải nén được`,
                en: `The RAR file is damaged and could not be extracted`,
            }, 'error');
        } else if (reason === 'ERAR_BAD_PASSWORD' || reason === 'ERAR_MISSING_PASSWORD') {
            t_snack({
                vi: `Sai mật khẩu`,
                en: `Incorrect password`,
            }, 'error');
        } else if (reason === 'ERAR_NO_MEMORY') {
            t_snack({
                vi: `File .rar quá lớn, không đủ bộ nhớ để giải nén`,
                en: `The RAR file is too large to extract in memory`,
            }, 'error');
        } else {
            t_snack({
                vi: `Giải nén thất bại, hãy giải nén tay`,
                en: `Extraction failed, please extract manually`,
            }, 'error');
        }
        return false;
    }

    // Xóa mod MỚI vừa nhập khi người dùng đóng hộp sửa mà không lưu
    // (Đạt báo 22/11: bấm Cancel mà mod vẫn vào kho). Hộp sửa gọi lúc
    // 'dismissed' hoặc lúc bấm Bỏ qua ở hộp xác nhận lưu. Các bước y như
    // deleteModPlugin.removeModFromList + xóa thư mục trực tiếp (không
    // qua thùng rác — bản gốc zip/thư mục vẫn còn ngoài app nên không
    // mất gì). Chỉ xóa khi đường dẫn nằm trong thư mục mod (chặn TC9
    // như plugin) — sai đường dẫn thì không xóa gì cả.
    discardNewMod(modName, modPath) {
        if (!modName || !modPath) return false;
        const folderName = path.basename(modPath);
        if (!folderName || folderName === '.' || folderName === '..' ||
            folderName.includes('/') || folderName.includes('\\') || folderName.includes('..')) {
            console.error('discardNewMod: invalid folder name', folderName);
            return false;
        }
        const modSourcePath = path.resolve(this.config.modSourcePath);
        const relativePath = path.relative(modSourcePath, path.resolve(modPath));
        if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            console.error('discardNewMod: mod path outside mod source', modPath);
            return false;
        }
        try {
            if (fs.existsSync(modPath)) {
                fs.rmSync(modPath, { recursive: true, force: true });
            }
        } catch (e) {
            console.error('discardNewMod: failed to delete folder', modPath, e);
            return false;
        }
        // Gỡ khỏi danh sách trong bộ nhớ (y như deleteModPlugin).
        this.data.modList = this.data.modList.filter((mod) => mod.name !== modName);
        // Gỡ cả khỏi danh sách gốc của ModLoader — trước đây chỉ lọc
        // modList nên mục ma còn lại trong modsRaw, làm kiểm tra bản
        // mới Banana hỏi cả mod đã xóa (probe Banana 23/11).
        ModLoader.removeModByFolder(folderName);
        if (this.temp.currentMod && this.temp.currentMod.name === modName) {
            this.setCurrentMod(this.data.modList[0]);
        }
        this.refreshCharacterList();
        this.trigger('addMod');
        return true;
    }

    //-------- Thu thập tên file trong thư mục mod (đệ quy, tối đa 500
    // file) để đoán nhân vật — chỉ lấy TÊN file, không đọc nội dung.
    collectModFileNames(modPath, limit = 500) {
        const names = [];
        const walk = (dir) => {
            let entries;
            try {
                entries = fs.readdirSync(dir, { withFileTypes: true });
            } catch (_ignored) {
                return;
            }
            for (const entry of entries) {
                if (names.length >= limit) return;
                if (entry.isDirectory()) {
                    walk(path.join(dir, entry.name));
                } else if (entry.isFile()) {
                    names.push(entry.name);
                }
            }
        };
        walk(modPath);
        return names;
    }

    //-------- Đoán nhân vật cho mod mới (Đạt dặn 22/11) — dùng chung
    // cho cả 2 luồng nhập (zip + thư mục). Chỉ đoán khi nhân vật còn
    // Unknown: mod.json đã ghi nhân vật thì giữ nguyên. Đoán chạy
    // TRƯỚC khối gán-nhân-vật-hiện-tại (Đạt báo 22/11: đang đứng tab
    // Ellen thì luật cũ gán Ellen trước, đoán không còn cơ hội chạy) —
    // đoán không ra thì khối gán mới gắn theo tab đang đứng. Đoán ra
    // thì ghi nhân vật + lưu. KHÔNG bắn fillSearch ở đây: caller bắn
    // 1 lần sau khi nhân vật đã chốt (dù từ mod.json, đoán được, hay
    // hàng đang đứng) để ô tìm kiếm luôn được điền.
    async tryGuessCharacter(mod, modPath) {
        if (mod.character !== 'Unknown') return;
        const known = (this.data.characterList || []).filter((c) => c !== 'Unknown');
        const guessed = guessCharacterFromNames(mod.name, this.collectModFileNames(modPath), known);
        if (!guessed) return;
        mod.character = guessed;
        await mod.saveModInfo();
        mod.triggerChanged();
    }

    // gbMeta (tải từ Banana): { url, fileId, fileDate } — ghi link + mã
    // file vào mod.json sau khi nhập để lần sau kiểm tra bản mới được.
    // Nhập tay (kéo-thả zip/thư mục) thì không truyền, mod không có link.
    async handleArchiveDrop(file, gbMeta = null) {
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

            // Mod tải từ Banana: ghi link + mã file vào mod.json ngay
            // (hộp sửa mở ngay sau đó phải thấy link) — ModData.url
            // cũng đặt luôn để hộp sửa sao đúng link.
            if (gbMeta && mod) {
                const modInfo = ModLoader.getModByID(mod.id);
                if (modInfo) {
                    modInfo.metaData.set('url', gbMeta.url, ModMetaDataType.String);
                    modInfo.metaData.set('gbFileId', gbMeta.fileId, ModMetaDataType.Number);
                    modInfo.metaData.set('gbFileDate', gbMeta.fileDate, ModMetaDataType.Number);
                    modInfo.saveMetaData();
                }
                mod.url = gbMeta.url;
            }

            // Đoán nhân vật từ tên thư mục/file (Đạt dặn 22/11) — chạy
            // TRƯỚC khối gán-nhân-vật-hiện-tại: đoán ra thì dùng nhân
            // vật đoán được (Đạt báo 22/11: đang đứng tab Ellen mà
            // nhập mod Norma thì phải tự đổi sang Norma).
            await this.tryGuessCharacter(mod, modPath);

            // Đoán không ra (vẫn Unknown) thì mới gắn theo tab đang
            // đứng như luật cũ.
            // 如果 currentCharacter 不为空，且 mod 的 character 为 unknown，则将 mod 的 character 设置为 currentCharacter
            //debug
            console.log(`currentCharacter: ${this.temp.currentCharacter}`, mod.character);
            if (this.temp.currentCharacter !== null && this.temp.currentCharacter !== 'all' && this.temp.currentCharacter !== 'selected' && mod.character === 'Unknown') {
                mod.character = this.temp.currentCharacter;
                await mod.saveModInfo();
                mod.triggerChanged();
            }

            // Nhân vật đã chốt (mod.json / hàng đang đứng / đoán được):
            // điền ô tìm kiếm 1 lần — sửa lỗi 1.5.23-test1 (Đạt báo
            // 22/11: mod Corin không được điền ô tìm vì nhân vật đã
            // biết sẵn trước khi đoán chạy).
            if (mod.character !== 'Unknown') {
                EventSystem.trigger(EventType.fillSearch, mod.character);
            }

            this.setCurrentCharacter(mod.character);


            this.setCurrentMod(mod);
            // Mod MỚI vừa nhập: đánh dấu để hộp sửa không chọn sẵn tag
            // (Đạt dặn 22/11) — hộp đọc + xóa cờ lúc mở/đóng.
            this.temp.editingNewMod = true;
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

        // Đoán nhân vật từ tên thư mục/file (Đạt dặn 22/11) — chạy
        // TRƯỚC khối gán-nhân-vật-hiện-tại (xem handleArchiveDrop).
        await this.tryGuessCharacter(mod, copiedPath);

        // Đoán không ra (vẫn Unknown) thì mới gắn theo tab đang đứng
        // như luật cũ.
        // 如果 currentCharacter 不为空，且 mod 的 character 为 unknown，则将 mod 的 character 设置为 currentCharacter
        //debug
        console.log(`currentCharacter: ${this.temp.currentCharacter}`, mod.character);
        if (this.temp.currentCharacter !== null && this.temp.currentCharacter !== 'all' && this.temp.currentCharacter !== 'selected' && mod.character === 'Unknown') {
            mod.character = this.temp.currentCharacter;
            await mod.saveModInfo();
            mod.triggerChanged();
        }

        // Nhân vật đã chốt (mod.json / hàng đang đứng / đoán được):
        // điền ô tìm kiếm 1 lần — sửa lỗi 1.5.23-test1 (xem
        // handleArchiveDrop).
        if (mod.character !== 'Unknown') {
            EventSystem.trigger(EventType.fillSearch, mod.character);
        }

        this.setCurrentMod(mod);
        this.setCurrentCharacter(mod.character);

        // Mod MỚI vừa nhập: đánh dấu để hộp sửa không chọn sẵn tag
        // (Đạt dặn 22/11) — hộp đọc + xóa cờ lúc mở/đóng.
        this.temp.editingNewMod = true;
        this.showDialog('edit-mod-dialog');

        // getModInfo 遇到新的 mod 会触发 addMod 事件，所以这里不需要再次触发
        // TC26: trả về true để handleDropEntry đếm số mod đã nhập.
        return true;
    }

    //-==================== GameBanana (1.5.25) ====================//
    // Tải mod từ GameBanana + kiểm tra/cập nhật bản mới. Mọi lần gọi
    // mạng dùng module https/http của Node (renderer fetch bị CORS chặn
    // với gamebanana.com) — xem gbFetchBuffer.

    // GET 1 URL, trả về Buffer. Tự đi theo chuyển hướng (tối đa 5 lần —
    // link tải gamebanana.com/dl/<id> chuyển sang CDN), quá 15 giây
    // không có dữ liệu thì ngắt. onProgress (nếu có) nhận (đã nhận,
    // tổng — tổng = -1 khi máy chủ không báo dung lượng). Lỗi mạng
    // thoáng qua (mất gói, wifi chập chờn, máy chủ ngắt giữa chừng) thì
    // thử lại 1 lần sau 500ms thay vì bỏ luôn — lỗi HTTP (404/...) thì
    // không thử lại vì thử nữa cũng lỗi y hệt. Xem _gbFetchBufferOnce
    // để biết chi tiết 1 lần tải.
    async gbFetchBuffer(url, onProgress = null, redirectsLeft = 5, retriesLeft = 1) {
        try {
            return await this._gbFetchBufferOnce(url, onProgress, redirectsLeft);
        } catch (e) {
            const isHttpError = /^HTTP \d+$/.test(e.message || '');
            if (retriesLeft > 0 && !isHttpError) {
                await new Promise((r) => setTimeout(r, 500));
                return this.gbFetchBuffer(url, onProgress, redirectsLeft, retriesLeft - 1);
            }
            throw e;
        }
    }

    async _gbFetchBufferOnce(url, onProgress = null, redirectsLeft = 5) {
        return new Promise((resolve, reject) => {
            const lib = url.startsWith('https:') ? https : http;
            let settled = false;
            const done = (fn, value) => {
                if (settled) return;
                settled = true;
                fn(value);
            };
            const req = lib.get(url, { headers: { 'User-Agent': GB_USER_AGENT } }, (res) => {
                // Chuyển hướng: đi theo link mới (tương đối thì nối với URL cũ).
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
                    res.resume();
                    const nextUrl = new URL(res.headers.location, url).href;
                    this.gbFetchBuffer(nextUrl, onProgress, redirectsLeft - 1).then(
                        (buf) => done(resolve, buf),
                        (err) => done(reject, err)
                    );
                    return;
                }
                if (res.statusCode !== 200) {
                    res.resume();
                    done(reject, new Error(`HTTP ${res.statusCode}`));
                    return;
                }
                const total = Number(res.headers['content-length']);
                const chunks = [];
                let received = 0;
                let idleTimer = null;
                const armIdle = () => {
                    clearTimeout(idleTimer);
                    idleTimer = setTimeout(() => {
                        req.destroy(new Error('Timed out: no data for 15s'));
                    }, 15000);
                };
                armIdle();
                res.on('data', (chunk) => {
                    chunks.push(chunk);
                    received += chunk.length;
                    armIdle();
                    if (onProgress) {
                        try { onProgress(received, Number.isFinite(total) ? total : -1); } catch (_e) { /* bỏ qua */ }
                    }
                });
                res.on('end', () => {
                    clearTimeout(idleTimer);
                    done(resolve, Buffer.concat(chunks));
                });
                res.on('error', (err) => {
                    clearTimeout(idleTimer);
                    done(reject, err);
                });
            });
            req.on('error', (err) => done(reject, err));
        });
    }

    // Đọc JSON từ 1 URL (dùng cho cổng dữ liệu Banana). Lỗi mạng / sai
    // định dạng thì văng lỗi — nơi gọi tự bắt và bỏ qua.
    async gbFetchJson(url) {
        const buf = await this.gbFetchBuffer(url);
        return JSON.parse(buf.toString('utf8'));
    }

    // Danh sách file của 1 mod Banana (mảng _aFiles thô) — lỗi thì null.
    async gbFetchModFiles(modId) {
        try {
            const data = await this.gbFetchJson(`${GB_API_BASE}/Mod/${modId}?_csvProperties=_aFiles`);
            const files = data && data._aFiles;
            return Array.isArray(files) ? files : null;
        } catch (e) {
            console.warn(`gbFetchModFiles(${modId}) failed`, e);
            return null;
        }
    }

    // Tải 1 file Banana về thành File (để nhập bằng đúng đường nhập mod
    // có sẵn). onProgress nhận (đã tải, tổng) để hiện % trên nút.
    async gbDownloadFile(downloadUrl, fileName, onProgress = null) {
        const buf = await this.gbFetchBuffer(downloadUrl, onProgress);
        return new File([buf], fileName, { type: 'application/octet-stream' });
    }

    // Kéo ảnh từ khung Banana ra ngoài (1.5.25 test3): tải ảnh về file
    // tạm rồi nhờ tiến trình chính bắt đầu cú kéo ở mức hệ điều hành
    // (kéo-thả HTML thường không xuyên qua được ranh giới webview).
    // Dùng gbFetchBuffer như tải mod (chịu được chuyển hướng + thử lại
    // 1 lần). File tạm của lần kéo trước bị xóa khi bắt đầu lần này.
    // Trả true khi đã gửi lệnh kéo cho tiến trình chính.
    async gbStartDragImage(imageUrl) {
        try {
            const url = (imageUrl || '').trim();
            if (!/^https?:\/\//i.test(url)) return false;
            const buf = await this.gbFetchBuffer(url);
            if (!buf || buf.length === 0) return false;
            if (gbDragTmpPath) {
                try { fs.unlinkSync(gbDragTmpPath); } catch (_e) { /* file đã mất: thôi */ }
                gbDragTmpPath = null;
            }
            const dir = path.join(os.tmpdir(), 'xxmm-gb-drag');
            fs.mkdirSync(dir, { recursive: true });
            let base = url.split('/').pop().split(/[?#]/)[0] || '';
            base = base.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80) || 'dragged-image';
            const ext = (base.match(/\.([A-Za-z0-9]+)$/) || [])[1] || '';
            if (!/^(png|jpe?g|gif|webp|bmp|avif)$/i.test(ext)) {
                base = base.replace(/\.[A-Za-z0-9]+$/, '') + '.png';
            }
            const tmpPath = path.join(dir, base);
            fs.writeFileSync(tmpPath, buf);
            gbDragTmpPath = tmpPath;
            ipcRenderer.send('gb-start-drag', tmpPath);
            return true;
        } catch (e) {
            console.error('gbStartDragImage failed for', imageUrl, e);
            return false;
        }
    }

    // Kiểm tra bản mới cho mọi mod đã gắn link Banana — hỏi lần lượt
    // từng mod, nghỉ 300ms giữa các lần hỏi để không dội yêu cầu vào
    // Banana. Mod nào file mới nhất khác file đã lưu thì bật dấu "Bản
    // mới" trên thẻ (sự kiện gbUpdateReady). Mod mới gắn link (chưa có
    // mã file) thì nhận file mới nhất làm mốc, không báo bản mới.
    // manual = bấm nút kiểm tra tay: luôn báo kết quả; tự chạy lúc mở
    // app thì chỉ báo khi có bản mới. Đang chạy thì lần gọi sau bỏ qua.
    async checkGameBananaUpdates(manual = false) {
        if (gbChecking) return { checked: 0, updates: 0, skipped: true };
        gbChecking = true;
        let checked = 0;
        let updates = 0;
        let failed = 0;
        try {
            const mods = ModLoader.modsRaw || [];
            for (const modInfo of mods) {
                // Thư mục mod đã bị xóa ngoài (người dùng xóa tay trong
                // lúc app chạy, plugin xóa...) mà danh sách gốc chưa
                // tải lại: bỏ qua, không hỏi Banana cho mod ma.
                if (!modInfo.location || !fs.existsSync(modInfo.location)) continue;
                const modId = parseGameBananaModId(modInfo.metaData.get('url') || '');
                if (!modId) continue;
                const files = await this.gbFetchModFiles(modId);
                if (files === null) {
                    // Hỏi Banana lỗi (mạng chập chờn...): bỏ qua mod này
                    // lần này, lần kiểm tra sau hỏi lại — không tính là
                    // "không có bản mới".
                    failed++;
                    await new Promise(r => setTimeout(r, 300));
                    continue;
                }
                const latest = pickLatestGbFile(files);
                if (!latest) {
                    // Mod không có file tải được: đã kiểm xong, không có
                    // gì để cập nhật.
                    checked++;
                    await new Promise(r => setTimeout(r, 300));
                    continue;
                }
                checked++;
                const storedFileId = Number(modInfo.metaData.get('gbFileId') || 0);
                const modData = this.data.modList.find((m) => m.id === modInfo.id);
                if (!storedFileId) {
                    // Chưa có mốc (vừa dán link tay): nhận file mới nhất
                    // làm mốc, không báo bản mới.
                    modInfo.metaData.set('gbFileId', latest.id, ModMetaDataType.Number);
                    modInfo.metaData.set('gbFileDate', latest.dateAdded, ModMetaDataType.Number);
                    modInfo.saveMetaData();
                } else if (latest.id !== storedFileId) {
                    updates++;
                    if (modData && !modData.gbHasUpdate) {
                        modData.gbHasUpdate = true;
                        EventSystem.trigger(EventType.gbUpdateReady, modData, true);
                    }
                } else if (modData && modData.gbHasUpdate) {
                    // Đã là bản mới nhất (vd vừa cập nhật bằng tay ở
                    // ngoài): tắt dấu cũ đi.
                    modData.gbHasUpdate = false;
                    EventSystem.trigger(EventType.gbUpdateReady, modData, false);
                }
                await new Promise(r => setTimeout(r, 300));
            }
        } finally {
            gbChecking = false;
        }
        if (manual || updates > 0) {
            if (updates > 0) {
                t_snack({
                    vi: `Có ${updates} mod có bản mới trên Banana`,
                    en: `${updates} mod(s) have updates on GameBanana`,
                });
            } else if (manual && failed > 0 && checked === 0) {
                // Bấm tay mà không hỏi được mod nào: báo lỗi mạng rõ
                // ràng thay vì "không có bản mới" gây hiểu lầm.
                t_snack({
                    vi: 'Không kiểm tra được bản mới, hãy thử lại sau',
                    en: 'Could not check for updates, please try again later',
                }, 'error');
            } else {
                t_snack({
                    vi: 'Không có mod nào có bản mới',
                    en: 'No mod updates available',
                });
            }
        }
        return { checked, updates, failed };
    }

    // Cập nhật 1 mod lên bản mới nhất trên Banana (bấm dấu "Bản mới"
    // trên thẻ): tải bản mới về THAY BẢN CŨ, không giữ bản cũ (Đạt
    // chốt). Giữ nguyên nhân vật/tag/tên trong mod.json; mã file + ngày
    // file cập nhật theo bản mới. Giải nén vào thư mục tạm TRƯỚC — thành
    // công mới thay nội dung mod cũ (extractArchive xóa thư mục đích
    // khi lỗi nên không giải nén thẳng vào mod cũ được).
    async gbUpdateMod(mod) {
        if (!mod || !mod.id) return false;
        if (gbUpdatingIds.has(mod.id)) return false;
        gbUpdatingIds.add(mod.id);
        try {
            const modInfo = ModLoader.getModByID(mod.id);
            if (!modInfo) {
                t_snack({ vi: 'Không tìm thấy mod', en: 'Mod not found' }, 'error');
                return false;
            }
            const modId = parseGameBananaModId(modInfo.metaData.get('url') || '');
            if (!modId) {
                t_snack({ vi: 'Mod này không có link Banana', en: 'This mod has no GameBanana link' }, 'error');
                return false;
            }
            const files = await this.gbFetchModFiles(modId);
            const latest = files ? pickLatestGbFile(files) : null;
            if (!latest) {
                t_snack({ vi: 'Không kiểm tra được bản mới, hãy thử lại sau', en: 'Could not check for updates, please try again later' }, 'error');
                return false;
            }
            const storedFileId = Number(modInfo.metaData.get('gbFileId') || 0);
            if (storedFileId && latest.id === storedFileId) {
                // Đã là bản mới nhất (bấm sau khi dấu chưa kịp tắt).
                mod.gbHasUpdate = false;
                EventSystem.trigger(EventType.gbUpdateReady, mod, false);
                t_snack({ vi: 'Mod này đã là bản mới nhất', en: 'This mod is already up to date' });
                return false;
            }
            // Đang áp dụng thì nhớ để kiểm tra lại liên kết sau khi thay.
            const wasApplied = this.scanAppliedModIds().includes(mod.id);
            // Tải bản mới về.
            this.showDialog('loading-dialog');
            let file = null;
            try {
                file = await this.gbDownloadFile(latest.downloadUrl, latest.name || `gb-${latest.id}.zip`);
            } catch (e) {
                console.error('gbUpdateMod download failed', e);
                t_snack({ vi: `Tải bản mới thất bại: ${e.message}`, en: `Failed to download the update: ${e.message}` }, 'error');
                return false;
            } finally {
                this.dismissDialog('loading-dialog');
            }
            // Giải nén vào thư mục tạm (cùng ổ với kho mod để chuyển
            // sang nhanh). Tên có mốc giờ + số ngẫu nhiên để 2 lần cập
            // nhật cùng lúc không đụng nhau.
            const tmpDir = path.join(
                this.config.modSourcePath,
                `.gb-tmp-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
            );
            let ok = false;
            try {
                ok = await this.extractArchive(file, tmpDir);
            } catch (e) {
                console.error('gbUpdateMod extract failed', e);
                ok = false;
            }
            if (!ok) {
                try { if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_e) { /* bỏ qua */ }
                return false;
            }
            // Thay nội dung: xóa hết trong thư mục mod TRỪ mod.json (giữ
            // nhân vật/tag/tên), rồi chuyển nội dung mới sang.
            const modPath = modInfo.location;
            try {
                for (const entry of fs.readdirSync(modPath)) {
                    if (entry === 'mod.json') continue;
                    fs.rmSync(path.join(modPath, entry), { recursive: true, force: true });
                }
                for (const entry of fs.readdirSync(tmpDir)) {
                    fs.renameSync(path.join(tmpDir, entry), path.join(modPath, entry));
                }
            } catch (e) {
                console.error('gbUpdateMod swap failed', e);
                t_snack({ vi: 'Thay bản mới thất bại, hãy kiểm tra lại thư mục mod', en: 'Failed to replace the mod files, please check the mod folder' }, 'error');
                return false;
            } finally {
                try { if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_e) { /* bỏ qua */ }
            }
            // Ghi mốc file mới + tắt dấu bản mới.
            modInfo.metaData.set('gbFileId', latest.id, ModMetaDataType.Number);
            modInfo.metaData.set('gbFileDate', latest.dateAdded, ModMetaDataType.Number);
            modInfo.saveMetaData();
            mod.gbHasUpdate = false;
            EventSystem.trigger(EventType.gbUpdateReady, mod, false);
            // Ảnh bìa/dung lượng có thể đổi theo bản mới: đuổi ảnh cũ
            // khỏi bộ nhớ đệm, quét lại dung lượng, thẻ tự đọc lại ảnh
            // qua modInfoChanged.
            ImageHelper.evictImage(mod.preview);
            mod.clearPreviewCache();
            mod.sizeBytes = -1;
            ModSizeScanner.scanMissing([mod]);
            mod.triggerChanged();
            // Mod đang áp: liên kết trỏ vào thư mục (đường dẫn không
            // đổi) nên vẫn còn hiệu lực — kiểm tra lại cho chắc, mất
            // thì tạo lại.
            if (wasApplied) this.gbEnsureAppliedLink(modInfo);
            t_snack({ vi: `Đã cập nhật ${mod.name} lên bản mới`, en: `Updated ${mod.name} to the latest version` });
            return true;
        } finally {
            gbUpdatingIds.delete(mod.id);
        }
    }

    // Mod đang áp mà liên kết trong thư mục đích mất (vd người dùng xóa
    // tay lúc đang cập nhật) thì tạo lại — chỉ tạo khi chưa có gì ở đó;
    // thư mục/file thật thì không đụng vào (theo luật ApplyMods).
    gbEnsureAppliedLink(modInfo) {
        if (this.config.ifUseTraditionalApply) return;
        const target = this.config.modTargetPath;
        const source = this.config.modSourcePath;
        if (!target || !source) return;
        const dest = path.join(target, modInfo.modName);
        const src = path.join(source, modInfo.modName);
        try {
            fs.lstatSync(dest);
            // Đã có gì ở đó (liên kết, thư mục hay file thật): không đụng vào.
            return;
        } catch (e) {
            if (!e || e.code !== 'ENOENT') return;
        }
        try {
            fs.symlinkSync(src, dest, 'junction');
        } catch (e) {
            console.error(`gbEnsureAppliedLink: cannot recreate link ${dest}`, e);
        }
    }

    // Dọn thư mục tạm của lần cập nhật Banana dở dang (sập giữa chừng):
    // chỉ xóa thư mục cũ hơn 1 giờ để không đụng lần cập nhật đang chạy
    // (thư mục của nó còn mới).
    gbCleanStaleTempDirs() {
        const dir = this.config.modSourcePath;
        if (!dir || !fs.existsSync(dir)) return;
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (_e) {
            return;
        }
        const now = Date.now();
        for (const entry of entries) {
            if (!entry.isDirectory() || !entry.name.startsWith('.gb-tmp-')) continue;
            const full = path.join(dir, entry.name);
            try {
                const stat = fs.statSync(full);
                if (now - stat.mtimeMs < 60 * 60 * 1000) continue;
                fs.rmSync(full, { recursive: true, force: true });
            } catch (_e) {
                // Xóa không được thì thôi — lần sau dọn tiếp.
            }
        }
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

    // Quét xem mod nào đang thật sự bật trong game (Đạt dặn 22/11 — nút
    // Apply nhấp nháy khi còn thay đổi chưa áp): chế độ liên kết thì đọc
    // thư mục đích (mục nào trùng tên mod là đang bật); chế độ truyền
    // thống thì đọc thư mục nguồn (thư mục tên mod, không có tiền tố
    // disabled_, là đang bật). Trả về id các mod đang bật. Lỗi đọc thư
    // mục (chưa đặt đường dẫn, thư mục không có) thì trả về rỗng, không
    // chặn app.
    scanAppliedModIds() {
        // modsRaw (ModInfo) mới có modName chuẩn — tên mục trong thư mục
        // đích do Apply đặt theo modName. data.modList là ModData, chỉ có
        // name (tên hiển thị, có thể khác modName) nên không khớp được.
        const mods = ModLoader.modsRaw || [];
        if (mods.length === 0) return [];
        const dir = this.config.ifUseTraditionalApply ? this.config.modSourcePath : this.config.modTargetPath;
        if (!dir) return [];
        let names;
        try {
            // Windows không phân biệt hoa/thường: liên kết tạo từ tên cũ
            // (khác hoa/thường với tên hiện tại) vẫn là mod đang áp —
            // Apply gặp liên kết đó thì bỏ qua (đã đúng đích), không tạo
            // lại, nên so khớp phải không phân biệt hoa/thường thì Apply
            // xong mới hết nháy.
            names = new Set(fs.readdirSync(dir).map(n => n.toLowerCase()));
        } catch (e) {
            return [];
        }
        return mods.filter(m => names.has((m.modName || '').toLowerCase())).map(m => m.id);
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

// Mất/chọn lại tiêu điểm cửa sổ thì chỉ báo cho các bộ phận khác
// (dừng/chạy lại hiệu ứng màu, vào/thoát chế độ nghỉ, ghi bộ nhớ đệm)
// — KHÔNG hiện thông báo gì. Đạt dặn 22/11: mấy bong bóng ☁️ mất tiêu
// điểm / 💤 nghỉ / 👀 được chọn chỉ làm phiền, bỏ hết.
ipcRenderer.on('windowBlur', () => {
    EventSystem.trigger('windowBlur');

    sleepTimer = setTimeout(() => {
        EventSystem.trigger('windowSleep');
        isSleeping = true;
    }, sleepTimeOutTime);
});

ipcRenderer.on('windowFocus', () => {
    if (isSleeping) {
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
