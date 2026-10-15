import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findOccurrencesInText, type Needle } from '../src/lib/searchCore';

const file = join(import.meta.dirname, '..', 'public', 'pi-1m.txt');
const available = existsSync(file);
const digits = available ? readFileSync(file, 'utf8').replace(/[^0-9]/g, '') : '';

// 真数据锚点：跑 pnpm fetch-fallback 之后才有 public/pi-1m.txt
describe.skipIf(!available)('真 π 数字（前 100 万位）', () => {
  it('文件是 100 万位且开头正确', () => {
    expect(digits.length).toBe(1_000_000);
    expect(digits.slice(0, 10)).toBe('1415926535');
  });

  it('1415926535 出现在小数点后第 1 位', () => {
    const needles: Needle[] = [{ id: '1415926535', digits: '1415926535' }];
    expect(findOccurrencesInText(digits, 1, needles)[0]?.position).toBe(1);
  });

  it('费曼点 999999 出现在小数点后第 762 位', () => {
    const needles: Needle[] = [{ id: '999999', digits: '999999' }];
    expect(findOccurrencesInText(digits, 1, needles)[0]?.position).toBe(762);
  });

  it('用 /api 的坐标口径交叉验证一个随机位置', () => {
    // api.pi.delivery start=999999999 返回 1964388311（前 100 万位够不到，这里只验证本文件的坐标换算）
    const start = 123_456;
    const slice = digits.slice(start - 1, start - 1 + 16);
    const needles: Needle[] = [{ id: 'x', digits: slice }];
    expect(findOccurrencesInText(digits, 1, needles)[0]?.position).toBe(start);
  });
});
