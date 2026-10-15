// 独立复核：不导入应用代码，自己按 MIT 文件重新找一遍「某天六种写法的首次出现位置」，
// 再用另一个数据源 api.pi.delivery 逐个验证位置对不对。
// 用法：node scripts/crosscheck.mjs [--date 2026-10-14] [--limit 10000000]
const MIT = 'https://stuff.mit.edu/afs/sipb/contrib/pi/pi-billion.txt';
const API = 'https://api.pi.delivery/v1/pi';
const CHUNK = 2_000_000;

const arg = (name, fallback) => {
  const index = process.argv.indexOf('--' + name);
  return index > -1 ? process.argv[index + 1] : fallback;
};

const dateArg = arg('date', new Date().toISOString().slice(0, 10));
const limit = Number(arg('limit', 10_000_000));
const [, y, m, d] = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateArg) ?? [];
if (!y) throw new Error('--date 需要 YYYY-MM-DD，例如 --date 2026-10-14');

const MM = m.padStart(2, '0');
const DD = d.padStart(2, '0');
const YYYY = y.padStart(4, '0');
const YY = YYYY.slice(-2);
const encodings = [
  ['YYYYMMDD', YYYY + MM + DD],
  ['MMDD', MM + DD],
  ['DDMM', DD + MM],
  ['YYMMDD', YY + MM + DD],
  ['MMDDYYYY', MM + DD + YYYY],
  ['DDMMYYYY', DD + MM + YYYY],
];
// 数字串相同的写法合并（例如 11 月 11 日 MMDD == DDMM）
const unique = new Map();
for (const [label, digits] of encodings) {
  const existing = unique.get(digits);
  if (existing) existing.labels.push(label);
  else unique.set(digits, { digits, labels: [label], first: null });
}
const needles = [...unique.values()];
const maxLen = Math.max(...needles.map((n) => n.digits.length));

console.log('日期 ' + dateArg + '，' + needles.length + ' 条数字串，本地扫描上限 ' + limit + ' 位');
console.log('本地只读 MIT 文件（与页面同一份数据），再用 api.pi.delivery 复核位置。\n');

let scanned = 0;
const started = Date.now();
while (scanned < limit) {
  const count = Math.min(CHUNK, limit - scanned);
  const from = scanned + 1;
  const startByte = from + 1;
  const endByte = startByte + count - 1;
  const response = await fetch(MIT, { headers: { Range: 'bytes=' + startByte + '-' + endByte } });
  if (!response.ok) throw new Error('上游 HTTP ' + response.status + '（字节 ' + startByte + '-' + endByte + '）');
  const text = (await response.text()).replace(/[^0-9]/g, '');
  for (const needle of needles) {
    if (needle.first !== null) continue;
    const index = text.indexOf(needle.digits);
    if (index !== -1) needle.first = from + index;
  }
  scanned += text.length;
  process.stdout.write('\r已扫描 ' + scanned.toLocaleString('en-US') + ' 位 — ' + needles.filter((n) => n.first !== null).length + '/' + needles.length + ' 已找到   ');
  if (needles.every((n) => n.first !== null)) break;
}
console.log('\n用时 ' + ((Date.now() - started) / 1000).toFixed(1) + ' 秒\n');

let failures = 0;
for (const needle of needles) {
  const label = needle.labels.join(' / ');
  if (needle.first === null) {
    console.log('· ' + label + ' (' + needle.digits + ')：前 ' + limit.toLocaleString('en-US') + ' 位内未出现');
    continue;
  }
  const response = await fetch(API + '?start=' + needle.first + '&numberOfDigits=' + needle.digits.length);
  const payload = await response.json().catch(() => ({}));
  const got = payload && payload.content;
  const ok = got === needle.digits;
  if (!ok) failures++;
  console.log('· ' + label + ' (' + needle.digits + ')：第 ' + needle.first.toLocaleString('en-US') + ' 位 → api.pi.delivery 返回 "' + (got ?? '?') + '" ' + (ok ? '✅ 一致' : '❌ 不一致'));
}

// 顺带验证一个固定锚点：费曼点 999999 应在小数点后第 762 位
const anchor = await (await fetch(API + '?start=762&numberOfDigits=6')).json();
const anchorOk = anchor.content === '999999';
if (!anchorOk) failures++;
console.log('\n锚点自检：第 762 位起 6 位 = "' + anchor.content + '" ' + (anchorOk ? '✅' : '❌ 期望 999999'));

console.log(failures === 0 ? '\n全部通过 ✅' : '\n有 ' + failures + ' 项不一致 ❌');
process.exit(failures === 0 ? 0 : 1);
