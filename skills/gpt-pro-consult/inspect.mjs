#!/usr/bin/env node
// 진단/자가수리 도구: 전용 프로필로 ChatGPT를 띄워 로그인을 기다린 뒤,
// 컴포저 주변 버튼/aria-haspopup 요소/강도 메뉴 항목을 덤프한다.
// UI가 바뀌어 consult.mjs가 깨졌을 때, 이 실측 덤프를 보고 selectors.mjs를 고친다.
// 결과: inspect-out/buttons.json + menu-*.json + *.png. 창은 끝나도 열어둔다(Ctrl+C 종료).

import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
// consult.mjs와 동일한 고정 프로필 위치(스킬 폴더 밖).
const PROFILE_DIR = join(homedir(), '.claude', 'gpt-pro-consult-profile');
const OUT = join(__dirname, 'inspect-out');
mkdirSync(OUT, { recursive: true });

// Chrome 경로 — macOS / Windows. CHROME_PATH env로 override.
function resolveChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (process.platform === 'win32') {
    const cands = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    ];
    return cands.find((p) => existsSync(p)) || cands[0];
  }
  if (process.platform === 'linux') {
    const cands = ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'];
    return cands.find((p) => existsSync(p)) || cands[0];
  }
  return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
}
const CHROME = resolveChrome();
const USE_SANDBOX = process.env.GPT_CONSULT_SANDBOX != null
  ? process.env.GPT_CONSULT_SANDBOX === '1'
  : process.platform !== 'linux';

const log = (...a) => process.stderr.write(a.join(' ') + '\n');
const LOGIN_WALL = ['button:has-text("로그인")', 'a:has-text("로그인")', 'button:has-text("Log in")'];
const COMPOSER = ['div#prompt-textarea[contenteditable="true"]', '[contenteditable="true"][role="textbox"]', '#prompt-textarea'];

async function visible(page, sels) {
  for (const s of sels) { try { if (await page.locator(s).first().isVisible()) return true; } catch {} }
  return false;
}

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false, executablePath: CHROME, chromiumSandbox: USE_SANDBOX,
  viewport: { width: 1280, height: 900 },
  args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check'],
});
const page = ctx.pages()[0] || await ctx.newPage();
page.setDefaultTimeout(15000);

log('ChatGPT 접속…');
await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' });

// 로그인 대기 (최대 10분)
const deadline = Date.now() + 10 * 60 * 1000;
let warned = false;
while (Date.now() < deadline) {
  const wall = await visible(page, LOGIN_WALL);
  const comp = await visible(page, COMPOSER);
  if (comp && !wall) break;
  if (!warned) { log('⚠ 창에서 로그인하세요 (최대 10분 대기)…'); warned = true; }
  await page.waitForTimeout(1500);
}
log('로그인 확인 — DOM 덤프 시작.');
await page.waitForTimeout(1500);

// 컴포저 후보 덤프 (contenteditable / textarea)
const composers = await page.$$eval('[contenteditable="true"], textarea', els => els.map(el => {
  const r = el.getBoundingClientRect();
  return {
    tag: el.tagName.toLowerCase(), id: el.id || null, name: el.getAttribute('name'),
    role: el.getAttribute('role'), ce: el.getAttribute('contenteditable'),
    cls: (el.className || '').toString().slice(0, 60), ph: el.getAttribute('placeholder'),
    visible: r.width > 1 && r.height > 1,
  };
}));
writeFileSync(join(OUT, 'composer.json'), JSON.stringify(composers, null, 2));
log('컴포저 후보:', JSON.stringify(composers.filter(c => c.visible)));

// 모든 버튼 덤프
const buttons = await page.$$eval('button, [role="button"]', els => els.map(el => {
  const r = el.getBoundingClientRect();
  return {
    text: (el.innerText || '').trim().slice(0, 40),
    aria: el.getAttribute('aria-label'),
    testid: el.getAttribute('data-testid'),
    haspopup: el.getAttribute('aria-haspopup'),
    x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
    visible: r.width > 0 && r.height > 0,
  };
}).filter(b => b.visible));

const popups = buttons.filter(b => b.haspopup);
const effortish = buttons.filter(b => /^(즉시|중간|높음|매우 높음|Pro|GPT|ChatGPT)/.test(b.text || ''));

writeFileSync(join(OUT, 'buttons.json'), JSON.stringify({ popups, effortish, all: buttons }, null, 2));
await page.screenshot({ path: join(OUT, 'inspect-buttons.png') });
log(`버튼 ${buttons.length}개 / haspopup ${popups.length}개 / effort후보 ${effortish.length}개 → inspect-out/buttons.json`);
log('haspopup 버튼:', JSON.stringify(popups));
log('effort 후보:', JSON.stringify(effortish));

// 강도 피커 추정 클릭 → 메뉴 항목 덤프
async function clickAndDumpMenu(loc, tag) {
  try {
    await loc.click({ timeout: 3000 });
    await page.waitForTimeout(700);
    const items = await page.$$eval('[role="menuitem"], [role="option"], [role="menuitemradio"]', els => els.map(el => ({
      role: el.getAttribute('role'),
      text: (el.innerText || '').trim().slice(0, 40),
      testid: el.getAttribute('data-testid'),
      aria: el.getAttribute('aria-label'),
    })));
    writeFileSync(join(OUT, `menu-${tag}.json`), JSON.stringify(items, null, 2));
    await page.screenshot({ path: join(OUT, `inspect-menu-${tag}.png`) });
    log(`[${tag}] 메뉴 항목 ${items.length}개:`, JSON.stringify(items));
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);
    return items;
  } catch (e) { log(`[${tag}] 클릭/덤프 실패:`, e.message); return []; }
}

// 후보1: 텍스트가 정확히 effort 라벨인 버튼
for (const label of ['Pro', '매우 높음', '높음', '중간', '즉시']) {
  const loc = page.getByRole('button', { name: label, exact: true });
  if (await loc.count()) { await clickAndDumpMenu(loc.first(), `exact-${label}`); break; }
}
// 후보2: haspopup=menu 버튼들 각각 (상위 4개)
let i = 0;
for (const b of popups) {
  if (b.testid) { await clickAndDumpMenu(page.locator(`[data-testid="${b.testid}"]`).first(), `popup-${i}-${b.testid}`); }
  else if (b.text) { await clickAndDumpMenu(page.getByRole('button', { name: b.text, exact: false }).first(), `popup-${i}`); }
  i++;
  if (i >= 4) break;
}

log('덤프 완료. inspect-out/ 확인. 창은 열어둠 — Ctrl+C로 종료.');
await new Promise(() => {});
