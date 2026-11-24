declare var document: Document;
interface HTMLDialogElement extends HTMLElement {
    show(): void;
    dismiss(): void;
}

enum DialogID {
    dialogEnterPassword = 'dialog-enter-password',
    loadingDialog = 'loading-dialog',
    editModDialog = 'edit-mod-dialog',
    dialogNeedRefresh = 'dialog-need-refresh',
    saveChangeDialog = 'save-change-dialog',
    addPresetDialog = 'add-preset-dialog',
    dialogApplyResult = 'dialog-apply-result',
    dialogConfirmReset = 'dialog-confirm-reset',
    dialogConfirmClose = 'dialog-confirm-close',
    dialogConfirmDeleteMod = 'dialog-confirm-delete-mod',
    dialogConfirmBatchCharacter = 'dialog-confirm-batch-character',
    dialogConfirmBatchTag = 'dialog-confirm-batch-tag',
    dialogConfirmDeletePreset = 'dialog-confirm-delete-preset',
    dialogConfirmCleanupFixerBackups = 'dialog-confirm-cleanup-fixer-backups',
    dialogUpdateAvailable = 'dialog-update-available',
    dialogUpdateDownloaded = 'dialog-update-downloaded',
    dialogConfirmConflict = 'dialog-confirm-conflict',
}

class DialogHelper {
    // Kiểm tra dialogID có nằm trong enum không (vì hàm này bị JS gọi trực
    // tiếp nên phải tự kiểm tra). Thông báo lỗi dùng dialogID nguyên văn:
    // DialogID là enum chuỗi nên tra ngược DialogID[dialogID] chỉ ra undefined.
    private static validateDialogID(dialogID: DialogID) {
        if (!Object.values(DialogID).includes(dialogID)) {
            // Nếu là chuỗi thì dùng trực tiếp, không qua enum
            console.error(`dialog ${dialogID} is not a valid DialogID`);
            throw new Error(`dialog ${dialogID} is not a valid DialogID`);
        }
    }

    static async showDialog(dialogID: DialogID) {
        DialogHelper.validateDialogID(dialogID);
        const dialog = document.getElementById(dialogID) as HTMLDialogElement;
        if (!dialog) {
            console.log(`dialog ${dialogID} not found`);
            return;
        }
        dialog.show();
    }

    static async dismissDialog(dialogID: DialogID) {
        DialogHelper.validateDialogID(dialogID);
        const dialog = document.getElementById(dialogID) as HTMLDialogElement;
        if (!dialog) {
            console.log(`dialog ${dialogID} not found`);
            return;
        }
        dialog.dismiss();
    }
}   

export { DialogID, DialogHelper };