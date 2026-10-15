export type CopyState = 'idle' | 'copied' | 'failed';

export interface CopyEnvironment {
  /** 异步剪贴板（navigator.clipboard）：只在安全上下文（https / localhost）里存在。 */
  clipboard?: { writeText(text: string): Promise<void> } | null;
  /** 兜底方案：把文本塞进隐藏文本框再 execCommand('copy')，返回是否成功。 */
  legacyCopy?: ((text: string) => boolean) | null;
}

/**
 * 复制一段文本：优先异步剪贴板，被拒绝或不存在时退回兜底方案。
 * 返回是否成功 —— 失败时页面要如实说「复制失败」，不能假装复制了。
 */
export async function copyText(text: string, env: CopyEnvironment): Promise<boolean> {
  if (env.clipboard) {
    try {
      await env.clipboard.writeText(text);
      return true;
    } catch {
      // 权限被拒 / 非安全上下文：继续试兜底方案
    }
  }
  if (env.legacyCopy) {
    try {
      return env.legacyCopy(text);
    } catch {
      return false;
    }
  }
  return false;
}

/** 浏览器默认环境：navigator.clipboard + 隐藏 textarea 兜底。 */
export function browserCopyEnvironment(): CopyEnvironment {
  const clipboard = typeof navigator !== 'undefined' && navigator.clipboard ? navigator.clipboard : null;
  const canExec = typeof document !== 'undefined' && typeof document.execCommand === 'function';
  return {
    clipboard,
    legacyCopy: canExec
      ? (text) => {
          const area = document.createElement('textarea');
          area.value = text;
          area.setAttribute('readonly', '');
          area.style.position = 'fixed';
          area.style.top = '-1000px';
          area.style.opacity = '0';
          document.body.appendChild(area);
          try {
            area.select();
            return document.execCommand('copy');
          } finally {
            document.body.removeChild(area);
          }
        }
      : null,
  };
}
