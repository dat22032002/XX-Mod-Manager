import 'sober'
import 'sober/style/scroll-view.css'

import '../src/style.css'

import { createApp } from 'vue'
import switchConfigPage from './src/switchConfigPage.vue'

const { ipcRenderer} = require('electron');

import IManager from '../electron/IManager'
// Cửa sổ đổi cấu hình chỉ cần cài đặt, không cần danh sách mod hay plugin.
const iManager = new IManager({ light: true });

//-====================入口文件====================-//
const vue_app = createApp(switchConfigPage);

//-====================国际化====================-//
import { createAppI18n, registerSnackListener, registerDomReadyProbe } from '../helper/sharedWindowSetup';

// 创建i18n实例
const i18n = createAppI18n();

// 使用i18n插件
vue_app.use(i18n);

//-==================== 挂载 ====================-//

vue_app.mount('#app-container');
iManager.on('languageChange', (language) => {
    // 将语言设置为 imanager 中的语言
    vue_app.config.globalProperties.$i18n.locale = language;
    //debug
    console.log('set language:', language);
});

iManager.waitInit().then((iManager) => {

    // ------------------ 语言切换 ------------------ //
    iManager.trigger('languageChange', iManager.config.language);

    // ------------------ first load ------------------ //
    // 首次打开时打开 初始化窗口
    // 已经初始化了
    iManager.config.firstLoad = false;
})


//-=====================事件监听====================-//
console.log('main.js');

registerDomReadyProbe();

//-======================== snackbar ========================-//
registerSnackListener(ipcRenderer);
