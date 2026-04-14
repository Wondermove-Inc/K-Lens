# skuber+ client Scripts 디렉토리

이 디렉토리는 skuber+ client 프로젝트의 빌드, 검증, 로깅 자동화를 위한 스크립트들을 포함합니다.

## 📋 스크립트 목록

### 🚀 빌드 관련

#### `build-full.js`
**전체 빌드 프로세스 통합 스크립트**

```bash
# 전체 빌드 (소스 → Storybook → 패키징 → 검증)
node scripts/build-full.js
# 또는
pnpm build:full

# Storybook 스킵 (앱만 빌드)
pnpm build:full:app
```

**실행 순서**:
1. 백그라운드 프로세스 자동 정리 (개발 서버 종료)
2. 소스 빌드 (`pnpm build`)
3. Storybook 빌드 (선택적)
4. Electron 앱 패키징 (`cd skuberplus && pnpm build:app`)
5. 빌드 경고/에러 수집 및 분석
6. 패키징된 앱 검증

**출력**:
- `skuberplus/dist/mac-arm64/skuber+ client.app` - 패키징된 Electron 앱
- `packages/storybook-shadcn/storybook-static/` - Storybook 정적 파일
- `build.log` - 전체 빌드 로그

**주요 기능**:
- Node.js v22 버전 체크 (v23 호환성 문제 방지)
- 백그라운드 프로세스 자동 종료 (SIGTERM → SIGKILL 2단계)
- 각 단계별 시간 측정 및 요약
- 실패 시 명확한 에러 메시지

#### `build-logger.js`
**표준 로깅 유틸리티**

```bash
node scripts/build-logger.js start "@skuberplus/core" "빌드 시작..."
node scripts/build-logger.js success "@skuberplus/core" "빌드 완료" 7.2
node scripts/build-logger.js error "skuberplus" "빌드 실패"
```

**기능**:
- 일관된 로그 형식 (`[시간] [패키지] [상태] 메시지`)
- 색상 지원 (CI 환경에서 자동 비활성화)
- 시간 측정 지원

**로그 형식**:
```
[10:23:45] [@skuberplus/core] [🚀 START] Pre-build starting...
[10:23:52] [@skuberplus/core] [✅ SUCCESS] Pre-build complete (7.2s)
```

---

### 🔍 검증 관련

#### `verify-packaged-app.js`
**패키징된 Electron 앱 종합 검증**

```bash
node scripts/verify-packaged-app.js
```

**검증 항목**:
1. **아키텍처 검증**: ARM64 바이너리 확인
   - `skuber+ client.app/Contents/Resources/app.asar.unpacked/node_modules/node-pty/build/Release/pty.node`
   - Kubernetes 바이너리 (kubectl, helm, skuberplus-k8s-proxy)

2. **앱 실행 테스트**: Chrome DevTools Protocol (CDP) 기반
   - 앱 자동 실행
   - 로그 수집
   - 크래시 감지
   - 안전한 종료

3. **필수 리소스 확인**: 패키징 파일 존재 여부

**실행 결과**:
- ✅ 성공: 모든 검증 통과
- ❌ 실패: 구체적인 오류 메시지 및 해결 방법 제공

#### `verify-build.js`
**빌드 결과물 기본 검증**

```bash
node scripts/verify-build.js
```

**검증 항목**:
1. **ARM64 아키텍처 바이너리**:
   - `node_modules/node-pty/build/Release/pty.node`
   - Kubernetes 바이너리

2. **Renderer 번들 모듈**:
   - 필수 모듈 (js-yaml, tar, byline 등) 포함 확인

3. **빌드 출력 파일**:
   - `skuberplus/static/build/main.js`
   - `skuberplus/static/build/renderer.js`
   - `skuberplus/static/build/renderer.css`

**특징**:
- 경고 발생 시에도 빌드 중단 없음
- `pnpm build` 후 자동 실행

#### `verify-architecture.sh`
**ARM64 아키텍처 빠른 검증 (Shell 스크립트)**

```bash
./scripts/verify-architecture.sh
```

**검증 항목**:
- node-pty ARM64 확인
- Kubernetes 바이너리 ARM64 확인

#### `verify-architecture-quick.js`
**ARM64 아키텍처 빠른 검증 (Node.js 버전)**

```bash
node scripts/verify-architecture-quick.js
```

**검증 항목**:
- node-pty ARM64 확인 (빠른 검증)

---

### 📊 분석 관련

#### `collect-build-warnings.js`
**빌드 경고/에러 자동 수집 및 분석**

```bash
node scripts/collect-build-warnings.js build.log
```

**기능**:
1. **로그 파일 분석**: `build.log`에서 경고 및 에러 추출
2. **패턴 매칭**: 알려진 경고/에러 패턴 인식
3. **해결 방법 제안**: 각 경고에 대한 해결 방법 제시
4. **요약 출력**: 심각도별 통계 (ERROR, WARNING, DEPRECATION)

**출력 예시**:
```
📊 빌드 경고/에러 요약:
  - ERROR: 2건
  - WARNING: 5건
  - DEPRECATION: 1건

🔍 상세 분석:
  [ERROR] Module not found: 'js-yaml'
  → 해결: webpack externals 설정 확인
```

#### `verify-app-health.js`
**앱 상태 상세 검증**

```bash
node scripts/verify-app-health.js
```

**검증 항목**:
- 앱 실행 가능 여부
- 필수 모듈 로딩 확인
- 에러 로그 수집

---

### 🎨 shadcn 마이그레이션

#### `ts-morph-universal-extractor.ts`
**React 컴포넌트 자동 분석 및 체크리스트 생성**

```bash
# 단일 컴포넌트 분석
pnpm tsx scripts/ts-morph-universal-extractor.ts \
  packages/core/src/renderer/components/layout/sidebar.tsx \
  docs/plan/active/features/sidebar-checklist.md
```

**기능**:
- UI elements, Props, Hooks, Event handlers, Business logic 자동 추출
- shadcn 특수 패턴 감지 (cva, Radix UI)
- Markdown 체크리스트 생성

**분석 항목**:
- UI 요소 (JSX elements)
- Props 인터페이스
- React Hooks (useState, useEffect, useMemo 등)
- 이벤트 핸들러
- 비즈니스 로직 함수
- 조건부 렌더링 (ternary, &&, if-return)
- 반복 렌더링 (.map(), .forEach())

#### `generate-all-checklists.sh`
**전체 10개 컴포넌트 체크리스트 일괄 생성**

```bash
./scripts/generate-all-checklists.sh
```

**생성 대상 컴포넌트**:
- sidebar, cluster-overview, welcome, cluster-metrics, table, menu, content, list, select, button

**소요 시간**: 약 3-4분

#### `measure-extraction-accuracy.ts`
**체크리스트 정확도 측정 및 JSON 생성**

```bash
# 단일 컴포넌트 측정
pnpm tsx scripts/measure-extraction-accuracy.ts \
  docs/plan/active/features/sidebar-checklist.md
```

**출력**:
- JSON 파일 (`sidebar-checklist-measurement.json`)
- 카테고리별 항목 개수
- 총 항목 수, 파일 크기, 라인 수

#### `measure-all-checklists.sh`
**전체 10개 컴포넌트 측정 일괄 실행**

```bash
./scripts/measure-all-checklists.sh
```

**소요 시간**: 약 1-2분

---

### 🔧 유틸리티

#### `check-node-version.js`
**Node.js 버전 검증**

```bash
node scripts/check-node-version.js
```

**기능**:
- Node.js v22 필수 확인
- v23에서 webpack-cli TypeScript config 로딩 오류 방지
- 실패 시 해결 방법 제공 (nvm 사용 안내)

#### `knip-install-missing-packages.sh`
**누락된 패키지 설치 (Knip 기반)**

```bash
./scripts/knip-install-missing-packages.sh
```

**기능**:
- Knip 분석을 통해 누락된 패키지 자동 설치

---

## 🎯 권장 사용 시나리오

### 일반 개발 작업

```bash
# 1. 의존성 설치
pnpm install

# 2. 개발 모드로 작업
pnpm dev

# 3. 빌드 및 검증
pnpm build
node scripts/verify-build.js
```

### 전체 빌드 및 배포 준비

```bash
# 한 번에 전체 빌드 + 패키징 + 검증
pnpm build:full

# 또는 Storybook 스킵 (빠른 빌드)
pnpm build:full:app
```

### ARM64 아키텍처 문제 해결

```bash
# 1. 빠른 아키텍처 검증
./scripts/verify-architecture.sh

# 2. 문제 발견 시 재빌드
pnpm install  # ARM64 네이티브 모듈 재컴파일
pnpm build

# 3. 상세 검증
node scripts/verify-packaged-app.js
```

### 빌드 경고/에러 분석

```bash
# 1. 전체 빌드 (로그 저장)
pnpm build:full

# 2. 로그 분석
node scripts/collect-build-warnings.js build.log
```

---

## 📚 관련 문서

### 프로젝트 문서
- **[CLAUDE.md](../CLAUDE.md)** - 프로젝트 전체 가이드
- **[docs/problem/README.md](../docs/problem/README.md)** - 빌드 문제 해결 가이드
- **[docs/problem/BUILD-ERROR-MAPPING.md](../docs/problem/BUILD-ERROR-MAPPING.md)** - 에러 매핑 가이드

### 빌드 문제 해결 문서
- **[2025-10-15-node-pty-arm64-architecture-mismatch.md](../docs/problem/2025-10-15-node-pty-arm64-architecture-mismatch.md)**
- **[2025-10-15-webpack-renderer-module-bundling.md](../docs/problem/2025-10-15-webpack-renderer-module-bundling.md)**
- **[2025-10-15-skuberplus-k8s-proxy-arm64-binary-missing.md](../docs/problem/2025-10-15-skuberplus-k8s-proxy-arm64-binary-missing.md)**

---

## 🛠️ 스크립트 분류

### 빌드 자동화
- `build-full.js` ⭐ 핵심
- `build-logger.js`

### 검증
- `verify-packaged-app.js` ⭐ 핵심
- `verify-build.js`
- `verify-architecture.sh`
- `verify-architecture-quick.js`
- `verify-app-health.js`

### 분석
- `collect-build-warnings.js`

### 유틸리티
- `check-node-version.js`
- `knip-install-missing-packages.sh`

---

## 🔍 주요 명령어 참고

```bash
# 빠른 빌드 (개발 모드)
pnpm build:dev

# 프로덕션 빌드
pnpm build

# 전체 빌드 + 패키징 + 검증
pnpm build:full

# 아키텍처 검증만
./scripts/verify-architecture.sh

# 패키징된 앱 검증
node scripts/verify-packaged-app.js

# 빌드 로그 분석
node scripts/collect-build-warnings.js build.log
```

---

**마지막 업데이트**: 2025-10-17
