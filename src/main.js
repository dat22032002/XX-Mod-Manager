import { createApp, watch } from 'vue'
import './style.css'
// Zone UI kit (phase 1): vendored verbatim in src/zone/, adapter last so its
// rules win same-specificity ties. See src/zone-app.css for why there is no
// .zzz-theme on the app root.
import './zone/tokens.css'
import './zone/base.css'
import './zone/button.css'
import './zone/icon-button.css'
import './zone/segmented-tabs.css'
import './zone/switch.css'
import './zone/chip.css'
import './zone/progress.css'
import './zone/scrollbar.css'
import './zone-app.css'
import App from './App.vue'
import 'sober'
//npm
import 'sober/style/scroll-view.css'
const { ipcRenderer} = require('electron');
import IManager from '../electron/IManager'
const iManager = new IManager();
import { g_config_vue } from '../electron/IManager'

import { EventSystem } from '../helper/EventSystem'

//-====================入口文件====================-//
const vue_app = createApp(App);

//-====================国际化====================-//
import { createAppI18n, registerSnackListener, registerDomReadyProbe } from '../helper/sharedWindowSetup';

// 创建i18n实例
const i18n = createAppI18n();

// 使用i18n插件
vue_app.use(i18n);
iManager.i18n = i18n;
//-==================== 挂载 ====================-//

vue_app.mount('#app');

// ------------------ 语言切换 ------------------ //
vue_app.config.globalProperties.$i18n.locale = `en`;
const language = g_config_vue.language;
watch(language, (newVal) => {
    vue_app.config.globalProperties.$i18n.locale = newVal;
    console.log('languageChange to:', newVal);
});

// manager初始化完成之后再切换一次
iManager.on("initDone", () => {
    // 手动触发一次语言切换事件
    vue_app.config.globalProperties.$i18n.locale = iManager.config.language;
    console.log('languageChange:', iManager.config.language);
}
);

// ------------------ first load ------------------ //
// 首次打开时打开 初始化窗口
// iManager.snack('first load : '+iManager.config.firstLoad);
EventSystem.on('wakeUp', () => {
    console.log('❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️\nfist load:', iManager.config.firstLoad);
    if (iManager.config.firstLoad) {
        // debug 
        console.log('ℹ️ first load');
        iManager.snack('ℹ️ first load');
        iManager.openNewWindow('firstLoad');
    }
});

// ------------------ 初始化 ------------------ //
// iManager.waitInit().then((iManager) => {
//     // 手动触发一次语言切换事件
//     EventSystem.trigger('languageChange', iManager.config.language);
// })

//-=====================事件监听====================-//
// console.log('main.js');

registerDomReadyProbe();

//-=======禁用 tab 切换焦点=======-//
document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
    }
})



//-======================== snack ========================-//
// Cửa sổ chính: snack info hiện 2000ms (giữ đúng hành vi cũ).
registerSnackListener(ipcRenderer, 2000);

//-======================== 窗口关闭时，保存配置 ========================-//

window.onbeforeunload = function (e) {
    // console.log('onbeforeunload');
    iManager.config.bounds = {
        x: window.screenX,
        y: window.screenY,
        width: window.outerWidth,
        height: window.innerHeight,
    };

    iManager.config.lastUsedPreset = iManager.temp.currentPreset;

    console.log('window unload');

    if (iManager.config.firstLoad) return;
    if (iManager.temp.ifDontSaveOnClose) return;

    console.log('save config');
    iManager.saveConfigSync();
    iManager.savePluginConfigSync();

    // e.returnValue = "你确定要离开吗？";
    // return "你确定要离开吗？";
};