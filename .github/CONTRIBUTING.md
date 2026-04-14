# Contributing to Skuber+ Client

Thank you for your interest in contributing to Skuber+ Client!

> **[한국어 버전 (Korean)](.github/CONTRIBUTING.ko.md)**

---

## Getting Started

### Setting Up the Development Environment

```bash
# 1. Fork and clone
git clone https://github.com/<your-username>/Skuberplus-Client-Community.git
cd Skuberplus-Client-Community

# 2. Install dependencies
pnpm install

# 3. Start the development server
pnpm dev
```

### Prerequisites

- Node.js >= 22.0.0
- pnpm 10.17.1
- Git

---

## Contribution Workflow

### 1. Create a Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/my-feature
```

### Branch Naming

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New feature | `feature/inline-diff-preview` |
| `fix/` | Bug fix | `fix/streaming-memory-leak` |
| `refactor/` | Refactoring | `refactor/agent-store-mobx` |
| `docs/` | Documentation | `docs/api-reference-update` |
| `chore/` | Build/config | `chore/upgrade-electron-36` |

### 2. Make Changes and Commit

```bash
git add .
git commit -m "feat: add syntax highlighting to code blocks"
```

#### Commit Message Format (Conventional Commits)

```
<type>: <description>
```

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation change |
| `refactor` | Refactoring |
| `test` | Add/update tests |
| `chore` | Build/config change |
| `perf` | Performance improvement |

### 3. Create a Pull Request

```bash
git push -u origin feature/my-feature
gh pr create --title "feat: add syntax highlighting to code blocks"
```

---

## Code Quality

Please verify the following before submitting a PR:

```bash
pnpm lint          # Lint check
pnpm biome:check   # Code quality + formatting check
pnpm test:unit     # Unit tests
pnpm build         # Build verification
```

### Code Conventions

- UI text (buttons, labels, messages, etc.) must be in English
- Use the DI pattern: `*.injectable.ts` suffix is required
- Split files exceeding 500 lines

---

## PR Review

- At least 1 approval required
- CI tests must pass
- All review comments must be resolved

---

## Reporting Issues

- Please file bug reports and feature requests on [GitHub Issues](https://github.com/Wondermove-Inc/Skuberplus-Client-Community/issues)
- For security vulnerabilities, refer to [SECURITY.md](SECURITY.md)

---

## License

All contributions are distributed under the [MIT License](../LICENSE).
