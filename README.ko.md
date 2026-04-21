<p align="center">
  <img src="k-lens/build/icons/128x128.png" alt="K-Lens Logo" width="128" height="128">
</p>

<h1 align="center">K-Lens</h1>

<p align="center">
  <strong>AI 기반 Kubernetes 통합 관리 플랫폼</strong>
</p>

<p align="center">
  <a href="https://github.com/Wondermove-Inc/K-Lens/releases"><img src="https://img.shields.io/badge/version-0.6.5-blue.svg" alt="Version"></a>
  <a href="https://github.com/Wondermove-Inc/K-Lens/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg" alt="Node.js"></a>
  <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/electron-35.7.5-9feaf9.svg" alt="Electron"></a>
  <a href="https://github.com/Wondermove-Inc/K-Lens/stargazers"><img src="https://img.shields.io/github/stars/Wondermove-Inc/K-Lens?style=social" alt="Stars"></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.zh.md">中文</a>
</p>

<h3 align="center">다운로드</h3>
<p align="center">
  <a href="https://github.com/Wondermove-Inc/K-Lens/releases/download/v0.6.5/KLens-0.6.5-arm64.dmg">macOS ARM64 (.dmg)</a> ·
  <a href="https://github.com/Wondermove-Inc/K-Lens/releases/download/v0.6.5/KLens-0.6.5-x64.exe">Windows x64 (.exe)</a> ·
  <a href="https://github.com/Wondermove-Inc/K-Lens/releases/download/v0.6.5/KLens-0.6.5-x86_64.AppImage">Linux x64 (.AppImage)</a> ·
  <a href="https://github.com/Wondermove-Inc/K-Lens/releases/download/v0.6.5/KLens-0.6.5-amd64.deb">Linux x64 (.deb)</a> ·
  <a href="https://github.com/Wondermove-Inc/K-Lens/releases/download/v0.6.5/KLens-0.6.5-x86_64.rpm">Linux x64 (.rpm)</a>
</p>

> **macOS 참고**: K-Lens는 Apple 개발자 인증서로 서명되지 않아 macOS에서 앱이 차단될 수 있습니다. 다운로드 후 아래 명령어를 실행하세요:
> ```bash
> xattr -dr com.apple.quarantine /경로/KLens.app
> ```

---

### 데모

https://github.com/user-attachments/assets/a5c5d846-49e3-4b33-b368-bb4014782b66

---

## K-Lens란?

> `kubectl`이 CLI라면, **K-Lens는 조종석입니다.**

K-Lens는 Kubernetes 관리를 터미널 전환의 반복에서 시각적이고 AI가 보조하는 워크플로우로 바꿔줍니다 — 클러스터 연결, 장애 진단, 수정 적용까지 하나의 데스크톱 앱에서 완료하세요.

[Open Lens](https://github.com/lensapp/lens) 기반에 AI SRE 진단, 보안 스캔, 실시간 Observability를 강화했습니다.

### 왜 K-Lens인가?

| K-Lens 없이 | K-Lens와 함께 |
|-------------|--------------|
| 터미널 여러 개 띄워서 kubectl 반복 | 단일 UI에서 멀티 클러스터 관리 |
| 장애 원인 수동 분석 (logs + describe) | AI가 자동 진단 + 해결책 제안 |
| CVE 스캔 따로, 결과 해석 따로 | 원클릭 보안 스캔 + AI 자동 수정 제안 |
| Helm, YAML, 모니터링 도구 분산 | 하나의 IDE에 통합 |

### 주요 기능

#### 1. 멀티 클러스터 관리
여러 Kubernetes 클러스터를 단일 인터페이스에서 관리합니다.

<img src="docs/images/feature-multi-cluster.png" alt="멀티 클러스터 관리" width="800">

#### 2. AI SRE 진단
LangChain 기반 자동 장애 분석 및 해결책 제안.

#### 3. 보안 스캔 (DAIVE)
CVE/KSV 취약점 스캔, AI 기반 자동 수정 제안 및 적용.

<img src="docs/images/feature-security-scan.png" alt="보안 스캔" width="800">

#### 4. 실시간 모니터링
Prometheus/Metrics Server 연동 리소스 시각화.

#### 5. 통합 터미널
클러스터별 kubectl 세션 및 Pod 셸 접속.

#### 6. Helm 차트 관리
Helm 릴리즈 설치, 업그레이드, 롤백 지원.

<img src="docs/images/feature-helm-chart.png" alt="Helm 차트 관리" width="800">

#### 7. 리소스 편집기
Monaco Editor 기반 YAML 편집 및 실시간 적용.

<img src="docs/images/feature-resource-editor.png" alt="리소스 편집기" width="800">

### DAIVE — AI SRE 코파일럿

> **Cursor가 코드를 위한 AI라면, DAIVE는 Kubernetes를 위한 AI입니다 — 문제를 먼저 진단합니다.**

https://github.com/user-attachments/assets/85bb068e-c52d-475f-8914-68302af6d76a

DAIVE는 K-Lens에 내장된 AI 엔진으로, 시니어 SRE처럼 클러스터를 분석합니다. LangChain 기반으로 다양한 모델(Claude, GPT, Gemini)을 지원합니다.

| 기능 | 설명 |
|------|------|
| **트러블슈팅** | CrashLoopBackOff, OOMKilled, ImagePullBackOff, Pending 등 장애 자동 감지 및 연쇄 장애 분석 |
| **근본 원인 분석** | 5 Whys, RCA/Ishikawa, 가설 기반 테스트 등 체계적 진단 |
| **보안 스캔** | CVE/KSV 취약점 탐지 및 단계별 자동 수정 제안 (Tier 1–3) |
| **성능 최적화** | 리소스 Right-sizing, HPA/VPA 튜닝, QoS 분석, 리소스 효율 점수 제공 |
| **FinOps 비용 분석** | 유휴 리소스, 과다 할당 워크로드, 좀비 리소스 식별 및 절감 비용 추정 |
| **클러스터 평가** | 노드, 네임스페이스, 오토스케일러, CNI, 서비스 메시, 워크로드 타입 전체 인벤토리 리포트 |
| **멀티 전문가 종합** | 보안·성능·신뢰성 전문가 분석을 통합하여 우선순위별 리포트 생성 |
| **커스텀 스킬** | 원하는 작업을 스킬로 만들어달라고 요청하면 DAIVE가 재사용 가능한 명령으로 만들어줍니다 |

```
사용자: "왜 파드가 계속 크래시하나요?"
DAIVE: 로그 스캔 → 이벤트 확인 → 리소스 리밋 분석 → OOMKilled 발견
     → 메모리 리밋 조정 권고 → 수정 적용 제안
```

---

## 빠른 시작 (macOS / Linux)

### 요구 사항

- **Node.js** >= 22.0.0
- **pnpm** 10.17.1
- **Git**

### 설치 및 실행

```bash
# 1. 저장소 클론
git clone https://github.com/Wondermove-Inc/Skuberplus-Client-Community.git
cd k-lens

# 2. 의존성 설치 (네이티브 모듈 빌드 자동 수행)
pnpm install

# 3. 개발 빌드
pnpm build:dev

# 4. 개발 서버 실행
pnpm dev
```

> **참고**: `pnpm install` 실행 시 Electron 네이티브 모듈 재빌드가 자동으로 수행됩니다.

> **Windows**: 네이티브 모듈 빌드에 추가 작업이 필요합니다. [플랫폼별 빌드 > Windows](#windows-x64) 섹션을 참조하세요.

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

# 결과물: k-lens/dist/mac-arm64/KLens.app
```

### macOS (Intel x64)

```bash
# 1. x64 전체 빌드 (소스 빌드 + 앱 패키징)
pnpm build:full:x64

# 2. x64 앱 패키징만 (소스 빌드는 이미 완료된 상태)
pnpm build:app:darwin:x64

# 결과물: k-lens/dist/mac/KLens.app
```

### Linux

```bash
# 1. 소스 빌드
pnpm build

# 2. 앱 패키징
cd k-lens
pnpm build:app:linux

# 결과물: k-lens/dist/linux-unpacked/
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

# 결과물: k-lens/dist/<version>/KLens-<version>-x64.exe
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
| macOS (ARM64) | `k-lens/dist/mac-arm64/KLens.app` |
| macOS (x64) | `k-lens/dist/mac/KLens.app` |
| Linux | `k-lens/dist/linux-unpacked/` |
| Windows | `k-lens/dist/<version>/KLens-<version>-x64.exe` |

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
k-lens/
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
├── k-lens/                             # Electron 메인 애플리케이션
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
rm -rf packages/core/static/build k-lens/static/build \
       packages/core/.webpack k-lens/.webpack k-lens/dist
pnpm build:dev
```

---

## 로드맵

| 단계 | 영역 | 설명 |
|------|------|------|
| ✅ 완료 | AI 진단 | 사후 AI 분석, 근본 원인 탐지, 복구 방안 제안 |
| ✅ 완료 | 보안 스캔 | CVE/KSV 취약점 스캔 + AI 자동 수정 제안 (DAIVE) |
| ✅ 완료 | k-o11y | Observability 대시보드 통합 |
| 🚧 진행 중 | AI 품질 | 진단 정확도 향상, 응답 지연 최적화 |
| 🚧 진행 중 | 성능 개선 | 대규모 클러스터 처리, 렌더링 최적화, 메모리 효율화 |
| 📋 계획 | 실시간 AI 모니터링 | 실시간 이상 탐지, 예측 알림, 오토스케일링 추천 |
| 📋 계획 | AI Cost Optimize | 리소스 낭비 감지, 적정 사이징 제안, 비용 예측 |
| 💡 검토 중 | 플러그인 마켓플레이스 | 커뮤니티 기반 확장 생태계 |
| 💡 검토 중 | 웹 버전 | 팀 협업을 위한 브라우저 기반 K-Lens |

> 로드맵 항목에 관심이 있으신가요? Fork 후 기능을 개선하거나 구현해서 PR을 보내주세요. [Issues](https://github.com/Wondermove-Inc/Skuberplus-Client-Community/issues)에서 `good first issue` 또는 `help wanted` 라벨로 시작할 수 있습니다.

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
