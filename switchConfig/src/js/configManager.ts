// 管理tape 和 config 的 类

const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');

import { snack, t_snack, SnackType} from '../../../helper/SnackHelper';
import { TranslatedText } from '../../../helper/Language';
import fsProxy from '../../../electron/fsProxy';
import { ref } from 'vue';

let g_allConfig: TapeConfig[] = [];
const g_allConfig_vue = ref(g_allConfig);


class TapeConfig{
    public _dir: string;
    private static _userConfigPath: string = '';
    private static _configRootPath: string = '';
    public static async getConfigRootPath(){
        // HP18: the user-data path never changes within a run — fetch it once
        // and reuse the cached result instead of an IPC call every time.
        // (Still empty after a failed fetch, so the next call retries.)
        if (this._configRootPath) {
            return this._configRootPath;
        }
        // 默认为用户数据路径
        this._userConfigPath = await ipcRenderer.invoke('get-user-data-path');
        this._configRootPath = path.join(this._userConfigPath, 'config');
        return this._configRootPath;
    }

    public name: string;
    public desc: string;
    public tape_front: string;
    public tape_side: string;
    public tape_back: string;
    public tape_spine: string;
    

    constructor(dir: string) {
        this._dir = dir;
        // name为文件夹名
        this.name = path.basename(dir);
        // HP17: read the directory listing once instead of 16 synchronous
        // existsSync calls (4 image types x 4 extensions). The lowercase map
        // keeps the Windows case-insensitive existsSync behaviour (e.g. a
        // FRONT.JPG file still matches front.jpg); a missing/unreadable dir
        // behaves like before (no images found, no throw).
        const dirFiles = new Map<string, string>();
        try {
            for (const f of fs.readdirSync(dir)) {
                dirFiles.set(f.toLowerCase(), f);
            }
        } catch (e) {
            // 目录不存在或不可读：与原来 existsSync 全为 false 的结果一致
        }
        const findImage = (base: string): string => {
            for (const ext of ['jpg', 'jpeg', 'png', 'gif']) {
                const found = dirFiles.get(`${base}.${ext}`);
                if (found !== undefined) {
                    return path.join(this._dir, found);
                }
            }
            return '';
        };
        this.tape_front = findImage('front');
        this.tape_side = findImage('side');
        this.tape_back = findImage('back');
        this.tape_spine = findImage('spine');
        const descFile = dirFiles.get('description.txt');
        this.desc = descFile !== undefined ? fs.readFileSync(path.join(this._dir, descFile), 'utf-8') : new TranslatedText('No Description','Không có mô tả').get();

        // debug
        console.log(this);
    }



    // 加载所有的配置
    static async loadAllConfig(){
        const configRootDir = await TapeConfig.getConfigRootPath()
        // 如果不存在config文件夹，创建一个
        if(!fs.existsSync(configRootDir)){
            t_snack(new TranslatedText('Config folder not found, creating a new one', 'Không tìm thấy thư mục cấu hình, đang tạo mới'), SnackType.info);
            fs.mkdirSync(configRootDir);
            // 打开文件夹
            fsProxy.openDir(configRootDir);
        }
        // 遍历 config
        // HP17: withFileTypes gives the entry type from the listing itself —
        // no statSync per entry (only symlinks still need a stat, to keep the
        // old behaviour of following a symlink to a directory).
        const configDirs: string[] = fs.readdirSync(configRootDir, { withFileTypes: true })
            .filter((entry): boolean => entry.isDirectory() || (entry.isSymbolicLink() && fs.statSync(path.join(configRootDir, entry.name)).isDirectory()))
            .map((entry) => entry.name);
        // 如果没有配置文件夹，创建一个
        if(configDirs.length === 0){
            t_snack(new TranslatedText('No config found', 'Không tìm thấy file cấu hình'), SnackType.error);
            return [];
        }
        const configList: TapeConfig[] = configDirs.map((dir: string): TapeConfig => {
            return new TapeConfig(path.join(configRootDir, dir));
        });
        //debug
        console.log("0000000000000000000000", configList);
        this.allConfig = configList;
        return configList;
    }
    static _allConfig: TapeConfig[] = [];
    static get allConfig(){
        return this._allConfig;
    }
    static set allConfig(value: TapeConfig[]){
        this._allConfig = value;
        // 全局变量 和 这里同步
        g_allConfig_vue.value = value;
        g_allConfig = value;
    }


    static async getAllConfig(){
        if(this._allConfig.length === 0){
            this._allConfig = await this.loadAllConfig();
        }
        return this._allConfig;
    }
    static async reloadAllConfig(){
        this._allConfig = await this.loadAllConfig();
    }
    static clearConfig(){
        this._allConfig = [];
        console.log('All configurations cleared.');
    }

    static async createConfig(name: string){
        if (name === ''){
            t_snack(new TranslatedText('Name cannot be empty', 'Tên không được để trống'), SnackType.error);
            return;
        }
        const configRootDir = await this.getConfigRootPath();
        const newConfigDir = path.join(configRootDir, name);
        console.log(newConfigDir);
        if(fs.existsSync(newConfigDir)){
            t_snack(new TranslatedText('Config already exists', 'Cấu hình đã tồn tại'), SnackType.error);
            return;
        }
        fs.mkdirSync(newConfigDir);
        t_snack(new TranslatedText('Config created', 'Đã tạo cấu hình'), SnackType.info);
        this.reloadAllConfig();
    }
}


// 自己触发一下获取路径
TapeConfig.getConfigRootPath();

export default TapeConfig;
export { g_allConfig_vue };
