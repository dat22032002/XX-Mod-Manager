// 因为 渲染进程 无法使用 fs 模块，所以这里需要通过 主进程 来获取数据
// 但是那样很麻烦，这里 写一个 代理 的 fs 模块，通过 ipcRenderer 来获取数据
const { ipcRenderer } = require('electron');

class fsProxy {
    static instance = null;
    constructor() {
        if (fsProxy.instance) {
            return fsProxy.instance;
        }
        fsProxy.instance = this;
    }

    static async openDir(path) {
        return await ipcRenderer.invoke('fs-open-dir', path);
    }
}


export default fsProxy;