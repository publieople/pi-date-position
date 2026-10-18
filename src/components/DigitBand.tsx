import { useEffect, useRef, useState } from 'react';
import { IconCheck, IconCopy, IconRefresh } from './Icons';
import { copyText } from '../lib/clipboard';
import { getWindow, verifyAt } from '../lib/digits';
import { formatCheckedAt, formatNumber } from '../lib/format';
import { formatDepth } from '../lib/format';
import type { DigitWindow, Reading, Verification } from '../lib/types';

interface DigitBandProps {
  reading: Reading | null;
  depth: number;
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : '读取失败，请稍后再试';
}

export function DigitBand({ reading, depth }: DigitBandProps) {
  const position = reading?.position ?? null;
  const encoded = reading?.encoded ?? '';
  const [windowData, setWindowData] = useState<DigitWindow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [verify, setVerify] = useState<Verification | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const verifyRequest = useRef(0);

  useEffect(() => {
    verifyRequest.current += 1;
    setVerify(null);
    setVerifyError(null);
    setCopied(false);
    if (position === null) {
      setWindowData(null);
      setLoading(false);
      setError(null);
      return;
    }
    const controller = new AbortController();
    let alive = true;
    setLoading(true);
    setError(null);
    setWindowData(null);
    getWindow(position, encoded.length, controller.signal)
      .then((next) => {
        if (alive) {
          setWindowData(next);
          setLoading(false);
        }
      })
      .catch((nextError) => {
        if (alive && !controller.signal.aborted) {
          setError(messageFor(nextError));
          setLoading(false);
        }
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [position, encoded, reloadKey]);

  async function handleVerify() {
    if (position === null || !encoded) {
      return;
    }
    const request = verifyRequest.current + 1;
    verifyRequest.current = request;
    setVerifying(true);
    setVerifyError(null);
    try {
      const result = await verifyAt(position, encoded);
      if (verifyRequest.current === request) {
        setVerify(result);
        setVerifying(false);
      }
    } catch (nextError) {
      if (verifyRequest.current === request) {
        setVerifyError(messageFor(nextError));
        setVerifying(false);
      }
    }
  }

  async function handleCopy() {
    const text = windowData
      ? 'π 第 ' + windowData.start + ' 位起：' + windowData.digits
      : encoded;
    const ok = await copyText(text);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  }

  const groups = windowData ? windowData.digits.match(/.{1,10}/g) || [] : [];
  const targetStart = position ?? 0;
  const targetEnd = position === null ? 0 : position + encoded.length;
  const windowEnd = windowData ? windowData.start + windowData.digits.length - 1 : 0;
  const feynman = windowData !== null && windowData.start <= 762 && windowEnd >= 762;

  return (
    <section id="digits" className="section section--digits" aria-labelledby="digits-title" data-reveal>
      <header className="section__head">
        <p className="eyebrow">02 / 数字带</p>
        <h2 id="digits-title">
          把数字放回 <em>π</em> 里
        </h2>
        <p className="section__lead">
          不只给你一个位次。把目标前后的一小段 π 摊开，目标数字用朱砂色标出；再用第二个请求独立复核一次。
        </p>
      </header>

      {reading === null ? (
        <div className="digits-panel digits-panel--empty">
          <p className="eyebrow">取数中</p>
          <p>正在读取这一天的答案与 π 数字。</p>
        </div>
      ) : position === null ? (
        <div className="digits-panel digits-panel--missing">
          <p className="eyebrow">没有落点</p>
          <p className="digits-panel__missing-title">在这个深度里，没有它的位置。</p>
          <p>
            前 {formatDepth(depth)}内没有出现完整的 <span className="mono">{encoded}</span>。这不是说它不存在，只是在这个扫描范围内还没找到。
            换一种写法，或去年份图集里看看别的日期。
          </p>
        </div>
      ) : (
        <div className="digits-panel">
          <div className="digits-panel__meta">
            <span className={'chip ' + (windowData ? 'chip--' + windowData.source : '')}>
              {loading ? '取数中' : windowData?.source === 'local' ? '本地 100 万位副本' : 'api.pi.delivery · 实时取数'}
            </span>
            {windowData ? (
              <span className="mono digits-panel__range">
                第 {formatNumber(windowData.start)} 位起 · 共 {windowData.digits.length} 位
              </span>
            ) : null}
            <span className="digits-panel__target">
              目标 <span className="mono">{encoded}</span>
            </span>
          </div>

          {loading ? (
            <div className="ribbon ribbon--skeleton" aria-label="正在读取 π 数字">
              <span className="skeleton skeleton--ribbon" />
            </div>
          ) : null}

          {error ? (
            <div className="inline-error" role="alert">
              <span>{error}</span>
              <button className="button button--small" type="button" onClick={() => setReloadKey((key) => key + 1)}>
                <IconRefresh size={15} /> 重试
              </button>
            </div>
          ) : null}

          {windowData ? (
            <>
              <div
                className="ribbon"
                aria-label={'π 第 ' + formatNumber(windowData.start) + ' 位起的 ' + windowData.digits.length + ' 位数字，目标 ' + encoded + ' 已标出'}
              >
                {groups.map((group, groupIndex) => (
                  <span className="ribbon__group" key={groupIndex}>
                    {group.split('').map((character, characterIndex) => {
                      const positionNow = windowData.start + groupIndex * 10 + characterIndex;
                      const isTarget = positionNow >= targetStart && positionNow < targetEnd;
                      return (
                        <span className={'ribbon__digit' + (isTarget ? ' is-target' : '')} key={characterIndex}>
                          {character}
                        </span>
                      );
                    })}
                  </span>
                ))}
              </div>

              <div className="digits-panel__ruler mono" aria-hidden="true">
                <span>第 {formatNumber(windowData.start)} 位</span>
                <span className="digits-panel__ruler-line" />
                <span>第 {formatNumber(windowEnd)} 位</span>
              </div>

              {feynman ? (
                <p className="digits-panel__aside">
                  顺便：第 762 位起是 <span className="mono">999999</span>，也就是著名的费曼点。
                </p>
              ) : null}
            </>
          ) : null}

          <div className="digits-panel__actions">
            <button className="button" type="button" onClick={handleVerify} disabled={verifying || loading}>
              {verifying ? '复核中…' : verify ? '再复核一次' : '独立复核'}
            </button>
            <button className="button button--quiet" type="button" onClick={handleCopy}>
              {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              {copied ? '已复制' : '复制数字'}
            </button>
          </div>

          {verify ? (
            <p className={'verify ' + (verify.ok ? 'verify--ok' : 'verify--bad')} role="status">
              <span className="verify__dot" aria-hidden="true" />
              {verify.ok ? '复核一致' : '复核不一致'}
              <span className="verify__meta">
                独立取数 {formatNumber(position)} 起 {encoded.length} 位 · {formatCheckedAt(verify.checkedAt)}
              </span>
            </p>
          ) : null}
          {verify && !verify.ok ? (
            <p className="inline-error">复核拿到的是 {verify.digits}，与离线答案表不一致。</p>
          ) : null}
          {verifyError ? (
            <p className="inline-error" role="alert">
              复核没有完成：{verifyError}
            </p>
          ) : null}

          <p className="digits-panel__note">
            本地副本只覆盖前 100 万位；更深的位次按需从 api.pi.delivery 取回。复核请求与展示请求互相独立，避免把同一个缓存当成两次证据。
          </p>
        </div>
      )}
    </section>
  );
}
