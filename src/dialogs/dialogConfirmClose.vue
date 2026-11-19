<!-- Hỏi xác nhận trước khi tắt app (nút X ở đầu app) -->
<template>
    <dialogTemplate id="dialog-confirm-close" type="block">
        <template v-slot:content>
            <h1 style="z-index: 1;">{{ $t('closeDialog.title') }}</h1>
            <p style="z-index: 1; text-align: center;">{{ $t('closeDialog.message') }}</p>
        </template>
        <template v-slot:action>
            <s-button slot="action" type="text" id="dialog-cancel" class="OO-button font-hongmeng" style="margin-left: 20px;
    margin-right: 20px;">
                <p>{{ $t('buttons.cancel') }}</p>
            </s-button>
            <s-button slot="action" type="text" id="close-confirm" @click="handleConfirmClose"
                class="OO-button font-hongmeng OO-color-gradient" style="color: var(--s-color-dark-surface);margin-left: 20px;
    margin-right: 20px;">
                <p>{{ $t('buttons.confirm') }}</p>
            </s-button>
        </template>
    </dialogTemplate>
</template>

<script setup>
import dialogTemplate from './dialogTemplate.vue';

function handleConfirmClose() {
    window.close();
}
</script>
