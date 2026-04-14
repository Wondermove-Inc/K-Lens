---
name: fix-issue
description: RCA 기반 버그 수정 워크플로우
disable-model-invocation: true
---

## RCA 기반 버그 수정

### Step 1: 격리/재현
1. `gh issue view <번호>` 또는 에러 메시지 확인
2. 에러 메시지/스택 트레이스로 관련 코드 검색
3. 재현 가능 여부 판단

### Step 2: 원인 식별 (5 Whys)
1. "왜 이 에러가 발생하는가?" → 직접 원인
2. "왜 그 코드가 그렇게 동작하는가?" → 로직 원인
3. "왜 그 로직이 존재하는가?" → 설계 원인
4. 근본 원인까지 추적 (최소 3단계)

### Step 3: 복잡도 판단 → 분기
- 1-2 파일 수정: 단독 진행
- 3+ 파일 또는 사이드 이펙트: Agent Teams 구성 (generator, evaluator, tester)

### Step 4: 수정 구현
- 재현 가능: 실패 테스트 작성 → 수정 → 통과
- 재현 불가: 원인 수정 → 회귀 테스트 확인
- 기존 패턴 유지, DI 패턴 준수 (`*.injectable.ts`)

### Step 5: 검증
- `bash scripts/quality-gate.sh` 실행
- 통과 후 커밋

### 사용법
```
/fix-issue 123
```
