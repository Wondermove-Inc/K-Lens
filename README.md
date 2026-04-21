<p align="center">
  <img src="k-lens/build/icons/128x128.png" alt="K-Lens Logo" width="128" height="128">
</p>

<h1 align="center">K-Lens</h1>

<p align="center">
  <strong>AI-Powered Kubernetes Management Desktop IDE</strong>
</p>

<p align="center">
  <a href="https://github.com/Wondermove-Inc/K-Lens/releases"><img src="https://img.shields.io/github/v/release/Wondermove-Inc/K-Lens?label=version&color=blue" alt="Version"></a>
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

<h3 align="center">Download</h3>
<p align="center">
  <a href="https://github.com/Wondermove-Inc/K-Lens/releases/download/v0.6.5/KLens-0.6.5-arm64.dmg">macOS ARM64 (.dmg)</a> ·
  <a href="https://github.com/Wondermove-Inc/K-Lens/releases/download/v0.6.5/KLens-0.6.5-x64.exe">Windows x64 (.exe)</a> ·
  <a href="https://github.com/Wondermove-Inc/K-Lens/releases/download/v0.6.5/KLens-0.6.5-x86_64.AppImage">Linux x64 (.AppImage)</a> ·
  <a href="https://github.com/Wondermove-Inc/K-Lens/releases/download/v0.6.5/KLens-0.6.5-amd64.deb">Linux x64 (.deb)</a> ·
  <a href="https://github.com/Wondermove-Inc/K-Lens/releases/download/v0.6.5/KLens-0.6.5-x86_64.rpm">Linux x64 (.rpm)</a>
</p>

> **macOS Note**: Since K-Lens is not signed with an Apple Developer certificate, macOS may block the app. Run the following command after downloading:
> ```bash
> xattr -dr com.apple.quarantine /path/to/KLens.app
> ```

---

### Demo

https://github.com/user-attachments/assets/a5c5d846-49e3-4b33-b368-bb4014782b66

---

## What is K-Lens?

> If `kubectl` is your CLI, **K-Lens is your cockpit.**

K-Lens turns Kubernetes management from terminal juggling into a visual, AI-assisted workflow — connect clusters, diagnose failures, and ship fixes without leaving your desk.

Built on [Open Lens](https://github.com/lensapp/lens), enhanced with AI-powered SRE diagnostics, security scanning, and real-time observability.

### Why K-Lens?

| Without K-Lens | With K-Lens |
|----------------|-------------|
| Multiple terminals running kubectl | Single UI for multi-cluster management |
| Manual failure analysis (logs + describe) | AI auto-diagnosis + remediation suggestions |
| Separate CVE scan tools, manual triage | One-click security scan + AI auto-fix proposals |
| Scattered Helm, YAML, monitoring tools | All-in-one integrated IDE |

### Key Features

#### 1. Multi-Cluster Management
Manage multiple Kubernetes clusters from a single interface.

<img src="docs/images/feature-multi-cluster.png" alt="Multi-Cluster Management" width="800">

#### 2. AI SRE Diagnostics
LangChain-based automatic failure analysis and remediation suggestions.

#### 3. Security Scan (DAIVE)
CVE/KSV vulnerability scanning with AI-powered auto-fix suggestions.

<img src="docs/images/feature-security-scan.png" alt="Security Scan" width="800">

#### 4. Real-time Monitoring
Resource visualization via Prometheus/Metrics Server integration.

#### 5. Integrated Terminal
Per-cluster kubectl sessions and Pod shell access.

#### 6. Helm Chart Management
Install, upgrade, and rollback Helm releases.

<img src="docs/images/feature-helm-chart.png" alt="Helm Chart Management" width="800">

#### 7. Resource Editor
Monaco Editor-based YAML editing with live apply.

<img src="docs/images/feature-resource-editor.png" alt="Resource Editor" width="800">

### DAIVE — Your AI SRE Co-pilot

> **Like Cursor for code, DAIVE is for Kubernetes — it diagnoses before you even ask.**

https://github.com/user-attachments/assets/85bb068e-c52d-475f-8914-68302af6d76a

DAIVE is K-Lens's built-in AI engine that acts as a senior SRE on your team. Powered by LangChain with multi-model support (Claude, GPT, Gemini), it provides:

| Capability | What it does |
|------------|-------------|
| **Troubleshooting** | Detects CrashLoopBackOff, OOMKilled, ImagePullBackOff, Pending pods — and cascading failures across layers |
| **Root Cause Analysis** | Systematic diagnosis using 5 Whys, RCA/Ishikawa, and hypothesis-based methods |
| **Security Scanning** | CVE/KSV vulnerability detection with tiered auto-fix proposals (Tier 1–3) |
| **Performance Optimization** | Right-sizing recommendations, HPA/VPA tuning, QoS analysis, and resource efficiency scoring |
| **FinOps & Cost Analysis** | Identifies idle resources, over-provisioned workloads, zombie resources with savings projections |
| **Cluster Assessment** | Full inventory reports — nodes, namespaces, autoscalers, CNI, service meshes, workload types |
| **Multi-Expert Synthesis** | Combines Security, Performance, and Reliability expert analyses into a unified prioritized report |
| **Custom Skills** | Ask DAIVE to create a skill for any task you want, and it builds a reusable command on the spot |

```
You: "Why is my pod crashing?"
DAIVE: Scans logs → checks events → analyzes resource limits → finds OOMKilled
     → recommends memory limit adjustment → offers to apply the fix
```

---

## Quick Start (macOS / Linux)

### Prerequisites

- **Node.js** >= 22.0.0
- **pnpm** 10.17.1
- **Git**

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Wondermove-Inc/Skuberplus-Client-Community.git
cd k-lens

# 2. Install dependencies (native module rebuild runs automatically)
pnpm install

# 3. Development build
pnpm build:dev

# 4. Start development server
pnpm dev
```

> **Note**: `pnpm install` automatically rebuilds Electron native modules.

> **Windows**: Native module builds require additional steps. See [Platform Builds > Windows](#windows-x64).

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

# Output: k-lens/dist/mac-arm64/KLens.app
```

### macOS (Intel x64)

```bash
# 1. Full x64 build (source build + app packaging)
pnpm build:full:x64

# 2. x64 app packaging only (source build already done)
pnpm build:app:darwin:x64

# Output: k-lens/dist/mac/KLens.app
```

### Linux

```bash
# 1. Source build
pnpm build

# 2. App packaging
cd k-lens
pnpm build:app:linux

# Output: k-lens/dist/linux-unpacked/
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

# Output: k-lens/dist/<version>/KLens-<version>-x64.exe
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
| macOS (ARM64) | `k-lens/dist/mac-arm64/KLens.app` |
| macOS (x64) | `k-lens/dist/mac/KLens.app` |
| Linux | `k-lens/dist/linux-unpacked/` |
| Windows | `k-lens/dist/<version>/KLens-<version>-x64.exe` |

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
k-lens/
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
├── k-lens/                             # Electron main application
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

- **Commit Messages**: Conventional Commits
- **File Structure**: `*.injectable.ts` suffix for injectables

### Cache Cleanup

If builds behave unexpectedly after source changes:

```bash
rm -rf packages/core/static/build k-lens/static/build \
       packages/core/.webpack k-lens/.webpack k-lens/dist
pnpm build:dev
```

---

## Roadmap

| Phase | Area | Description |
|-------|------|-------------|
| ✅ Done | AI Diagnostics | Post-incident AI analysis, root cause detection, remediation suggestions |
| ✅ Done | Security Scan | CVE/KSV vulnerability scanning with AI auto-fix proposals (DAIVE) |
| ✅ Done | k-o11y | Observability dashboard integration |
| 🚧 In Progress | AI Quality | Diagnostic accuracy improvements, response latency optimization |
| 🚧 In Progress | Performance | Large cluster handling, rendering optimization, memory efficiency |
| 📋 Planned | Real-time AI Monitoring | Live anomaly detection, predictive alerting, auto-scaling recommendations |
| 📋 Planned | AI Cost Optimize | Resource waste detection, right-sizing suggestions, cost forecasting |
| 💡 Exploring | Plugin Marketplace | Community-driven extension ecosystem |
| 💡 Exploring | Web Version | Browser-based K-Lens for team collaboration |

> Interested in a roadmap item? Fork the repo, improve or build the feature, and open a PR. Check [Issues](https://github.com/Wondermove-Inc/Skuberplus-Client-Community/issues) labeled `good first issue` or `help wanted` for entry points.

---

## Contributing

1. Fork and create a feature branch
2. Commit changes (Conventional Commits format)
3. Create a Pull Request

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for detailed guidelines.

### Issue Reporting

Please report bugs and feature requests on [GitHub Issues](https://github.com/Wondermove-Inc/Skuberplus-Client-Community/issues).

---

## Contributors

<table>
  <tr>
    <td align="center"><a href="https://github.com/wondermovestarlord"><img src="https://github.com/wondermovestarlord.png" width="80px;" alt=""/><br /><sub><b>wondermovestarlord</b></sub></a></td>
    <td align="center"><a href="https://github.com/wondermoveheimdall"><img src="https://github.com/wondermoveheimdall.png" width="80px;" alt=""/><br /><sub><b>wondermoveheimdall</b></sub></a></td>
    <td align="center"><a href="https://github.com/wonder-captain"><img src="https://github.com/wonder-captain.png" width="80px;" alt=""/><br /><sub><b>wonder-captain</b></sub></a></td>
    <td align="center"><a href="https://github.com/flash-wondermove"><img src="https://github.com/flash-wondermove.png" width="80px;" alt=""/><br /><sub><b>flash-wondermove</b></sub></a></td>
    <td align="center"><a href="https://github.com/ceo-tw"><img src="https://github.com/ceo-tw.png" width="80px;" alt=""/><br /><sub><b>ceo-tw</b></sub></a></td>
    <td align="center"><a href="https://github.com/SeulkiMantis"><img src="https://github.com/SeulkiMantis.png" width="80px;" alt=""/><br /><sub><b>SeulkiMantis</b></sub></a></td>
  </tr>
</table>

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Wondermove-Inc/K-Lens&type=Date)](https://star-history.com/#Wondermove-Inc/K-Lens&Date)

---

## Contact

- **Bug Reports & Feature Requests**: [GitHub Issues](https://github.com/Wondermove-Inc/K-Lens/issues)
- **Questions & Discussions**: [GitHub Discussions](https://github.com/Wondermove-Inc/K-Lens/discussions)
- **Website**: [skuberplus.com](https://www.skuberplus.com/)

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
  <sub>Built with love by <a href="https://www.skuberplus.com/">Wondermove Inc.</a></sub>
</p>
