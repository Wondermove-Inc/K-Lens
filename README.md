<p align="center">
  <img src="skuberplus/build/icons/128x128.png" alt="Skuber+ Logo" width="128" height="128">
</p>

<h1 align="center">Skuber+ Client</h1>

<p align="center">
  <strong>AI-Powered Kubernetes Management Desktop IDE</strong>
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

## Introduction

**Skuber+ Client** is a desktop IDE for intuitive Kubernetes cluster management. Built on [Open Lens](https://github.com/lensapp/lens), it adds AI-powered diagnostics, SRE automation, real-time monitoring, and enterprise features.

### Key Features

| Feature | Description |
|---------|-------------|
| **Multi-Cluster Management** | Manage multiple Kubernetes clusters from a single interface |
| **AI SRE Diagnostics** | LangChain-based automatic failure analysis and remediation suggestions |
| **Security Scan (DAIVE)** | CVE/KSV vulnerability scanning with AI-powered auto-fix suggestions |
| **Real-time Monitoring** | Resource visualization via Prometheus/Metrics Server integration |
| **Integrated Terminal** | Per-cluster kubectl sessions and Pod shell access |
| **Helm Chart Management** | Install, upgrade, and rollback Helm releases |
| **Resource Editor** | Monaco Editor-based YAML editing with live apply |

---

## Quick Start

### Prerequisites

- **Node.js** >= 22.0.0
- **pnpm** 10.17.1
- **Git**

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Wondermove-Inc/Skuberplus-Client-Community.git
cd skuberplus-client

# 2. Install dependencies (native module rebuild runs automatically)
pnpm install

# 3. Development build
pnpm build:dev

# 4. Start development server
pnpm dev
```

> **Note**: `pnpm install` automatically rebuilds Electron native modules.

> **Node.js version**: v22 (LTS) and v24+ (LTS) are supported. v23 is also supported via `.npmrc` config (`--no-experimental-strip-types`).

---

## Platform Builds

### macOS (ARM64 / Apple Silicon)

```bash
# 1. Full build (source build + app packaging)
pnpm build:full:app

# 2. Or step by step
pnpm build              # Source build
pnpm build:app          # App packaging (ARM64)

# Output: skuberplus/dist/mac-arm64/SkuberPlus.app
```

### macOS (Intel x64)

```bash
# 1. Full x64 build (source build + app packaging)
pnpm build:full:x64

# 2. x64 app packaging only (source build already done)
pnpm build:app:darwin:x64

# Output: skuberplus/dist/mac/SkuberPlus.app
```

### Linux

```bash
# 1. Source build
pnpm build

# 2. App packaging
cd skuberplus
pnpm build:app:linux

# Output: skuberplus/dist/linux-unpacked/
```

### Windows (x64)

On Windows, skip the `postinstall` script (macOS-only electron-rebuild) and manually build native modules.

**Prerequisites:**
- Node.js 22+
- Visual Studio Build Tools (C++ build tools)
- Python 3.x (node-gyp dependency)

```powershell
# 1. Install dependencies (skip postinstall - macOS-only electron-rebuild)
pnpm install --ignore-scripts

# 2. Patch node-pty for Windows (winpty.gyp path fix + GenVersion.h generation)
node scripts/fix-node-pty-windows.js

# 3. Build node-pty native module (using Electron headers)
cd node_modules/node-pty
pnpm dlx node-gyp rebuild --target=35.7.5 --arch=x64 --dist-url=https://electronjs.org/headers
cd ../..

# 4. Build clipboard-files native module
cd node_modules/clipboard-files
pnpm dlx node-gyp rebuild --target=35.7.5 --arch=x64 --dist-url=https://electronjs.org/headers
cd ../..

# 5. Source build (full workspace)
pnpm run build:win

# 6. App packaging
node scripts/build-windows-app.js

# Output: skuberplus/dist/<version>/SkuberPlusClient-<version>-x64.exe
```

> **Why `--ignore-scripts`?**
> The `postinstall` script runs `electron-rebuild` for macOS ARM64 only.
> On Windows, this step fails, so we skip it and manually build via `fix-node-pty-windows.js` patch followed by `node-gyp rebuild`.

> **If node-pty build fails:**
> ```powershell
> Remove-Item -Recurse -Force node_modules\node-pty
> pnpm install --ignore-scripts
> node scripts/fix-node-pty-windows.js
> cd node_modules/node-pty
> pnpm dlx node-gyp rebuild --target=35.7.5 --arch=x64 --dist-url=https://electronjs.org/headers
> cd ../..
> ```

### Build Output Paths

| Platform | Path |
|----------|------|
| macOS (ARM64) | `skuberplus/dist/mac-arm64/SkuberPlus.app` |
| macOS (x64) | `skuberplus/dist/mac/SkuberPlus.app` |
| Linux | `skuberplus/dist/linux-unpacked/` |
| Windows | `skuberplus/dist/<version>/SkuberPlusClient-<version>-x64.exe` |

---

## Command Reference

### Development

| Command | Description |
|---------|-------------|
| `pnpm install` | Install dependencies + native module build |
| `pnpm dev` | Start development server (Hot Reload) |
| `pnpm build:dev` | Development build |
| `pnpm build` | Production build |
| `pnpm build:full:app` | Full build (source + app packaging) |

### Testing & Quality

| Command | Description |
|---------|-------------|
| `pnpm lint` | Trunk-based lint check (shell, YAML, etc.) |
| `pnpm lint:fix` | Auto-fix lint issues |
| `pnpm biome:check` | Biome TS/JS code quality + format check |
| `pnpm biome:fix` | Biome auto-fix |
| `pnpm test:unit` | Run all unit tests (Turborepo) |
| `pnpm test:unit:core` | Core package tests |
| `pnpm test:integration` | Integration tests |

### Packaging

| Command | Description |
|---------|-------------|
| `pnpm build:full:app` | Full build (source + packaging, macOS ARM64) |
| `pnpm build:full:x64` | Full build (source + packaging, macOS x64) |
| `pnpm build:app` | App packaging only (macOS ARM64) |
| `pnpm build:app:darwin:x64` | App packaging only (macOS x64) |
| `pnpm build:win:x64` | Windows x64 build + packaging |

---

## Project Structure

```
skuberplus-client/
├── packages/                           # pnpm workspace packages (54)
│   ├── core/                           # Core logic, UI components, K8s API
│   ├── kube-object/                    # Kubernetes object models
│   ├── logger/                         # Logging utilities
│   │
│   ├── business-features/              # Business features
│   │   └── keyboard-shortcuts/         # Keyboard shortcuts
│   │
│   ├── technical-features/             # Technical features
│   │   ├── prometheus/                 # Prometheus integration
│   │   ├── kubernetes-metrics-server/  # Metrics Server integration
│   │   ├── messaging/                  # IPC messaging system
│   │   └── application/                # Application core
│   │
│   ├── utility-features/              # Utility features
│   │   ├── kube-api/                   # Kubernetes API client
│   │   ├── kube-api-specifics/         # K8s API specific logic
│   │   └── utilities/                  # Common utilities
│   │
│   ├── ui-components/                  # UI components
│   │   ├── button/                     # Button component
│   │   ├── icon/                       # Icon component
│   │   └── tooltip/                    # Tooltip component
│   │
│   └── infrastructure/                 # Infrastructure config
│       ├── webpack/                    # Webpack shared config
│       ├── typescript/                 # TypeScript shared config
│       └── jest/                       # Jest shared config
│
├── skuberplus/                         # Electron main application
│   ├── src/
│   │   ├── main/                       # Main process
│   │   ├── renderer/                   # Renderer process (React)
│   │   └── common/                     # Shared code
│   ├── webpack/                        # Webpack config
│   └── dist/                           # Build output
│
├── scripts/                            # Build/diagnostic/quality gate scripts
├── docs/                               # Documentation
│   ├── architecture/                   # Dependency rules, DI patterns
│   └── guides/                         # Coding conventions, test strategies
└── .claude/                            # AI agent harness config
    ├── agents/                         # Agent definitions (generator, evaluator, tester)
    └── settings.json                   # Hooks, environment variables
```

---

## Tech Stack

### Core

| Technology | Version | Purpose |
|------------|---------|---------|
| Electron | 35.7.5 | Desktop app framework |
| React | 18.3.1 | UI framework |
| TypeScript | 5.9 | Type system |
| MobX | 6.13 | State management |
| Tailwind CSS | 4.1 | Styling |

### AI/ML

| Technology | Version | Purpose |
|------------|---------|---------|
| @langchain/core | 1.1.39 | LLM integration framework |
| @langchain/anthropic | 1.3.26 | Claude model integration |
| @langchain/openai | 1.4.2 | OpenAI model integration |
| @langchain/google-genai | 2.1.26 | Gemini model integration |

### Infrastructure

| Technology | Version | Purpose |
|------------|---------|---------|
| pnpm | 10.17.1 | Package manager |
| Turborepo | 2.9.3 | Monorepo build/test orchestration |
| Webpack | 5.101 | Module bundler |
| Biome | 2.2.4 | TS/JS linter + formatter |
| Jest | 29.7 | Test framework |

### Bundled Binaries

| Tool | Version |
|------|---------|
| kubectl | 1.34.1 |
| Helm | 3.19.0 |

---

## Development Guide

### Dependency Injection (DI)

The project follows a DI pattern using `@ogre-tools/injectable`:

```typescript
// Injectable definition
const myServiceInjectable = getInjectable({
  id: "my-service",
  instantiate: (di) => new MyService(di.inject(loggerInjectable)),
});

// Feature registration
registerFeature(di, myFeature);
```

### Code Conventions

- **Comments/Docs**: Written in Korean
- **Commit Messages**: Conventional Commits
- **File Structure**: `*.injectable.ts` suffix for injectables

### Cache Cleanup

If builds behave unexpectedly after source changes:

```bash
rm -rf packages/core/static/build skuberplus/static/build \
       packages/core/.webpack skuberplus/.webpack skuberplus/dist
pnpm build:dev
```

---

## Contributing

1. Fork and create a feature branch
2. Commit changes (Conventional Commits format)
3. Create a Pull Request

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for detailed guidelines.

### Issue Reporting

Please report bugs and feature requests on [GitHub Issues](https://github.com/Wondermove-Inc/Skuberplus-Client-Community/issues).

---

## License

This project is based on [Open Lens](https://github.com/lensapp/lens).

```
Copyright (c) 2024-2026 Wondermove Inc.
Copyright (c) 2022 OpenLens Authors.

MIT License
```

See the [LICENSE](LICENSE) file for the full license text.

---

<p align="center">
  <sub>Built with love by <a href="https://wondermove.net">Wondermove Inc.</a></sub>
</p>
