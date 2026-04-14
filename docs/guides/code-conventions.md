# 코딩 컨벤션

## 파일 규칙

| 항목 | 규칙 |
|------|------|
| 파일 크기 | 500줄 초과 시 분리 |
| Injectable 파일명 | `feature-name.injectable.ts` (kebab-case) |
| 테스트 파일명 | `*.test.ts`, `*.test.tsx` |
| 언어 | 주석/문서는 한국어 |

## 네이밍 컨벤션

| 대상 | 규칙 | 예시 |
|------|------|------|
| Injectable ID | kebab-case | `"user-authentication"` |
| Injectable 변수 | camelCase + Injectable 접미사 | `userAuthInjectable` |
| 타입 | PascalCase | `UserProfile` |
| 파일 | kebab-case | `user-auth.injectable.ts` |
| 컴포넌트 | PascalCase | `UserProfileCard.tsx` |

## 의존성 방향

```
types → config → repo → service → runtime → ui
```

하위 레이어는 상위 레이어를 import할 수 없다.

## DI 패턴

- 모든 의존성은 `getInjectable()` + `di.inject()`으로 관리
- 직접 `import`로 구체 클래스 참조 금지
- 상세: `docs/architecture/di-patterns.md` 참조

## 린트

- `pnpm lint` = `trunk check`
- `pnpm lint:fix` = `trunk check --fix`
- 파일 수정 시 자동 실행 (PostToolUse Hook)

## Git 컨벤션

- 커밋 전 `pnpm test:unit --bail && pnpm lint` 필수
- 커밋 메시지: Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`)
