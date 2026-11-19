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

const fs = require('fs');
const path = require('path');
const pluginName = 'deleteModPlugin';
// 这是一个用来在 编辑mod信息页面 增加一个 删除mod 按钮的插件

// TC8: mod đang chờ xác nhận xóa (đặt lúc bấm nút xóa, dùng khi hộp xác
// nhận trả về sự kiện deleteModConfirmed).
let pendingDeleteMod = null;

function removeModFromList(iManager, modName) {
    // 不再需要刷新页面，直接删除mod信息
    // iManager.showDialog('dialog-need-refresh');

    iManager.data.modList = iManager.data.modList.filter((mod) => {
        return mod.name !== modName;
    });

    // 如果currentMod是modName，则清空currentMod
    if (iManager.temp.currentMod.name === modName) {
        iManager.setCurrentMod(iManager.data.modList[0]);
    }

    // 刷新角色列表
    iManager.refreshCharacterList();

    //! 这是不好的做法，应当将事件的调用逻辑单独拎出来
    //! 现在很多地方都直接调用了事件，这样会导致代码的耦合性很高
    iManager.trigger('addMod');

    // 使得编辑mod信息页面消失
    iManager.dismissDialog('edit-mod-dialog');
}
// TC9: xóa theo đường dẫn thật của mod (ModData.getModPath), không ghép
// đường dẫn từ tên hiển thị trên hộp thoại. Chặn đường dẫn trèo ra ngoài
// thư mục mod và tên thư mục chứa ký tự tách đường dẫn / '..'.
async function deleteMod(iManager, mod) {
    const modName = mod.name;
    iManager.snack((iManager.config.language === 'vi' ? 'Đang xóa mod: ' : 'Deleting mod: ') + modName, 'error');

    let modPath;
    try {
        modPath = await mod.getModPath();
    } catch (error) {
        iManager.snack((iManager.config.language === 'vi' ? 'Không lấy được đường dẫn mod: ' : 'Cannot resolve mod path: ') + modName, 'error');
        console.error(error);
        return;
    }

    const folderName = path.basename(modPath);
    if (!folderName || folderName === '.' || folderName === '..' ||
        folderName.includes('/') || folderName.includes('\\') || folderName.includes('..')) {
        iManager.snack((iManager.config.language === 'vi' ? 'Tên thư mục mod không hợp lệ: ' : 'Invalid mod folder name: ') + folderName, 'error');
        console.error('deleteMod: invalid folder name', folderName);
        return;
    }
    const modSourcePath = path.resolve(iManager.config.modSourcePath);
    const relativePath = path.relative(modSourcePath, path.resolve(modPath));
    if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        iManager.snack((iManager.config.language === 'vi' ? 'Mod nằm ngoài thư mục mod, không xóa được: ' : 'Mod is outside the mod library, refusing to delete: ') + modName, 'error');
        console.error('deleteMod: mod path outside mod source', modPath);
        return;
    }

    // 删除mod
    // 删除mod文件夹
    if (fs.existsSync(modPath)) {
        // 判断是否使用回收站
        const ifUseRecycleBin = iManager.getPluginData(pluginName, 'useRecycleBin');

        if (!ifUseRecycleBin) {
            // 直接删除
            fs.rmdir(modPath, {recursive: true}, (err) => {
                if (err) {
                    iManager.snack((iManager.config.language === 'vi' ? 'Xóa mod thất bại: ' : 'Failed to delete mod: ') + modName, 'error');
                    console.error(err);
                } else {
                    iManager.snack((iManager.config.language === 'vi' ? 'Đã xóa mod: ' : 'Deleted mod: ') + modName, 'info');
                    removeModFromList(iManager, modName);
                }
            });
            return;
        }

        // 将其移动到回收站
        const recycleBin = 'recycleBin';
        // Dùng tên thư mục thật (đã lọc) cho đích trong thùng rác, không dùng
        // tên hiển thị của mod (có thể khác tên thư mục).
        let recycleBinPath = path.join(iManager.config.modSourcePath, recycleBin, folderName);
        // 如果回收站不存在，创建回收站
        if (!fs.existsSync(path.join(iManager.config.modSourcePath, recycleBin))) {
            fs.mkdirSync(path.join(iManager.config.modSourcePath, recycleBin));
        }
        // 如果回收站已经存在，判断是否有同名文件夹
        if (fs.existsSync(recycleBinPath)) {
            iManager.snack(iManager.config.language === 'vi' ? 'Thùng rác đã có mod trùng tên, thời gian hiện tại sẽ được thêm vào tên mod' : 'Recycle bin already has a mod with the same name, current time will be added to the mod name', 'info');
            // 将当前时间加到mod名字后面
            const now = new Date();
            const nowStr = now.toISOString().replace(/:/g, '-').replace(/\./g, '-');
            recycleBinPath = path.join(iManager.config.modSourcePath, recycleBin, folderName+'-'+nowStr);
        }
        //debug
        console.log('modPath:', modPath, 'recycleBinPath:', recycleBinPath);
        fs.rename(modPath, recycleBinPath, (err) => {
            if (err) {
                iManager.snack((iManager.config.language === 'vi' ? 'Xóa mod thất bại: ' : 'Failed to delete mod: ') + modName, 'error');
                console.error(err);
            } else {
                iManager.snack((iManager.config.language === 'vi' ? 'Đã chuyển mod vào thùng rác: ' : 'Moved mod to recycle bin: ') + modName, 'info');
                removeModFromList(iManager, modName);
            }
        });
    } else {
        iManager.snack((iManager.config.language === 'vi' ? 'Thư mục mod không tồn tại: ' : 'Mod folder does not exist: ') + modPath, 'error');
    }
}

function addDeleteButton(iManager){
    // 在编辑mod信息页面增加一个删除mod的按钮
    // 在 id=edit-mod-info-content 的 div 的 第一个 div 内的 第一个 s-button 内增加一个删除mod的按钮
    const deleteButton = document.createElement('s-icon-button');
    deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
  <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"></path>
</svg>`
    deleteButton.style.marginRight = '10px';
    deleteButton.style.color = 'red';
    deleteButton.style.zIndex = '1'; 
    deleteButton.style.position = 'relative';
    deleteButton.style.left = '23px';
    deleteButton.classList.add('OO-button');

    // TC8: bấm 1 lần mở hộp xác nhận (ghi rõ tên mod + hậu quả), không xóa
    // ngay bằng đúp chuột nữa. Mod lấy từ currentMod (TC9), không đọc tên
    // từ chữ hiển thị trên hộp thoại.
    deleteButton.onclick = () => {
        const mod = iManager.temp.currentMod;
        if (!mod) {
            iManager.snack(iManager.config.language === 'vi' ? 'Chưa chọn mod nào để xóa' : 'No mod selected to delete', 'error');
            return;
        }
        pendingDeleteMod = mod;
        iManager.showDialog('dialog-confirm-delete-mod');
    }

    const editModInfoContent = document.getElementById('edit-mod-info-content');
    if (editModInfoContent) {
        const firstDiv = editModInfoContent.querySelector('div');
        console.log('firstDiv:', firstDiv);
        if (firstDiv) {
            const targetElement = firstDiv.querySelector('#edit-mod-name');
            console.log('edit-mod-name:', targetElement);
            if (targetElement) {
                firstDiv.insertBefore(deleteButton, targetElement);
                console.log('add delete button');
                return;
            }
        }
    }

    iManager.snack('add delete button failed', 'error');
    return;
}

module.exports = {
    name: pluginName,
    t_displayName:{
        vi:'Plugin xóa mod',
        en:'Delete Mod Plugin'
    },
    init(iManager){

        // TC8: hộp xác nhận xóa trả về sự kiện này khi người dùng bấm Xác nhận.
        // pendingDeleteMod đặt lại null ngay để bấm đúp xác nhận không xóa 2 lần.
        iManager.on('deleteModConfirmed', async () => {
            const mod = pendingDeleteMod;
            pendingDeleteMod = null;
            if (mod) {
                await deleteMod(iManager, mod);
            }
        });

        iManager.on("pluginLoaded", (iManager) => {
            // debug
            const ifAble = iManager.getPluginData(pluginName, 'ifAblePlugin')
            // iManager.snack('deleteModPlugin Loaded from '+__dirname + ' ifAble:'+ifAble);
            if (ifAble) {
                addDeleteButton(iManager);
            }
        }
        );



        let pluginData = [];

        let markdown = {
            name: 'markdown',
            data: '',
            type: 'markdown',
            displayName: 'Delete Mod',
            description: 'Delete the mod',
            t_displayName:{
                vi:'Xóa mod',
                en:'Delete Mod'
            },
            t_description:{
                vi:'# Thêm nút xóa mod vào trang chỉnh sửa thông tin mod\nBấm nút, hộp xác nhận sẽ hiện ra rồi mới xóa',
                en:'# Add a delete mod button on the edit mod info page\nClick the button, a confirmation dialog appears before deleting'
            },
            onChange: (value) => {
                // markdown 类型的数据不会触发 onChange,它只作为展示
            }
        };
        pluginData.push(markdown);

        let ifAblePlugin = {
            name: 'ifAblePlugin',
            data: true,
            type: 'boolean',
            displayName: 'If Able Plugin',
            t_displayName:{
                vi:'Bật plugin',
                en:'Enable Plugin'
            },
            onChange: (value) => {
                console.log('ifAblePlugin changed:', value);
                ifAblePlugin.data = value;

                if (value) {
                    addDeleteButton(iManager);
                } else {
                    iManager.showDialog("dialog-need-refresh");
                }
            }
        };
        pluginData.push(ifAblePlugin);

        // 是否使用回收站
        let useRecycleBin = {
            name: 'useRecycleBin',
            data: true,
            type: 'boolean',
            displayName: 'Use Recycle Bin',
            t_displayName:{
                vi:'Dùng thùng rác',
                en:'Use Recycle Bin'
            },
            description: 'If true, the mod will be moved to a recycle bin under the mod source path',
            t_description:{
                vi:'Nếu bật, mod sẽ được chuyển vào thùng rác trong thư mục nguồn mod',
                en:'If true, the mod will be moved to a recycle bin under the mod source path'
            },
            onChange: (value) => {
                console.log('useRecycleBin changed:', value);
                useRecycleBin.data = value;
            }
        };
        pluginData.push(useRecycleBin);

        iManager.registerPluginConfig(pluginName, pluginData);
    }
}
