import { formatCn, formatDot, toDateKey } from './date';
import { formatNumber } from './format';
import type { DateParts, Reading } from './types';
import type { Theme } from './theme';

export interface PosterInput {
  date: DateParts;
  reading: Reading;
  digits: string | null;
  start: number | null;
  url: string;
  theme: Theme;
}

const WIDTH = 1080;
const HEIGHT = 1350;
const SERIF = '"Fraunces Variable", Georgia, "Times New Roman", serif';
const MONO = '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace';
const SANS = '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif';

function font(weight: string, size: number, family: string): string {
  return weight + ' ' + size + 'px ' + family;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max - 1) + '…';
}

export async function loadPosterFonts(): Promise<void> {
  if (!document.fonts) {
    return;
  }
  await Promise.all([
    document.fonts.load(font('600', 160, SERIF)),
    document.fonts.load(font('italic 500', 30, SERIF)),
    document.fonts.load(font('500', 30, MONO)),
  ]);
  await document.fonts.ready;
}

function drawRibbon(
  ctx: CanvasRenderingContext2D,
  reading: Reading,
  digits: string | null,
  start: number | null,
  ink: string,
  paper: string,
  muted: string,
  vermilion: string,
  line: string,
) {
  const position = reading.position;
  if (position === null) {
    return;
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = muted;
  ctx.font = font('500', 15, MONO);
  ctx.fillText('IN CONTEXT', 80, 744);

  if (digits === null || start === null) {
    ctx.fillStyle = ink;
    ctx.font = font('500', 42, MONO);
    ctx.fillText(reading.encoded, 80, 810);
    ctx.fillStyle = muted;
    ctx.font = font('500', 18, SANS);
    ctx.fillText('数字带在离线时也能生成；联网后可在网页上复核。', 80, 850);
    return;
  }

  const ribbonStart = Math.max(1, position - 8);
  const offset = ribbonStart - start;
  if (offset < 0 || offset + 30 > digits.length) {
    return;
  }
  const ribbon = digits.slice(offset, offset + 30);
  const panel = ctx.createLinearGradient(80, 760, 1000, 920);
  panel.addColorStop(0, ink);
  panel.addColorStop(1, ink);
  ctx.fillStyle = panel;
  roundedRect(ctx, 80, 760, 920, 196, 8);
  ctx.fill();

  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  roundedRect(ctx, 80.5, 760.5, 919, 195, 8);
  ctx.stroke();

  ctx.fillStyle = paper;
  ctx.font = font('500', 30, MONO);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 10; column += 1) {
      const index = row * 10 + column;
      const digit = ribbon[index];
      if (!digit) {
        continue;
      }
      const absolute = ribbonStart + index;
      const isTarget = absolute >= position && absolute < position + reading.encoded.length;
      ctx.fillStyle = isTarget ? vermilion : paper;
      const x = 108 + column * 86;
      const y = 812 + row * 48;
      ctx.fillText(digit, x, y);
      if (isTarget) {
        ctx.fillStyle = vermilion;
        ctx.fillRect(x, y + 8, 32, 3);
      }
    }
  }

  ctx.fillStyle = muted;
  ctx.font = font('500', 14, MONO);
  ctx.textAlign = 'left';
  ctx.fillText('π · ' + formatNumber(ribbonStart) + ' — ' + formatNumber(ribbonStart + 29), 80, 994);
  ctx.textAlign = 'left';
}

function drawPoster(ctx: CanvasRenderingContext2D, input: PosterInput) {
  const { date, reading, theme } = input;
  const dark = theme === 'dark';
  const paper = dark ? '#0f1115' : '#f4f0e6';
  const ink = dark ? '#ede7da' : '#14161c';
  const muted = dark ? '#9aa0aa' : '#5a5e68';
  const vermilion = dark ? '#e0654c' : '#c4442c';
  const line = dark ? 'rgba(237, 231, 218, 0.18)' : 'rgba(20, 22, 28, 0.14)';
  const panelPaper = '#f4f0e6';

  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, 984, 1254);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = ink;
  ctx.font = font('600', 44, SERIF);
  ctx.fillText('π 日签', 80, 132);
  ctx.fillStyle = muted;
  ctx.font = font('500', 15, MONO);
  ctx.fillText('THE PI ALMANAC', 80, 164);

  ctx.textAlign = 'right';
  ctx.fillStyle = ink;
  ctx.font = font('italic 500', 32, SERIF);
  ctx.fillText(formatDot(date), 1000, 132);
  ctx.fillStyle = muted;
  ctx.font = font('500', 13, MONO);
  ctx.fillText('A DAILY READING', 1000, 160);

  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 190);
  ctx.lineTo(1000, 190);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = vermilion;
  ctx.font = font('500', 15, MONO);
  ctx.fillText("TODAY'S READING", 80, 240);

  ctx.fillStyle = ink;
  ctx.font = font('600', 44, SANS);
  ctx.fillText(formatCn(date), 80, 300);

  const position = reading.position;
  if (position === null) {
    ctx.fillStyle = ink;
    ctx.font = font('600', 128, SERIF);
    ctx.fillText('未出现', 80, 500);
    ctx.fillStyle = muted;
    ctx.font = font('500', 22, SANS);
    ctx.fillText('在前 10 亿位内，这串数字没有出现。', 80, 550);
  } else {
    const positionText = formatNumber(position);
    let size = 160;
    ctx.font = font('600', size, SERIF);
    while (ctx.measureText(positionText).width > 760 && size > 88) {
      size -= 4;
      ctx.font = font('600', size, SERIF);
    }
    const width = ctx.measureText(positionText).width;
    ctx.fillStyle = muted;
    ctx.font = font('500', 28, SANS);
    ctx.fillText('第', 80, 512);
    const leadWidth = ctx.measureText('第').width;
    const numberX = 80 + leadWidth + 18;
    ctx.fillStyle = ink;
    ctx.font = font('600', size, SERIF);
    ctx.fillText(positionText, numberX, 512);
    ctx.fillStyle = muted;
    ctx.font = font('500', 28, SANS);
    ctx.fillText('位', numberX + width + 22, 512);
    ctx.fillStyle = muted;
    ctx.font = font('500', 22, SANS);
    ctx.fillText('首次出现在 π 的小数点后', 80, 558);
  }

  ctx.fillStyle = vermilion;
  ctx.fillRect(80, 592, 10, 10);
  ctx.fillStyle = ink;
  ctx.font = font('500', 23, MONO);
  ctx.fillText(reading.label + ' · ' + reading.encoded, 104, 604);

  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 632);
  ctx.lineTo(1000, 632);
  ctx.stroke();

  const stats = [
    { label: '前 10 亿位内', value: reading.count === null ? '—' : formatNumber(reading.count) + ' 次' },
    { label: '扫描深度', value: '10 亿位' },
    { label: '取数口径', value: '完整落点' },
  ];
  stats.forEach((stat, index) => {
    const x = 80 + index * 310;
    ctx.fillStyle = muted;
    ctx.font = font('500', 13, MONO);
    ctx.fillText(stat.label, x, 676);
    ctx.fillStyle = ink;
    ctx.font = font('600', 24, SANS);
    ctx.fillText(stat.value, x, 706);
  });

  drawRibbon(ctx, reading, input.digits, input.start, ink, panelPaper, muted, vermilion, line);

  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = ink;
  ctx.font = font('600', 340, SERIF);
  ctx.textAlign = 'right';
  ctx.fillText('π', 1020, 1240);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.fillStyle = muted;
  ctx.font = font('500', 16, MONO);
  ctx.fillText(truncate(input.url, 56), 80, 1212);
  ctx.font = font('500', 14, SANS);
  ctx.fillText('10 亿位离线答案表 · 纯静态 · 生成于 ' + formatDot(date), 80, 1240);

  ctx.fillStyle = vermilion;
  ctx.fillRect(80, 1264, 42, 3);
  ctx.fillStyle = muted;
  ctx.font = font('500', 12, MONO);
  ctx.fillText('A SMALL RITUAL, EVERY DAY', 136, 1270);
}

export async function downloadPoster(input: PosterInput): Promise<void> {
  await loadPosterFonts();
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('浏览器无法创建海报画布');
  }
  drawPoster(ctx, input);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((next) => resolve(next), 'image/png');
  });
  if (!blob) {
    throw new Error('海报生成失败');
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'pi-almanac-' + toDateKey(input.date) + '.png';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
