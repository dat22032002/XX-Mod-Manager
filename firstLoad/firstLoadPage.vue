<template>
    <div class="control-bar">
        <div id="rectangle"
            style="width: 73%; height: 8px; background-color:var(--s-color-outline-variant); border-radius: 10px;align-self: center;">
        </div>
    </div>

    <div class="main-container">
        <div class="head">
            <!-- Tab trình setup dùng kiểu thu gọn (compact): công thức viên
                 nghiêng gốc chỉ đúng cho 3 tab, với 5 tab thì viên lệch
                 trái che mất đuôi chữ tab trước (Đạt báo 24/11: chữ
                 "Welcome" bị viên vàng che ở bản tiếng Anh). Viên thu gọn
                 căn đúng từng tab với mọi số tab. -->
            <sectionSelector :sections="sections" :modelValue="currentSection" :compact="true"
                @update:currentSection="handleSectionChange" @update:modelValue="currentSection = $event"
                id="section-selector" ref="section-selector">
            </sectionSelector>
        </div>

        <div class="section-container">
            <!-- Bước 1: Chào mừng + ngôn ngữ/giao diện -->
            <div class="section OO-box" v-if="currentSection === 'welcome'">
                <div class="section-box">
                    <div class="OO-box OO-shade-box">
                        <h2 style="margin: 5px 0 10px 0;"> {{ $t('setup.welcomeTitle') }} </h2>
                        <p> {{ $t('setup.welcomeIntro') }}</p>
                        <ol>
                            <li> {{ $t('setup.welcomeStep1') }} </li>
                            <li> {{ $t('setup.welcomeStep2') }} </li>
                            <li> {{ $t('setup.welcomeStep3') }} </li>
                            <li> {{ $t('setup.welcomeStep4') }} </li>
                        </ol>
                        <p> {{ $t('setup.welcomeNote') }} </p>
                    </div>
                    <settingBar :data=languageData />
                    <s-divider></s-divider>
                    <settingBar :data=themeData />
                    <p> {{ $t('firstLoad.themeRecommand') }} </p>
                    <div class="placeholder" style="flex: 1;min-height: 150px;"></div>
                </div>
            </div>

            <!-- Bước 2: Tìm game ZZZ -->
            <div class="OO-box section" v-if="currentSection === 'game'">
                <div class="section-box">
                    <div class="OO-box OO-shade-box">
                        <h2 style="margin: 5px 0 10px 0;"> {{ $t('setup.gameTitle') }} </h2>
                        <p> {{ $t('setup.gameDesc') }} </p>
                    </div>
                    <s-divider></s-divider>
                    <div class="OO-setting-bar">
                        <h3> {{ $t('setup.gameLabel') }} </h3>
                        <s-button class="OO-button-box" @click="scanGame" :disabled="gameBusy">
                            {{ $t('setup.scan') }}
                        </s-button>
                    </div>
                    <div class="OO-box OO-shade-box" v-if="gameScanned">
                        <p v-if="gameExe" class="ok">✓ {{ gameExe }}</p>
                        <p v-else class="alert">{{ $t('setup.gameNotFound') }}</p>
                    </div>
                    <div class="OO-setting-bar">
                        <s-button class="OO-button-box" @click="pickGameManually">
                            {{ gameExe ? $t('setup.change') : $t('setup.pickManually') }}
                        </s-button>
                    </div>
                    <p v-if="!gameExe && gameScanned">{{ $t('setup.gamePickHint') }}</p>
                    <div class="placeholder" style="flex: 1;min-height: 150px;"></div>
                </div>
            </div>

            <!-- Bước 3: Bộ nạp mod (XXMI Launcher + ZZMI) -->
            <div class="OO-box section" v-if="currentSection === 'launcher'">
                <div class="section-box">
                    <div class="OO-box OO-shade-box">
                        <h2 style="margin: 5px 0 10px 0;"> {{ $t('setup.launcherTitle') }} </h2>
                        <p> {{ $t('setup.launcherDesc') }} </p>
                    </div>
                    <s-divider></s-divider>
                    <div class="OO-setting-bar">
                        <h3> {{ $t('setup.launcherLabel') }} </h3>
                        <s-button class="OO-button-box" @click="scanLauncher" :disabled="launcherBusy">
                            {{ $t('setup.recheck') }}
                        </s-button>
                    </div>
                    <div class="OO-box OO-shade-box" v-if="launcherScanned">
                        <!-- Đã có launcher + ZZMI -->
                        <template v-if="launcherDir && modsDir">
                            <p class="ok">✓ {{ $t('setup.launcherFound') }}</p>
                            <p>{{ launcherDir }}</p>
                            <p class="ok">✓ {{ $t('setup.zzmiFound') }}</p>
                            <p>{{ modsDir }}</p>
                        </template>
                        <!-- Đã có launcher nhưng chưa có ZZMI -->
                        <template v-else-if="launcherDir">
                            <p class="ok">✓ {{ $t('setup.launcherFound') }}</p>
                            <p>{{ launcherDir }}</p>
                            <p class="alert">{{ $t('setup.zzmiMissing') }}</p>
                            <p>{{ $t('setup.zzmiHowto') }}</p>
                            <s-button class="OO-button-box" @click="openLauncher">
                                {{ $t('setup.openLauncher') }}
                            </s-button>
                        </template>
                        <!-- Chưa có launcher -->
                        <template v-else>
                            <p class="alert">{{ $t('setup.launcherNotFound') }}</p>
                            <p>{{ $t('setup.launcherDownloadHint') }}</p>
                            <s-button class="OO-button-box" @click="pickLauncherManually">
                                {{ $t('setup.pickLauncherFolder') }}
                            </s-button>
                            <s-button class="OO-button-box" @click="downloadXxmi"
                                :disabled="msiState === 'downloading'">
                                {{ msiState === 'ready' ? $t('setup.downloaded') : $t('setup.download') }}
                            </s-button>
                            <div v-if="msiState === 'downloading'" style="margin-top: 10px;">
                                <div class="progress-track">
                                    <div class="progress-fill" :style="{ width: downloadPct + '%' }"></div>
                                </div>
                                <p>{{ $t('setup.downloading', { pct: downloadPct }) }}</p>
                            </div>
                            <p v-if="msiState === 'error'" class="alert">{{ downloadError }}</p>
                            <div v-if="msiState === 'ready'" style="margin-top: 10px;">
                                <s-button class="OO-button-box" @click="openInstaller">
                                    {{ $t('setup.openInstaller') }}
                                </s-button>
                                <p>{{ $t('setup.installerHint') }}</p>
                            </div>
                        </template>
                    </div>
                    <div class="placeholder" style="flex: 1;min-height: 150px;"></div>
                </div>
            </div>

            <!-- Bước 4: Thư mục (đích / kho mod / preset) -->
            <div class="OO-box section" v-if="currentSection === 'folders'">
                <div class="section-box">
                    <div class="OO-box OO-shade-box">
                        <h2 style="margin: 5px 0 10px 0;"> {{ $t('setup.foldersTitle') }} </h2>
                        <p> {{ $t('setup.foldersDesc') }} </p>
                    </div>
                    <s-divider></s-divider>
                    <div class="OO-setting-bar">
                        <h3> {{ $t('setting.modTargetPath') }} </h3>
                    </div>
                    <div class="OO-box OO-shade-box">
                        <p v-if="modTargetPath" class="ok">✓ {{ modTargetPath }}</p>
                        <p v-else class="alert">{{ $t('setup.targetMissing') }}</p>
                        <s-button class="OO-button-box" @click="pickTargetManually" style="margin-top: 8px;">
                            {{ $t('setup.change') }}
                        </s-button>
                    </div>
                    <s-divider></s-divider>
                    <div class="OO-setting-bar">
                        <h3> {{ $t('setting.modSourcePath') }} </h3>
                    </div>
                    <div class="OO-box OO-shade-box">
                        <p>{{ $t('setup.libraryQuestion') }}</p>
                        <div style="display: flex; gap: 10px; margin: 8px 0;">
                            <s-button class="OO-button-box" @click="pickLibrary">
                                {{ $t('setup.libraryHave') }}
                            </s-button>
                            <s-button class="OO-button-box" @click="createLibrary">
                                {{ $t('setup.libraryNew') }}
                            </s-button>
                        </div>
                        <p v-if="modSourcePath" class="ok">✓ {{ modSourcePath }}</p>
                        <p v-if="libraryChoice === 'have' && libraryModCount > 0">
                            {{ $t('setup.libraryFound', { count: libraryModCount }) }}
                        </p>
                        <p v-if="libraryChoice === 'have' && libraryChecked && libraryModCount === 0" class="alert">
                            {{ $t('setup.libraryEmpty') }}
                        </p>
                    </div>
                    <!-- Chuyển mod từ thư mục Mods vào kho (chỉ khi có mod ở đó) -->
                    <div class="OO-box OO-shade-box" v-if="modsInTarget > 0 && modSourcePath && moveState === 'idle'">
                        <p>{{ $t('setup.moveOffer', { count: modsInTarget }) }}</p>
                        <div style="display: flex; gap: 10px; margin-top: 8px;">
                            <s-button class="OO-button-box" @click="moveModsNow">
                                {{ $t('setup.moveNow') }}
                            </s-button>
                            <s-button class="OO-button-box" @click="moveState = 'skipped'">
                                {{ $t('setup.moveLater') }}
                            </s-button>
                        </div>
                    </div>
                    <div class="OO-box OO-shade-box" v-if="moveState === 'done'">
                        <p class="ok">✓ {{ $t('setup.moveDone', { moved: moveResult.moved.length }) }}</p>
                        <p v-if="moveResult.skipped.length > 0">
                            {{ $t('setup.moveSkipped', { count: moveResult.skipped.length }) }}
                        </p>
                        <p v-if="moveResult.failed.length > 0" class="alert">
                            {{ $t('setup.moveFailed', { count: moveResult.failed.length }) }}
                        </p>
                    </div>
                    <s-divider></s-divider>
                    <div class="OO-setting-bar">
                        <h3> {{ $t('setting.presetPath') }} </h3>
                    </div>
                    <div class="OO-box OO-shade-box">
                        <p v-if="presetPath" class="ok">✓ {{ presetPath }}</p>
                        <p v-else class="alert">{{ $t('setup.presetMissing') }}</p>
                        <div style="display: flex; gap: 10px; margin-top: 8px;">
                            <s-button class="OO-button-box" @click="pickPreset">
                                {{ $t('setup.change') }}
                            </s-button>
                            <s-button class="OO-button-box" @click="createPreset" v-if="!presetPath">
                                {{ $t('setup.presetNew') }}
                            </s-button>
                        </div>
                    </div>
                    <div class="placeholder" style="flex: 1;min-height: 150px;"></div>
                </div>
            </div>

            <!-- Bước 5: Kiểm tra + hoàn tất -->
            <div class="OO-box section" v-if="currentSection === 'check'">
                <div class="section-box">
                    <div class="OO-box OO-shade-box">
                        <h2 style="margin: 5px 0 10px 0;"> {{ $t('setup.checkTitle') }} </h2>
                        <p> {{ $t('setup.checkDesc') }} </p>
                    </div>
                    <s-divider></s-divider>
                    <div class="OO-box OO-shade-box">
                        <div v-for="item in checkItems" :key="item.key" class="check-row">
                            <p :class="item.ok ? 'ok' : 'alert'">{{ item.ok ? '✓' : '✗' }} {{ item.label }}</p>
                            <s-button v-if="!item.ok" class="OO-button-box check-fix"
                                @click="goTo(item.goTo)">
                                {{ $t('setup.fixIt') }}
                            </s-button>
                        </div>
                    </div>
                    <div class="OO-box OO-shade-box" style="margin-top: 10px;">
                        <s-button class="OO-color-gradient font-hongmeng" @click="finish" :disabled="finishing">
                            {{ $t('setup.finish') }}
                        </s-button>
                        <p style="margin-top: 10px;">{{ $t('setup.finishHint') }}</p>
                    </div>
                    <div class="placeholder" style="flex: 1;min-height: 150px;"></div>
                </div>
            </div>

        </div>
        <div class="buttons">
            <s-button type="text" @click="prev" id="prev" class="OO-button-box">{{ $t('buttons.forePage') }}</s-button>
            <s-button type="text" @click="next" id="next" class="OO-button-box">
                {{ currentSection === 'check' ? $t('setup.finish') : $t('buttons.nextPage') }}
            </s-button>
        </div>

    </div>
    <CssProxy />
</template>

<script setup>
import { ref, onMounted, computed, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';

import sectionSelector from '../src/components/sectionSelector.vue';
import IManager from '../electron/IManager';
import CssProxy from '../src/components/cssProxy.vue';
import settingBar from '../src/components/settingBar.vue';
import getData from '../src/section/settingSectionData.js';
import {
    findGameExe, windowsGameRoots,
    findLauncherDir, findLauncherExe, windowsLauncherRoots,
    findZzmiMods, readLauncherConfig, deriveFromTarget, isDir,
    countModFolders, looksLikeModLibrary, ensureDir, moveModFolders,
    defaultLibraryDir, defaultPresetDir,
} from '../helper/SetupDetect';

let { languageData, themeData } = getData();

const ipcRenderer = require('electron').ipcRenderer;
const iManager = new IManager({ light: true });
const { t } = useI18n();

// Trình setup mới (1.5.30, Đạt duyệt hướng A 24/11): 5 bước thay cho
// 5 mục cũ (intro/basic/advanced/auto/more). Người dùng không phải tự
// cài bộ nạp hay điền tay đường dẫn nữa — trình tự tìm, tự tải, tự tạo.
const sections = ref(['welcome', 'game', 'launcher', 'folders', 'check']);
const sectionSelectorRef = useTemplateRef('section-selector');
const currentSection = ref('welcome');

// Bước 2: game.
const gameExe = ref('');
const gameScanned = ref(false);
const gameBusy = ref(false);

// Bước 3: bộ nạp mod.
const launcherDir = ref('');
const modsDir = ref('');
const launcherScanned = ref(false);
const launcherBusy = ref(false);
const msiState = ref('idle'); // idle | downloading | ready | error
const downloadPct = ref(0);
const downloadError = ref('');

// Bước 4: thư mục.
const modTargetPath = ref('');
const modSourcePath = ref('');
const presetPath = ref('');
const libraryChoice = ref(''); // '' | have | new
const libraryChecked = ref(false);
const libraryModCount = ref(0);
const modsInTarget = ref(0);
const moveState = ref('idle'); // idle | done | skipped
const moveResult = ref({ moved: [], skipped: [], failed: [] });

const finishing = ref(false);

const handleSectionChange = (section) => {
    currentSection.value = section;
};

const goTo = (section) => {
    currentSection.value = section;
};

const next = () => {
    if (currentSection.value === 'check') {
        finish();
        return;
    }
    sectionSelectorRef.value.nextSection();
};

const prev = () => {
    sectionSelectorRef.value.prevSection();
};

// --- Bước 2: tìm game ---
const scanGame = () => {
    gameBusy.value = true;
    try {
        let found = findGameExe(windowsGameRoots());
        // Không thấy ở chỗ hay cài thì thử đường dẫn game trong cấu hình
        // của XXMI Launcher (nếu máy đã có launcher).
        if (!found) {
            const dir = findLauncherDir(windowsLauncherRoots());
            if (dir) {
                const cfg = readLauncherConfig(dir);
                if (cfg.gameFolder) {
                    const candidate = findGameExe([cfg.gameFolder]);
                    if (candidate) found = candidate;
                }
            }
        }
        gameExe.value = found || '';
    } finally {
        gameScanned.value = true;
        gameBusy.value = false;
    }
};

const pickGameManually = async () => {
    const picked = await iManager.getFilePath('ZenlessZoneZero.exe', 'exe');
    if (!picked) return;
    if (!picked.toLowerCase().endsWith('zenlesszonezero.exe')) {
        alert(t('setup.gameWrongFile'));
        return;
    }
    gameExe.value = picked;
    gameScanned.value = true;
};

// --- Bước 3: tìm bộ nạp mod ---
const scanLauncher = () => {
    launcherBusy.value = true;
    try {
        let dir = findLauncherDir(windowsLauncherRoots());
        let found = dir ? findZzmiMods(dir) : null;
        // Không thấy ở chỗ mặc định thì suy ra từ thư mục đích đã lưu
        // trong cài đặt cũ (máy từng cài app / launcher ở chỗ tự chọn —
        // vd máy Đạt: E:\Games\Mod\ModLaucher\ZZMI\Mods). Suy ra được cả
        // khi thư mục cha không có dấu hiệu launcher (lúc đó vẫn có
        // modsDir để bước Kiểm tra tính ZZMI).
        if (!found && modTargetPath.value) {
            const derived = deriveFromTarget(modTargetPath.value);
            if (derived.modsDir) {
                if (derived.launcherDir) dir = derived.launcherDir;
                found = { modsDir: derived.modsDir, importerDir: derived.importerDir, via: 'target' };
            }
        }
        launcherDir.value = dir || '';
        modsDir.value = found ? found.modsDir : '';
        // Tìm thấy thư mục Mods thì điền sẵn làm thư mục đích.
        if (modsDir.value) {
            modTargetPath.value = modsDir.value;
            modsInTarget.value = countModFolders(modsDir.value);
        }
    } finally {
        launcherScanned.value = true;
        launcherBusy.value = false;
    }
};

// Chọn thư mục launcher bằng tay (khi trình không tìm thấy mà người
// dùng biết chắc máy đã có launcher — vd cài ở chỗ lạ). Thư mục chọn
// phải có dấu hiệu launcher HOẶC chứa ZZMI (d3dx.ini + Mods), không
// thì báo sai và không nhận.
const pickLauncherManually = async () => {
    const picked = await iManager.getFilePath('XXMI Launcher', 'directory');
    if (!picked) return;
    const found = findZzmiMods(picked);
    if (!found) {
        alert(t('setup.launcherWrongFolder'));
        return;
    }
    launcherDir.value = picked;
    modsDir.value = found.modsDir;
    modTargetPath.value = found.modsDir;
    modsInTarget.value = countModFolders(found.modsDir);
    launcherScanned.value = true;
};

const downloadXxmi = async () => {
    if (msiState.value === 'downloading') return;
    msiState.value = 'downloading';
    downloadPct.value = 0;
    downloadError.value = '';
    try {
        const msiPath = await iManager.downloadXxmiInstaller((done, total) => {
            downloadPct.value = total > 0 ? Math.round((done / total) * 100) : 0;
        });
        if (!msiPath) {
            // null = đang có lần tải khác chạy (chống bấm trùng).
            msiState.value = 'idle';
            return;
        }
        msiState.value = 'ready';
    } catch (e) {
        console.error('downloadXxmi failed', e);
        msiState.value = 'error';
        downloadError.value = t('setup.downloadFailed');
    }
};

const openInstaller = () => {
    if (iManager.openXxmiInstaller()) {
        alert(t('setup.installerOpened'));
    } else {
        alert(t('setup.installerFailed'));
    }
};

const openLauncher = () => {
    const exe = findLauncherExe(launcherDir.value);
    if (exe) iManager.startExe(exe);
};

// --- Bước 4: thư mục ---
const pickTargetManually = async () => {
    const picked = await iManager.getFilePath('Mods', 'directory');
    if (!picked) return;
    modTargetPath.value = picked;
    modsDir.value = picked;
    modsInTarget.value = countModFolders(picked);
};

const pickLibrary = async () => {
    const picked = await iManager.getFilePath('Mod Library', 'directory');
    if (!picked) return;
    modSourcePath.value = picked;
    libraryChoice.value = 'have';
    libraryChecked.value = true;
    libraryModCount.value = looksLikeModLibrary(picked) ? countModFolders(picked) : 0;
};

const createLibrary = () => {
    const dir = defaultLibraryDir();
    if (!ensureDir(dir)) {
        alert(t('setup.createFolderFailed'));
        return;
    }
    modSourcePath.value = dir;
    libraryChoice.value = 'new';
    libraryChecked.value = false;
    libraryModCount.value = 0;
};

const pickPreset = async () => {
    const picked = await iManager.getFilePath('Presets', 'directory');
    if (!picked) return;
    presetPath.value = picked;
};

const createPreset = () => {
    const dir = defaultPresetDir();
    if (!ensureDir(dir)) {
        alert(t('setup.createFolderFailed'));
        return;
    }
    presetPath.value = dir;
};

const moveModsNow = () => {
    if (!modTargetPath.value || !modSourcePath.value) return;
    moveResult.value = moveModFolders(modTargetPath.value, modSourcePath.value);
    moveState.value = 'done';
    modsInTarget.value = countModFolders(modTargetPath.value);
};

// --- Bước 5: kiểm tra + hoàn tất ---
const checkItems = computed(() => [
    { key: 'game', label: t('setup.checkGame'), ok: !!gameExe.value, goTo: 'game' },
    // Có thư mục Mods của ZZMI thì coi như đã có bộ nạp (ZZMI chỉ tồn
    // tại khi đã cài bộ nạp) — tránh kẹt Hoàn tất khi trình không tìm
    // ra thư mục launcher mà bộ nạp vẫn có thật (máy Đạt 24/11).
    { key: 'launcher', label: t('setup.checkLauncher'), ok: !!(launcherDir.value || modsDir.value), goTo: 'launcher' },
    // ZZMI tính là đạt khi tìm thấy qua launcher HOẶC thư mục đích đã
    // có sẵn và có thật (máy từng cài app: đích chính là Mods của ZZMI).
    { key: 'zzmi', label: t('setup.checkZzmi'), ok: !!(modsDir.value || (modTargetPath.value.trim() && isDir(modTargetPath.value.trim()))), goTo: 'launcher' },
    { key: 'target', label: t('setup.checkTarget'), ok: !!modTargetPath.value.trim(), goTo: 'folders' },
    { key: 'source', label: t('setup.checkSource'), ok: !!modSourcePath.value.trim(), goTo: 'folders' },
    { key: 'preset', label: t('setup.checkPreset'), ok: !!presetPath.value.trim(), goTo: 'folders' },
]);

function finish() {
    if (finishing.value) return;
    // Cổng như TC31 cũ (chỉ cho xong khi đủ 3 đường dẫn), mở rộng thêm
    // game + bộ nạp + ZZMI — thiếu mục nào thì báo đúng mục đó.
    const missing = checkItems.value.filter((item) => !item.ok);
    if (missing.length > 0) {
        alert(t('setup.missingItems', { missing: missing.map((m) => m.label).join(', ') }));
        return;
    }
    finishing.value = true;
    iManager.config.firstLoad = false;
    iManager.config.modTargetPath = modTargetPath.value;
    iManager.config.modSourcePath = modSourcePath.value;
    iManager.config.presetPath = presetPath.value;
    iManager.saveConfig();
    ipcRenderer.send('refresh-main-window');
    window.close();
}

onMounted(async () => {
    await iManager.waitInit();
    // Điền sẵn đường dẫn cũ nếu máy từng cài app (cài lại / mở lại trình
    // setup từ Cài đặt) — người dùng khỏi chọn lại từ đầu.
    modTargetPath.value = iManager.config.modTargetPath || '';
    modSourcePath.value = iManager.config.modSourcePath || '';
    presetPath.value = iManager.config.presetPath || '';
    if (modSourcePath.value) {
        libraryChoice.value = 'have';
        libraryChecked.value = true;
        libraryModCount.value = countModFolders(modSourcePath.value);
    }
    // Quét sẵn game + bộ nạp ngay lúc mở (chỉ đọc ổ đĩa, không mạng) để
    // bước 2-3 có kết quả ngay khi người dùng tới.
    scanGame();
    scanLauncher();
    // TC31: KHÔNG đặt firstLoad=false lúc mở trang nữa — chỉ khi người dùng
    // đã xong hết và bấm hoàn tất (finish). Đóng cửa sổ giữa chừng (nút X)
    // thì lần mở sau trang này vẫn hiện lại.
});

</script>

<style scoped>
.main-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    align-items: center;
}

.head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 20px 5px 20px;
    height: 50px;
}

#section-selector {
    width: 100%;
}

.section-container {
    position: absolute;
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    width: calc(100% - 20px);
    height: calc(100% - 90px);
    padding: 10px;
    bottom: 0px;
    overflow: visible;
}

.section {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    width: calc(100% - 30px);
    height: calc(100% - 60px);
    bottom: 0px;

    >div {
        margin-right: -10px;
        padding-right: 10px;
    }
}

.section-box {
    height: 100%;
    overflow: auto;
}

.buttons {
    position: absolute;
    bottom: 0px;
    display: flex;
    justify-content: space-around;
    width: 100%;
    height: 50px;
}

.OO-button-box {
    width: 30%;
    height: calc(100% - 20px);
}

.alert {
    color: red;
}

.ok {
    color: green;
    word-break: break-all;
}

.check-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin: 6px 0;
}

.check-row p {
    word-break: break-all;
}

.check-fix {
    flex: none;
    width: 90px;
}

.progress-track {
    width: 100%;
    height: 10px;
    background-color: var(--s-color-surface-container-high);
    border-radius: 5px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background-color: #9fb900;
    border-radius: 5px;
    transition: width 0.3s;
}

.control-bar {
    width: 100%;
    margin: 0 0 10px 0;
    height: 30px;
    display: flex;

    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex-wrap: nowrap;
    background-color: #00000000;
    position: fixed;
    top: 0;
    left: 0;

    -webkit-app-region: drag;
}
</style>
