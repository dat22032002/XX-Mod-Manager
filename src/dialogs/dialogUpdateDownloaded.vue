<!-- Hộp hỏi sau khi tải xong bản mới: khởi động lại ngay để cài, hay để
     sau (bản mới sẽ tự cài khi tắt app lần tới). -->
<template>
    <dialogTemplate id="dialog-update-downloaded" type="block">
        <template v-slot:content>
            <h1 style="z-index: 1;">{{ $t('update.downloadedTitle') }}</h1>
            <p style="z-index: 1; text-align: center;">
                {{ $t('update.downloadedMessage', { version: updateState.availableVersion }) }}
            </p>
            <p style="z-index: 1; text-align: center;">{{ $t('update.downloadedNote') }}</p>
        </template>
        <template v-slot:action>
            <s-button slot="action" type="text" id="update-restart-later" class="OO-button font-hongmeng" style="margin-left: 20px;
    margin-right: 20px;">
                <p>{{ $t('update.later') }}</p>
            </s-button>
            <s-button slot="action" type="text" id="update-restart-now" @click="handleRestartNow"
                class="OO-button font-hongmeng OO-color-gradient" style="color: var(--s-color-dark-surface);margin-left: 20px;
    margin-right: 20px;">
                <p>{{ $t('update.restartNow') }}</p>
            </s-button>
        </template>
    </dialogTemplate>
</template>

<script setup>
import dialogTemplate from './dialogTemplate.vue';
import { updateState, installUpdate } from '../../helper/UpdateHelper';

function handleRestartNow() {
    installUpdate();
}
</script>
