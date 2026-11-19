//-===================== 插件 =====================
import XXMMCore from "../core/XXMMCore";
import { EventType, EventSystem } from "./EventSystem";
import { TranslatedText } from "./Language";
import { PathHelper } from "./PathHelper";
import { snack, SnackType, t_snack } from "./SnackHelper";
// require qua biến trung gian để Vite không phân tích tĩnh được tên module:
// 'path' là module Node, phải để Node require lúc chạy thay vì để Vite đóng gói.
const pathOsName = 'path'
const path = require(pathOsName);
const fs = require('fs');


/** @enum
 * @desc 用于标记插件数据的类型
 */
enum IPluginDataTypes {
    markdown = 'markdown',
    boolean = 'boolean',
    path = 'path',
    number = 'number',
    button = 'button',
    iconbutton = 'iconbutton',
    select = 'select'
}

interface IPluginOption {
    value: string;
    t_value: TranslatedText;
}

interface IPluginData {
    name: string;
    data: any;
    type: IPluginDataTypes;
    displayName: string;
    description?: string;
    onChange?: (value: any) => void;


    //-可选项：显示名称，带有翻译
    t_displayName?: TranslatedText;

    //-可选项：显示描述，带有翻译
    t_description?: TranslatedText;


    //-作为 button 类型的按钮   
    buttonName?: string;
    t_buttonName?: TranslatedText;

    //-作为 iconbutton 类型的按钮
    icon?: string;

    //-作为 select 类型的选项
    options?: IPluginOption[];
}

interface IPlugin {
    name: string;
    t_displayName: TranslatedText;
    init: (enviroment) => void;
}


class IPluginLoader {
    public static plugins: { [key: string]: IPlugin } = {};
    public static disabledPluginNames: string[] = [];
    public static pluginConfig: { [key: string]: IPluginData[] } = {};
    public static enviroment: any;

    // HP12: the user-data path is fetched once asynchronously (via the cached
    // XXMMCore.getDataPath()) instead of a blocking sendSync on every load.
    public static pluginLoadFolders: (() => string | Promise<string>)[] = [
        () => path.resolve('./plugins'), // 内置插件
        async () => {
            const userDataPath = await XXMMCore.getDataPath();
            return path.join(userDataPath, 'plugins'); // 用户插件
        }   // 全局插件
    ];

    //-============= 自身初始化 =============-//
    public static clearAllPlugins() {
        IPluginLoader.plugins = {};
        IPluginLoader.disabledPluginNames = [];
        IPluginLoader.pluginConfig = {};
    }

    public static async Init(env: any) {
        IPluginLoader.clearAllPlugins(); // 清空所有插件    
        IPluginLoader.enviroment = env;

        // 加载禁用的插件
        await IPluginLoader.LoadDisabledPlugins();
        // 加载所有插件 
        await IPluginLoader.LoadPlugins(env);
        // debug
        console.log('IPluginLoader init finished');
    }

    static async LoadDisabledPlugins() {
        IPluginLoader.disabledPluginNames = XXMMCore.getDisabledPlugins();
        // debug
        console.log('disabledPluginNames:', IPluginLoader.disabledPluginNames);
    }

    //-============= 方法 =============-//

    static disablePlugin(pluginName: string) {
        IPluginLoader.disabledPluginNames.push(pluginName);
        EventSystem.trigger(EventType.pluginDisabled, pluginName);
        IPluginLoader.saveDisabledPlugins();
    }

    static enablePlugin(pluginName: string) {
        let index = IPluginLoader.disabledPluginNames.indexOf(pluginName);
        if (index !== -1) {
            IPluginLoader.disabledPluginNames.splice(index, 1);
            EventSystem.trigger(EventType.pluginEnabled, pluginName);
            IPluginLoader.saveDisabledPlugins();
        }
    }

    static togglePlugin(pluginName: string) {
        if (IPluginLoader.disabledPluginNames.includes(pluginName)) {
            IPluginLoader.enablePlugin(pluginName);
        } else {
            IPluginLoader.disablePlugin(pluginName);
        }
    }

    static async saveDisabledPlugins() {
        XXMMCore.saveDisabledPlugins(IPluginLoader.disabledPluginNames);
    }

    //-============= 插件注册 =============-//

    /** @function
     * @desc 注册一个插件
     * @param {IPlugin} plugin - 插件
     * @param {any} enviroment - should be an IManager instance
     * 这里使用 enviroment 是为了 避免循环引用
     * @returns {boolean}
     */
    static async RegisterPlugin(plugin: IPlugin, enviroment: any): Promise<boolean> {
        IPluginLoader.plugins[plugin.name] = plugin;

        if (IPluginLoader.disabledPluginNames.includes(plugin.name)) {
            // debug
            const tt = new TranslatedText(`⛔plugin ${plugin.name} disabled`, `⛔Plugin ${plugin.name} đã tắt`);
            console.log(tt.get());
            // t_snack(tt, SnackType.info);
            return false;
        }

        if (plugin.init !== undefined) {
            if (!IPluginLoader.initializePlugin(plugin, enviroment)) {
                return false;
            }
            // debug
            const tt = new TranslatedText(`🚀plugin ${plugin.name} initialized`, `🚀Plugin ${plugin.name} đã khởi tạo xong`);
            console.log(tt.get());
        }

        // 检测是否有本地配置（插件可能没有注册配置，先判空再遍历）
        const localPluginData = XXMMCore.getPluginConfig(plugin.name);
        if (localPluginData && IPluginLoader.pluginConfig[plugin.name]) {
            IPluginLoader.pluginConfig[plugin.name].forEach((data) => {
                if (localPluginData[data.name] !== undefined) {
                    data.data = localPluginData[data.name];
                }
            });
            // debug
            const tt = new TranslatedText(`🔧plugin ${plugin.name} loaded with local data`, `🔧Plugin ${plugin.name} chạy với dữ liệu cục bộ`);
            console.log(tt.get(), IPluginLoader.pluginConfig[plugin.name]);
        }
        return true;
    }

    /** @function
     * @desc 初始化一个插件
     * @param {IPlugin} plugin - 插件
     * @param {any} enviroment - should be an IManager instance
     * 这里使用 enviroment 是为了 避免循环引用
     * @returns {boolen}
     */
    static initializePlugin(plugin: IPlugin, enviroment: any): boolean {
        try {
            plugin.init(enviroment);
        } catch (error) {
            const tt = new TranslatedText(`❌plugin ${plugin.name} initialization failed: ${error.message}`, `❌Plugin ${plugin.name} khởi tạo thất bại: ${error.message}`);
            console.error(tt.get(), error);
            t_snack(tt, SnackType.error);
            return false;
        }
        return true;
    }

    static RegisterPluginConfig(pluginName: string, pluginConfig: IPluginData[]) {
        // 如果 pluginConfig 不存在，则创建一个新的数组，否则将 pluginConfig 添加到 pluginConfig 中
        if (IPluginLoader.pluginConfig[pluginName] === undefined) {
            IPluginLoader.pluginConfig[pluginName] = pluginConfig;
        }
        else {
            IPluginLoader.pluginConfig[pluginName] = IPluginLoader.pluginConfig[pluginName].concat(pluginConfig);
        }

        // debug
        const tt = new TranslatedText(`👻plugin ${pluginName} config registered`, `👻Plugin ${pluginName} đã đăng ký cấu hình`);
        console.log(tt.get(), IPluginLoader.pluginConfig[pluginName]);
    }

    /** @function
     * @desc 从指定的文件夹加载插件
     * @param {any} enviroment - should be an IManager instance
     * @param {string} folder - 插件文件夹
     * @returns {Promise<void>}
     */
    static async LoadPluginsFromFolder(enviroment: any, folder: string) {
        if (!PathHelper.CheckDir(folder, false, true, new TranslatedText('plugin folder', 'Thư mục plugin'))) {
            // 不存在就创建
            fs.mkdirSync(folder, { recursive: true });
            t_snack(new TranslatedText('create plugin folder', 'Tạo thư mục plugin'), SnackType.info);
            return;
        }
        const files = fs.readdirSync(folder);
        // HP4: files.forEach(async ...) was never awaited, so Init returned
        // before plugins finished registering; a for...of loop awaits each one.
        for (const file of files) {
            if (file.endsWith('.js')) {
                try {
                    const plugin: IPlugin = require(path.join(folder, file)) as unknown as IPlugin;
                    await IPluginLoader.RegisterPlugin(plugin, enviroment);
                }
                catch (e) {
                    const tt = new TranslatedText(`❌plugin ${file} load failed: ${e.message}`, `❌Plugin ${file} tải thất bại: ${e.message}`);
                    console.error(tt.get(), e);
                    t_snack(tt, SnackType.error);
                }
            }
        }
    }

    /** @function
     * @desc 加载所有插件
     * @param {any} enviroment - should be an IManager instance
     * 这里使用 enviroment 是为了 避免循环引用
     */
    static async LoadPlugins(enviroment: any) {
        // 插件为 一个 js 文件，通过 require 引入
        // 然后调用 init 方法，将 iManager 传递给插件
        const startTime = new Date().getTime();
        await Promise.all(
            IPluginLoader.pluginLoadFolders.map(async (folder) => {
                // resolve once: a folder entry may be async now (HP12)
                const folderPath = await folder();
                // debug
                console.log(`Load plugins from ${folderPath}`);
                await IPluginLoader.LoadPluginsFromFolder(enviroment, folderPath);
            }
            ));

        const endTime = new Date().getTime();
        const tt = new TranslatedText(`🚀plugin loaded in ${endTime - startTime}ms`, `🚀Đã tải plugin trong ${endTime - startTime}ms`);
        console.log(tt.get(), `${Object.keys(IPluginLoader.plugins).length} plugins loaded, ${IPluginLoader.disabledPluginNames.length} disabled`);
    }

    //-===================== 插件配置 =====================
    static transformPluginConfigToSave(pluginConfig: IPluginData[]) {
        // 只保留 data
        const pluginDataToSave = {};
        pluginConfig.forEach((data) => {
            pluginDataToSave[data.name] = data.data;
        });
        return pluginDataToSave;
    }

    /** @function
     * @desc 保存单个插件的配置
     * 保存的配置是 pluginData 里面的 data
     * data 是一个对象，包含了 插件的配置数据,以{{配置名：配置值}}的形式保存
     * @param {string} pluginName - 插件名称
     * @param {IPluginData[]} pluginData - 插件配置
     * @returns {Promise<void>}
     * 该方法是异步的，不会阻塞主线程
    */
    static async SavePluginConfig(pluginName: string, pluginData: IPluginData[]) {
        // pluginConfig 里面存储了 所有插件的配置 pluginData
        // 每个 pluginData 是一个 数组 ，包含了 插件的配置
        // 但是我们不需要保存 pluginData里面的所有数据，比如说显示名称，描述，onChange等，只需要保存 data
        // data 是一个对象，包含了 插件的配置数据

        const pluginDataToSave = IPluginLoader.transformPluginConfigToSave(pluginData);

        // debug
        const tt = new TranslatedText(`🔧plugin ${pluginName} config saved`, `🔧Đã lưu cấu hình plugin ${pluginName}`
        );
        console.log(tt.get(), pluginName, pluginDataToSave);
        // 保存插件配置到文件
        XXMMCore.savePluginConfig(pluginName, pluginDataToSave);
    }

    /** @function   
     * @desc 保存所有插件的配置
     * 保存的配置是 pluginData 里面的 data  
     * data 是一个对象，包含了 插件的配置数据,以{{配置名：配置值}}的形式保存
    */
    static async SaveAllPluginConfig() {
        // HP15: one read + one write for all plugins instead of one per plugin
        const allPluginDataToSave: { [key: string]: any } = {};
        for (const pluginName in IPluginLoader.pluginConfig) {
            allPluginDataToSave[pluginName] = IPluginLoader.transformPluginConfigToSave(IPluginLoader.pluginConfig[pluginName]);
        }
        XXMMCore.saveAllPluginConfig(allPluginDataToSave);
    }

    /** @function
     * @desc 保存所有插件的配置，同步版本
     * 保存的配置是 pluginData 里面的 data  
     * data 是一个对象，包含了 插件的配置数据,以{{配置名：配置值}}的形式保存
     * 该方法是同步的，会阻塞主线程
     * 一般用于程序退出时保存配置
    */
    static SaveAllPluginConfigSync() {
        //弹出窗口，询问是否保存配置
        // alert('SaveAllPluginConfigSync');
        // TC13: chỉ còn 1 đường ghi cấu hình plugin — ghi đồng bộ trực tiếp
        // như SaveAllPluginConfig. Trước đây đường tắt app đi qua IPC
        // 'save-all-plugin-config' (tiến trình chính đọc-sửa-ghi cùng 1 file
        // pluginConfig.json) trong khi plugin ghi trực tiếp từ giao diện
        // (XXMMCore.savePluginConfig) — 2 tiến trình đọc-sửa-ghi chồng nhau
        // có thể ghi đè mất nhau, và lệnh IPC không chờ lúc tắt app có thể
        // mất luôn trước khi cửa sổ đóng. Ghi đồng bộ ở đây thì chắc chắn
        // xong trước khi cửa sổ đóng (giống saveConfigSync).
        const allPluginDataToSave: { [key: string]: any } = {};
        for (const pluginName in IPluginLoader.pluginConfig) {
            allPluginDataToSave[pluginName] = IPluginLoader.transformPluginConfigToSave(IPluginLoader.pluginConfig[pluginName]);
        }
        console.log('saveAllPluginConfig:', allPluginDataToSave);
        XXMMCore.saveAllPluginConfig(allPluginDataToSave);
    }

    //-===================== 插件接口 =====================
    static GetPluginData(pluginName: string, dataName: string) {
        // 检查是否有本地配置
        if (IPluginLoader.pluginConfig[pluginName] === undefined) {
            return undefined;
        }
        const pluginData = IPluginLoader.pluginConfig[pluginName];
        const data = pluginData.find((data) => data.name === dataName);
        return data ? data.data : undefined;
    }

    static SetPluginData(pluginName: string, dataName: string, value: any) {
        const pluginData = IPluginLoader.pluginConfig[pluginName];
        const data = pluginData.find((data) => data.name === dataName);
        if (data && data.onChange) {
            data.onChange(value);
        }
    }
}



export { IPlugin, IPluginLoader, IPluginData, IPluginDataTypes, IPluginOption }