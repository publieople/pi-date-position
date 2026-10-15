// 抓 MIT pi-billion.txt 的前 1,000,000 位小数，写成 public/pi-1m.txt。
// 这是「没有本机服务时」的降级数据源（也用于单测里的真数据锚点）。
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const UPSTREAM = 'https://stuff.mit.edu/afs/sipb/contrib/pi/pi-billion.txt';
const COUNT = 1_000_000;
const root = resolve(import.meta.dirname, '..');
const target = join(root, 'public', 'pi-1m.txt');

// 第 1 位小数 = 文件字节 2（字节 0 是整数位 3，字节 1 是小数点）
const start = 2;
const end = start + COUNT - 1;

const response = await fetch(UPSTREAM, { headers: { Range: 'bytes=' + start + '-' + end } });
if (!response.ok) throw new Error('上游返回 HTTP ' + response.status);
const text = (await response.text()).replace(/[^0-9]/g, '');
if (text.length !== COUNT) throw new Error('取回 ' + text.length + ' 位，期望 ' + COUNT);
if (text.slice(0, 10) !== '1415926535') throw new Error('开头不是 1415926535：' + text.slice(0, 10));

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, text + '\n');
console.log('已写入 ' + target + '（' + COUNT + ' 位，开头 ' + text.slice(0, 20) + '）');
