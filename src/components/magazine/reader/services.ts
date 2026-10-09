import { LocalStorageReaderStore, ReaderStore } from './annotations';

/** 阅读器对宿主环境的依赖，全部可替换（后续接入自有库时实现这些接口即可） */
export interface ClipboardService {
  writeText(text: string): Promise<boolean>;
}

export interface SpeechService {
  speak(text: string): void;
  cancel(): void;
}

export interface ReaderServices {
  store: ReaderStore;
  clipboard: ClipboardService;
  speech: SpeechService;
}

export const browserClipboard: ClipboardService = {
  async writeText(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* 落到兜底方案 */
    }
    // 兜底：不可见 textarea + execCommand（仅作剪贴板桥，不属于界面）
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  },
};

export const browserSpeech: SpeechService = {
  speak(text) {
    if (typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    speechSynthesis.speak(u);
  },
  cancel() {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  },
};

export const defaultServices = (): ReaderServices => ({
  store: new LocalStorageReaderStore(),
  clipboard: browserClipboard,
  speech: browserSpeech,
});
