import { describe, expect, it, vi } from 'vitest';
import { copyText, type CopyEnvironment } from '../src/lib/share';

function env(partial: CopyEnvironment): CopyEnvironment {
  return partial;
}

describe('复制分享链接', () => {
  it('异步剪贴板可用时直接用它，不碰兜底方案', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const legacyCopy = vi.fn(() => true);
    await expect(copyText('https://example.test/?date=2026-10-15', env({ clipboard: { writeText }, legacyCopy }))).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://example.test/?date=2026-10-15');
    expect(legacyCopy).not.toHaveBeenCalled();
  });

  it('剪贴板被拒绝时退回兜底方案', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('NotAllowedError')));
    const legacyCopy = vi.fn(() => true);
    await expect(copyText('x', env({ clipboard: { writeText }, legacyCopy }))).resolves.toBe(true);
    expect(legacyCopy).toHaveBeenCalledWith('x');
  });

  it('剪贴板被拒绝、兜底也失败时返回 false', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('NotAllowedError')));
    await expect(copyText('x', env({ clipboard: { writeText }, legacyCopy: () => false }))).resolves.toBe(false);
  });

  it('没有剪贴板对象（非安全上下文）时只用兜底方案', async () => {
    const legacyCopy = vi.fn(() => true);
    await expect(copyText('x', env({ clipboard: null, legacyCopy }))).resolves.toBe(true);
    expect(legacyCopy).toHaveBeenCalledTimes(1);
  });

  it('兜底方案抛异常按失败处理', async () => {
    await expect(
      copyText('x', env({ clipboard: null, legacyCopy: () => { throw new Error('boom'); } })),
    ).resolves.toBe(false);
  });

  it('两种方案都没有时返回 false', async () => {
    await expect(copyText('x', env({}))).resolves.toBe(false);
  });
});
