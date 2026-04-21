<p align="center">
  <img src="k-lens/build/icons/128x128.png" alt="K-Lens Logo" width="128" height="128">
</p>

<h1 align="center">K-Lens</h1>

<p align="center">
  <strong>AI 驱动的 Kubernetes 管理桌面 IDE</strong>
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

<h3 align="center">下载</h3>
<p align="center">
  <a href="https://github.com/Wondermove-Inc/K-Lens/releases/download/v0.6.5/KLens-0.6.5-arm64.dmg">macOS ARM64 (.dmg)</a> ·
  <a href="https://github.com/Wondermove-Inc/K-Lens/releases/download/v0.6.5/KLens-0.6.5-x64.exe">Windows x64 (.exe)</a> ·
  <a href="https://github.com/Wondermove-Inc/K-Lens/releases/download/v0.6.5/KLens-0.6.5-x86_64.AppImage">Linux x64 (.AppImage)</a> ·
  <a href="https://github.com/Wondermove-Inc/K-Lens/releases/download/v0.6.5/KLens-0.6.5-amd64.deb">Linux x64 (.deb)</a> ·
  <a href="https://github.com/Wondermove-Inc/K-Lens/releases/download/v0.6.5/KLens-0.6.5-x86_64.rpm">Linux x64 (.rpm)</a>
</p>

> **macOS 注意**: K-Lens 未使用 Apple 开发者证书签名，macOS 可能会阻止应用运行。下载后请执行以下命令：
> ```bash
> xattr -dr com.apple.quarantine /路径/KLens.app
> ```

---

### 演示

https://github.com/user-attachments/assets/a5c5d846-49e3-4b33-b368-bb4014782b66

---

## K-Lens 是什么？

> 如果 `kubectl` 是你的 CLI，那么 **K-Lens 就是你的驾驶舱。**

K-Lens 将 Kubernetes 管理从终端切换的重复劳动转变为可视化、AI 辅助的工作流 — 连接集群、诊断故障、应用修复，全部在一个桌面应用中完成。

基于 [Open Lens](https://github.com/lensapp/lens)，增强了 AI SRE 诊断、安全扫描和实时 Observability。

### 为什么选择 K-Lens？

| 没有 K-Lens | 使用 K-Lens |
|-------------|------------|
| 多个终端重复执行 kubectl | 单一 UI 管理多集群 |
| 手动分析故障原因（logs + describe） | AI 自动诊断 + 修复建议 |
| CVE 扫描和结果分析分开进行 | 一键安全扫描 + AI 自动修复建议 |
| Helm、YAML、监控工具分散 | 集成在一个 IDE 中 |

### 主要功能

#### 1. 多集群管理
在单一界面中管理多个 Kubernetes 集群。

<img src="docs/images/feature-multi-cluster.png" alt="多集群管理" width="800">

#### 2. AI SRE 诊断
基于 LangChain 的自动故障分析与修复建议。

#### 3. 安全扫描 (DAIVE)
CVE/KSV 漏洞扫描，提供 AI 驱动的自动修复建议。

<img src="docs/images/feature-security-scan.png" alt="安全扫描" width="800">

#### 4. 实时监控
通过 Prometheus/Metrics Server 集成实现资源可视化。

#### 5. 集成终端
每个集群独立的 kubectl 会话与 Pod Shell 访问。

#### 6. Helm Chart 管理
安装、升级和回滚 Helm 发布。

<img src="docs/images/feature-helm-chart.png" alt="Helm Chart 管理" width="800">

#### 7. 资源编辑器
基于 Monaco Editor 的 YAML 编辑，支持实时应用。

<img src="docs/images/feature-resource-editor.png" alt="资源编辑器" width="800">

### DAIVE — AI SRE 副驾驶

> **Cursor 是代码的 AI，DAIVE 是 Kubernetes 的 AI — 先于你发现问题。**

https://github.com/user-attachments/assets/85bb068e-c52d-475f-8914-68302af6d76a

DAIVE 是 K-Lens 内置的 AI 引擎，如同资深 SRE 一样分析集群。基于 LangChain，支持多种模型（Claude、GPT、Gemini）。

| 功能 | 说明 |
|------|------|
| **故障排查** | 自动检测 CrashLoopBackOff、OOMKilled、ImagePullBackOff、Pending 等故障及级联故障分析 |
| **根因分析** | 5 Whys、RCA/Ishikawa、假设驱动测试等系统化诊断方法 |
| **安全扫描** | CVE/KSV 漏洞检测及分级自动修复建议（Tier 1–3） |
| **性能优化** | 资源 Right-sizing、HPA/VPA 调优、QoS 分析、资源效率评分 |
| **FinOps 成本分析** | 识别闲置资源、过度分配的工作负载、僵尸资源，并预估节省成本 |
| **集群评估** | 节点、命名空间、自动扩缩器、CNI、服务网格、工作负载类型的完整清单报告 |
| **多专家综合** | 整合安全、性能、可靠性专家分析，生成按优先级排列的统一报告 |
| **自定义技能** | 告诉 DAIVE 你需要的任务技能，它会为你创建可复用的命令 |

```
用户："为什么我的 Pod 一直崩溃？"
DAIVE：扫描日志 → 检查事件 → 分析资源限制 → 发现 OOMKilled
     → 建议调整内存限制 → 提供修复方案
```

---

## 快速开始 (macOS / Linux)

### 前置条件

- **Node.js** >= 22.0.0
- **pnpm** 10.17.1
- **Git**

### 安装

```bash
# 1. 克隆仓库
git clone https://github.com/Wondermove-Inc/Skuberplus-Client-Community.git
cd k-lens

# 2. 安装依赖（原生模块会自动重新编译）
pnpm install

# 3. 开发环境构建
pnpm build:dev

# 4. 启动开发服务器
pnpm dev
```

> **提示**：`pnpm install` 会自动重新编译 Electron 原生模块。

> **Windows**：原生模块构建需要额外步骤。请参阅 [平台构建 > Windows](#windows-x64)。

> **Node.js 版本**：支持 v22（LTS）和 v24+（LTS）。v23 也通过 `.npmrc` 配置（`--no-experimental-strip-types`）支持。

---

## 平台构建

### macOS (ARM64 / Apple Silicon)

```bash
# 1. 完整构建（源码编译 + 应用打包）
pnpm build:full:app

# 2. 或分步执行
pnpm build              # 源码编译
pnpm build:app          # 应用打包（ARM64）

# 输出路径：k-lens/dist/mac-arm64/KLens.app
```

### macOS (Intel x64)

```bash
# 1. 完整 x64 构建（源码编译 + 应用打包）
pnpm build:full:x64

# 2. 仅 x64 应用打包（源码已编译完成）
pnpm build:app:darwin:x64

# 输出路径：k-lens/dist/mac/KLens.app
```

### Linux

```bash
# 1. 源码编译
pnpm build

# 2. 应用打包
cd k-lens
pnpm build:app:linux

# 输出路径：k-lens/dist/linux-unpacked/
```

### Windows (x64)

在 Windows 上需要跳过 `postinstall` 脚本（仅适用于 macOS 的 electron-rebuild），并手动编译原生模块。

**前置条件：**
- Node.js 22+
- Visual Studio Build Tools（C++ 构建工具）
- Python 3.x（node-gyp 依赖）

```powershell
# 1. 安装依赖（跳过 postinstall —— 仅适用于 macOS 的 electron-rebuild）
pnpm install --ignore-scripts

# 2. 修补 node-pty 以适配 Windows（winpty.gyp 路径修复 + GenVersion.h 生成）
node scripts/fix-node-pty-windows.js

# 3. 编译 node-pty 原生模块（使用 Electron 头文件）
cd node_modules/node-pty
pnpm dlx node-gyp rebuild --target=35.7.5 --arch=x64 --dist-url=https://electronjs.org/headers
cd ../..

# 4. 编译 clipboard-files 原生模块
cd node_modules/clipboard-files
pnpm dlx node-gyp rebuild --target=35.7.5 --arch=x64 --dist-url=https://electronjs.org/headers
cd ../..

# 5. 源码编译（完整工作区）
pnpm run build:win

# 6. 应用打包
node scripts/build-windows-app.js

# 输出路径：k-lens/dist/<version>/KLens-<version>-x64.exe
```

> **为什么要使用 `--ignore-scripts`？**
> `postinstall` 脚本仅针对 macOS ARM64 运行 `electron-rebuild`。
> 在 Windows 上该步骤会失败，因此需要跳过并通过 `fix-node-pty-windows.js` 补丁后手动执行 `node-gyp rebuild`。

> **如果 node-pty 编译失败：**
> ```powershell
> Remove-Item -Recurse -Force node_modules\node-pty
> pnpm install --ignore-scripts
> node scripts/fix-node-pty-windows.js
> cd node_modules/node-pty
> pnpm dlx node-gyp rebuild --target=35.7.5 --arch=x64 --dist-url=https://electronjs.org/headers
> cd ../..
> ```

### 构建输出路径

| 平台 | 路径 |
|------|------|
| macOS (ARM64) | `k-lens/dist/mac-arm64/KLens.app` |
| macOS (x64) | `k-lens/dist/mac/KLens.app` |
| Linux | `k-lens/dist/linux-unpacked/` |
| Windows | `k-lens/dist/<version>/KLens-<version>-x64.exe` |

---

## 命令参考

### 开发

| 命令 | 说明 |
|------|------|
| `pnpm install` | 安装依赖 + 原生模块编译 |
| `pnpm dev` | 启动开发服务器（热重载） |
| `pnpm build:dev` | 开发环境构建 |
| `pnpm build` | 生产环境构建 |
| `pnpm build:full:app` | 完整构建（源码编译 + 应用打包） |

### 测试与质量保障

| 命令 | 说明 |
|------|------|
| `pnpm lint` | 基于 Trunk 的代码检查（Shell、YAML 等） |
| `pnpm lint:fix` | 自动修复代码检查问题 |
| `pnpm biome:check` | Biome TS/JS 代码质量 + 格式检查 |
| `pnpm biome:fix` | Biome 自动修复 |
| `pnpm test:unit` | 运行全部单元测试（Turborepo） |
| `pnpm test:unit:core` | Core 包测试 |
| `pnpm test:integration` | 集成测试 |

### 打包

| 命令 | 说明 |
|------|------|
| `pnpm build:full:app` | 完整构建（源码 + 打包，macOS ARM64） |
| `pnpm build:full:x64` | 完整构建（源码 + 打包，macOS x64） |
| `pnpm build:app` | 仅应用打包（macOS ARM64） |
| `pnpm build:app:darwin:x64` | 仅应用打包（macOS x64） |
| `pnpm build:win:x64` | Windows x64 构建 + 打包 |

---

## 项目结构

```
k-lens/
├── packages/                           # pnpm workspace 包（54 个）
│   ├── core/                           # 核心逻辑、UI 组件、K8s API
│   ├── kube-object/                    # Kubernetes 对象模型
│   ├── logger/                         # 日志工具
│   │
│   ├── business-features/              # 业务功能
│   │   └── keyboard-shortcuts/         # 键盘快捷键
│   │
│   ├── technical-features/             # 技术功能
│   │   ├── prometheus/                 # Prometheus 集成
│   │   ├── kubernetes-metrics-server/  # Metrics Server 集成
│   │   ├── messaging/                  # IPC 消息系统
│   │   └── application/                # 应用核心
│   │
│   ├── utility-features/              # 工具功能
│   │   ├── kube-api/                   # Kubernetes API 客户端
│   │   ├── kube-api-specifics/         # K8s API 专用逻辑
│   │   └── utilities/                  # 通用工具
│   │
│   ├── ui-components/                  # UI 组件
│   │   ├── button/                     # 按钮组件
│   │   ├── icon/                       # 图标组件
│   │   └── tooltip/                    # 提示组件
│   │
│   └── infrastructure/                 # 基础设施配置
│       ├── webpack/                    # Webpack 共享配置
│       ├── typescript/                 # TypeScript 共享配置
│       └── jest/                       # Jest 共享配置
│
├── k-lens/                             # Electron 主应用
│   ├── src/
│   │   ├── main/                       # 主进程
│   │   ├── renderer/                   # 渲染进程（React）
│   │   └── common/                     # 共享代码
│   ├── webpack/                        # Webpack 配置
│   └── dist/                           # 构建输出
│
├── scripts/                            # 构建/诊断/质量检查脚本
├── docs/                               # 文档
│   ├── architecture/                   # 依赖规则、DI 模式
│   └── guides/                         # 编码规范、测试策略
└── .claude/                            # AI 代理配置
    ├── agents/                         # 代理定义（generator、evaluator、tester）
    └── settings.json                   # 钩子、环境变量
```

---

## 技术栈

### 核心

| 技术 | 版本 | 用途 |
|------|------|------|
| Electron | 35.7.5 | 桌面应用框架 |
| React | 18.3.1 | UI 框架 |
| TypeScript | 5.9 | 类型系统 |
| MobX | 6.13 | 状态管理 |
| Tailwind CSS | 4.1 | 样式方案 |

### AI/ML

| 技术 | 版本 | 用途 |
|------|------|------|
| @langchain/core | 1.1.39 | LLM 集成框架 |
| @langchain/anthropic | 1.3.26 | Claude 模型集成 |
| @langchain/openai | 1.4.2 | OpenAI 模型集成 |
| @langchain/google-genai | 2.1.26 | Gemini 模型集成 |

### 基础设施

| 技术 | 版本 | 用途 |
|------|------|------|
| pnpm | 10.17.1 | 包管理器 |
| Turborepo | 2.9.3 | Monorepo 构建/测试编排 |
| Webpack | 5.101 | 模块打包器 |
| Biome | 2.2.4 | TS/JS 代码检查 + 格式化 |
| Jest | 29.7 | 测试框架 |

### 内置二进制工具

| 工具 | 版本 |
|------|------|
| kubectl | 1.34.1 |
| Helm | 3.19.0 |

---

## 开发指南

### 依赖注入 (DI)

项目采用 `@ogre-tools/injectable` 实现依赖注入模式：

```typescript
// Injectable 定义
const myServiceInjectable = getInjectable({
  id: "my-service",
  instantiate: (di) => new MyService(di.inject(loggerInjectable)),
});

// 功能注册
registerFeature(di, myFeature);
```

### 代码规范

- **注释/文档**：使用韩语编写
- **提交信息**：遵循 Conventional Commits 规范
- **文件结构**：Injectable 文件使用 `*.injectable.ts` 后缀

### 缓存清理

如果源码修改后构建出现异常行为：

```bash
rm -rf packages/core/static/build k-lens/static/build \
       packages/core/.webpack k-lens/.webpack k-lens/dist
pnpm build:dev
```

---

## 路线图

| 阶段 | 领域 | 说明 |
|------|------|------|
| ✅ 已完成 | AI 诊断 | 事后 AI 分析、根因检测、修复建议 |
| ✅ 已完成 | 安全扫描 | CVE/KSV 漏洞扫描 + AI 自动修复建议 (DAIVE) |
| ✅ 已完成 | k-o11y | Observability 仪表盘集成 |
| 🚧 进行中 | AI 质量 | 诊断准确率提升、响应延迟优化 |
| 🚧 进行中 | 性能优化 | 大规模集群处理、渲染优化、内存效率 |
| 📋 计划中 | 实时 AI 监控 | 实时异常检测、预测告警、自动扩缩建议 |
| 📋 计划中 | AI Cost Optimize | 资源浪费检测、合理规格建议、成本预测 |
| 💡 探索中 | 插件市场 | 社区驱动的扩展生态 |
| 💡 探索中 | Web 版本 | 面向团队协作的浏览器版 K-Lens |

> 对路线图中的功能感兴趣？Fork 仓库，改进或实现功能，然后提交 PR。可以从 [Issues](https://github.com/Wondermove-Inc/Skuberplus-Client-Community/issues) 中标记为 `good first issue` 或 `help wanted` 的问题开始。

---

## 贡献

1. Fork 仓库并创建功能分支
2. 提交更改（遵循 Conventional Commits 格式）
3. 创建 Pull Request

详细指南请参阅 [CONTRIBUTING.md](.github/CONTRIBUTING.md)。

### 问题反馈

请在 [GitHub Issues](https://github.com/Wondermove-Inc/Skuberplus-Client-Community/issues) 上报告 Bug 和功能需求。

---

## 许可证

本项目基于 [Open Lens](https://github.com/lensapp/lens) 构建。

```
Copyright (c) 2024-2026 Wondermove Inc.
Copyright (c) 2022 OpenLens Authors.

MIT License
```

完整许可证内容请查看 [LICENSE](LICENSE) 文件。

---

<p align="center">
  <sub>由 <a href="https://wondermove.net">Wondermove Inc.</a> 用心打造</sub>
</p>
