import { ModInfo } from "./ModInfo";
import ModLoader from "./ModLoader";

import { SnackType, t_snack } from "../helper/SnackHelper";
import { TranslatedText } from "../helper/Language";

// One mod that could not be applied or removed, with the reason why.
// The reason is a TranslatedText so the summary dialog shows it in the
// user's language.
interface ApplyFailure {
    modName: string;
    reason: TranslatedText;
}

// The outcome of one Apply run. Failures are collected here instead of
// being swallowed, so the caller can show one summary at the end.
interface ApplyResult {
    // Links created (normal mode) or folders enabled (traditional mode).
    applied: number;
    // Links removed (normal mode) or folders disabled (traditional mode).
    removed: number;
    // Mods already in the wanted state, nothing to do.
    skipped: number;
    failures: ApplyFailure[];
}

// Called after each mod is handled: (mods done so far, total mods, mod name).
type ApplyProgressCallback = (done: number, total: number, currentModName: string) => void;

// How many mods to handle before yielding to the UI thread, so a long
// Apply does not freeze the window.
const APPLY_CHUNK_SIZE = 10;

function emptyResult(): ApplyResult {
    return { applied: 0, removed: 0, skipped: 0, failures: [] };
}

// Let the UI thread breathe between chunks.
async function yieldToUI() {
    await new Promise(resolve => setTimeout(resolve, 0));
}

// Remove one unselected mod from the target folder.
// Only a link is removed: unlinking a link never touches the files it
// points to. A real folder or file with the same name is NOT something
// the app created — leave it alone and report it instead of deleting it.
function removeModLink(mod: ModInfo, modTargetPath: string, result: ApplyResult) {
    const fs = require('fs');
    const path = require('path');
    const dest = path.join(modTargetPath, mod.modName);
    let stat;
    try {
        stat = fs.lstatSync(dest);
    } catch (e: any) {
        // Does not exist: nothing to remove.
        if (e && e.code === 'ENOENT') {
            result.skipped++;
            return;
        }
        result.failures.push({
            modName: mod.modName,
            reason: new TranslatedText(
                `Could not check ${dest}: ${e.message}`,
                `Không kiểm tra được ${dest}: ${e.message}`),
        });
        return;
    }
    if (!stat.isSymbolicLink()) {
        // A real folder or file — not a link created by the app. Never delete it.
        result.failures.push({
            modName: mod.modName,
            reason: new TranslatedText(
                `A real folder named "${mod.modName}" is in the target folder, not a link created by the app — left untouched, so the mod may still load in game.`,
                `Trong thư mục đích có một thư mục thật tên "${mod.modName}", không phải liên kết do chương trình tạo — đã giữ nguyên, nên mod vẫn có thể chạy trong game.`),
        });
        return;
    }
    try {
        fs.unlinkSync(dest);
        result.removed++;
    } catch (e: any) {
        result.failures.push({
            modName: mod.modName,
            reason: new TranslatedText(
                `Could not remove the link: ${e.message}`,
                `Không xóa được liên kết: ${e.message}`),
        });
    }
}

// Create the link for one selected mod in the target folder.
// Every failure is recorded in the result instead of being swallowed.
function createModLink(mod: ModInfo, modSourcePath: string, modTargetPath: string, result: ApplyResult) {
    const fs = require('fs');
    const path = require('path');
    const src = path.join(modSourcePath, mod.modName);
    const dest = path.join(modTargetPath, mod.modName);
    if (!fs.existsSync(src)) {
        result.failures.push({
            modName: mod.modName,
            reason: new TranslatedText(
                `Source folder not found: ${src}`,
                `Không tìm thấy thư mục nguồn: ${src}`),
        });
        return;
    }
    let stat = null;
    try {
        stat = fs.lstatSync(dest);
    } catch (e: any) {
        if (!e || e.code !== 'ENOENT') {
            result.failures.push({
                modName: mod.modName,
                reason: new TranslatedText(
                    `Could not check ${dest}: ${e.message}`,
                    `Không kiểm tra được ${dest}: ${e.message}`),
            });
            return;
        }
    }
    if (stat) {
        if (!stat.isSymbolicLink()) {
            // A real folder or file is already there — do not overwrite it.
            result.failures.push({
                modName: mod.modName,
                reason: new TranslatedText(
                    `A real folder named "${mod.modName}" is already in the target folder — left untouched, mod not applied.`,
                    `Trong thư mục đích đã có một thư mục thật tên "${mod.modName}", đã giữ nguyên, mod này chưa được áp dụng.`),
            });
            return;
        }
        // A link is already there. If it points at the right source, the mod
        // is already applied. Otherwise (stale or broken link) replace it.
        try {
            const linkTarget = fs.readlinkSync(dest);
            if (path.resolve(modTargetPath, linkTarget) === path.resolve(src)) {
                result.skipped++;
                return;
            }
        } catch (e) {
            // Unreadable link: fall through and replace it.
        }
        try {
            fs.unlinkSync(dest);
        } catch (e: any) {
            result.failures.push({
                modName: mod.modName,
                reason: new TranslatedText(
                    `Could not remove the old link: ${e.message}`,
                    `Không xóa được liên kết cũ: ${e.message}`),
            });
            return;
        }
    }
    try {
        fs.symlinkSync(src, dest, 'junction');
        result.applied++;
    } catch (e: any) {
        result.failures.push({
            modName: mod.modName,
            reason: new TranslatedText(
                `Could not create the link: ${e.message}. Please check permissions or confirm if your disk type supports creating links. Or you can use the traditional way to apply mod.`,
                `Không tạo được liên kết: ${e.message}. Hãy kiểm tra quyền hoặc xem ổ đĩa của bạn có hỗ trợ tạo liên kết không. Hoặc bạn có thể dùng cách áp dụng truyền thống.`),
        });
    }
}

// Rename one mod folder for traditional mode, recording the outcome.
function renameModFolder(mod: ModInfo, newName: string, result: ApplyResult, countKey: 'applied' | 'removed') {
    let renameError: any = null;
    const ok = mod.rename(newName, (err: any) => { renameError = err; });
    if (ok && !renameError) {
        result[countKey]++;
    } else {
        const detail = renameError ? renameError.message : 'unknown error';
        result.failures.push({
            modName: mod.modName,
            reason: new TranslatedText(
                `Could not rename the mod folder: ${detail}`,
                `Đổi tên thư mục mod thất bại: ${detail}`),
        });
    }
}

// Chia toàn bộ mod thành 2 tập để áp dụng: tập chưa chọn (cần gỡ) và tập
// vừa chọn vừa có trong danh sách (cần áp dụng). selectedMods luôn là tập
// con của allMod vì getModByID chỉ tra trong modsRaw, nên không có trường
// hợp mod được chọn mà không nằm trong allMod.
function resolveApplySets(modIds: string[]): { notInSelectedMods: ModInfo[]; inBoth: ModInfo[] } {
    const allMod = ModLoader.modsRaw;

    const selectedMods = modIds.map((modId) => {
        const mod = ModLoader.getModByID(modId);
        return mod ? mod : null;
    }).filter(mod => mod !== null) as ModInfo[];

    console.log('selectedMods', selectedMods);

    const notInSelectedMods = allMod.filter(mod => !selectedMods.includes(mod));
    const inBoth = selectedMods.filter(mod => allMod.includes(mod));

    // debug
    console.log('notInSelectedMods', notInSelectedMods);
    console.log('inBoth', inBoth);

    return { notInSelectedMods, inBoth };
}

async function applyMods(
    modIds: string[],
    modSourcePath: string,
    modTargetPath: string,
    onProgress?: ApplyProgressCallback
): Promise<ApplyResult | null> {
    const fs = require('fs');
    const path = require('path');


    // 检查一下modSourcePath和modTargetPath是否存在，且不能为同一个文件夹
    if (modSourcePath === undefined || modSourcePath === null || modSourcePath === '') {
        const errorMessage = 'modSourcePath is empty. Please check your configuration in Settings/Advanced Settings.';
        console.error(errorMessage);
        t_snack(new TranslatedText(errorMessage, 'modSourcePath trống, hãy kiểm tra cấu hình trong Cài đặt/Cài đặt nâng cao'), SnackType.error);
        return null;
    }
    if (modTargetPath === undefined || modTargetPath === null || modTargetPath === '') {
        const errorMessage = 'modTargetPath is empty. Please check your configuration in Settings/Advanced Settings.';
        console.error(errorMessage);
        t_snack(new TranslatedText(errorMessage, 'modTargetPath trống, hãy kiểm tra cấu hình trong Cài đặt/Cài đặt nâng cao'), SnackType.error);
        return null;
    }
    if (modSourcePath === modTargetPath) {
        const errorMessage = 'modSourcePath and modTargetPath are the same. Please check your configuration in Settings/Advanced Settings.';
        console.error(errorMessage);
        t_snack(new TranslatedText(errorMessage, 'Ở chế độ không truyền thống, modSourcePath và modTargetPath không được trùng nhau, hãy kiểm tra cấu hình trong Cài đặt/Cài đặt nâng cao, hoặc chọn dùng chế độ truyền thống'), SnackType.error);
        return null;
    }
    if (!fs.existsSync(modSourcePath)) {
        const errorMessage = `modSourcePath does not exist: ${modSourcePath}. Please check your configuration in Settings/Advanced Settings.`;
        console.error(errorMessage);
        t_snack(new TranslatedText(errorMessage, `modSourcePath không tồn tại: ${modSourcePath}, hãy kiểm tra cấu hình trong Cài đặt/Cài đặt nâng cao`), SnackType.error);
        return null;
    }
    if (!fs.existsSync(modTargetPath)) {
        const errorMessage = `modTargetPath does not exist: ${modTargetPath}. Please check your configuration in Settings/Advanced Settings.`;
        console.error(errorMessage);
        t_snack(new TranslatedText(errorMessage, `modTargetPath không tồn tại: ${modTargetPath}, hãy kiểm tra cấu hình trong Cài đặt/Cài đặt nâng cao`), SnackType.error);
        return null;
    }
    if (!fs.statSync(modSourcePath).isDirectory()) {
        const errorMessage = `modSourcePath is not a directory: ${modSourcePath}. Please check your configuration in Settings/Advanced Settings.`;
        console.error(errorMessage);
        t_snack(new TranslatedText(errorMessage, `modSourcePath không phải là thư mục: ${modSourcePath}, hãy kiểm tra cấu hình trong Cài đặt/Cài đặt nâng cao`), SnackType.error);
        return null;
    }
    if (!fs.statSync(modTargetPath).isDirectory()) {
        const errorMessage = `modTargetPath is not a directory: ${modTargetPath}. Please check your configuration in Settings/Advanced Settings.`;
        console.error(errorMessage);
        t_snack(new TranslatedText(errorMessage, `modTargetPath không phải là thư mục: ${modTargetPath}, hãy kiểm tra cấu hình trong Cài đặt/Cài đặt nâng cao`), SnackType.error);
        return null;
    }


    //debug
    console.log('modIds', modIds);

    

    // await ModLoader.loadMods();
    const { notInSelectedMods, inBoth } = resolveApplySets(modIds);

    const result = emptyResult();
    const total = notInSelectedMods.length + inBoth.length;
    let done = 0;
    const report = (modName: string) => {
        done++;
        if (onProgress) {
            onProgress(done, total, modName);
        }
    };

    // 移除不在selectedMods中的mod（只删除本程序创建的链接，真实文件夹不动）
    for (let i = 0; i < notInSelectedMods.length; i++) {
        removeModLink(notInSelectedMods[i], modTargetPath, result);
        report(notInSelectedMods[i].modName);
        if (done % APPLY_CHUNK_SIZE === 0) {
            await yieldToUI();
        }
    }

    // 为inBoth中的mod创建链接
    for (let i = 0; i < inBoth.length; i++) {
        createModLink(inBoth[i], modSourcePath, modTargetPath, result);
        report(inBoth[i].modName);
        if (done % APPLY_CHUNK_SIZE === 0) {
            await yieldToUI();
        }
    }

    return result;
}

async function applyModsTranditional(
    modIds: string[],
    onProgress?: ApplyProgressCallback
): Promise<ApplyResult | null> {
    // 这个功能不需要SourcePath，只有一个TargetPath
    // 通过改变mod的文件夹的名字来实现
    // 当mod文件夹的名称前为”disabled_“时，表示该mod被禁用
    // 当mod文件夹的名称前部位为”disabled_“时，表示该mod被启用

    const fs = require('fs');
    const path = require('path');

    // 如果 开启了 mod名称和mod文件夹名称一致，将无法使用该功能，因为这里会需要修改文件夹名称
    if (ModInfo.ifKeepModNameAsModFolderName) {
        t_snack(new TranslatedText(
            `Mod name and mod folder name are the same, unable to use the traditional way to apply mod.`,
            `Tên mod và tên thư mục mod giống nhau, không dùng được cách áp dụng truyền thống.`
        ),SnackType.error);
        return null;
    }

    // await ModLoader.loadMods();
    const { notInSelectedMods, inBoth } = resolveApplySets(modIds);

    const result = emptyResult();
    const total = notInSelectedMods.length + inBoth.length;
    let done = 0;
    const report = (modName: string) => {
        done++;
        if (onProgress) {
            onProgress(done, total, modName);
        }
    };

    // 为不在selectedMods中的mod的文件夹名称添加前缀”disabled_“
    for (let i = 0; i < notInSelectedMods.length; i++) {
        const mod = notInSelectedMods[i];
        // 如果文件夹名称前缀已经是”disabled_“，则不需要修改
        if (path.basename(mod.location).startsWith('disabled_')) {
            result.skipped++;
        } else {
            renameModFolder(mod, `disabled_${mod.modName}`, result, 'removed');
        }
        report(mod.modName);
        if (done % APPLY_CHUNK_SIZE === 0) {
            await yieldToUI();
        }
    }

    // 为inBoth中的mod的文件夹名称添加移除前缀”disabled_“
    for (let i = 0; i < inBoth.length; i++) {
        const mod = inBoth[i];
        // 如果文件夹名称前缀已经不是”disabled_“，则不需要修改
        if (!path.basename(mod.location).startsWith('disabled_')) {
            result.skipped++;
        } else {
            renameModFolder(mod, path.basename(mod.location).replace('disabled_', ''), result, 'applied');
        }
        report(mod.modName);
        if (done % APPLY_CHUNK_SIZE === 0) {
            await yieldToUI();
        }
    }

    // 重命名完成之后，文件位置可能会发生变化，所以需要重新加载mod
    // ModLoader.loadMods()

    return result;
}

export {applyMods, applyModsTranditional};
export type { ApplyResult, ApplyFailure, ApplyProgressCallback };
