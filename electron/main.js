// main.js
const { app, BrowserWindow, ipcMain, screen, dialog, session, nativeImage } = require('electron');
const path = require('node:path')
const { isGbAdUrl } = require('./gbAdBlock');
require('./fileSystem.js')
const setMainWindow = require('./fileSystem.js').setMainWindow;
const setCustomConfigFolder = require('./fileSystem.js').setCustomConfigFolder;
const getSavedWindowBounds = require('./fileSystem.js').getSavedWindowBounds;
const { initUpdater } = require('./updater.js');
let currentMainWindow;

let devMode = false;
devMode = process.argv.includes('--dev');
console.log('process.argv', process.argv);

let firstpage = false;
firstpage = process.argv.includes('--firstpage');
console.log('firstpage', firstpage);

let switchConfig = false;
switchConfig = process.argv.includes('--switchConfig');
console.log('switchConfig', switchConfig);

let devTools = false;
devTools = process.argv.includes('--devTools');
console.log('devTools', devTools);

let ifCustomConfig = false;
ifCustomConfig = process.argv.includes('--customConfig');
console.log('customConfig', ifCustomConfig);
// customConfig 获取一个配置文件路径
let customConfigFolder = '';
if (ifCustomConfig) {
  const index = process.argv.indexOf('--customConfig');
  customConfigFolder = process.argv[index + 1];
  console.log('customConfigFolder', customConfigFolder);

  setCustomConfigFolder(customConfigFolder);
}

// 渲染进程获取参数
ipcMain.handle('get-args', async () => {
  return {
    devMode: devMode,
    firstpage: firstpage,
    switchConfig: switchConfig,
    devTools: devTools,
    ifCustomConfig: ifCustomConfig,
    customConfigFolder: customConfigFolder
  }
});

// 获取参数的同步版本
ipcMain.on('get-args-sync', (event) => {
  //debug
  console.log('get-args-sync', {
    devMode: devMode,
    firstpage: firstpage,
    switchConfig: switchConfig,
    devTools: devTools,
    ifCustomConfig: ifCustomConfig,
    customConfigFolder: customConfigFolder
  });
  event.returnValue = {
    devMode: devMode,
    firstpage: firstpage,
    switchConfig: switchConfig,
    devTools: devTools,
    ifCustomConfig: ifCustomConfig,
    customConfigFolder: customConfigFolder
  }
});

ipcMain.on("set-custom-config-folder", (event, folder) => {
  console.log("set-custom-config-folder", folder);
  // 设置配置文件夹路径
  ifCustomConfig = true;
  customConfigFolder = folder;
  // 设置配置文件夹路径
  setCustomConfigFolder(folder);
});


// Tuỳ chọn chung cho mọi cửa sổ của app: không khung, chạy Node trực tiếp
// trong renderer (nodeIntegration, không cách ly) nên không cần preload.
// webviewTag: trang Banana nhúng web GameBanana bằng <webview> (1.5.25).
function baseWindowOptions() {
  return {
    frame: false,
    webPreferences: {
      sandbox: false,
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true
    }
  };
}

// HP11: same fit-and-center rules as the 'set-bounds' handler, so the window
// can be created at the exact bounds the renderer would apply after init
// (and therefore never visibly jumps size on launch).
function fitBoundsToScreen(bounds) {
  const screenArea = screen.getDisplayMatching(bounds).workArea;
  const width = Math.min(bounds.width, screenArea.width);
  const height = Math.min(bounds.height, screenArea.height);
  // 如果bounds的x,y，为-1，表示居中
  if (bounds.x === -1 || bounds.y === -1) {
    return {
      x: Math.floor((screenArea.width - width) / 2),
      y: Math.floor((screenArea.height - height) / 2),
      width: width,
      height: height
    };
  }
  if (
    (bounds.x + bounds.width) > (screenArea.x + screenArea.width) ||
    bounds.x > (screenArea.x + screenArea.width) ||
    bounds.x < screenArea.x ||
    (bounds.y + bounds.height) > (screenArea.y + screenArea.height) ||
    bounds.y > (screenArea.y + screenArea.height) ||
    bounds.y < screenArea.y
  ) {
    // Fit and center window into the existing screenarea
    return {
      x: Math.floor((screenArea.width - width) / 2),
      y: Math.floor((screenArea.height - height) / 2),
      width: width,
      height: height
    };
  }
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
}

const createWindow = () => {
  // HP11: create the window hidden (show: false) at the saved bounds, and only
  // show it once ready-to-show fires — previously it appeared immediately at
  // 800x600 and visibly jumped when the renderer applied the saved bounds.
  const initialBounds = fitBoundsToScreen(
    getSavedWindowBounds() || { width: 800, height: 600, x: -1, y: -1 }
  );
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    ...baseWindowOptions(),
    show: false,
    // Chiều rộng tối thiểu 1200 (Đạt quyết 20/11): thu hẹp hơn thì thanh
    // tag nhân vật bị ép còn ~26px, không bấm được tag nào (ở 1024).
    // Chỉ đặt cho cửa sổ chính — cửa sổ phụ 800x600 (open-new-window)
    // không bị ép theo. Màn hình mặc định của app đã là 1280x800 nên
    // 1200 không ảnh hưởng người dùng bình thường.
    minWidth: 1200,
    width: initialBounds.width,
    height: initialBounds.height,
    x: initialBounds.x,
    y: initialBounds.y,
  })
  // 因为这里使用了 nodeIntegration: true, contextIsolation: false
  // 所以可以直接使用 node.js 的模块
  // 也就不需要 preload.js 了

  currentMainWindow = mainWindow;
  setMainWindow(mainWindow);
  // Tự kiểm tra bản cập nhật (chỉ chạy trên bản cài đặt Windows).
  initUpdater(mainWindow);

  //-==================== 监听窗口显隐 ====================
  currentMainWindow.on("blur", () => {
    console.debug("window blur");
    currentMainWindow.webContents.send('windowBlur')
  });

  currentMainWindow.on("focus", () => {
    console.debug("window focus");
    currentMainWindow.webContents.send('windowFocus')
  });


  //debug
  console.log('===== createWindow =====');

  // 因为现在是 使用 vite + vue3 开发的，所以这里加载的是 vite 启动的地址
  if (devMode) {
    // HP22: pick one URL and load it once — previously loadURL was called up
    // to 3 times (--firstpage + --switchConfig), the first loads wasted.
    // Precedence matches the old last-load-wins order: switchConfig > firstpage.
    let startUrl = 'http://localhost:3000/';
    if (firstpage) {
      startUrl = 'http://localhost:3000/firstLoad/index.html';
    }
    if (switchConfig) {
      startUrl = 'http://localhost:3000/switchConfig/index.html';
    }
    mainWindow.loadURL(startUrl);
    if (devTools) {
      mainWindow.webContents.openDevTools()
    }
  }
  else {
    mainWindow.loadFile('dist/index.html')
  }

  // 隐藏菜单栏
  mainWindow.setMenuBarVisibility(false)

  //因为需要调整窗口大小，所以需要等待窗口加载完成
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('main window is ready');
  });

  // HP11 safety net: with show: false, a failed page load would leave the
  // window invisible forever (ready-to-show never fires) — show it anyway
  // so the failure stays visible instead of looking like a dead launch.
  mainWindow.webContents.once('did-fail-load', () => {
    if (!mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  });
}


// 这段程序将会在 Electron 结束初始化
// 和创建浏览器窗口的时候调用
// 部分 API 在 ready 事件触发后才能使用。
app.whenReady().then(() => {
  // Chặn quảng cáo trong khung web Banana (1.5.25): chỉ session của
  // khung Banana (partition persist:gamebanana) — phần khác của app
  // không bị ảnh hưởng. Đăng ký trước khi tạo cửa sổ để khung web
  // chưa tải gì đã bị chặn.
  session.fromPartition('persist:gamebanana').webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: isGbAdUrl(details.url) });
  });

  createWindow()

  app.on('activate', () => {
    // 在 macOS 系统内, 如果没有已开启的应用窗口
    // 点击托盘图标时通常会重新创建一个新窗口
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  console.log('===== createWindow end =====');
  // TC33: app đã sẵn sàng — gửi wakeUp cho các cửa sổ đã báo ready trước đó.
  appIsReady = true;
  for (const [id, pending] of wakeUpPending) {
    clearTimeout(pending.timer);
    sendWakeUpTo(pending.contents);
    wakeUpPending.delete(id);
  }
})

// TC33: "bắt tay đánh thức" theo từng cửa sổ, thay cho bộ đếm chung == 2.
// Trước đây: mọi cửa sổ (kể cả trang đổi cấu hình, vì nó cũng import
// IManager) đều gửi 'main-window-ready' làm lệch số đếm, và sau mỗi lần
// tải lại trang số đếm vượt quá 2 nên wakeUp không bao giờ tới nữa.
// Giờ: mỗi cửa sổ báo ready thì nhận wakeUp riêng; nếu app chưa sẵn sàng
// thì chờ app sẵn sàng, và hẹn giờ dự phòng 5 giây tự gửi wakeUp để
// không kẹt vĩnh viễn khi 1 tín hiệu bị mất.
let appIsReady = false;
const WAKEUP_FALLBACK_MS = 5000;
// webContents.id -> { contents, timer } của cửa sổ đang chờ app sẵn sàng
const wakeUpPending = new Map();

function sendWakeUpTo(contents) {
  if (contents && !contents.isDestroyed()) {
    console.log('send wakeUp to webContents', contents.id);
    contents.send('wakeUp');
  }
}

// 监听主窗口是否准备好
ipcMain.on('main-window-ready', (event) => {
  const contents = event.sender;
  console.log('main-window-ready', contents.id);
  // Cửa sổ tải lại sẽ gửi ready lại: xóa hẹn giờ dự phòng cũ trước.
  const oldPending = wakeUpPending.get(contents.id);
  if (oldPending) {
    clearTimeout(oldPending.timer);
    wakeUpPending.delete(contents.id);
  }
  if (appIsReady) {
    sendWakeUpTo(contents);
    return;
  }
  // App chưa sẵn sàng: chờ app sẵn sàng, nhưng sau 5 giây vẫn tự gửi
  // wakeUp để không kẹt nếu tín hiệu app-ready bị mất.
  const timer = setTimeout(() => {
    wakeUpPending.delete(contents.id);
    sendWakeUpTo(contents);
  }, WAKEUP_FALLBACK_MS);
  wakeUpPending.set(contents.id, { contents, timer });
})

// 除了 macOS 外，当所有窗口都被关闭的时候退出程序。 因此, 通常
// 对应用程序和它们的菜单栏来说应该时刻保持激活状态, 
// 直到用户使用 Cmd + Q 明确退出
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// 白屏意味着渲染进程崩溃了，这里可以尝试重启
// TC32: sập khi mở mà cứ tải lại mãi thì quay vòng vô hạn — đếm số lần sập
// trong 1 phút cho từng cửa sổ, quá 3 lần thì dừng + hiện thông báo lỗi.
// 'crashed' và 'render-process-gone' có thể cùng báo 1 lần sập nên 2 sự
// kiện cách nhau dưới 2 giây chỉ tính là 1 lần.
const CRASH_WINDOW_MS = 60 * 1000;
const CRASH_MAX_RELOADS = 3;
const CRASH_DEDUPE_MS = 2000;
// webContents.id -> { crashTimes: number[], notified: boolean }
const crashTracker = new Map();

function handleRendererCrash(contents, details) {
  if (!contents || contents.isDestroyed()) {
    return;
  }
  const now = Date.now();
  let record = crashTracker.get(contents.id);
  if (!record) {
    record = { crashTimes: [], notified: false };
    crashTracker.set(contents.id, record);
  }
  const recent = record.crashTimes.filter(t => now - t < CRASH_WINDOW_MS);
  // Cùng 1 lần sập báo 2 sự kiện ('crashed' + 'render-process-gone'):
  // sự kiện thứ 2 tới quá nhanh thì bỏ qua, không tính 2 lần.
  if (recent.length > 0 && now - recent[recent.length - 1] < CRASH_DEDUPE_MS) {
    return;
  }
  recent.push(now);
  record.crashTimes = recent;
  console.log(`renderer crashed (${recent.length} in the last minute)`, details);
  if (recent.length > CRASH_MAX_RELOADS) {
    if (!record.notified) {
      record.notified = true;
      dialog.showMessageBox({
        type: 'error',
        title: 'XX Mod Manager',
        message: 'The app window crashed repeatedly and was not reloaded automatically.\n\nCửa sổ app đã sập nhiều lần (hơn 3 lần trong 1 phút) nên không tự tải lại nữa.',
        detail: 'Please restart the app. If the crash repeats, the log files in the app data folder may help find the cause.\n\nHãy khởi động lại app. Nếu lỗi lặp lại, file nhật ký trong thư mục dữ liệu của app có thể giúp tìm nguyên nhân.',
        buttons: ['OK'],
      });
    }
    return;
  }
  contents.reload();
}

app.on('web-contents-created', (e, contents) => {
  contents.on('crashed', () => {
    handleRendererCrash(contents, { reason: 'crashed' });
  });
});

app.on("render-process-gone", (e, contents, details) => {
  console.log("render-process-gone", details);
  handleRendererCrash(contents, details);
});


//-==================== 新窗口 ====================
ipcMain.on('open-new-window', (event, arg) => {
  console.log('open-new-window', arg);

  const newWindow = new BrowserWindow({
    ...baseWindowOptions(),
    width: 800,
    height: 600,
  })

  if (devMode) {
    newWindow.loadURL('http://localhost:3000/' + arg + '/index.html')
  }
  else {
    const path = require('path');
    const filePath = path.join(__dirname, `../dist/${arg}/index.html`);
    console.log('filePath', filePath);

    newWindow.loadFile(filePath)
  }
})





//-==================== 窗口控制 ====================

ipcMain.on('refresh-main-window', (event) => {
  currentMainWindow.reload()
});

ipcMain.handle('minimize-window', async () => {
  BrowserWindow.getFocusedWindow().minimize();
});

ipcMain.handle('toggle-fullscreen', async () => {
  //窗口化全屏
  const win = BrowserWindow.getFocusedWindow();
  if (win.isFullScreen()) {
    win.setFullScreen(false);
    return false;
  }
  else {
    win.setFullScreen(true);
    return true;
  }
});

ipcMain.handle('pin-window', async () => {
  const win = BrowserWindow.getFocusedWindow();
  win.setAlwaysOnTop(true);
  //debug
  console.log('pin-window', win.isAlwaysOnTop());
  return true;
});

ipcMain.handle('unpin-window', async () => {
  const win = BrowserWindow.getFocusedWindow();
  win.setAlwaysOnTop(false);
  //debug
  console.log('unpin-window', win.isAlwaysOnTop());
  return false;
});


// 设置窗口大小
ipcMain.handle('set-bounds', async (event, boundsStr) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    const bounds = JSON.parse(boundsStr);
    //debug
    console.log('set-bounds', bounds, win == null);

    if (win && bounds) {
      // Dùng chung fitBoundsToScreen với lúc tạo cửa sổ (cùng quy tắc:
      // x/y -1 thì căn giữa, vượt màn hình thì co lại rồi căn giữa).
      win.setBounds(fitBoundsToScreen(bounds));
    }
  } catch (e) {
    console.error('set-bounds', e);
  }
});











//-==================== 通知 ====================
ipcMain.on('snack', (event, message, type = 'info') => {
  currentMainWindow.webContents.send('snack', message, type)
})

//-==================== 拖拽图片 ====================
// Kéo ảnh từ khung Banana ra (1.5.25 test3): renderer tải ảnh về file
// tạm rồi gửi đường dẫn sang đây, tiến trình chính bắt đầu cú kéo ở
// mức hệ điều hành để ảnh kéo được ra khỏi khung web (kéo-thả HTML
// thường không xuyên qua được ranh giới webview). Icon kéo là chính
// tấm ảnh, thu nhỏ nếu rộng quá 256px; lỗi icon thì vẫn kéo được.
// startDrag chạy lệch 1 nhịp (setImmediate) để bộ nghe IPC trả về ngay:
// trên Linux, startDrag mở vòng lặp kéo lồng nhau, gọi thẳng trong bộ
// nghe sẽ kẹt việc gửi tin IPC sau đó; lệch 1 nhịp thì không ảnh hưởng
// cú kéo thật (chuột vẫn đang giữ).
ipcMain.on('gb-start-drag', (event, filePath) => {
  try {
    if (!filePath || typeof filePath !== 'string') return;
    const sender = event.sender;
    setImmediate(() => {
      try {
        if (sender.isDestroyed()) return;
        let icon;
        try {
          const img = nativeImage.createFromPath(filePath);
          if (!img.isEmpty()) {
            icon = img.getSize().width > 256 ? img.resize({ width: 256 }) : img;
          }
        } catch (_e) { /* không có icon kéo thì vẫn kéo được */ }
        sender.startDrag(icon ? { file: filePath, icon } : { file: filePath });
      } catch (e) {
        console.error('gb-start-drag failed', e);
      }
    });
  } catch (e) {
    console.error('gb-start-drag failed', e);
  }
});






module.exports = {
  currentMainWindow,
  getMainWindow: () => {
    return currentMainWindow
  }
}