# gpt-pro-consult (Claude Code plugin)

작업 중 **어려운 전략/아키텍처 결정이나 리서치 방향**이 필요할 때, 에이전트(Claude Code / Codex)가 웹 ChatGPT의 **GPT-5.5 Pro**에게 자문을 구하고 그 답변 전문을 로컬로 가져와 이어서 작업하게 해주는 스킬.

GPT-5.5 Pro는 API/CLI로는 못 쓰고 웹에서만 되기 때문에, 전용 Chrome 프로필(사용자 ChatGPT Pro 로그인 상태)을 Playwright로 구동해 프롬프트를 보내고 → 완료까지 기다린 뒤 → 답변을 마크다운으로 회수한다.

## 요구사항

- **Node 18+**
- **Google Chrome** 설치 (macOS / Windows)
- **ChatGPT Pro 계정** (강도 Pro 사용)

## 설치

```text
/plugin marketplace add Sioonn/gpt-pro-consult-plugin
/plugin install gpt-pro-consult@sionhyeop-skills
```

(GitHub 계정: Sioonn)

의존성(`playwright-core`)은 레포에 포함돼 있어 **별도 `npm install` 불필요**.

## 최초 1회: 로그인

처음 자문을 돌리면 Chrome 창이 뜬다. 거기서 **ChatGPT(Pro 계정)로 로그인**하면 이후 쿠키가 유지된다(`~/.claude/gpt-pro-consult-profile`, 플러그인 폴더 밖이라 업데이트에도 보존).

## 사용

- 사용자가 "GPT Pro에 자문 구해" 같이 **명시적으로 요청**하면 발동.
- 또는 오래 도는 자율 작업(/goal 등) 중 **리서치/큰 방향 결정**엔 적극적으로, 일반 코드 작업엔 정말 막혔을 때만 자동 발동.
- 자세한 동작·프롬프트 작성 가이드·자가수리 절차는 `skills/gpt-pro-consult/SKILL.md` 참조.

## UI가 바뀌어 깨지면 (자가 수리)

ChatGPT 웹 UI가 바뀌면 셀렉터가 깨질 수 있다. 에이전트가 `skills/gpt-pro-consult/inspect.mjs`로 실제 DOM을 덤프해 `selectors.mjs`를 **최소 수정**으로 고치도록 SKILL.md에 플레이북이 들어있다.

## 보안

- 로그인 쿠키는 플러그인 폴더 밖(`~/.claude/gpt-pro-consult-profile`)에 저장돼 **배포물에 절대 포함되지 않는다**.
- 이 레포를 클론/포크해 재배포할 때 그 프로필 폴더를 포함하지 말 것.

## 라이선스

MIT
