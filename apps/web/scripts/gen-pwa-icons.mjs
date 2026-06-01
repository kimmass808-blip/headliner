// 와이드 워드마크(headliner.png)를 ink-900 배경의 정사각 PWA 아이콘으로 변환한다.
// 일회성 생성 스크립트 — 아이콘 디자인이 바뀌면 다시 실행.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require('/Users/k5d/dev/mft/node_modules/.pnpm/sharp@0.34.5/node_modules/sharp');

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, '..', 'public');
const logo = path.join(publicDir, 'headliner.png');

const BG = { r: 10, g: 10, b: 10, alpha: 1 }; // #0a0a0a (ink-900)

async function makeIcon(size, { padRatio = 0.18, out }) {
  // 워드마크를 가로 기준 (1 - 2*padRatio) 폭으로 맞춰 중앙 배치.
  const targetW = Math.round(size * (1 - padRatio * 2));
  const mark = await sharp(logo).resize({ width: targetW, fit: 'inside' }).toBuffer();
  const meta = await sharp(mark).metadata();
  const left = Math.round((size - meta.width) / 2);
  const top = Math.round((size - meta.height) / 2);
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: mark, left, top }])
    .png()
    .toFile(path.join(publicDir, out));
  console.log(`wrote ${out} (${size}x${size})`);
}

await makeIcon(192, { out: 'icon-192.png' });
await makeIcon(512, { out: 'icon-512.png' });
// maskable: 세이프존 고려해 패딩을 더 크게.
await makeIcon(512, { padRatio: 0.28, out: 'icon-maskable-512.png' });
// iOS 홈화면 아이콘.
await makeIcon(180, { out: 'apple-touch-icon.png' });
