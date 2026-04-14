# Skuber+ Client

> AI 기반 Kubernetes 통합 관리 데스크톱 IDE

## Overview

Electron + React 기반 데스크톱 앱. Open Lens 포크에 AI SRE 진단 기능 추가.

## Project Structure

| Path | Type | Purpose |
|------|------|---------|
| `packages/core/` | Dir | 핵심 로직, UI, K8s API |
| `packages/technical-features/` | Dir | 메시징, 애플리케이션 코어 |
| `packages/ui-components/` | Dir | 공유 UI 컴포넌트 |
| `packages/infrastructure/` | Dir | 빌드 설정 (webpack, jest, ts) |
| `skuberplus/` | Dir | Electron 메인 앱 |
| `scripts/` | Dir | 빌드/유틸 스크립트 |

## Quick Reference

### Commands

```bash
pnpm install           # 의존성 설치
pnpm dev               # 개발 서버 (Hot Reload)
pnpm build             # 프로덕션 빌드
pnpm test:unit         # 유닛 테스트 (turbo)
pnpm lint              # 린트 검사
```

### Tech Stack

- **Runtime**: Electron 35.7.5 + Node 22
- **UI**: React 18.3 + MobX 6.13 + Tailwind 4.1
- **Language**: TypeScript 5.9
- **Build**: pnpm 10.17 + Webpack 5.101 + Turborepo
- **Test**: Jest 29.7 (maxWorkers: 2)
- **AI**: @langchain/core 1.1.39 + @langchain/anthropic 1.3.26

## Documentation Index

| 문서 | 위치 | 설명 |
|------|------|------|
| 아키텍처 규칙 | `docs/architecture/` | 의존성 방향, 레이어 제약 |
| 개발 가이드 | `docs/guides/` | DI 패턴, 코드 컨벤션 |
| AI 에이전트 | `.claude/agents/` | 서브 에이전트 정의 |
| 일회성 문서 | `docs/scratch/` | 분석 보고서, 완료된 계획서 (git 미추적) |

> **문서 생성 규칙**: 분석 보고서, 개선 제안서, 완료된 구현 계획 등 일회성 문서는 반드시 `docs/scratch/`에 생성하세요. 이 폴더는 `.gitignore`로 git에서 제외됩니다. `docs/architecture/`와 `docs/guides/`는 하네스용 영구 문서만 저장합니다.

## Constraints (Enforced)

1. **의존성 방향**: `types → config → repo → service → runtime → ui`
2. **파일 크기**: 500줄 초과 시 분리 필요
3. **언어**: 주석/문서는 한국어
4. **UI 언어**: 사용자에게 보여지는 UI 텍스트(버튼, 라벨, 메시지, 토스트, 다이얼로그 등)는 영어로 작성
5. **DI 패턴**: `*.injectable.ts` 접미사 필수

## Entry Points

- **Main Process**: `packages/core/src/main/`
- **Renderer Process**: `packages/core/src/renderer/`
- **AI Features**: `packages/core/src/features/ai-assistant/`

## 새 기능 구현 규칙 (필수)

새 기능/피처 구현 요청 시 반드시 Agent Teams를 사용하세요:

### 팀 구성
- **Generator**: 코드 작성 담당 (`.claude/agents/generator.md`)
- **Evaluator**: 코드 리뷰 담당 (`.claude/agents/evaluator.md`)
- **Tester**: 테스트 작성 담당 (`.claude/agents/tester.md`)

### 워크플로우
1. Plan approval 필수 - 구현 전 계획 검토
2. Evaluator 승인 전까지 Task 완료 불가
3. 모든 테스트 통과 + 린트 통과 필수
4. **모든 Task 완료 후** 전체 통합 검증 실행 필수: `bash scripts/quality-gate.sh`
5. 통합 검증 통과 후에만 커밋 가능

### 품질 검증 흐름 (quality-gate)
quality-gate.sh가 4단계 자동 검증을 수행합니다 (TaskCompleted 훅에서 자동 호출):
1. **사이드이펙트 검사** (`impact-check.sh`): tsc --noEmit + export 시그니처 변경 감지
2. **린트** (trunk check)
3. **biome** (코드 품질 + 포맷)
4. **유닛 테스트** (turbo)

실패 시 exit 2로 차단 → 에이전트가 오류 메시지를 보고 자동 수정 → Task 재완료 시 재실행.

> **주의**: 워크플로 내에서 `/check` 슬래시 커맨드를 호출하지 마세요.
> `/check`는 유저가 수동으로 사이드이펙트 보고서를 확인할 때만 사용합니다.
> 에이전트 간 자동 검증은 quality-gate의 impact-check.sh가 담당합니다.

### 트리거 키워드
다음 키워드 포함 시 Agent Teams 자동 구성:
- "기능 만들어", "feature", "구현해", "implement"
- "새로운", "추가해", "개발해"

## 버그 수정 규칙

### 기본 방법론: RCA (Root Cause Analysis)
1. **격리/재현**: 에러 메시지, 스택 트레이스 추적. 재현 가능하면 테스트 작성
2. **원인 식별**: 5 Whys 기법으로 근본 원인 추적 (표면 증상이 아닌 진짜 원인)
3. **수정**: 근본 원인 수정. 증상만 가리는 우회 금지
4. **검증**: 재현 테스트 통과 + 기존 테스트 회귀 없음 + quality-gate 통과

### 복잡도 판단
- **단순 버그** (1-2 파일, 명확한 원인): Lead 단독 수정
- **복잡 버그** (3+ 파일, 사이드 이펙트 우려): Agent Teams 구성
  - Generator: 원인 분석 + 수정
  - Tester: 재현 테스트 + 회귀 테스트
  - Evaluator: 수정 리뷰 + 사이드 이펙트 분석

### 재현 테스트 전략
- 재현 가능 → 실패하는 테스트 먼저 작성 → 수정 → 테스트 통과
- 재현 불가 (UI, 타이밍, IPC 등) → 원인 분석 후 수정 → 관련 영역 회귀 테스트로 대체

### 트리거 키워드
- "버그", "bug", "에러", "error", "고쳐", "fix", "수정해"
- "안돼", "안됨", "깨짐", "크래시", "crash"

### 필수 규칙
- 증상만 가리는 우회 수정 금지 (근본 원인 해결)
- 기존 테스트 회귀 없음 확인 필수
- quality-gate 통과 후에만 커밋 가능

---

*Context7 또는 docs/ 디렉토리 참조하여 상세 정보 확인*
