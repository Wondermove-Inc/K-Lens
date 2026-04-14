---
name: implement-feature
description: Agent Teams로 새 기능 구현
disable-model-invocation: true
---

## Agent Teams 워크플로우

이 스킬 호출 시 반드시 Agent Teams를 구성하세요:

### 1. 팀 구성
- **Generator**: `.claude/agents/generator.md` 기반 teammate 생성
- **Evaluator**: `.claude/agents/evaluator.md` 기반 teammate 생성
- **Tester**: `.claude/agents/tester.md` 기반 teammate 생성

### 2. Plan Approval
- Generator에게 plan approval 필수 설정
- 구현 전 계획을 Lead가 검토

### 3. 실행
1. Tester: AC 기반 테스트 먼저 작성 (TDD)
2. Generator: 코드 구현
3. Evaluator: 코드 리뷰 → 승인/거부
4. 피드백 루프 반복

### 4. 완료 조건
- Evaluator 승인
- `pnpm test:unit --bail` 통과
- `pnpm lint` 통과

### 사용법
```
/implement-feature 로그인 기능 구현
```
