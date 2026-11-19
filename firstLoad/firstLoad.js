import 'sober'
import 'sober/style/scroll-view.css'

import '../src/style.css'

import { createApp, watch } from 'vue'
import firstLoadPage from './firstLoadPage.vue'

const { ipcRenderer} = require('electron');

import IManager from '../electron/IManager'
// Cửa sổ cài đặt lần đầu chỉ cần cài đặt, không cần danh sách mod hay plugin.
const iManager = new IManager({ light: true });
import { g_config_vue } from '../electron/IManager'

//-====================入口文件====================-//
const vue_app = createApp(firstLoadPage);

//-====================国际化====================-//
import { createAppI18n, registerSnackListener, registerDomReadyProbe } from '../helper/sharedWindowSetup';

// 创建i18n实例
const i18n = createAppI18n();

// 使用i18n插件
vue_app.use(i18n);

//-==================== 挂载 ====================-//

vue_app.mount('#app-container');

const language = g_config_vue.language;
watch(language, (language) => {
    // 将语言设置为 imanager 中的语言
    vue_app.config.globalProperties.$i18n.locale = language;
    console.log('set language to:', language);
})

iManager.on("initDone", () => {
    // 手动触发一次语言切换事件
    vue_app.config.globalProperties.$i18n.locale = iManager.config.language;
    console.log('languageChange:', iManager.config.language);
}
);

//-=====================事件监听====================-//
console.log('main.js');

registerDomReadyProbe();

window.addEventListener('beforeunload', () => {
    iManager.config.firstLoad = false;
    iManager.saveConfig();
    ipcRenderer.send('refresh-main-window');
});

//-======================== snackbar ========================-//
registerSnackListener(ipcRenderer);
