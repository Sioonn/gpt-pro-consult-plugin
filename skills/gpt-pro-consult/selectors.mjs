// ChatGPT DOM 셀렉터 모음 — UI가 바뀌면 이 파일만 고치면 된다.
//
// 설계 원칙: 각 요소마다 후보 셀렉터 배열을 두고, 순서대로 시도해 처음
// 보이는 것을 쓴다(tryLocators). data-* 속성처럼 오래 안정적인 앵커를
// 우선하고, 보이는 텍스트(한국어 UI 기준)를 폴백으로 둔다.
//
// 2026-06-17 스크린샷 기준 사실:
//   - 컴포저 placeholder: "무엇이든 물어보세요"
//   - 새 채팅 사이드바 메뉴: "새 채팅"
//   - 강도(지능) 피커 버튼에 현재 강도가 표시됨(예: "Pro")
//   - 피커 메뉴 항목: 즉시 / 중간 / 높음 / 매우 높음 / Pro(✓) / GPT-5.5(서브메뉴)
//   - 계정 영역에 "Pro" 뱃지(로그인 판별 보조)

export const URLS = {
  base: 'https://chatgpt.com/',
  newChat: 'https://chatgpt.com/',
};

// 강도(effort) 라벨. 우리가 원하는 건 "Pro".
export const EFFORT_TARGET = 'Pro';
export const EFFORT_LABELS = ['즉시', '중간', '높음', '매우 높음', 'Pro'];

// 원하는 베이스 모델(부분 일치로 검증).
export const MODEL_SUBSTR = '5.5';

// 한 요소에 대한 후보 셀렉터들. tryLocators가 순서대로 시도한다.
// 값은 page.locator()에 넣을 CSS/Playwright 셀렉터 문자열.
export const SEL = {
  // 프롬프트 입력창. 실측(2026-06-17): 보이는 입력창은 ProseMirror
  // contenteditable div(#prompt-textarea, role=textbox). 같은 name의
  // <textarea>도 있으나 숨김(fallback)이라 절대 잡으면 안 됨 → contenteditable만.
  composer: [
    'div#prompt-textarea[contenteditable="true"]',
    '#prompt-textarea[contenteditable="true"]',
    'div.ProseMirror[contenteditable="true"]',
    '[contenteditable="true"][role="textbox"]',
  ],

  // 전송 버튼 (idle 상태 판별용)
  sendButton: [
    '[data-testid="send-button"]',
    'button[aria-label="프롬프트 보내기"]',
    'button[aria-label*="보내기"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label*="Send"]',
  ],

  // 생성 중지 버튼 (생성 진행 판별용)
  stopButton: [
    '[data-testid="stop-button"]',
    'button[aria-label*="중지"]',
    'button[aria-label="스트리밍 중지"]',
    'button[aria-label="Stop streaming"]',
    'button[aria-label*="Stop"]',
  ],

  // 어시스턴트 메시지 컨테이너 (가장 안정적인 앵커)
  assistantTurn: [
    '[data-message-author-role="assistant"]',
    'div[data-message-author-role="assistant"]',
  ],

  // "턴(메시지) 전체" 복사 버튼 — 마크다운 원문 회수용.
  // ⚠ 코드블록마다 있는 복사버튼(aria-label "복사")과 반드시 구분할 것.
  // 그걸 누르면 코드블록 하나만 복사돼 응답이 잘린다(실제 버그였음).
  // 그래서 턴 단위 testid만 사용하고, 실패 시 consult.mjs가 innerText로 폴백한다.
  copyTurnButton: [
    '[data-testid="copy-turn-action-button"]',
  ],

  // 강도(effort) 피커 버튼 — 현재 강도 텍스트를 품고 있다.
  // getByRole('button') + 텍스트 매칭으로도 따로 잡으므로 여기엔 보조 후보만.
  effortPickerButton: [
    '[data-testid="model-switcher-dropdown-button"]',
    'button[aria-haspopup="menu"]',
  ],

  // 로그인 여부 보조 신호: 계정 메뉴/Pro 뱃지 등
  loggedInHints: [
    '#prompt-textarea',
    'textarea[data-testid="prompt-textarea"]',
    'nav [data-testid="accounts-profile-button"]',
  ],

  // 로그인 화면 신호
  loginWall: [
    'button:has-text("로그인")',
    'a:has-text("로그인")',
    'button:has-text("Log in")',
    '[data-testid="login-button"]',
  ],
};

// 후보 셀렉터들을 순서대로 시도해 처음으로 "보이는" Locator를 반환.
// timeoutMs 안에 아무것도 못 찾으면 null.
export async function tryLocators(page, candidates, { timeoutMs = 8000, visible = true } = {}) {
  const deadline = Date.now ? null : null; // Date.now는 워크플로 외 일반 실행에선 사용 가능
  const start = nowMs();
  while (nowMs() - start < timeoutMs) {
    for (const sel of candidates) {
      const loc = page.locator(sel).first();
      try {
        const count = await loc.count();
        if (count > 0) {
          if (!visible) return loc;
          if (await loc.isVisible()) return loc;
        }
      } catch {
        // 잘못된 셀렉터/탈착 등은 무시하고 다음 후보로
      }
    }
    await page.waitForTimeout(250);
  }
  return null;
}

// 강도 피커 버튼을 찾는다.
// 실측(2026-06-17): 컴포저 우측의 button[aria-haspopup="menu"]이고 innerText가
// 현재 강도 라벨(예: "Pro")이다. testid/aria 없음. 프로필 버튼도 haspopup=menu라
// innerText가 "정확히" 강도 라벨인 것만 채택해 오인을 막는다.
export async function findEffortPicker(page, { timeoutMs = 8000 } = {}) {
  const start = nowMs();
  while (nowMs() - start < timeoutMs) {
    const btns = page.locator('button[aria-haspopup="menu"], [role="button"][aria-haspopup="menu"]');
    let n = 0;
    try { n = await btns.count(); } catch {}
    for (let i = 0; i < n; i++) {
      const b = btns.nth(i);
      try {
        if (!(await b.isVisible())) continue;
        const t = (await b.innerText()).trim();
        if (EFFORT_LABELS.includes(t)) return b;
      } catch {}
    }
    await page.waitForTimeout(250);
  }
  return null;
}

function nowMs() {
  // 일반 node 실행 환경에서는 Date.now 사용 가능.
  return Date.now();
}
