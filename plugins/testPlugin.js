


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
const pluginName = 'testPlugin';
const markdown_vi = `# Plugin thử nghiệm
Đây là một plugin thử nghiệm đơn giản, dùng để kiểm tra chức năng và cách hiển thị của plugin, với người dùng, bạn có thể tắt plugin trong cài đặt-plugin để ẩn plugin này.
# Khai báo mục cấu hình
Plugin có thể hiển thị các mục cấu hình bằng cách khai báo dữ liệu, và người dùng có thể cấu hình chức năng của plugin qua trang cài đặt:
- dữ liệu kiểu boolean có thể điều khiển bằng công tắc
- dữ liệu kiểu number có thể điều khiển bằng ô nhập
- dữ liệu kiểu path có thể điều khiển bằng trình chọn thư mục
- dữ liệu kiểu select có thể điều khiển bằng trình chọn
- dữ liệu kiểu button có thể kích hoạt sự kiện bằng nút bấm
- dữ liệu kiểu markdown có thể hiển thị văn bản định dạng markdown

# Lắng nghe thay đổi dữ liệu
Plugin có thể lắng nghe thay đổi dữ liệu bằng cách khai báo phương thức onChange, phương thức này sẽ được gọi khi dữ liệu thay đổi.
# Lưu dữ liệu
Plugin có thể lưu dữ liệu thủ công bằng cách gọi phương thức iManager.savePluginConfig(), tất nhiên chương trình sẽ tự động lưu dữ liệu khi đóng.
# Lắng nghe sự kiện
Plugin có thể lắng nghe sự kiện qua phương thức iManager.on() để thực hiện chức năng của plugin.
---
# Hiển thị mục cấu hình:
Dưới đây là một số mục cấu hình mẫu:`;
const markdown_en = `# Test Plugin
This is a simple test plugin, used to test the function and display effect of the plugin, for users, you can turn off the plugin in settings-plugin to cancel the display of the plugin.
# Declare configuration items
Plugins can display configuration items by declaring data, and users can configure the function of the plugin through the settings page:
- boolean type data can be controlled by switch
- number type data can be controlled by input box
- path type data can be controlled by folder selector
- select type data can be controlled by selector
- button type data can trigger events by button
- markdown type data can display text in markdown format

# Listen for data changes
Plugins can listen for data changes by declaring the onChange method, which will be triggered when data changes.
# Save data
Plugins can manually save data by calling iManager.savePluginConfig() method, of course the program will automatically save data when closing.
# Event listening
Plugins can listen for events through the iManager.on() method to implement the function of the plugin.
---
# Configuration item display:
Here are some configuration items display:`;

module.exports = {
    name: pluginName,
    t_displayName: {
        vi: 'Plugin thử nghiệm',
        en: 'Test Plugin'
    },
    init(iManager) {
        iManager.t_snack({
            vi: 'Plugin thử nghiệm được tải từ đường dẫn: ' + __dirname,
            en: 'Test Plugin loaded from path: ' + __dirname    
        });
        iManager.t_snack({
            vi: 'Plugin thử nghiệm dùng để trình bày chức năng của plugin, cung cấp tài liệu tham khảo cho việc viết plugin, với người dùng thông thường, bạn có thể tắt plugin trong cài đặt>plugin để ẩn plugin này.',  
            en: 'Test Plugin is used to show the function of the plugin, provide reference for plugin writing, for ordinary users, you can close the plugin in settings>plugin to cancel the display of the plugin.'      
        });

        iManager.on('pluginLoaded', () => {
            // 如果开启了打印日志到文件，则激活LogHandler
            const ifLog2File = iManager.getPluginData(pluginName, 'ifLog2File');
            if (ifLog2File) {
                iManager.t_snack({
                    vi: 'Nhật ký sẽ được ghi vào file',
                    en: 'Log will be printed to file'
                });
                iManager.LogHandler.init();
            }
        });

        let pluginData = [];

        //- 是否打印日志
        let ifLog2File = {
            name: 'ifLog2File',
            data: false,
            type: 'boolean',
            displayName: 'If Log To File',
            description: 'If true, the plugin will log to file',
            t_displayName: {
                vi: 'Ghi nhật ký vào file',
                en: 'Log To File'
            },
            t_description: {
                vi: 'Nếu bật, plugin sẽ ghi nhật ký vào file',
                en: 'If true, the plugin will log to file'
            },
            onChange: (value) => {
                console.log('ifLog2File changed:', value);
                ifLog2File.data = value;
                iManager.snack('ifLog2File changed:' + value);
                iManager.showDialog('dialog-need-refresh');
            }
        };
        pluginData.push(ifLog2File);

        //- 测试 markdown 类型
        let testMarkdown = {
            name: 'testMarkdown',
            data: '',
            type: 'markdown',
            displayName: 'Test Markdown',
            description: 'Test Markdown',
            t_displayName: {
                vi: 'Thử nghiệm Markdown',
                en: 'Test Markdown'
            },
            t_description: {
                vi: markdown_vi,
                en: markdown_en
            },
            onChange: (value) => {
                // markdown 类型的数据不会触发 onChange,它只作为展示
            }
        }
        pluginData.push(testMarkdown);

        //- 测试 boolean 类型
        let ifAblePlugin = {
            name: 'ifAblePlugin',
            data: true,
            type: 'boolean',
            displayName: 'If Able Plugin',
            description: 'If true, the plugin will be enabled',
            t_displayName: {
                vi: 'Bật plugin',
                en: 'Enable Plugin'
            },
            t_description: {
                vi: 'Nếu bật, plugin sẽ được bật',
                en: 'If true, the plugin will be enabled'
            },
            onChange: (value) => {
                console.log('ifAblePlugin changed:', value);
                ifAblePlugin.data = value;
                iManager.snack('ifAblePlugin changed:' + value);
                iManager.savePluginConfig();
            }
        };
        pluginData.push(ifAblePlugin);

        //- 测试 path 类型
        let modLoaderPath = {
            name: 'modLoaderPath',
            data: '',
            type: 'dir',
            displayName: 'Mod Loader Path',
            description: 'The path of the mod loader',
            t_displayName: {
                vi: 'Đường dẫn Mod Loader',
                en: 'Mod Loader Path'
            },
            t_description: {
                vi: 'Đường dẫn của mod loader',
                en: 'The path of the mod loader'
            },
            onChange: (value) => {
                console.log('modLoaderPath changed:', value);
                modLoaderPath.data = value;
                iManager.snack('Mod Loader Path changed:' + value);
                iManager.savePluginConfig();
            }
        }
        pluginData.push(modLoaderPath);

        //- 测试 number 类型
        let testNumber = {
            name: 'testNumber',
            data: 0,
            type: 'number',
            displayName: 'Test Number',
            description: 'Test Number',
            t_displayName: {
                vi: 'Số thử nghiệm',
                en: 'test Number'
            },
            t_description: {
                vi: 'Số thử nghiệm',
                en: 'test Number'
            },
            onChange: (value) => {
                console.log('testNumber changed:', value);
                testNumber.data = value;
            }
        }
        pluginData.push(testNumber);

        //- 测试 button 类型
        let testButton = {
            name: 'testButton',
            type: 'button',
            displayName: 'Test Button',
            description: 'Test Button',
            t_displayName: {
                vi: 'Nút thử nghiệm',
                en: 'Test Button'
            },
            t_description: {
                vi: 'Nút thử nghiệm',
                en: 'Test Button'
            },
            buttonName: 'Test Button',
            t_buttonName: {
                vi: 'Nút thử nghiệm',
                en: 'Test Button'
            },
            onChange: (value) => {
                iManager.snack('Test Button Clicked');
            }
        }
        pluginData.push(testButton);

        //- 测试 iconbutton 类型
        let testIconButton = {
            name: 'testIconButton',
            type: 'iconbutton',
            displayName: 'Test IconButton',
            description: 'Test IconButton',
            t_displayName: {
                vi: 'Nút biểu tượng thử nghiệm',
                en: 'Test IconButton'
            },
            t_description: {
                vi: 'Nút biểu tượng thử nghiệm',
                en: 'Test IconButton'
            },
            icon: `  <svg viewBox="0 -960 960 960">
    <path d="M620-520q25 0 42.5-17.5T680-580q0-25-17.5-42.5T620-640q-25 0-42.5 17.5T560-580q0 25 17.5 42.5T620-520Zm-280 0q25 0 42.5-17.5T400-580q0-25-17.5-42.5T340-640q-25 0-42.5 17.5T280-580q0 25 17.5 42.5T340-520Zm140 260q68 0 123.5-38.5T684-400H276q25 63 80.5 101.5T480-260Zm0 180q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z"></path>
  </svg>`,
            buttonName: 'Test IconButton',
            t_buttonName: {
                vi: 'Biểu tượng thử nghiệm',
                en: 'Test Icon'
            },
            onChange: (value) => {
                iManager.snack('Test IconButton Clicked');
            }
        }
        pluginData.push(testIconButton);

        //- 测试 select 类型
        let testSelect = {
            name: 'testSelect',
            data: 'a',
            type: 'select',
            displayName: 'Test Select',
            description: 'Test Select',
            t_displayName: {
                vi: 'Lựa chọn thử nghiệm',
                en: 'Test Select'
            },
            t_description: {
                vi: 'Lựa chọn thử nghiệm',
                en: 'Test Select'
            },
            options: [{
                value: 'a',
                t_value: {
                    vi: 'Lựa chọn A',
                    en: 'Option A'
                }
            },
            {
                value: 'b',
                t_value: {
                    vi: 'Lựa chọn B',
                    en: 'Option B'
                }
            }],
            onChange: (value) => {
                console.log('testSelect changed:', value);
                iManager.snack('Test Select changed: ' + value);
            }
        }
        pluginData.push(testSelect);

        iManager.registerPluginConfig(pluginName, pluginData);
    }
}