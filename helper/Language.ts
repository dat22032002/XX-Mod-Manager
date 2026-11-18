/** @enum
 * @desc 用于标记当前的语言环境
 */
enum Language {
    en = 'en',
    vi = 'vi',
}

// 保存一个全局的语言环境
let currentLanguage = Language.en;
function setCurrentLanguage(language: Language) {
    currentLanguage = language;
}

/** @class
 * @classdesc TranslatedText 用于简化多语言文本的获取
 * @param {string} enText - 英文文本
 * @param {string} viText - Vietnamese text
 */
class TranslatedText {
    public en : string;
    public vi : string;

    constructor(enText: string, viText: string) {
        this.en = enText;
        this.vi = viText;
    }

    public getText(language: Language) {
        if (language === 'en') {
            return this.en;
        } else if (language === 'vi') {
            return this.vi;
        }

        return this.en;
    }

    /** @function
     * @desc 获取当前的文本，根据当前的语言环境
     * @returns {string} 当前的文本
     */
    public get() {
        return this.getText(currentLanguage);
    }

    public static fromObject(obj: any) {
        if (obj.en && obj.vi) {
            return new TranslatedText(obj.en, obj.vi);
        } else {
            console.error('TranslatedText.fromObject error: obj is invalid', obj);
            return new TranslatedText('', '');
        }
    }
}




export { Language, TranslatedText, setCurrentLanguage };