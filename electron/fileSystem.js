const { app, ipcMain, dialog } = require('electron');
const path = require('node:path')
const fs = require('fs');
//-==================== 核心变量 =====================


//----------------- 变量 -----------------
let currentMainWindow = null;
let ifCustomConfig = false;
let customConfigFolder = '';


const dataPath = app.getPath('userData');
const configPath = () => {
    return (ifCustomConfig) ? path.join(customConfigFolder, 'config.json') : path.join(dataPath, 'config.json');
}
const pluginConfigPath = () => {
    return (ifCustomConfig) ? path.join(customConfigFolder, 'pluginConfig.json') : path.join(dataPath, 'pluginConfig.json');
}

// HP11: read the window bounds the renderer saved on last close, so the main
// window can be created at its saved size/position instead of 800x600 and
// then visibly jumping when the renderer applies the bounds after init.
// Returns null when there is no saved config or the bounds are unusable;
// the caller then falls back to the 800x600 centered default.
function getSavedWindowBounds() {
    try {
        const cfgPath = configPath();
        if (!fs.existsSync(cfgPath)) {
            return null;
        }
        const config = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
        const b = config && config.bounds;
        if (!b || !Number.isFinite(b.width) || !Number.isFinite(b.height) || b.width <= 0 || b.height <= 0) {
            return null;
        }
        return {
            width: b.width,
            height: b.height,
            // x/y 为 -1 表示居中（与 set-bounds 的约定一致）
            x: Number.isFinite(b.x) ? b.x : -1,
            y: Number.isFinite(b.y) ? b.y : -1,
        };
    } catch (e) {
        console.error('getSavedWindowBounds', e);
        return null;
    }
}


//-========================== 对外接口 ==========================
//----------------- 获取变量 -----------------
ipcMain.handle('get-user-data-path', async (event) => {
    return app.getPath('userData');
});

ipcMain.on('get-user-data-path-sync', (event,data) => {
    event.returnValue = app.getPath('userData');
});


ipcMain.handle('get-desktop-path', async (event) => {
    return app.getPath('desktop');
});


//-========================== 对外接口 - 能力 ==========================


// 因为 渲染进程 无法获取 本地文件，所以需要通过 主进程 来获取图片文件
ipcMain.handle('get-image', async (event, imagePath) => {
    // 传递一个 buffer 对象给渲染进程
    //debug
    // console.log(`get-image:${imagePath}`);
    return fs.readFileSync(imagePath).toString('base64');
});

ipcMain.handle('get-file-path', async (event, fileName, fileType, defaultPath) => {
    //通过文件选择对话框选择文件
    // 5 nhánh cũ chỉ khác nhau ở properties/filters nên gộp thành 1 lần gọi:
    // thư mục thì mở hộp chọn thư mục, còn lại đều mở hộp chọn file với
    // filters theo loại (riêng 'image' có sẵn danh sách đuôi ảnh).
    const dialogOptions = {
        defaultPath: defaultPath,
        title: 'Select ' + fileName,
        properties: fileType == 'directory' ? ['openDirectory'] : ['openFile'],
    };
    if (fileType != 'directory') {
        const extensions = fileType == 'image'
            ? ['jpg', 'png', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff']
            : [fileType];
        dialogOptions.filters = [{ name: fileName, extensions: extensions }];
    }
    const result = await dialog.showOpenDialog(dialogOptions);

    if (!result.canceled) {
        //debug
        console.log(`get-file-path:${result.filePaths[0]}`);
        return result.filePaths[0];
    }
    return '';
}
);

//-=========================== 插件 ===========================


// HP15: save every plugin's config with a single read + a single write,
// instead of one read + one full write per plugin (SaveAllPluginConfigSync
// used to call savePluginConfig once per plugin on every app close).
async function saveAllPluginConfig(allConfigs) {
    const currentPluginConfigPath = pluginConfigPath();

    // 不存在文件则从空对象开始（旧逻辑是先写 '{}' 再读回，效果相同）
    let data = {};
    if (fs.existsSync(currentPluginConfigPath)) {
        // 读取文件，插入新的配置
        data = JSON.parse(fs.readFileSync(currentPluginConfigPath, 'utf-8'));
    }
    Object.assign(data, allConfigs);
    //debug
    console.log(`save-all-plugin-config:${currentPluginConfigPath}`, data);

    // 保存文件
    fs.writeFileSync(currentPluginConfigPath, JSON.stringify(data, null, 2), 'utf-8');
}


// HP15: one IPC call saves all plugins' configs with a single file write
ipcMain.handle('save-all-plugin-config', async (event, allConfigs) => {
    saveAllPluginConfig(allConfigs);
});


// 保存插件启用状态


//-========================== 初始化所有数据 ==========================
// init-all-data: xóa hết preset + config.json, làm lại từ đầu.
// Nhận đường dẫn config + preset đang dùng (renderer gửi lên) để xóa đúng chỗ,
// kể cả khi người dùng dùng thư mục cấu hình tùy chỉnh.
// Trước khi xóa: sao lưu config.json + từng file preset (*.json) thành .bak
// trong thư mục reset-backup-<thời gian> đặt cạnh config.json.
// Chỉ xóa file *.json trong thư mục preset — file khác (ảnh, ghi chú...) giữ nguyên.
// Trả về { ok, backupPath?, backedUpPresets?, error? }.
ipcMain.handle('init-all-data', async (event, configFilePath, presetPathArg) => {
    try {
        const dataPath = app.getPath('userData');
        const configPath = (configFilePath && typeof configFilePath === 'string' && configFilePath.length > 0)
            ? configFilePath
            : path.join(dataPath, 'config.json');

        // Đường dẫn preset: ưu tiên tham số renderer gửi; không có thì đọc từ config.
        let targetPresetPath = (presetPathArg && typeof presetPathArg === 'string' && presetPathArg.length > 0)
            ? presetPathArg
            : null;
        if (!targetPresetPath && fs.existsSync(configPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                targetPresetPath = config.presetPath || null;
            } catch (e) {
                console.error(`init-all-data: cannot read presetPath from config: ${e}`);
            }
        }

        // Chỉ file *.json trong thư mục preset mới là preset (PresetHelper chỉ
        // đọc file .json ở cấp cao nhất); thư mục con và file khác không động vào.
        const listPresetFiles = (dir) => {
            if (!dir || !fs.existsSync(dir)) return [];
            return fs.readdirSync(dir)
                .map((file) => path.join(dir, file))
                .filter((full) => {
                    try {
                        return fs.statSync(full).isFile() && path.extname(full) === '.json';
                    } catch (e) {
                        return false;
                    }
                });
        };
        const presetFiles = listPresetFiles(targetPresetPath);

        // Sao lưu trước khi xóa — đặt cạnh config.json, ngoài thư mục preset
        // nên lần quét preset sau này không nhìn thấy.
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(path.dirname(configPath), `reset-backup-${stamp}`);
        fs.mkdirSync(backupDir, { recursive: true });
        if (fs.existsSync(configPath)) {
            fs.copyFileSync(configPath, path.join(backupDir, 'config.json.bak'));
        }
        let backedUpPresets = 0;
        for (const file of presetFiles) {
            fs.copyFileSync(file, path.join(backupDir, path.basename(file) + '.bak'));
            backedUpPresets++;
        }

        // Xóa chỉ các file preset.
        for (const file of presetFiles) {
            fs.unlinkSync(file);
        }

        // Xóa file config đang dùng.
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
        }

        return { ok: true, backupPath: backupDir, backedUpPresets };
    } catch (error) {
        console.error(`init-all-data failed: ${error}`);
        return { ok: false, error: String((error && error.message) || error) };
    }
});

// 打开文件夹路径
ipcMain.handle('fs-open-dir', async (event, path) => {
    //debug
    console.log(`fs-open-dir:${path}`);
    const { shell } = require('electron');
    shell.openPath(path);
}
);

// 在外部打开链接
ipcMain.handle('open-url', async (event, url) => {
    const { shell } = require('electron');
    shell.openExternal(url);
}
);


//-=============================导出=============================
function setMainWindow(mainWindow) {
    currentMainWindow = mainWindow;
}
function setCustomConfigFolder(path) {
    ifCustomConfig = true;
    customConfigFolder = path;
}


module.exports = {
    setMainWindow,
    setCustomConfigFolder,
    getSavedWindowBounds
}