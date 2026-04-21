<p align="center">
  <img src="k-lens/build/icons/128x128.png" alt="K-Lens Logo" width="128" height="128">
</p>

<h1 align="center">K-Lens</h1>

<p align="center">
  <strong>AI駆動型 Kubernetes管理デスクトップIDE</strong>
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

<h3 align="center">ダウンロード</h3>
<p align="center">
  <a href="https://github.com/Wondermove-Inc/K-Lens/releases/download/v0.6.5/KLens-0.6.5-arm64.dmg">macOS ARM64 (.dmg)</a> ·
  <a href="https://github.com/Wondermove-Inc/K-Lens/releases/download/v0.6.5/KLens-0.6.5-x64.exe">Windows x64 (.exe)</a> ·
  <a href="https://github.com/Wondermove-Inc/K-Lens/releases/download/v0.6.5/KLens-0.6.5-x86_64.AppImage">Linux x64 (.AppImage)</a> ·
  <a href="https://github.com/Wondermove-Inc/K-Lens/releases/download/v0.6.5/KLens-0.6.5-amd64.deb">Linux x64 (.deb)</a> ·
  <a href="https://github.com/Wondermove-Inc/K-Lens/releases/download/v0.6.5/KLens-0.6.5-x86_64.rpm">Linux x64 (.rpm)</a>
</p>

> **macOS注意**: K-LensはApple開発者証明書で署名されていないため、macOSでアプリがブロックされる場合があります。ダウンロード後、以下のコマンドを実行してください：
> ```bash
> xattr -dr com.apple.quarantine /パス/KLens.app
> ```

---

### デモ

https://github.com/user-attachments/assets/a5c5d846-49e3-4b33-b368-bb4014782b66

---

## K-Lensとは？

> `kubectl`がCLIなら、**K-Lensはコックピットです。**

K-Lensは、Kubernetes管理をターミナルの切り替え作業から、ビジュアルでAIアシスト付きのワークフローに変えます — クラスター接続、障害診断、修正適用まで、すべてデスクトップアプリ一つで完結します。

[Open Lens](https://github.com/lensapp/lens) をベースに、AI SRE診断、セキュリティスキャン、リアルタイムObservabilityを強化しています。

### なぜK-Lensか？

| K-Lensなし | K-Lensあり |
|------------|-----------|
| 複数のターミナルでkubectlを繰り返し | 単一UIでマルチクラスター管理 |
| 障害原因を手動分析（logs + describe） | AIが自動診断 + 解決策を提案 |
| CVEスキャンと結果解析が別々 | ワンクリックセキュリティスキャン + AI自動修正提案 |
| Helm、YAML、モニタリングツールが分散 | 一つのIDEに統合 |

### 主な機能

#### 1. マルチクラスター管理
単一のインターフェースから複数のKubernetesクラスターを管理します。

<img src="docs/images/feature-multi-cluster.png" alt="マルチクラスター管理" width="800">

#### 2. AI SRE診断
LangChainベースの障害自動分析と復旧提案。

#### 3. セキュリティスキャン (DAIVE)
CVE/KSV脆弱性スキャンとAIによる自動修正提案。

<img src="docs/images/feature-security-scan.png" alt="セキュリティスキャン" width="800">

#### 4. リアルタイムモニタリング
Prometheus/Metrics Server連携によるリソース可視化。

#### 5. 統合ターミナル
クラスターごとのkubectlセッションとPodシェルアクセス。

#### 6. Helm Chart管理
Helmリリースのインストール、アップグレード、ロールバック。

<img src="docs/images/feature-helm-chart.png" alt="Helm Chart管理" width="800">

#### 7. リソースエディタ
Monaco Editorベースのリアルタイム適用対応YAMLエディタ。

<img src="docs/images/feature-resource-editor.png" alt="リソースエディタ" width="800">

### DAIVE — AI SREコパイロット

> **CursorがコードのためのAIなら、DAIVEはKubernetesのためのAI — 問題を先に診断します。**

https://github.com/user-attachments/assets/85bb068e-c52d-475f-8914-68302af6d76a

DAIVEはK-Lens内蔵のAIエンジンで、シニアSREのようにクラスターを分析します。LangChainベースで複数モデル（Claude、GPT、Gemini）をサポートします。

| 機能 | 説明 |
|------|------|
| **トラブルシューティング** | CrashLoopBackOff、OOMKilled、ImagePullBackOff、Pending等の障害を自動検知し、連鎖障害を分析 |
| **根本原因分析** | 5 Whys、RCA/Ishikawa、仮説ベーステスト等の体系的な診断 |
| **セキュリティスキャン** | CVE/KSV脆弱性検知と段階別自動修正提案（Tier 1–3） |
| **パフォーマンス最適化** | リソースRight-sizing、HPA/VPAチューニング、QoS分析、リソース効率スコア |
| **FinOpsコスト分析** | アイドルリソース、過剰プロビジョニング、ゾンビリソースの特定とコスト削減見積もり |
| **クラスター評価** | ノード、ネームスペース、オートスケーラー、CNI、サービスメッシュ、ワークロード全体のレポート |
| **マルチエキスパート統合** | セキュリティ・パフォーマンス・信頼性の専門家分析を統合し、優先度別レポートを生成 |
| **カスタムスキル** | 必要なタスクのスキル作成をDAIVEに依頼すると、再利用可能なコマンドとして作成してくれます |

```
ユーザー: 「なぜPodがクラッシュし続けるのですか？」
DAIVE: ログスキャン → イベント確認 → リソースリミット分析 → OOMKilled発見
     → メモリリミット調整を推奨 → 修正適用を提案
```

---

## クイックスタート (macOS / Linux)

### 前提条件

- **Node.js** >= 22.0.0
- **pnpm** 10.17.1
- **Git**

### インストール

```bash
# 1. リポジトリをクローン
git clone https://github.com/Wondermove-Inc/Skuberplus-Client-Community.git
cd k-lens

# 2. 依存関係のインストール（ネイティブモジュールのリビルドが自動実行されます）
pnpm install

# 3. 開発用ビルド
pnpm build:dev

# 4. 開発サーバーの起動
pnpm dev
```

> **備考**: `pnpm install` を実行すると、Electronネイティブモジュールのリビルドが自動的に行われます。

> **Windows**: ネイティブモジュールのビルドに追加手順が必要です。[プラットフォームビルド > Windows](#windows-x64)を参照してください。

> **Node.jsバージョン**: v22（LTS）とv24+（LTS）をサポートしています。v23も`.npmrc`設定（`--no-experimental-strip-types`）により対応しています。

---

## プラットフォーム別ビルド

### macOS (ARM64 / Apple Silicon)

```bash
# 1. フルビルド（ソースビルド + アプリパッケージング）
pnpm build:full:app

# 2. またはステップごとに実行
pnpm build              # ソースビルド
pnpm build:app          # アプリパッケージング（ARM64）

# 出力先: k-lens/dist/mac-arm64/KLens.app
```

### macOS (Intel x64)

```bash
# 1. x64フルビルド（ソースビルド + アプリパッケージング）
pnpm build:full:x64

# 2. x64アプリパッケージングのみ（ソースビルド済みの場合）
pnpm build:app:darwin:x64

# 出力先: k-lens/dist/mac/KLens.app
```

### Linux

```bash
# 1. ソースビルド
pnpm build

# 2. アプリパッケージング
cd k-lens
pnpm build:app:linux

# 出力先: k-lens/dist/linux-unpacked/
```

### Windows (x64)

Windowsでは、`postinstall` スクリプト（macOS専用のelectron-rebuild）をスキップし、ネイティブモジュールを手動でビルドします。

**前提条件:**
- Node.js 22+
- Visual Studio Build Tools（C++ビルドツール）
- Python 3.x（node-gypの依存関係）

```powershell
# 1. 依存関係のインストール（postinstallをスキップ - macOS専用のelectron-rebuild）
pnpm install --ignore-scripts

# 2. node-ptyのWindows向けパッチ（winpty.gypパス修正 + GenVersion.h生成）
node scripts/fix-node-pty-windows.js

# 3. node-ptyネイティブモジュールのビルド（Electronヘッダーを使用）
cd node_modules/node-pty
pnpm dlx node-gyp rebuild --target=35.7.5 --arch=x64 --dist-url=https://electronjs.org/headers
cd ../..

# 4. clipboard-filesネイティブモジュールのビルド
cd node_modules/clipboard-files
pnpm dlx node-gyp rebuild --target=35.7.5 --arch=x64 --dist-url=https://electronjs.org/headers
cd ../..

# 5. ソースビルド（ワークスペース全体）
pnpm run build:win

# 6. アプリパッケージング
node scripts/build-windows-app.js

# 出力先: k-lens/dist/<version>/KLens-<version>-x64.exe
```

> **`--ignore-scripts` を使う理由**
> `postinstall` スクリプトはmacOS ARM64専用の `electron-rebuild` を実行します。
> Windowsではこのステップが失敗するため、スキップして `fix-node-pty-windows.js` パッチ適用後に `node-gyp rebuild` で手動ビルドを行います。

> **node-ptyのビルドに失敗した場合:**
> ```powershell
> Remove-Item -Recurse -Force node_modules\node-pty
> pnpm install --ignore-scripts
> node scripts/fix-node-pty-windows.js
> cd node_modules/node-pty
> pnpm dlx node-gyp rebuild --target=35.7.5 --arch=x64 --dist-url=https://electronjs.org/headers
> cd ../..
> ```

### ビルド出力先一覧

| プラットフォーム | パス |
|------------------|------|
| macOS (ARM64) | `k-lens/dist/mac-arm64/KLens.app` |
| macOS (x64) | `k-lens/dist/mac/KLens.app` |
| Linux | `k-lens/dist/linux-unpacked/` |
| Windows | `k-lens/dist/<version>/KLens-<version>-x64.exe` |

---

## コマンドリファレンス

### 開発

| コマンド | 説明 |
|----------|------|
| `pnpm install` | 依存関係のインストール + ネイティブモジュールビルド |
| `pnpm dev` | 開発サーバーの起動（Hot Reload） |
| `pnpm build:dev` | 開発用ビルド |
| `pnpm build` | プロダクションビルド |
| `pnpm build:full:app` | フルビルド（ソース + アプリパッケージング） |

### テスト・品質管理

| コマンド | 説明 |
|----------|------|
| `pnpm lint` | Trunkベースのリントチェック（shell、YAMLなど） |
| `pnpm lint:fix` | リント問題の自動修正 |
| `pnpm biome:check` | Biome TS/JSコード品質 + フォーマットチェック |
| `pnpm biome:fix` | Biome自動修正 |
| `pnpm test:unit` | 全ユニットテスト実行（Turborepo） |
| `pnpm test:unit:core` | Coreパッケージのテスト |
| `pnpm test:integration` | 統合テスト |

### パッケージング

| コマンド | 説明 |
|----------|------|
| `pnpm build:full:app` | フルビルド（ソース + パッケージング、macOS ARM64） |
| `pnpm build:full:x64` | フルビルド（ソース + パッケージング、macOS x64） |
| `pnpm build:app` | アプリパッケージングのみ（macOS ARM64） |
| `pnpm build:app:darwin:x64` | アプリパッケージングのみ（macOS x64） |
| `pnpm build:win:x64` | Windows x64ビルド + パッケージング |

---

## プロジェクト構成

```
k-lens/
├── packages/                           # pnpmワークスペースパッケージ（54個）
│   ├── core/                           # コアロジック、UIコンポーネント、K8s API
│   ├── kube-object/                    # Kubernetesオブジェクトモデル
│   ├── logger/                         # ログユーティリティ
│   │
│   ├── business-features/              # ビジネス機能
│   │   └── keyboard-shortcuts/         # キーボードショートカット
│   │
│   ├── technical-features/             # 技術機能
│   │   ├── prometheus/                 # Prometheus連携
│   │   ├── kubernetes-metrics-server/  # Metrics Server連携
│   │   ├── messaging/                  # IPCメッセージングシステム
│   │   └── application/                # アプリケーションコア
│   │
│   ├── utility-features/              # ユーティリティ機能
│   │   ├── kube-api/                   # Kubernetes APIクライアント
│   │   ├── kube-api-specifics/         # K8s API固有ロジック
│   │   └── utilities/                  # 共通ユーティリティ
│   │
│   ├── ui-components/                  # UIコンポーネント
│   │   ├── button/                     # Buttonコンポーネント
│   │   ├── icon/                       # Iconコンポーネント
│   │   └── tooltip/                    # Tooltipコンポーネント
│   │
│   └── infrastructure/                 # インフラ設定
│       ├── webpack/                    # Webpack共通設定
│       ├── typescript/                 # TypeScript共通設定
│       └── jest/                       # Jest共通設定
│
├── k-lens/                             # Electronメインアプリケーション
│   ├── src/
│   │   ├── main/                       # メインプロセス
│   │   ├── renderer/                   # レンダラープロセス（React）
│   │   └── common/                     # 共通コード
│   ├── webpack/                        # Webpack設定
│   └── dist/                           # ビルド出力
│
├── scripts/                            # ビルド/診断/品質ゲートスクリプト
├── docs/                               # ドキュメント
│   ├── architecture/                   # 依存関係ルール、DIパターン
│   └── guides/                         # コーディング規約、テスト戦略
└── .claude/                            # AIエージェント設定
    ├── agents/                         # エージェント定義（generator、evaluator、tester）
    └── settings.json                   # フック、環境変数
```

---

## 技術スタック

### コア

| 技術 | バージョン | 用途 |
|------|-----------|------|
| Electron | 35.7.5 | デスクトップアプリフレームワーク |
| React | 18.3.1 | UIフレームワーク |
| TypeScript | 5.9 | 型システム |
| MobX | 6.13 | 状態管理 |
| Tailwind CSS | 4.1 | スタイリング |

### AI/ML

| 技術 | バージョン | 用途 |
|------|-----------|------|
| @langchain/core | 1.1.39 | LLM統合フレームワーク |
| @langchain/anthropic | 1.3.26 | Claudeモデル連携 |
| @langchain/openai | 1.4.2 | OpenAIモデル連携 |
| @langchain/google-genai | 2.1.26 | Geminiモデル連携 |

### インフラストラクチャ

| 技術 | バージョン | 用途 |
|------|-----------|------|
| pnpm | 10.17.1 | パッケージマネージャー |
| Turborepo | 2.9.3 | モノレポビルド/テストオーケストレーション |
| Webpack | 5.101 | モジュールバンドラー |
| Biome | 2.2.4 | TS/JSリンター + フォーマッター |
| Jest | 29.7 | テストフレームワーク |

### 同梱バイナリ

| ツール | バージョン |
|--------|-----------|
| kubectl | 1.34.1 |
| Helm | 3.19.0 |

---

## 開発ガイド

### 依存性注入 (DI)

本プロジェクトでは `@ogre-tools/injectable` を用いたDIパターンを採用しています。

```typescript
// Injectableの定義
const myServiceInjectable = getInjectable({
  id: "my-service",
  instantiate: (di) => new MyService(di.inject(loggerInjectable)),
});

// 機能の登録
registerFeature(di, myFeature);
```

### コーディング規約

- **コメント/ドキュメント**: 韓国語で記述
- **コミットメッセージ**: Conventional Commits形式
- **ファイル構成**: Injectableファイルは `*.injectable.ts` サフィックスを使用

### キャッシュのクリーンアップ

ソース変更後にビルドが想定通り動作しない場合は、以下を実行してください。

```bash
rm -rf packages/core/static/build k-lens/static/build \
       packages/core/.webpack k-lens/.webpack k-lens/dist
pnpm build:dev
```

---

## ロードマップ

| フェーズ | 領域 | 説明 |
|---------|------|------|
| ✅ 完了 | AI診断 | インシデント後のAI分析、根本原因検出、修復提案 |
| ✅ 完了 | セキュリティスキャン | CVE/KSV脆弱性スキャン + AI自動修正提案 (DAIVE) |
| ✅ 完了 | k-o11y | Observabilityダッシュボード統合 |
| 🚧 進行中 | AI品質 | 診断精度の向上、レスポンス遅延の最適化 |
| 🚧 進行中 | パフォーマンス | 大規模クラスター対応、レンダリング最適化、メモリ効率化 |
| 📋 計画中 | リアルタイムAIモニタリング | リアルタイム異常検知、予測アラート、オートスケーリング推奨 |
| 📋 計画中 | AI Cost Optimize | リソース無駄の検出、適正サイジング提案、コスト予測 |
| 💡 検討中 | プラグインマーケットプレイス | コミュニティ主導の拡張エコシステム |
| 💡 検討中 | Web版 | チームコラボレーション向けブラウザベースK-Lens |

> ロードマップの項目に興味がありますか？Forkして機能を改善・実装し、PRを送ってください。[Issues](https://github.com/Wondermove-Inc/Skuberplus-Client-Community/issues)の`good first issue`や`help wanted`ラベルから始められます。

---

## コントリビューション

1. フォークしてフィーチャーブランチを作成
2. 変更をコミット（Conventional Commits形式）
3. プルリクエストを作成

詳細なガイドラインは [CONTRIBUTING.md](.github/CONTRIBUTING.md) をご参照ください。

### 問題の報告

バグ報告や機能リクエストは [GitHub Issues](https://github.com/Wondermove-Inc/Skuberplus-Client-Community/issues) からお願いいたします。

---

## ライセンス

本プロジェクトは [Open Lens](https://github.com/lensapp/lens) をベースにしています。

```
Copyright (c) 2024-2026 Wondermove Inc.
Copyright (c) 2022 OpenLens Authors.

MIT License
```

ライセンス全文は [LICENSE](LICENSE) ファイルをご確認ください。

---

<p align="center">
  <sub>Built with love by <a href="https://wondermove.net">Wondermove Inc.</a></sub>
</p>
