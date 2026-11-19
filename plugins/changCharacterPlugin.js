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

//- 这是一个用于批量修改mod信息的插件
//-1. 批量修改mod的 character



const pluginName = 'changeCharacterPlugin';



module.exports = {
    name: pluginName,
    t_displayName: {
        vi: 'Plugin đổi nhân vật',
        en: 'Change Character Plugin'
    },
    init(iManager) {

        let pluginData = [];
        //- markdown
        const markdown_vi = `# Thay đổi nhân vật của mod hàng loạt
        Thay đổi nhân vật của các mod có nhân vật nguồn thành nhân vật đích`;
        const markdown_en = `# Change character of mods in batch
        Change the character of mods with source character to target character`;
        let markdown = {
            name: 'markdown',
            data: '',
            type: 'markdown',
            displayName: 'markdown',
            description: 'markdown',
            t_displayName: {
                vi: 'markdown',
                en: 'markdown'
            },
            t_description: {
                vi: markdown_vi,
                en: markdown_en
            },
            onChange: (value) => {
                // markdown 类型的数据不会触发 onChange,它只作为展示
            }
        }
        pluginData.push(markdown);

        //- 源角色
        let sourceCharacter = {
            name: 'sourceCharacter',
            data: '',
            type: 'select',
            displayName: 'Source Character',
            description: 'The character you want to change',
            t_displayName: {
                vi: 'Nhân vật nguồn',
                en: 'Source Character'
            },
            t_description: {
                vi: 'Nhân vật bạn muốn đổi',
                en: 'The character you want to change'
            },
            options: iManager.data.characterList.map((character) => {
                return {
                    value: character,
                    label: character
                }
            }),
            onChange: (value) => {
                console.log('sourceCharacter changed:', value);
            }
        }

        pluginData.push(sourceCharacter);

        //- 目标角色
        let targetCharacter = {
            name: 'targetCharacter',
            data: '',
            type: 'string',
            displayName: 'Target Character',
            description: 'The character you want to change to',
            t_displayName: {
                vi: 'Nhân vật đích',
                en: 'Target Character'
            },
            t_description: {
                vi: 'Nhân vật bạn muốn đổi thành',
                en: 'The character you want to change to'
            },
            onChange: (value) => {
                console.log('targetCharacter changed:', value);
                targetCharacter.data = value;
            }
        }
        pluginData.push(targetCharacter);

        //- 按钮，二次确认修改
        let ifChangeCharacter = {
            name: 'ifChangeCharacter',
            data: false,
            type: 'boolean',
            displayName: 'If Change Character',
            description: 'If true, change character',
            t_displayName: {
                vi: 'Xác nhận đổi',
                en: 'Confirm Change'
            },
            t_description: {
                vi: 'Nếu bật, đổi nhân vật',
                en: 'If true, change character'
            },
            onChange: (value) => {
                console.log('ifChangeCharacter changed:', value);
                ifChangeCharacter.data = value;

                const snackMessage = {
                    vi: 'Bạn cần bật tùy chọn này trước để đổi nhân vật',
                    en: 'You need to set this option to true first to change character'
                }
                if (value) {
                    iManager.t_snack(snackMessage);
                }
                //需要刷新，将value返回
                // return value;
            }
        }
        pluginData.push(ifChangeCharacter);

        //- 按钮，修改角色
        let changeCharacter = {
            name: 'changeCharacter',
            data: '',
            type: 'iconbutton',
            displayName: 'Change Character',
            description: 'Change character',
            t_displayName: {
                vi: 'Đổi nhân vật',
                en: 'Change Character'
            },
            t_description: {
                vi: 'Đổi nhân vật',
                en: 'Change character'
            },
            buttonName: 'change',
            t_buttonName: {
                vi: 'Đổi',
                en: 'Change'
            },
            onChange: () => {
                console.log('changeCharacter clicked');

                if (iManager.getPluginData(pluginName, "ifChangeCharacter")) {
                    // 将 二次确认 开关关闭
                    iManager.setPluginData(pluginName, "ifChangeCharacter", false);

                    iManager.showDialog('loading-dialog');
                    const snackMessage = {
                        en: "change character",
                        vi: "Đổi nhân vật"
                    }
                    iManager.t_snack(snackMessage);

                    const sourceCharacter = iManager.getPluginData(pluginName, "sourceCharacter");
                    const targetCharacter = iManager.getPluginData(pluginName, "targetCharacter");
                    
                    // 检查数据
                    if (sourceCharacter === '' || targetCharacter === '') {
                        const snackMessage = {
                            en: "Please set source character and target character",
                            vi: "Hãy đặt nhân vật nguồn và nhân vật đích"
                        }
                        iManager.t_snack(snackMessage, 'error');
                        iManager.dismissDialog('loading-dialog');
                        return;
                    }

                    // 修改mod的character,当所有mod的character都修改完成后，关闭loading-dialog
                    // 使用Promise.all来等待所有的promise完成
                    Promise.all(iManager.data.modList.map(async (mod) => {
                        if (mod.character === sourceCharacter) {
                            mod.character = targetCharacter;
                            // debug
                            console.log('mod:', mod.name, 'character changed to:', mod.character);
                            await mod.saveModInfo();
                        }
                    })).then(() => {
                        iManager.dismissDialog('loading-dialog');
                        iManager.showDialog('dialog-need-refresh');
                    });
                }
                else {
                    const snackMessage = {
                        en: "You need to set 'If Change Character' to true first",
                        vi: "Bạn cần đặt 'Xác nhận đổi' thành bật trước"
                    }
                    iManager.t_snack(snackMessage, 'error');
                }
            }
        }
        pluginData.push(changeCharacter);


        iManager.registerPluginConfig(pluginName, pluginData);
    }
};


