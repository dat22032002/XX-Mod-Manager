// 因为 使用 了 统一的 settingBar 结构，所以说不再需要 一个个的写 settingBar 的数据了
// settingSection.vue 直接 import settingBarData from './settingSectionData.js' 即可
// 会在这里 定义 settingBar 的 需要显示的 配置项

// data 为一个对象，包含了插件的可配置数据，比如说是否启用，是否显示等等
// 它会被 解析 之后 在 设置页面 中显示，并且为 插件提供数据
// 当它发生变化时，会触发 插件的 onChange 方法

// 在这里 将 程序原本的核心程序 视作一个 特殊的插件

// data 的格式为
// {
//     name: 'ifAblePlugin',
//     data: true,
//     type: 'boolean',
//     displayName: 'If Able Plugin',
//     description: 'If true, the plugin will be enabled',
//     t_displayName:{
//         zh_cn:'是否启用插件',
//         en:'Enable Plugin'
//     },
//     t_description:{
//         zh_cn:'如果为真，插件将被启用',
//         en:'If true, the plugin will be enabled'
//     },
//     onChange: (value) => {
//         console.log('ifAblePlugin changed:', value);
//     }
// }
import IManager from "../../electron/IManager";
const iManager = new IManager();



//- ========================== 常规设置 ========================== -//
function getData() {
    //-------------------- 语言 ------------------//
    let languageData = {
        name: 'language',
        data: iManager.config.language,
        type: 'select',
        displayName: 'Language',
        description: '',
        t_displayName: {
            vi: 'Ngôn ngữ',
            en: 'Language'
        },
        options: [{
            value: 'en',
            t_value: {
                vi: 'English',
                en: 'English'
            }
        },
        {
            value: 'vi',
            t_value: {
                vi: 'Tiếng Việt',
                en: 'Tiếng Việt'
            }
        }
        ],
        onChange: (value) => {
            console.log('language changed:', value);
            iManager.setLanguage(value);
        }
    }
    //-------------------- 主题 ------------------//
    let themeData = {
        name: 'theme',
        data: iManager.config.theme,
        type: 'select',
        displayName: 'Theme',
        description: '',
        t_displayName: {
            vi: 'Giao diện',
            en: 'Theme'
        },
        options: [{
            value: 'auto',
            t_value: {
                vi: 'Tự động',
                en: 'Auto'
            }
        },
        {
            value: 'dark',
            t_value: {
                vi: 'Tối',
                en: 'Dark'
            }
        },
        {
            value: 'light',
            t_value: {
                vi: 'Sáng',
                en: 'Light'
            }
        }
        ],
        onChange: (value) => {
            console.log('theme changed:', value);
            iManager.setTheme(value);
        }
    }

    //-------------------- 是否使用上次使用的预设 ------------------//
    let ifStartWithLastPresetData = {
        name: 'ifStartWithLastPreset',
        data: iManager.config.ifStartWithLastPreset,
        type: 'boolean',
        displayName: 'Start With Last Preset',
        description: 'Whether to start with the last preset used',
        t_displayName: {
            vi: 'Dùng preset lần trước',
            en: 'Start With Last Preset'
        },
        t_description: {
            vi: 'Khi mở chương trình có dùng preset đã dùng lần trước không',
            en: 'Whether to use the last preset used when the program starts'
        },
        onChange: (value) => {
            console.log('ifStartWithLastPreset changed:', value);
            iManager.setConfig('ifStartWithLastPreset', value);
        }
    }

    //-------------------- 模组目标文件夹 ------------------//
    let modTargetPathData = {
        name: 'modTargetPath',
        data: iManager.config.modTargetPath,
        type: 'dir',
        displayName: 'Mod Target Path',
        description: 'The path of the mod target',
        t_displayName: {
            vi: 'Thư mục đích của mod',
            en: 'Mod Target Folder'
        },
        t_description: {
            vi: 'Thư mục đích là nơi trình tải mod đọc mod, thường là thư mục Mods',
            en: 'Mod target directory is the location where modLoader reads mod, usually the Mods folder'
        },
        onChange: (value) => {
            console.log('modTargetPath changed:', value);
            iManager.setConfig('modTargetPath', value);
        }
    }
    //-------------------- 模组源文件夹 ------------------//
    let modSourcePathData = {
        name: 'modSourcePath',
        data: iManager.config.modSourcePath,
        type: 'dir',
        displayName: 'Mod Source Path',
        description: 'The path of the mod source',
        t_displayName: {
            vi: 'Thư mục nguồn của mod',
            en: 'Mod Source Folder'
        },
        t_description: {
            vi: 'Thư mục nguồn là nơi chương trình lưu mod, khi mod được bật sẽ tạo liên kết từ đây tới thư mục đích.',
            en: 'Mod Source directory is the location where the program stores mod. When the mod is enabled, a link will be created from here to the mod target directory.'
        },
        onChange: (value) => {
            console.log('modSourcePath changed:', value);
            iManager.setConfig('modSourcePath', value);
        }
    }
    //-------------------- 预设文件夹 ------------------//
    let presetPathData = {
        name: 'presetPath',
        data: iManager.config.presetPath,
        type: 'dir',
        displayName: 'Preset Path',
        description: 'The path of the preset',
        t_displayName: {
            vi: 'Thư mục preset',
            en: 'Preset Folder'
        },
        t_description: {
            vi: 'Thư mục preset là nơi lưu preset, preset là một nhóm mod có thể bật cùng lúc chỉ với một lần bấm',
            en: 'The preset path is the location where the preset is stored. The preset is a collection of mods that can be enabled with one click.'
        },
        onChange: (value) => {
            console.log('presetPath changed:', value);
            iManager.setConfig('presetPath', value);
        }
    }

    //-------------------- 初始化所有数据的按钮 ------------------//
    let initAllDataButton = {
        name: 'initAllData',
        type: 'button',
        displayName: 'Init All Data',
        description: 'Initialize all data',
        t_displayName: {
            vi: 'Khởi tạo lại toàn bộ dữ liệu',
            en: 'Init All Data'
        },
        t_description: {
            vi: 'Khởi tạo lại toàn bộ dữ liệu',
            en: 'Initialize all data'
        },
        buttonName: 'Init All Data',
        t_buttonName: {
            vi: 'Khởi tạo lại toàn bộ dữ liệu',
            en: 'Init All Data'
        },
        onChange: () => {
            iManager.initAllData();
        }
    }

    //-------------------- 重新扫描全部 mod 的按钮 ------------------//
    // 正常情况下不需要点：每次打开程序都会自动发现新增/删除/改过的 mod。
    // 只有缓存坏了、列表显示不对时才用它强制重扫一遍。
    let rescanAllModsButton = {
        name: 'rescanAllMods',
        type: 'button',
        displayName: 'Rescan All Mods',
        description: 'Clear the mod cache and rescan all mods',
        t_displayName: {
            vi: 'Quét lại toàn bộ mod',
            en: 'Rescan All Mods'
        },
        t_description: {
            vi: 'Xóa bộ nhớ đệm của mod và quét lại toàn bộ mod (dùng khi bộ nhớ đệm hỏng, danh sách hiện sai)',
            en: 'Clear the mod cache and rescan all mods (use when the cache is broken or the list looks wrong)'
        },
        buttonName: 'Rescan All Mods',
        t_buttonName: {
            vi: 'Quét lại',
            en: 'Rescan'
        },
        onChange: () => {
            iManager.rescanAllMods();
        }
    }

    //-------------------- 打开 firstLoad 页面的按钮 ------------------//
    let openFirstLoadButton = {
        name: 'openFirstLoad',
        type: 'iconbutton',
        displayName: 'Open First Load',
        description: 'Open First Load',
        t_displayName: {
            vi: 'Hướng dẫn cho người mới',
            en: 'New User Guide'
        },
        t_description: {
            vi: 'Mở trang hướng dẫn cho người mới',
            en: 'Open New User Guide Page'
        },
        buttonName: 'First Load',
        t_buttonName: {
            vi: 'Mở hướng dẫn cho người mới',
            en: 'Open New User Guide'
        },
        onChange: () => {
            iManager.openNewWindow('firstLoad');
            iManager.config.firstLoad = true;
        }
    }
    return {
        languageData, themeData, ifStartWithLastPresetData,modTargetPathData, modSourcePathData, presetPathData, initAllDataButton, rescanAllModsButton, openFirstLoadButton
    }
}


export default getData;
