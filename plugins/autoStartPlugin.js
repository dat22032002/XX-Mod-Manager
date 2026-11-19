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
const { ipcRenderer } = require('electron');
const fs = require('fs');

function startGame(iManager, gamePath) {
    // 检查游戏路径是否存在
    if (!gamePath) {
        const snackMessage = iManager.config.language === 'vi' ? 'Chưa đặt đường dẫn game' : 'Game Path not set';
        iManager.snack(snackMessage, "error");
        return false;
    }
    if (!fs.existsSync(gamePath)) {
        const snackMessage = iManager.config.language === 'vi' ? 'Đường dẫn game không tồn tại' : 'Game Path not exist';
        iManager.snack(snackMessage, "error");
        return false;
    }
    // 启动游戏
    iManager.startExe(gamePath);
}

function startModLoader(iManager, modLoaderPath) {
    // 检查 mod 加载器路径是否存在
    if (!modLoaderPath) {
        const snackMessage = iManager.config.language === 'vi' ? 'Chưa đặt đường dẫn mod loader' : 'Mod Loader Path not set';
        iManager.snack(snackMessage, "error");
        return false;
    }
    if (!fs.existsSync(modLoaderPath)) {
        const snackMessage = iManager.config.language === 'vi' ? 'Đường dẫn mod loader không tồn tại' : 'Mod Loader Path not exist';
        iManager.snack(snackMessage, "error");
        return false;
    }
    // 启动 mod 加载器
    iManager.startExe(modLoaderPath);
}

function runCommand(iManager, command) {
    //debug
    console.log('runCommand:', command);
    if (!command) {
        const snackMessage = iManager.config.language === 'vi' ? 'Chưa đặt lệnh' : 'Command not set';
        iManager.snack(snackMessage, "error");
        return false;
    }
    iManager.runCommand(command);
}

function autoStart(iManager) {
    //debug
    console.log('autoStart:', iManager.getPluginData(pluginName, 'autoStartModLoader'), iManager.getPluginData(pluginName, 'autoStartGame'));
    iManager.snack('Trying to auto start mod loader and game...');
    const commandStatus = {
        data: iManager.getPluginData(pluginName, 'commandStatus')
    }
    if (iManager.getPluginData(pluginName, 'autoStartModLoader')) startModLoader(iManager, iManager.getPluginData(pluginName, 'modLoaderPath'));
    if (iManager.getPluginData(pluginName, 'autoStartGame')) startGame(iManager, iManager.getPluginData(pluginName, 'gamePath'));
    if (iManager.getPluginData(pluginName, 'ifRunCommand')) {
        ipcRenderer.invoke('get-args').then((args) => {
            //debug
            console.log('get-args:', args, args.switchConfig, iManager.getPluginData(pluginName, 'ignoreSwitchConfig'));
            if (!args.switchConfig || iManager.getPluginData(pluginName, 'ignoreSwitchConfig')) {
                runCommand(iManager, iManager.getPluginData(pluginName, 'command'));
                // 重置 commandStatus
                commandStatus.data = '';
            } else {
                console.log('ignoreSwitchConfig,waiting for switchConfig');
                commandStatus.data = ignoredState;
                iManager.savePluginConfig();
            }
        });
    }

    // 如果发现 commandStatus 为 ignoredState,那么就说明上一次刷新结束时，并没有执行命令，这次刷新时，即使拥有参数 --switchConfig 也要执行命令
    if (iManager.getPluginData(pluginName, 'commandStatus') === ignoredState && !window.location.href.includes('switchConfig')) {
        runCommand(iManager, iManager.getPluginData(pluginName, 'command'));
        // 重置 commandStatus
        commandStatus.data = '';
        iManager.savePluginConfig();
    }
}

const pluginName = 'autoStartPlugin';
const ignoredState = 'ignoreSwitchConfig,waiting for switchConfig';
module.exports = {
    name: pluginName,
    t_displayName: {
        vi: 'Plugin tự động khởi động',
        en: 'Auto Start Plugin'
    },
    init(iManager) {
        // iManager.snack('Auto Start Plugin Loaded from '+__dirname);
        const ignoredState = 'ignoreSwitchConfig,waiting for switchConfig';
        let conditionCount = 0;
        iManager.on('wakeUp', () => {
            conditionCount++;
            //debug
            console.log('auto start plugin get wakeUp event:', conditionCount);
            if (conditionCount === 2) {
                autoStart(iManager);
            }
        });
        iManager.on('pluginLoaded', () => {
            conditionCount++;
            //debug
            console.log('auto start plugin get pluginLoaded event:', conditionCount);
            if (conditionCount === 2) {
                autoStart(iManager);
            }
        });

        let pluginData = [];



        let markdownModLoader = {
            name: 'markdownModLoader',
            data: '',
            type: 'markdown',
            displayName: 'Mod Loader',
            description: 'The path of the mod loader',
            t_displayName: {
                vi: 'Mod Loader',
                en: 'Mod Loader'
            },
            t_description: {
                vi: '# Tự động khởi động mod loader khi chương trình mở\nHãy đảm bảo đường dẫn mod loader đúng và bật công tắc. \nBạn có thể bấm nút thủ công để kiểm tra chương trình có khởi động bình thường không.',
                en: '# Auto Start Mod Loader on Program Start\nPlease make sure the path of the mod loader is correct and turn on the switch. \nYou can test if the program starts normally by manually clicking the button.'
            },
            onChange: (value) => {
                // markdown 类型的数据不会触发 onChange,它只作为展示
            }
        };
        pluginData.push(markdownModLoader);

        //- 是否自动启动mod加载器
        let autoStartModLoader = {
            name: 'autoStartModLoader',
            data: false,
            type: 'boolean',
            displayName: 'Auto Start Mod Loader',
            t_displayName: {
                vi: 'Tự động khởi động mod loader',
                en: 'Auto Start Mod Loader'
            },
            onChange: (value) => {
                // 检查 mod 加载器路径是否存在
                const modLoaderPath = iManager.getPluginData(pluginName, 'modLoaderPath');
                if (value && !modLoaderPath && !fs.existsSync(modLoaderPath)) {
                    const snackMessage = iManager.config.language === 'vi' ? 'Chưa đặt đường dẫn mod loader hoặc đường dẫn không tồn tại' : 'Mod Loader Path not set or not exist';
                    iManager.snack(snackMessage, "error");
                    return false;
                }
                console.log('autoStartModLoader changed:', value);
                autoStartModLoader.data = value;
                const snackMessage = iManager.config.language === 'vi' ? 'Tự động khởi động mod loader đã đổi thành' : 'autoStartModLoader changed to';
                iManager.snack(snackMessage + value);
                iManager.savePluginConfig();
            }
        };
        pluginData.push(autoStartModLoader);
        //- mod加载器路径
        let modLoaderPath = {
            name: 'modLoaderPath',
            data: '',
            type: 'exePath',
            displayName: 'Mod Loader Path',
            t_displayName: {
                vi: 'Đường dẫn mod loader',
                en: 'Mod Loader Path'
            },
            onChange: (value) => {
                console.log('modLoaderPath changed:', value);
                modLoaderPath.data = value;
                iManager.snack('modLoaderPath changed:' + value);
                iManager.savePluginConfig();
            }
        };
        pluginData.push(modLoaderPath);

        //- 手动启动mod加载器的按钮
        let startModLoaderButton = {
            name: 'startModLoader',
            type: 'iconbutton',
            displayName: 'Test Start Mod Loader',
            t_displayName: {
                vi: 'Thử khởi động mod loader',
                en: 'Test Start Mod Loader'
            },
            buttonName: 'Start Mod Loader',
            t_buttonName: {
                vi: 'Khởi động mod loader',
                en: 'Start Mod Loader'
            },
            onChange: () => {
                // 检查 mod 加载器路径是否存在
                const modLoaderPath = iManager.getPluginData(pluginName, 'modLoaderPath');
                if (!modLoaderPath || !fs.existsSync(modLoaderPath)) {
                    const snackMessage = iManager.config.language === 'vi' ? 'Chưa đặt đường dẫn mod loader hoặc đường dẫn không tồn tại' : 'Mod Loader Path not set or not exist';
                    iManager.snack(snackMessage, "error");
                    return false;
                }
                iManager.startExe(modLoaderPath);
            }
        };
        pluginData.push(startModLoaderButton);





        let divider1 = {
            name: 'divider',
            data: '',
            type: 'markdown',
            displayName: 'Divider',
            description: '---',
            t_displayName: {
                vi: 'Đường phân cách',
                en: 'Divider'
            }
        }
        pluginData.push(divider1);

        let markdownGame = {
            name: 'markdownGame',
            data: '',
            type: 'markdown',
            displayName: 'Game',
            description: 'The path of the game',
            t_displayName: {
                vi: 'Game',
                en: 'Game'
            },
            t_description: {
                vi: '# Tự động khởi động game khi chương trình mở\nHãy đảm bảo đường dẫn game đúng và bật công tắc. \nBạn có thể bấm nút thủ công để kiểm tra chương trình có khởi động bình thường không.',
                en: '# Auto Start Game on Program Start\nPlease make sure the path of the game is correct and turn on the switch. \nYou can test if the program starts normally by manually clicking the button.'
            },
            onChange: (value) => {
                // markdown 类型的数据不会触发 onChange,它只作为展示
            }
        };
        pluginData.push(markdownGame);


        //- 是否自动启动游戏
        let autoStartGame = {
            name: 'autoStartGame',
            data: false,
            type: 'boolean',
            displayName: 'Auto Start Game',
            t_displayName: {
                vi: 'Tự động khởi động game',
                en: 'Auto Start Game'
            },
            onChange: (value) => {
                // 检查游戏路径是否存在
                const gamePath = iManager.getPluginData(pluginName, 'gamePath');
                if (value && !gamePath && !fs.existsSync(gamePath)) {
                    const snackMessage = iManager.config.language === 'vi' ? 'Chưa đặt đường dẫn game hoặc đường dẫn không tồn tại' : 'Game Path not set or not exist';
                    iManager.snack(snackMessage, "error");
                    return false;
                }
                console.log('autoStartGame changed:', value);
                autoStartGame.data = value;
                iManager.savePluginConfig();
            }
        }
        pluginData.push(autoStartGame);
        //- 游戏路径
        let gamePath = {
            name: 'gamePath',
            data: '',
            type: 'exePath',
            displayName: 'Game Path',
            t_displayName: {
                vi: 'Đường dẫn game',
                en: 'Game Path'
            },
            onChange: (value) => {
                console.log('gamePath changed:', value);
                gamePath.data = value;
                iManager.snack('gamePath changed:' + value);
                iManager.savePluginConfig();
            }
        }
        pluginData.push(gamePath);

        //- 手动启动游戏的按钮
        let startGameButton = {
            name: 'startGame',
            type: 'iconbutton',
            displayName: 'Test Start Game',
            t_displayName: {
                vi: 'Thử khởi động game',
                en: 'Test Start Game'
            },
            buttonName: 'Start Game',
            t_buttonName: {
                vi: 'Khởi động game',
                en: 'Start Game'
            },
            onChange: () => {
                // 检查游戏路径是否存在
                const gamePath = iManager.getPluginData(pluginName, 'gamePath');
                if (!gamePath || !fs.existsSync(gamePath)) {
                    const snackMessage = iManager.config.language === 'vi' ? 'Chưa đặt đường dẫn game hoặc đường dẫn không tồn tại' : 'Game Path not set or not exist';
                    iManager.snack(snackMessage, "error");
                    return false;
                }
                iManager.startExe(gamePath);
            }
        };
        pluginData.push(startGameButton);

        let divider2 = {
            name: 'divider',
            data: '',
            type: 'markdown',
            displayName: 'Divider',
            description: '---',
            t_displayName: {
                vi: 'Đường phân cách',
                en: 'Divider'
            }
        }
        pluginData.push(divider2);

        let markdownCommand = {
            name: 'markdownCommand',
            data: '',
            type: 'markdown',
            displayName: 'Command',
            description: 'Run command when program start',
            t_displayName: {
                vi: 'Lệnh',
                en: 'Command'
            },
            t_description: {
                vi: '# Chạy lệnh tùy chỉnh khi chương trình mở\nVí dụ, nếu bạn muốn khởi động XXMI tương ứng với cấu hình hiện tại khi XXMM mở, bạn có thể đặt lệnh chạy ở đây: \n "XXMI Launcher.exe" --nogui --xxmi ZZMI \n-\nThay XXMI bằng vị trí của XXMI của bạn, và ZZMI bằng loại mod loader mà nó khởi động, ví dụ ZZMI/WWMI/HSMI, v.v. \nHãy đảm bảo lệnh đúng và bật công tắc.',
                en: '# Run custom command when program start\nFor example, if you want to start the XXMI corresponding to the current configuration when XXMM starts, you can set the command to run here: \n "XXMI Launcher.exe" --nogui --xxmi ZZMI \n-\nReplace XXMI with the location of your XXMI, and ZZMI with the type of mod loader it starts, such as ZZMI/WWMI/HSMI, etc. \nPlease make sure the command is correct and turn on the switch.'
            },
            onChange: (value) => {
                // markdown 类型的数据不会触发 onChange,它只作为展示
            }
        };
        pluginData.push(markdownCommand);

        //- 是否运行命令
        let ifRunCommand = {
            name: 'ifRunCommand',
            data: false,
            type: 'boolean',
            displayName: 'Run Command',
            t_displayName: {
                vi: 'Chạy lệnh',
                en: 'Run Command'
            },
            onChange: (value) => {
                console.log('runCommand changed:', value);
                ifRunCommand.data = value;
            }
        }
        pluginData.push(ifRunCommand);

        //- 忽略是否是切换配置界面
        let ignoreSwitchConfig = {
            name: 'ignoreSwitchConfig',
            data: false,
            type: 'boolean',
            displayName: 'Ignore Switch Config',
            t_displayName: {
                vi: 'Bỏ qua màn hình chuyển cấu hình',
                en: 'Ignore Switch Config'
            },
            onChange: (value) => {
                console.log('ignoreSwitchConfig changed:', value);
                ignoreSwitchConfig.data = value;
            }
        }
        pluginData.push(ignoreSwitchConfig);

        //- 命令
        let command = {
            name: 'command',
            data: '',
            type: 'string',
            displayName: 'Command',
            t_displayName: {
                vi: 'Lệnh',
                en: 'Command'
            },
            onChange: (value) => {
                console.log('command changed:', value);
                command.data = value;
            }
        }
        pluginData.push(command);

        //- 指令执行状态
        let commandStatus = {
            name: 'commandStatus',
            data: '',
            type: 'hidden',
            displayName: 'Command Status',
            t_displayName: {
                vi: 'Trạng thái chạy lệnh',
                en: 'Command Status'
            },
            onChange: (value) => {
                console.log('commandStatus changed:', value);
                commandStatus.data = value;
            }
        }
        pluginData.push(commandStatus);

        //- 手动运行命令的按钮
        let runCommandButton = {
            name: 'runCommand',
            type: 'iconbutton',
            displayName: 'Test Run Command',
            t_displayName: {
                vi: 'Thử chạy lệnh',
                en: 'Test Run Command'
            },
            buttonName: 'Run Command',
            t_buttonName: {
                vi: 'Chạy lệnh',
                en: 'Run Command'
            },
            onChange: () => {
                const command = iManager.getPluginData(pluginName, 'command');
                if (!command) {
                    const snackMessage = iManager.config.language === 'vi' ? 'Chưa đặt lệnh' : 'Command not set';
                    iManager.snack(snackMessage, "error");
                    return false;
                }
                runCommand(iManager, command);
            }
        };
        pluginData.push(runCommandButton);



        iManager.registerPluginConfig(pluginName, pluginData);
    }
}