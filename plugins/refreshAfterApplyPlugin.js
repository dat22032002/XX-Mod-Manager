// pluginConfig 是 data 的 数组

// data 为一个对象，包含了插件的可配置数据，比如说是否启用，是否显示等等
// 它会被 解析 之后 在 设置页面 中显示，并且为 插件提供数据
// 当它发生变化时，会触发 插件的 onChange 方法

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



//- 这是一个 用于 在 应用mod之后自动在游戏中应用mod 的插件

// //-------------------刷新游戏-------------------
const pluginName = 'refreshAfterApply';
// 上面是 原来集成到主程序的代码，现在我们将其转移到插件中
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const refreshInGame = async (iManager) => {
    // Refresh in ZZZ success flag
    // 0: Failed
    // 1: Success
    // 2: Cannot find the process
    // 3: Cannot find the zenless zone zero window
    // 4: Cannot find the mod manager window
    // Only availabe in windows
    const HMC = iManager.HMC;
    const isWindows = process.platform === 'win32';
    if (!isWindows) return 0;
    const processName = iManager.getPluginData(pluginName, 'processName');
    const VisualKey = iManager.getPluginData(pluginName, 'VisualKey');
    if (!processName || !VisualKey) return 0;
    if (isWindows) {
        // Process name. Should be set as a config value for 
        // this to work while managing other games.
        const process = HMC.getProcessNameList(processName);
        if (process.length <= 0) return 2;
        // Get the Zenless Zone Zero Hwnd handle
        const window = HMC.getProcessWindow(process[0].pid);
        if (!window) return 3;
        // Get the Mod manager Hwnd handle
        const manager = HMC.getForegroundWindow();
        if (!manager) return 4;
        // ZZZ wont accept any keys if the manager is not run as admin.
        // ZZZ wont accept virtual keys, only accepts direct input keys.
        // Here is the trick to get ZZZ to register the VK input without admin:
        // TC25: bọc toàn bộ trong try/finally — lỗi ở bước giữa (vd setFocus
        // văng) thì phím vẫn được nhả + focus trả về app, không kẹt phím F10
        // trong game. Thành công thì giữ nguyên hành vi cũ (focus ở lại game).
        //
        // THỬ NGHIỆM 1 lần nhảy (Đạt 24/11): bản cũ nhảy focus 3 lần
        // (game → app → game) vì bấm + nhả phím đều lúc app đang trước
        // mặt — Đạt thấy màn hình nhảy khó chịu. Bản này chỉ nhảy 1 lần:
        // bấm xuống ở app → qua game → nhả ở game → ở lại game luôn.
        // Trạng thái phím là chung cả máy nên nhả ở game vẫn phải thấy
        // phím nhả; nếu game không tải lại mod thì về lại bản 3 lần nhảy.
        // Chỉ đổi số lần nhảy, giữ nguyên thời gian chờ 75ms (1 biến 1 lần).
        let keyDown = false;
        let succeeded = false;
        try {
            // 1. Press the F10 Key down on the manager
            HMC.sendKeyboard(VisualKey, true);
            keyDown = true;
            // 2. Set focus on ZZZ window (single switch)
            window.setFocus(true);
            // 3. Wait a reasonable amount of time for the key to register
            await sleep(75);
            // 4. Release the F10 Key while the game is focused, then stay
            // on the game — no switch back to the manager.
            HMC.sendKeyboard(VisualKey, false);
            keyDown = false;
            succeeded = true;
            return 1;
        } catch (error) {
            console.error('refreshInGame failed:', error);
            return 0;
        } finally {
            if (keyDown) {
                try {
                    HMC.sendKeyboard(VisualKey, false);
                } catch (e) {
                    console.error('refreshInGame: failed to release key:', e);
                }
            }
            if (!succeeded) {
                try {
                    manager.setFocus(true);
                } catch (e) {
                    console.error('refreshInGame: failed to restore focus:', e);
                }
            }
        }
    }
    return 0;
}


module.exports = {
    name: pluginName,
    t_displayName: {
        vi: 'Làm mới sau khi áp dụng',
        en: 'Refresh After Apply'
    },
    init(iManager) {
        iManager.on('modsApplied', async () => {
            //debug
            console.log('modsApplied');
            if (iManager.getPluginData(pluginName, 'ifRefreshAfterApply')) {
                const result = await refreshInGame(iManager);
                // Refresh in ZZZ success flag
                // 0: Failed
                // 1: Success
                // 2: Cannot find the process
                // 3: Cannot find the zenless zone zero window
                // 4: Cannot find the mod manager window
                // Only availabe in windows
                const snackMessage = iManager.config.language === 'vi' ?
                    ['Làm mới thất bại', 'Làm mới thành công', 'Không tìm thấy tiến trình', 'Không tìm thấy cửa sổ', 'Không tìm thấy trình quản lý mod'][result] :
                    ['Refresh Failed', 'Refresh Success', 'Cannot find the process', 'Cannot find the window', 'Cannot find the mod manager'][result];
                iManager.snack(ifRefreshAfterApply.t_displayName[iManager.config.language] + " : " +
                    snackMessage, result === 1 ? "success" : "error");
            }
        });


        let pluginData = [];

        //-MD介绍
        let markdown = {
            name: 'markdown',
            data: '',
            type: 'markdown',
            displayName: 'Refresh After Apply',
            description: 'Refresh the game after applying the mod',
            t_displayName: {
                vi: 'Làm mới sau khi áp dụng',
                en: 'Refresh After Apply'
            },
            t_description: {
                vi: '# Làm mới game sau khi áp dụng mod\nThường sau khi đổi mod, bạn cần bấm tay phím F10 hoặc phím tắt khác để mod có hiệu lực\nPlugin này có thể tự động làm mới game giúp bạn\n\nKhi bạn bấm Áp dụng, chương trình sẽ tự động làm mới game',
                en: '# Refresh the game after applying the mod\nUsually after changing the mod, you need to manually press F10 or other shortcut keys to make the Mod take effect\nThis plugin can automatically help you refresh the game\n\nWhen you click Apply, the program will automatically refresh the game'
            },
            onChange: (value) => {
                // markdown 类型的数据不会触发 onChange,它只作为展示
            }
        };
        pluginData.push(markdown);


        //-是否启用
        let ifRefreshAfterApply = {
            name: 'ifRefreshAfterApply',
            data: false,
            type: 'boolean',
            displayName: 'Refresh After Apply',
            t_displayName: {
                vi: 'Làm mới sau khi áp dụng',
                en: 'Refresh After Apply'
            },
            onChange: (value) => {
                console.log('ifRefreshAfterApply changed:', value);
                ifRefreshAfterApply.data = value;
                // 直接赋值可能会导致插件的数据不同步，所以需要手动更新
            }
        };
        pluginData.push(ifRefreshAfterApply);

        //- 游戏进程名
        let processName = {
            name: 'processName',
            data: 'ZenlessZoneZero.exe',
            type: 'string',
            displayName: 'Process Name',
            description: 'The process name of the game',
            t_displayName: {
                vi: 'Tên tiến trình',
                en: 'Process Name'
            },
            t_description: {
                vi: 'Tên tiến trình của game',
                en: 'The process name of the game'
            },
            onChange: (value) => {
                console.log('processName changed:', value);
                processName.data = value;
            }
        };
        pluginData.push(processName);

        //- F10键值
        let VisualKey = {
            name: 'VisualKey',
            data: 0x79,
            type: 'number',
            displayName: 'VisualKey',
            description: 'The virtual key code for F10',
            t_displayName: {
                vi: 'VisualKey',
                en: 'VisualKey'
            },
            t_description: {
                vi: 'Mã phím ảo để làm mới (mặc định trong 3dmiggoto là F10, tức là 121)',
                en: 'The virtual key code for refresh(3dmiggoto default is F10, which is 121)'
            },
            onChange: (value) => {
                console.log('VisualKey changed:', value);
                VisualKey.data = value;
            }
        };
        pluginData.push(VisualKey);

        iManager.registerPluginConfig(pluginName, pluginData);
    }

}
