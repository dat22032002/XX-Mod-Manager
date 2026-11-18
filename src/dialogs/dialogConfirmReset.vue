<!-- Xác nhận trước khi xóa hết preset + cài đặt (nút "Khởi tạo lại toàn bộ dữ liệu") -->
<template>
    <dialogTemplate id="dialog-confirm-reset" type="block">
        <template v-slot:content>
            <h1 style="z-index: 1;">{{ $t('resetDialog.title') }}</h1>
            <p style="z-index: 1; text-align: center;">{{ $t('resetDialog.warning') }}</p>
            <p style="z-index: 1; text-align: center;">{{ $t('resetDialog.backupNote') }}</p>
        </template>
        <template v-slot:action>
            <s-button slot="action" type="text" id="dialog-cancel" class="OO-button font-hongmeng" style="margin-left: 20px;
    margin-right: 20px;">
                <p>{{ $t('buttons.cancel') }}</p>
            </s-button>
            <s-button slot="action" type="text" id="reset-confirm" @click="handleConfirmReset"
                class="OO-button font-hongmeng OO-color-gradient" style="color: var(--s-color-dark-surface);margin-left: 20px;
    margin-right: 20px;">
                <p>{{ $t('buttons.confirm') }}</p>
            </s-button>
        </template>
    </dialogTemplate>
</template>

<script setup>
import dialogTemplate from './dialogTemplate.vue';

import IManager from '../../electron/IManager';
const iManager = new IManager();

function handleConfirmReset() {
    iManager.initAllData();
}
</script>
