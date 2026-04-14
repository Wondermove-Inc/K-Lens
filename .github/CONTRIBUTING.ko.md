# Contributing to Skuber+ Client

Skuber+ Client에 기여해 주셔서 감사합니다!

---

## 시작하기

### 개발 환경 설정

```bash
# 1. Fork 후 클론
git clone https://github.com/<your-username>/Skuberplus-Client-Community.git
cd Skuberplus-Client-Community

# 2. 의존성 설치
pnpm install

# 3. 개발 서버 실행
pnpm dev
```

### 요구 사항

- Node.js >= 22.0.0
- pnpm 10.17.1
- Git

---

## 기여 흐름

### 1. 브랜치 생성

```bash
git checkout main
git pull origin main
git checkout -b feature/my-feature
```

### 브랜치 네이밍

| 접두사 | 용도 | 예시 |
|--------|------|------|
| `feature/` | 새 기능 | `feature/inline-diff-preview` |
| `fix/` | 버그 수정 | `fix/streaming-memory-leak` |
| `refactor/` | 리팩토링 | `refactor/agent-store-mobx` |
| `docs/` | 문서 | `docs/api-reference-update` |
| `chore/` | 빌드/설정 | `chore/upgrade-electron-36` |

### 2. 변경 및 커밋

```bash
git add .
git commit -m "feat: 코드 블록 문법 강조 기능 추가"
```

#### 커밋 메시지 형식 (Conventional Commits)

```
<type>: <설명>
```

| Type | 설명 |
|------|------|
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `docs` | 문서 변경 |
| `refactor` | 리팩토링 |
| `test` | 테스트 추가/수정 |
| `chore` | 빌드/설정 변경 |
| `perf` | 성능 개선 |

### 3. PR 생성

```bash
git push -u origin feature/my-feature
gh pr create --title "feat: 코드 블록 문법 강조 기능"
```

---

## 코드 품질

PR 제출 전 아래 항목을 확인해 주세요:

```bash
pnpm lint          # 린트 검사
pnpm biome:check   # 코드 품질 + 포맷 검사
pnpm test:unit     # 유닛 테스트
pnpm build         # 빌드 확인
```

### 코드 컨벤션

- UI 텍스트(버튼, 라벨, 메시지 등)는 영어로 작성
- DI 패턴 사용: `*.injectable.ts` 접미사 필수
- 파일 크기 500줄 초과 시 분리

---

## PR 리뷰

- 최소 1명의 승인(Approve) 필요
- CI 테스트 통과 필수
- 모든 리뷰 코멘트 해결 필수

---

## 이슈 리포팅

- 버그 리포트나 기능 제안은 [GitHub Issues](https://github.com/Wondermove-Inc/Skuberplus-Client-Community/issues)에 등록해 주세요
- 보안 취약점은 [SECURITY.md](SECURITY.md)를 참고해 주세요

---

## 라이선스

기여하신 코드는 [MIT License](../LICENSE)에 따라 배포됩니다.
