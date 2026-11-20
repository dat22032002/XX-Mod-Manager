//-==================== 事件管理 ====================
// 所有的事件：
//----------生命周期----------
// wakeUp,initDone,startDone
//------- 插件加载相关 -------
// pluginLoaded
//----------状态变更----------
// themeChange,languageChange,
// lastClickedModChanged,
// modInfoChanged,
// currentCharacterChanged,
// currentPresetChanged,
// currentModChanged
//----------事件节点----------
// modsApplied,addMod,addPreset,toggledMod

/** @enum
 * @desc 分类用于标记所有的事件
*/
enum EventType {
    //----------生命周期----------
    wakeUp = 'wakeUp',
    initDone = 'initDone',
    startDone = 'startDone',
    //------- 插件加载相关 -------
    pluginLoaded = 'pluginLoaded',
    //----------状态变更----------
    themeChange = 'themeChange',
    languageChange = 'languageChange',
    lastClickedModChanged = 'lastClickedModChanged',
    modInfoChanged = 'modInfoChanged',
    currentCharacterChanged = 'currentCharacterChanged',
    currentPresetChanged = 'currentPresetChanged',
    currentModChanged = 'currentModChanged',
    modListChanged = 'modListChanged',
    // Quét nền vừa tính xong dung lượng 1 mod (thẻ đó tự cập nhật dòng dung lượng)
    modSizeReady = 'modSizeReady',
    // Làm mới danh sách mà không tải lại cửa sổ (giữ vị trí cuộn, bộ lọc, tìm kiếm, lựa chọn)
    refreshModList = 'refreshModList',
    //----------事件节点----------
    modsApplied = 'modsApplied',
    addMod = 'addMod',
    addPreset = 'addPreset',
    toggledMod = 'toggledMod',
    //----------插件相关----------
    pluginEnabled = 'pluginEnabled',
    pluginDisabled = 'pluginDisabled',
    // TC8: người dùng đã xác nhận xóa mod trong hộp dialogConfirmDeleteMod
    deleteModConfirmed = 'deleteModConfirmed',
    // Người dùng đã bấm "Vẫn áp dụng" trong hộp cảnh báo mod đụng nhau
    applyConflictsConfirmed = 'applyConflictsConfirmed',
    currentTabChanged = "currentTabChanged",
    //----------窗口相关----------
    windowBlur = 'windowBlur',
    windowFocus = 'windowFocus',
    windowSleep = 'windowSleep',
    windowWake = 'windowWake',
}

class EventSystem {
    private static eventMap = new Map<EventType, Function[]>(); // 事件映射表
    // HP19: Object.values() built a fresh ~20-item array on every trigger()/on()
    // call; a prebuilt Set makes the validity check O(1) with no allocation.
    private static validEvents = new Set<string>(Object.values(EventType));

    static async on(event: EventType, callback: Function) {
        // 因为会被js调用，所以说需要判断event是否为EventType之一
        if (!EventSystem.validEvents.has(event)) {
            throw new Error(`EventSystem.on: event ${event} is not a valid EventType`);
        }
        // 防止 eventMap 不存在 
        if (!EventSystem.eventMap) {
            EventSystem.eventMap = new Map<EventType, Function[]>();
        }
        if (!EventSystem.eventMap.has(event)) {
            EventSystem.eventMap.set(event, []);
        }
        EventSystem.eventMap.get(event)?.push(callback);
        // debug
        // console.log('eventMap:', EventSystem.eventMap);
    }

    // TC12: hủy 1 bộ nghe đã đăng ký — trước đây không có hàm này nên bộ nghe
    // đăng ký rồi không bao giờ hủy được (rò rỉ theo mỗi lần tải lại danh sách).
    static async off(event: EventType, callback: Function) {
        if (!EventSystem.validEvents.has(event)) {
            throw new Error(`EventSystem.off: event ${event} is not a valid EventType`);
        }
        const callbacks = EventSystem.eventMap.get(event);
        if (!callbacks) {
            return;
        }
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
            callbacks.splice(index, 1);
        }
    }

    static async trigger(event: EventType, ...args: any[]) {
        // 因为会被js调用，所以说需要判断event是否为EventType之一
        if (!EventSystem.validEvents.has(event)) {
            throw new Error(`EventSystem.on: event ${event} is not a valid EventType`);
        }
        if (EventSystem.eventMap.has(event)) {
            let callbacks = EventSystem.eventMap.get(event);
            if (callbacks) {
                // TC12: 1 bộ nghe lỗi không được làm chết cả chuỗi — bọc từng
                // callback, lỗi thì ghi log rồi chạy tiếp bộ nghe sau.
                // Copy mảng trước khi lặp để bộ nghe tự hủy giữa chừng không
                // làm lệch vòng lặp.
                for (let callback of [...callbacks]) {
                    try {
                        const result = callback(...args);
                        // Callback bất đồng bộ lỗi cũng phải bắt, không thì
                        // thành lời hứa bị từ chối không ai bắt.
                        if (result && typeof result.catch === 'function') {
                            result.catch((e: any) => {
                                console.error(`EventSystem.trigger: async listener for ${event} failed`, e);
                            });
                        }
                    } catch (e) {
                        console.error(`EventSystem.trigger: listener for ${event} failed`, e);
                    }
                }
            }
        }
    }

}

export { EventType, EventSystem };