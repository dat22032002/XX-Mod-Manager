<!-- 应用结果汇总：显示成功/失败数量和失败的 Mod 列表 -->
<template>
    <dialogTemplate id="dialog-apply-result" type="block" maxWidth="640px">
        <template v-slot:content>
            <h1 style="z-index: 1;">{{ hasFailures ? $t('apply.titlePartial') : $t('apply.titleSuccess') }}</h1>
            <p style="z-index: 1;">
                {{ $t('apply.applied') }}: {{ result?.applied ?? 0 }} ·
                {{ $t('apply.removed') }}: {{ result?.removed ?? 0 }} ·
                {{ $t('apply.skipped') }}: {{ result?.skipped ?? 0 }} ·
                {{ $t('apply.failed') }}: {{ result?.failures?.length ?? 0 }}
            </p>
            <div v-if="hasFailures" class="failure-list">
                <h3>{{ $t('apply.failedMods') }}</h3>
                <div v-for="failure in result.failures" :key="failure.modName" class="failure-item">
                    <div class="failure-name">{{ failure.modName }}</div>
                    <div class="failure-reason">{{ failure.reason.get() }}</div>
                </div>
            </div>
        </template>
        <template v-slot:action>
            <s-button slot="action" type="text" class="OO-button font-hongmeng OO-color-gradient" style="color: var(--s-color-dark-surface);">
                {{ $t('apply.close') }}
            </s-button>
        </template>
    </dialogTemplate>
</template>

<script setup>
import { computed } from 'vue';
import dialogTemplate from './dialogTemplate.vue';
import { g_temp_vue } from '../../electron/IManager';

const result = g_temp_vue.applyResult;
const hasFailures = computed(() => (result.value?.failures?.length ?? 0) > 0);
</script>

<style scoped>
.failure-list {
    z-index: 1;
    width: 100%;
    max-height: 40vh;
    overflow-y: auto;
    text-align: left;
}

.failure-item {
    margin: 8px 0;
    padding: 8px 12px;
    background: var(--s-color-surface-container-low);
    border-radius: 8px;
}

.failure-name {
    font-weight: bold;
}

.failure-reason {
    font-size: 13px;
    opacity: 0.8;
    word-break: break-all;
}
</style>
