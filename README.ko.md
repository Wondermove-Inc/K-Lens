<p align="center">
  <img src="skuberplus/build/icons/128x128.png" alt="Skuber+ Logo" width="128" height="128">
</p>

<h1 align="center">Skuber+ Client</h1>

<p align="center">
  <strong>AI 기반 Kubernetes 통합 관리 플랫폼</strong>
</p>

<p align="center">
  <a href="https://github.com/Wondermove-Inc/Skuberplus-Client-Community/releases"><img src="https://img.shields.io/badge/version-0.6.5-blue.svg" alt="Version"></a>
  <a href="https://github.com/Wondermove-Inc/Skuberplus-Client-Community/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg" alt="Node.js"></a>
  <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/electron-35.7.5-9feaf9.svg" alt="Electron"></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.zh.md">中文</a>
</p>

---

## 소개

**Skuber+ Client**는 Kubernetes 클러스터를 직관적으로 관리할 수 있는 데스크톱 IDE입니다. [Open Lens](https://github.com/lensapp/lens)를 기반으로 AI 기반 진단, SRE 자동화, 실시간 모니터링 등 엔터프라이즈 기능을 추가했습니다.

### 주요 기능

| 기능 | 설명 |
|------|------|
| **멀티 클러스터 관리** | 여러 Kubernetes 클러스터를 단일 인터페이스에서 관리 |
| **AI SRE 진단** | LangChain 기반 자동 장애 분석 및 해결책 제안 |
| **보안 스캔 (DAIVE)** | CVE/KSV 취약점 스캔, AI 기반 자동 수정 제안 및 적용 |
| **실시간 모니터링** | Prometheus/Metrics Server 연동 리소스 시각화 |
| **통합 터미널** | 클러스터별 kubectl 세션 및 Pod 셸 접속 |
| **Helm 차트 관리** | Helm 릴리즈 설치, 업그레이드, 롤백 지원 |
| **리소스 편집기** | Monaco Editor 기반 YAML 편집 및 실시간 적용 |

---

## 빠른 시작

### 요구 사항

- **Node.js** >= 22.0.0
- **pnpm** 10.17.1
- **Git**

### 설치 및 실행

```bash
# 1. 저장소 클론
git clone https://github.com/Wondermove-Inc/Skuberplus-Client-Community.git
cd skuberplus-client

# 2. 의존성 설치 (네이티브 모듈 빌드 자동 수행)
pnpm install

# 3. 개발 빌드
pnpm build:dev

# 4. 개발 서버 실행
pnpm dev
```

> **참고**: `pnpm install` 실행 시 Electron 네이티브 모듈 재빌드가 자동으로 수행됩니다.

> **Node.js 버전**: v22 (LTS)와 v24+ (LTS)를 지원합니다. v23도 `.npmrc` 설정(`--no-experimental-strip-types`)을 통해 지원됩니다.

---

## 플랫폼별 빌드

### macOS (ARM64 / Apple Silicon)

```bash
# 1. 전체 빌드 (소스 빌드 + 앱 패키징)
pnpm build:full:app

# 2. 또는 단계별 실행
pnpm build              # 소스 빌드
pnpm build:app          # 앱 패키징 (ARM64)

# 결과물: skuberplus/dist/mac-arm64/SkuberPlus.app
```

### macOS (Intel x64)

```bash
# 1. x64 전체 빌드 (소스 빌드 + 앱 패키징)
pnpm build:full:x64

# 2. x64 앱 패키징만 (소스 빌드는 이미 완료된 상태)
pnpm build:app:darwin:x64

# 결과물: skuberplus/dist/mac/SkuberPlus.app
```

### Linux

```bash
# 1. 소스 빌드
pnpm build

# 2. 앱 패키징
cd skuberplus
pnpm build:app:linux

# 결과물: skuberplus/dist/linux-unpacked/
```

### Windows (x64)

Windows에서는 `postinstall` 스크립트(macOS 전용 electron-rebuild)를 스킵하고, 네이티브 모듈을 수동으로 빌드해야 합니다.

**사전 요구사항:**
- Node.js 22 이상
- Visual Studio Build Tools (C++ 빌드 도구)
- Python 3.x (node-gyp 의존)

```powershell
# 1. 의존성 설치 (postinstall 스킵 — macOS 전용 electron-rebuild 회피)
pnpm install --ignore-scripts

# 2. node-pty Windows 패치 (winpty.gyp 경로 수정 + GenVersion.h 생성)
node scripts/fix-node-pty-windows.js

# 3. node-pty 네이티브 모듈 빌드 (Electron 헤더 사용)
cd node_modules/node-pty
pnpm dlx node-gyp rebuild --target=35.7.5 --arch=x64 --dist-url=https://electronjs.org/headers
cd ../..

# 4. clipboard-files 네이티브 모듈 빌드
cd node_modules/clipboard-files
pnpm dlx node-gyp rebuild --target=35.7.5 --arch=x64 --dist-url=https://electronjs.org/headers
cd ../..

# 5. 소스 빌드 (전체 워크스페이스)
pnpm run build:win

# 6. 앱 패키징
node scripts/build-windows-app.js

# 결과물: skuberplus/dist/<version>/SkuberPlusClient-<version>-x64.exe
```

> **왜 `--ignore-scripts`인가?**
> `postinstall`은 macOS ARM64 환경 전용 `electron-rebuild`를 실행합니다.
> Windows에서는 이 단계가 실패하므로, 스킵 후 `fix-node-pty-windows.js` 패치 → `node-gyp rebuild` 순서로 수동 빌드합니다.

> **node-pty 빌드 실패 시:**
> ```powershell
> Remove-Item -Recurse -Force node_modules\node-pty
> pnpm install --ignore-scripts
> node scripts/fix-node-pty-windows.js
> cd node_modules/node-pty
> pnpm dlx node-gyp rebuild --target=35.7.5 --arch=x64 --dist-url=https://electronjs.org/headers
> cd ../..
> ```

### 패키징 결과물 경로

| 플랫폼 | 경로 |
|--------|------|
| macOS (ARM64) | `skuberplus/dist/mac-arm64/SkuberPlus.app` |
| macOS (x64) | `skuberplus/dist/mac/SkuberPlus.app` |
| Linux | `skuberplus/dist/linux-unpacked/` |
| Windows | `skuberplus/dist/<version>/SkuberPlusClient-<version>-x64.exe` |

---

## 명령어 참조

### 개발

| 명령어 | 설명 |
|--------|------|
| `pnpm install` | 의존성 설치 + 네이티브 모듈 빌드 |
| `pnpm dev` | 개발 서버 실행 (Hot Reload) |
| `pnpm build:dev` | 개발용 빌드 |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm build:full:app` | 전체 빌드 (소스 + 앱 패키징) |

### 테스트 및 품질

| 명령어 | 설명 |
|--------|------|
| `pnpm lint` | Trunk 기반 린트 검사 (shell, YAML 등) |
| `pnpm lint:fix` | 린트 자동 수정 |
| `pnpm biome:check` | Biome TS/JS 코드 품질 + 포맷 검사 |
| `pnpm biome:fix` | Biome 자동 수정 |
| `pnpm test:unit` | 전체 유닛 테스트 (Turborepo) |
| `pnpm test:unit:core` | Core 패키지 테스트 |
| `pnpm test:integration` | 통합 테스트 |

### 패키징

| 명령어 | 설명 |
|--------|------|
| `pnpm build:full:app` | 전체 빌드 (소스 + 앱 패키징, macOS ARM64) |
| `pnpm build:full:x64` | 전체 빌드 (소스 + 앱 패키징, macOS x64) |
| `pnpm build:app` | 앱 패키징만 (macOS ARM64) |
| `pnpm build:app:darwin:x64` | 앱 패키징만 (macOS x64) |
| `pnpm build:win:x64` | Windows x64 빌드 + 패키징 |

---

## 프로젝트 구조

```
skuberplus-client/
├── packages/                           # pnpm 워크스페이스 패키지 (54개)
│   ├── core/                           # 핵심 로직, UI 컴포넌트, K8s API
│   ├── kube-object/                    # Kubernetes 오브젝트 모델
│   ├── logger/                         # 로깅 유틸리티
│   ├── storybook-shadcn/               # ShadCN UI Storybook
│   │
│   ├── business-features/              # 비즈니스 기능
│   │   └── keyboard-shortcuts/         # 키보드 단축키
│   │
│   ├── technical-features/             # 기술 기능
│   │   ├── prometheus/                 # Prometheus 연동
│   │   ├── kubernetes-metrics-server/  # Metrics Server 연동
│   │   ├── messaging/                  # IPC 메시징 시스템
│   │   └── application/                # 애플리케이션 코어
│   │
│   ├── utility-features/               # 유틸리티 기능
│   │   ├── kube-api/                   # Kubernetes API 클라이언트
│   │   ├── kube-api-specifics/         # K8s API 특화 로직
│   │   └── utilities/                  # 공통 유틸리티
│   │
│   ├── ui-components/                  # UI 컴포넌트
│   │   ├── button/                     # 버튼 컴포넌트
│   │   ├── icon/                       # 아이콘 컴포넌트
│   │   └── tooltip/                    # 툴팁 컴포넌트
│   │
│   └── infrastructure/                 # 인프라 설정
│       ├── webpack/                    # Webpack 공통 설정
│       ├── typescript/                 # TypeScript 공통 설정
│       └── jest/                       # Jest 공통 설정
│
├── skuberplus/                         # Electron 메인 애플리케이션
│   ├── src/
│   │   ├── main/                       # Main 프로세스
│   │   ├── renderer/                   # Renderer 프로세스 (React)
│   │   └── common/                     # 공유 코드
│   ├── webpack/                        # Webpack 설정
│   └── dist/                           # 빌드 결과물
│
├── scripts/                            # 빌드/진단/품질 게이트 스크립트
├── docs/                               # 하네스/아키텍처 문서
│   ├── architecture/                   # 의존성 규칙, DI 패턴
│   ├── guides/                         # 코딩 컨벤션, 테스트 전략
│   └── scratch/                        # 일회성 문서 (git 미추적)
└── .claude/                            # AI 에이전트 하네스 설정
    ├── agents/                         # 에이전트 정의 (generator, evaluator, tester)
    └── settings.json                   # 훅, 환경변수
```

---

## 기술 스택

### 핵심

| 기술 | 버전 | 용도 |
|------|------|------|
| Electron | 35.7.5 | 데스크톱 앱 프레임워크 |
| React | 18.3.1 | UI 프레임워크 |
| TypeScript | 5.9 | 타입 시스템 |
| MobX | 6.13 | 상태 관리 |
| Tailwind CSS | 4.1 | 스타일링 |

### AI/ML

| 기술 | 버전 | 용도 |
|------|------|------|
| @langchain/core | 1.1.39 | LLM 통합 프레임워크 |
| @langchain/anthropic | 1.3.26 | Claude 모델 연동 |
| @langchain/openai | 1.4.2 | OpenAI 모델 연동 |
| @langchain/google-genai | 2.1.26 | Gemini 모델 연동 |

### 인프라

| 기술 | 버전 | 용도 |
|------|------|------|
| pnpm | 10.17.1 | 패키지 매니저 |
| Turborepo | 2.9.3 | 모노레포 빌드/테스트 오케스트레이션 |
| Webpack | 5.101 | 모듈 번들러 |
| Biome | 2.2.4 | TS/JS 린터 + 포매터 |
| Jest | 29.7 | 테스트 프레임워크 |

### 번들 바이너리

| 도구 | 버전 |
|------|------|
| kubectl | 1.34.1 |
| Helm | 3.19.0 |

---

## 개발 가이드

### 의존성 주입 (DI)

프로젝트는 `@ogre-tools/injectable`을 사용한 DI 패턴을 따릅니다:

```typescript
// 인젝터블 정의
const myServiceInjectable = getInjectable({
  id: "my-service",
  instantiate: (di) => new MyService(di.inject(loggerInjectable)),
});

// 피처 등록
registerFeature(di, myFeature);
```

### 코드 컨벤션

- **주석/문서**: 한국어 작성 필수
- **커밋 메시지**: Conventional Commits (한국어)
- **파일 구조**: `*.injectable.ts` 접미사로 인젝터블 표시

### 캐시 정리

소스 변경 후 빌드 이상 시:

```bash
rm -rf packages/core/static/build skuberplus/static/build \
       packages/core/.webpack skuberplus/.webpack skuberplus/dist
pnpm build:dev
```

---

## 기여하기

1. Fork 후 feature 브랜치 생성
2. 변경사항 커밋 (Conventional Commits 형식)
3. Pull Request 생성

### 이슈 리포팅

버그 리포트나 기능 제안은 [GitHub Issues](https://github.com/Wondermove-Inc/Skuberplus-Client-Community/issues)에 등록해 주세요.

---

## 라이선스

이 프로젝트는 [Open Lens](https://github.com/lensapp/lens)를 기반으로 합니다.

```
Copyright (c) 2024-2026 Wondermove Inc.
Copyright (c) 2022 OpenLens Authors.

MIT License
```

전체 라이선스는 [LICENSE](LICENSE) 파일을 참조하세요.

---

<p align="center">
  <sub>Built with ❤️ by <a href="https://wondermove.net">Wondermove Inc.</a></sub>
</p>
