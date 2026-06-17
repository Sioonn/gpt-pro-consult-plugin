#!/usr/bin/env node
// gpt-pro-consult — 전용 Chrome 프로필로 ChatGPT(GPT-5.5 Pro)에 자문하고
// 응답 전문을 로컬에 저장한다. 일회성(매번 새 대화), 명시 호출 전용.
//
// 사용:
//   node consult.mjs --prompt-file q.md [--timeout 1500] [--model 5.5]
//   node consult.mjs --prompt "짧은 질문"
// 출력:
//   stdout 마지막 줄 = 저장된 response.md 절대경로
//   진행 로그 = stderr

import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import {
  URLS, SEL, EFFORT_TARGET, MODEL_SUBSTR,
  tryLocators, findEffortPicker,
} from './selectors.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// 프로필은 스킬 폴더 밖 고정 위치에 둔다 — 플러그인 업데이트에도 로그인 유지 +
// 배포물 안에 쿠키가 절대 포함되지 않음.
const PROFILE_DIR = join(homedir(), '.claude', 'gpt-pro-consult-profile');
const OUT_ROOT = join(homedir(), '.claude', 'gpt-pro-consults');

// Chrome 실행 파일 경로 — 배포 대상은 macOS / Windows 뿐. CHROME_PATH env로 override 가능.
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
  // macOS
  return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
}
const CHROME = resolveChrome();

// ---- 로깅 ----------------------------------------------------------------
const log = (...a) => process.stderr.write(`[${ts()}] ${a.join(' ')}\n`);
function ts() {
  const d = new Date();
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function fail(msg, code = 1) { log('ERROR:', msg); process.exit(code); }

// ---- 인자 파싱 -----------------------------------------------------------
function parseArgs(argv) {
  const a = { timeout: 1500, model: MODEL_SUBSTR, debug: false, keepOpen: false };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--prompt-file') a.promptFile = argv[++i];
    else if (k === '--prompt') a.prompt = argv[++i];
    else if (k === '--timeout') a.timeout = parseInt(argv[++i], 10);
    else if (k === '--model') a.model = argv[++i];
    else if (k === '--debug') a.debug = true;
    else if (k === '--keep-open') a.keepOpen = true;
    else fail(`unknown arg: ${k}`);
  }
  return a;
}

function slug(text) {
  return (text || 'consult')
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .slice(0, 40)
    .replace(/-+$/g, '') || 'consult';
}

// ---- 메인 ----------------------------------------------------------------
const args = parseArgs(process.argv);
const TIMEOUT_MS = Math.max(30, args.timeout) * 1000;

let prompt;
if (args.promptFile) {
  if (!existsSync(args.promptFile)) fail(`prompt file not found: ${args.promptFile}`);
  prompt = readFileSync(args.promptFile, 'utf8');
} else if (args.prompt) {
  prompt = args.prompt;
} else {
  fail('need --prompt-file <path> or --prompt "<text>"');
}
if (!prompt.trim()) fail('prompt is empty');

if (!existsSync(CHROME)) fail(`Chrome not found at ${CHROME} — install Google Chrome, or set CHROME_PATH env.`);

const outDir = join(OUT_ROOT, `${stamp()}-${slug(prompt.split('\n')[0])}`);
mkdirSync(outDir, { recursive: true });
mkdirSync(PROFILE_DIR, { recursive: true });
writeFileSync(join(outDir, 'prompt.md'), prompt, 'utf8');

const startedAt = new Date();
let ctx;
let timedOut = false;

try {
  log('Chrome 전용 프로필 기동 (headful)…');
  ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    executablePath: CHROME,
    chromiumSandbox: true, // Playwright 기본은 --no-sandbox(경고배너) → 샌드박스 켜서 제거
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check'],
  });
  try {
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://chatgpt.com' });
  } catch (e) { log('clipboard 권한 부여 경고:', e.message); }

  const page = ctx.pages()[0] || await ctx.newPage();
  page.setDefaultTimeout(15000);

  log('ChatGPT 접속…');
  await page.goto(URLS.base, { waitUntil: 'domcontentloaded' });

  // 로그인 체크 — 컴포저가 보이면 로그인됨.
  await waitForLogin(page);

  // 깨끗한 새 대화로.
  log('새 대화 시작…');
  await page.goto(URLS.newChat, { waitUntil: 'domcontentloaded' });
  const composer = await tryLocators(page, SEL.composer, { timeoutMs: 15000 });
  if (!composer) fail('컴포저를 찾지 못함 (셀렉터 갱신 필요 — selectors.mjs).');

  // 강도(effort) = Pro 선택 + 검증.
  await selectProEffort(page, args);

  // 베이스 모델 best-effort 확인 (검증 실패는 경고만).
  // (Pro 강도 검증이 하드 게이트. 모델 라벨은 서브메뉴라 신뢰도 낮음.)

  // 보낼 어시스턴트 턴 수 기록(새 응답 식별용).
  const beforeTurns = await countAssistant(page);

  // 프롬프트 주입 (contenteditable 안전 입력: Enter로 제출되지 않게 insertText).
  log(`프롬프트 입력 (${prompt.length}자)…`);
  await composer.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.insertText(prompt);
  await page.waitForTimeout(300);

  // 전송 — Enter가 아니라 전송 버튼 클릭(여러 줄 보존).
  log('전송…');
  const sendBtn = await tryLocators(page, SEL.sendButton, { timeoutMs: 5000 });
  if (sendBtn) await sendBtn.click();
  else { await composer.click(); await page.keyboard.press('Enter'); }

  // 완료 대기.
  await waitForCompletion(page, beforeTurns);

  // 응답 회수.
  const answer = await extractAnswer(page);
  if (!answer || !answer.trim()) {
    writeFileSync(join(outDir, 'response.md'), '(빈 응답 — 회수 실패)\n', 'utf8');
    writeMeta();
    fail('응답 회수 실패(빈 텍스트). 셀렉터 갱신 필요할 수 있음.', 2);
  }

  writeFileSync(join(outDir, 'response.md'), answer, 'utf8');
  writeMeta();
  log(`저장 완료: ${outDir}${timedOut ? ' (타임아웃 — 부분 응답)' : ''}`);

  // stdout 마지막 줄 = 결과 경로(에이전트가 이걸 읽음).
  process.stdout.write(join(outDir, 'response.md') + '\n');

  if (args.keepOpen) {
    log('--keep-open: 창 유지(셀렉터 점검용). 종료하려면 Ctrl+C.');
    await new Promise(() => {}); // 영원히 대기 → 창/연결 유지 (top-level이라 return 불가)
  }
  await ctx.close();
  process.exit(timedOut ? 3 : 0);

} catch (err) {
  log('예외:', err && err.stack ? err.stack : String(err));
  try { if (ctx) await page0Screenshot(ctx); } catch {}
  writeMeta(String(err && err.message || err));
  try { if (ctx && !args.keepOpen) await ctx.close(); } catch {}
  process.exit(1);
}

// ---- 단계 함수들 ---------------------------------------------------------

async function isLoginWall(page) {
  for (const sel of SEL.loginWall) {
    try { if (await page.locator(sel).first().isVisible()) return true; } catch {}
  }
  return false;
}

// 로그인 벽이 없고 컴포저가 보일 때 = 로그인됨. 그때까지 최대 10분 대기.
async function waitForLogin(page) {
  const deadline = Date.now() + 10 * 60 * 1000;
  let warned = false;
  while (Date.now() < deadline) {
    const wall = await isLoginWall(page);
    const composer = await tryLocators(page, SEL.composer, { timeoutMs: 1500 });
    if (composer && !wall) {
      if (warned) log('로그인 확인됨.');
      return;
    }
    if (!warned) {
      log('⚠ 로그인이 필요합니다. 열린 Chrome 창에서 ChatGPT(Pro 계정)에 로그인하세요. (최대 10분 대기)');
      warned = true;
    }
    await page.waitForTimeout(1500);
  }
  fail('로그인 확인 실패(타임아웃). 창에서 로그인 후 다시 실행하세요.');
}

async function selectProEffort(page, args) {
  log('강도 피커 열기…');
  const picker = await findEffortPicker(page, { timeoutMs: 10000 });
  if (!picker) fail('강도 피커 버튼을 찾지 못함 (selectors.mjs: findEffortPicker 갱신 필요).');

  const current = (await picker.innerText().catch(() => '')).trim();
  log(`현재 강도 표시: "${current}"`);
  await picker.click();
  await page.waitForTimeout(600);

  // 강도 항목은 role="menuitemradio"(즉시/중간/높음/매우 높음/Pro),
  // 베이스 모델은 같은 메뉴의 role="menuitem" "GPT-5.5".
  const itemTexts = await page.locator('[role="menuitemradio"], [role="menuitem"], [role="option"]')
    .allInnerTexts().catch(() => []);
  if (args.debug) log('DEBUG 메뉴 항목:', JSON.stringify(itemTexts));

  // 베이스 모델 best-effort 확인: 항목 중 "5.5"(=GPT-5.5)가 보이는지.
  const joined = itemTexts.join(' | ');
  if (joined.includes(args.model)) log(`베이스 모델 확인(부분일치 "${args.model}") OK.`);
  else log(`⚠ 메뉴에서 모델 "${args.model}" 미확인. 베이스 모델 수동 확인 권장(메뉴: ${joined.slice(0, 120)}).`);

  // "Pro" 강도 항목 클릭 (menuitemradio 우선).
  let clicked = false;
  for (const role of ['menuitemradio', 'menuitem', 'option']) {
    const item = page.getByRole(role, { name: EFFORT_TARGET, exact: true });
    if (await item.count()) { await item.first().click(); clicked = true; break; }
  }
  if (!clicked) {
    // 폴백: 메뉴 안의 정확히 "Pro" 텍스트 요소.
    const alt = page.locator('[role="menu"] *, [role="listbox"] *', { hasText: /^Pro$/ }).first();
    if (await alt.count()) { await alt.click(); clicked = true; }
  }
  if (!clicked) fail('강도 메뉴에서 "Pro" 항목을 찾지 못함 (selectors.mjs 갱신 필요).');
  await page.waitForTimeout(500);

  // 검증 게이트: 피커 버튼 텍스트가 "Pro"인지.
  const picker2 = await findEffortPicker(page, { timeoutMs: 5000 });
  const now = (picker2 ? await picker2.innerText().catch(() => '') : '').trim();
  if (!now.includes(EFFORT_TARGET)) {
    fail(`강도 검증 실패: 선택 후 피커가 "${now}" — "Pro" 아님. 엉뚱한 강도로 자문 방지 위해 중단.`);
  }
  log(`강도 = Pro 검증 완료.`);
}

async function countAssistant(page) {
  for (const sel of SEL.assistantTurn) {
    try { const n = await page.locator(sel).count(); if (n >= 0) return n; } catch {}
  }
  return 0;
}

async function assistantLast(page) {
  for (const sel of SEL.assistantTurn) {
    const loc = page.locator(sel);
    try { if (await loc.count()) return loc.last(); } catch {}
  }
  return null;
}

async function isStopVisible(page) {
  for (const sel of SEL.stopButton) {
    try { if (await page.locator(sel).first().isVisible()) return true; } catch {}
  }
  return false;
}

async function waitForCompletion(page, beforeTurns) {
  const start = Date.now();
  log('생성 시작 대기(Pro는 thinking이 길 수 있음)…');

  // 1) 생성 시작: 중지버튼 등장 또는 새 어시스턴트 턴 등장.
  let started = false;
  while (Date.now() - start < TIMEOUT_MS) {
    if (await isStopVisible(page)) { started = true; break; }
    if ((await countAssistant(page)) > beforeTurns) { started = true; break; }
    await page.waitForTimeout(500);
  }
  if (!started) { timedOut = true; log('⚠ 생성 시작 감지 못함(타임아웃).'); return; }
  log('생성 진행 중…');

  // 2) 완료: 중지버튼 사라짐 + 마지막 답변 텍스트가 STABLE_MS 동안 불변.
  const STABLE_MS = 10000;
  let lastLen = -1;
  let lastChange = Date.now();
  let lastLogged = 0;

  while (Date.now() - start < TIMEOUT_MS) {
    const stop = await isStopVisible(page);
    const last = await assistantLast(page);
    let len = 0;
    try { len = last ? (await last.innerText()).length : 0; } catch {}

    if (len !== lastLen) { lastLen = len; lastChange = Date.now(); }

    const elapsed = Math.round((Date.now() - start) / 1000);
    if (elapsed - lastLogged >= 15) { lastLogged = elapsed; log(`…진행 ${elapsed}s, 길이 ${len}, stop=${stop}`); }

    if (!stop && len > 0 && (Date.now() - lastChange) >= STABLE_MS) {
      log(`완료 감지 (${elapsed}s, ${len}자).`);
      return;
    }
    await page.waitForTimeout(2000);
  }
  timedOut = true;
  log('⚠ 하드 타임아웃 도달 — 그때까지의 응답을 저장.');
}

async function extractAnswer(page) {
  const last = await assistantLast(page);
  if (!last) return '';

  // 폴백 겸 길이 기준이 될 전체 텍스트(코드블록 포함 메시지 전체).
  let innerText = '';
  try { innerText = (await last.innerText()).trim(); } catch {}

  // 1순위: "턴 전체" 복사버튼 → 클립보드(마크다운 원문).
  // 코드블록별 복사버튼은 절대 쓰지 않음(한 블록만 복사돼 잘림).
  let clip = '';
  try {
    await last.hover().catch(() => {});       // 액션바가 호버 시 뜨는 경우 대비
    await page.waitForTimeout(400);
    let btn = null;
    for (const sel of SEL.copyTurnButton) {
      const g = page.locator(sel).last();      // 페이지의 마지막 = 가장 최근 답변의 턴 복사
      if (await g.count()) { btn = g; break; }
    }
    if (btn) {
      await btn.click();
      await page.waitForTimeout(400);
      clip = (await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')).trim();
    }
  } catch (e) { log('복사버튼 회수 경고:', e.message); }

  // 길이 가드: 클립보드가 충분히 길면 채택, 아니면(=코드블록 조각 등) innerText.
  if (clip && (clip.length >= innerText.length * 0.5 || clip.length >= 1500)) {
    log(`응답 회수: 턴 복사버튼→클립보드 (${clip.length}자, 마크다운).`);
    return clip;
  }
  if (innerText) {
    log(`응답 회수: innerText 폴백 (clip ${clip.length}자 < text ${innerText.length}자).`);
    return innerText;
  }
  return clip || '';
}

async function page0Screenshot(ctx) {
  const p = ctx.pages()[0];
  if (p) { await p.screenshot({ path: join(outDir, 'error.png'), fullPage: false }).catch(() => {}); log(`스크린샷: ${join(outDir, 'error.png')}`); }
}

function writeMeta(error) {
  const finishedAt = new Date();
  const meta = {
    model: `GPT-5.5 (effort=${EFFORT_TARGET})`,
    modelCheckSubstr: args.model,
    started: startedAt.toISOString(),
    finished: finishedAt.toISOString(),
    durationSec: Math.round((finishedAt - startedAt) / 1000),
    timedOut,
    timeoutSec: TIMEOUT_MS / 1000,
    outDir,
    ...(error ? { error } : {}),
  };
  try { writeFileSync(join(outDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8'); } catch {}
}
