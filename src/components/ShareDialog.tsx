import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { IconClose, IconCopy, IconShare } from './Icons';
import { copyText } from '../lib/clipboard';
import { formatCn, toDateKey } from '../lib/date';
import { getWindow } from '../lib/digits';
import { formatNumber } from '../lib/format';
import { downloadPoster } from '../lib/poster';
import { pageTitle, shareText, shareUrl } from '../lib/share';
import { getInitialTheme } from '../lib/theme';
import type { DateParts, Reading, SlotId } from '../lib/types';

interface ShareDialogProps {
  open: boolean;
  date: DateParts;
  reading: Reading | null;
  slot: SlotId;
  depth: number;
  onClose: () => void;
}

export function ShareDialog({ open, date, reading, slot, depth, onClose }: ShareDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState('');
  const [posterBusy, setPosterBusy] = useState(false);
  const url = shareUrl(date, slot);
  const text = shareText(date, reading, depth);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
      setMessage('');
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previousOverflow;
        if (dialog.open) {
          dialog.close();
        }
      };
    }
    if (dialog.open) {
      dialog.close();
    }
    return;
  }, [open]);

  async function handleCopyLink() {
    const ok = await copyText(url);
    setMessage(ok ? '链接已复制。' : '复制失败，请手动选中链接。');
  }

  async function handleCopySummary() {
    const ok = await copyText(text);
    setMessage(ok ? '摘要已复制，可以直接发给别人。' : '复制失败，请手动选中摘要。');
  }

  async function handleNativeShare() {
    if (!navigator.share) {
      setMessage('当前浏览器不支持系统分享，请复制链接。');
      return;
    }
    try {
      await navigator.share({
        title: pageTitle(date, reading),
        text: text,
        url: url,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      setMessage('系统分享没有完成。');
    }
  }

  async function handlePoster() {
    if (!reading) {
      setMessage('正在读取这一天的答案，请稍后再试。');
      return;
    }
    if (reading.position === null) {
      setMessage('这个读数没有位次，海报只能展示「未出现」。');
      return;
    }
    setPosterBusy(true);
    setMessage('');
    let digits: string | null = null;
    let start: number | null = null;
    try {
      const range = await getWindow(reading.position, reading.encoded.length);
      digits = range.digits;
      start = range.start;
    } catch (error) {
      void error;
    }
    try {
      await downloadPoster({
        date: date,
        reading: reading,
        digits: digits,
        start: start,
        url: url,
        theme: getInitialTheme(),
      });
      setMessage('海报已生成，请在下载文件夹查看。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '海报生成失败。');
    } finally {
      setPosterBusy(false);
    }
  }

  function handleBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      dialogRef.current?.close();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="share-dialog"
      aria-labelledby="share-title"
      onClose={onClose}
      onClick={handleBackdrop}
    >
      <div className="share-dialog__panel">
        <header className="share-dialog__head">
          <div>
            <p className="eyebrow">分享</p>
            <h2 id="share-title">把这一天发出去</h2>
          </div>
          <button className="icon-button" type="button" onClick={() => dialogRef.current?.close()} aria-label="关闭分享">
            <IconClose />
          </button>
        </header>

        <div className="share-preview" aria-hidden="true">
          <div className="share-preview__card">
            <span className="share-preview__date mono">{toDateKey(date)}</span>
            <span className="share-preview__pi">π</span>
            <p className="share-preview__date-cn">{formatCn(date)}</p>
            <p className={'share-preview__position' + (reading?.position == null ? ' is-missing' : '')}>
              {reading?.position == null ? '未出现' : formatNumber(reading.position)}
            </p>
            <p className="share-preview__meta">
              <span className="mono">{reading?.encoded ?? '…'}</span>
              <span>{reading?.position == null ? '前 10 亿位内' : '第 ' + formatNumber(reading.position) + ' 位'}</span>
            </p>
          </div>
        </div>

        <div className="share-dialog__summary">
          <p>{text}</p>
        </div>

        <div className="share-dialog__actions">
          <button className="button" type="button" onClick={handleCopyLink}>
            <IconCopy size={16} /> 复制链接
          </button>
          <button className="button" type="button" onClick={handleCopySummary}>
            复制摘要
          </button>
          <button className="button" type="button" onClick={handleNativeShare}>
            <IconShare size={16} /> 系统分享
          </button>
          <button
            className="button button--primary"
            type="button"
            onClick={handlePoster}
            disabled={posterBusy || !reading || reading.position === null}
          >
            {posterBusy ? '生成中…' : '下载 3:4 海报'}
          </button>
        </div>

        {message ? (
          <p className="share-dialog__message" role="status">
            {message}
          </p>
        ) : null}
        <p className="share-dialog__hint">海报 1080 × 1350，随当前主题生成；数字带取数失败时，海报会退回只展示目标数字。</p>
      </div>
    </dialog>
  );
}
