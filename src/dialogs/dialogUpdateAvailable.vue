<!-- Hộp hỏi khi có bản mới: ghi version hiện tại + version mới + ghi chú
     phát hành; bấm "Cập nhật ngay" thì tải (hiện % trong hộp), bấm "Để sau"
     thì đóng và không hỏi lại trong phiên này.
     Nút đặt ở khe action như mọi hộp khác (để hộp ôm sát nội dung, không
     thừa khoảng đen dưới nút). Sober tự đóng hộp khi bấm nút ở khe action,
     nên có bộ nghe dismiss chặn lại khi đang tải (pattern TC23): bấm
     "Cập nhật ngay" thì cờ downloading bật đồng bộ trước khi sự kiện
     dismiss tới, hộp ở lại để hiện tiến độ; tải xong thì helper đóng hộp
     bằng code. -->
<template>
    <dialogTemplate id="dialog-update-available" type="block">
        <template v-slot:content>
            <h1 style="z-index: 1;">{{ $t('update.availableTitle') }}</h1>
            <p style="z-index: 1; text-align: center;">
                {{ $t('update.currentVersion', { version: updateState.currentVersion }) }}
            </p>
            <p style="z-index: 1; text-align: center;">
                {{ $t('update.newVersion', { version: updateState.availableVersion }) }}
            </p>
            <div v-if="updateState.releaseNotes" class="release-notes" style="z-index: 1;">
                <h3>{{ $t('update.releaseNotes') }}</h3>
                <p class="notes-text">{{ updateState.releaseNotes }}</p>
            </div>
            <div v-if="updateState.status === 'downloading'" class="download-progress" style="z-index: 1;">
                <p>{{ $t('update.downloading', { percent: updateState.downloadPercent }) }}</p>
                <div class="progress-track">
                    <div class="progress-fill" :style="{ width: updateState.downloadPercent + '%' }"></div>
                </div>
            </div>
        </template>
        <template v-slot:action>
            <span style="display: none;"></span>
            <s-button v-if="updateState.status !== 'downloading'" slot="action" type="text" id="update-later"
                @click="handleLater" class="OO-button font-hongmeng"
                style="margin-left: 20px; margin-right: 20px;">
                <p>{{ $t('update.later') }}</p>
            </s-button>
            <s-button v-if="updateState.status !== 'downloading'" slot="action" type="text" id="update-now"
                @click="handleUpdateNow" class="OO-button font-hongmeng OO-color-gradient"
                style="color: var(--s-color-dark-surface); margin-left: 20px; margin-right: 20px;">
                <p>{{ $t('update.updateNow') }}</p>
            </s-button>
        </template>
    </dialogTemplate>
</template>

<script setup>
import dialogTemplate from './dialogTemplate.vue';
import { watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { updateState, downloadUpdate, dismissUpdateAvailable } from '../../helper/UpdateHelper';
import { snack, SnackType } from '../../helper/SnackHelper';

const { t } = useI18n();

// Đang tải mà lỗi mạng: hộp quay lại trạng thái nút bấm + báo lỗi.
watch(() => updateState.status, (newStatus, oldStatus) => {
    if (newStatus === 'error' && oldStatus === 'downloading') {
        snack(t('update.downloadFailed'), SnackType.error);
    }
});

// Nút "Cập nhật ngay" nằm ở khe action nên Sober tự đóng hộp khi bấm —
// chặn lại khi đang tải để hộp ở lại hiện tiến độ (pattern TC23 ở
// dialogModInfo2: sự kiện dismiss là cancelable, cờ bật đồng bộ trong
// click handler trước khi dismiss tới). Chỉ chặn nguồn ACTION để bấm ra
// ngoài vùng hộp vẫn đóng được.
onMounted(() => {
    document.getElementById('dialog-update-available')?.addEventListener('dismiss', (event) => {
        const source = event.detail && event.detail.source;
        if (updateState.status === 'downloading' && source === 'ACTION') {
            event.preventDefault();
        }
    });
});

function handleUpdateNow() {
    downloadUpdate();
}

function handleLater() {
    dismissUpdateAvailable();
}
</script>

<style scoped>
.release-notes {
    width: 100%;
    max-width: 460px;
    text-align: left;
}

.notes-text {
    white-space: pre-wrap;
    max-height: 180px;
    overflow-y: auto;
    text-align: left;
    font-size: 14px;
}

.download-progress {
    width: 100%;
    max-width: 460px;
    text-align: center;
}

.progress-track {
    width: 100%;
    height: 8px;
    background: var(--s-color-surface-container-high);
    border-radius: 4px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: var(--s-color-primary);
    transition: width 0.2s;
}
</style>
