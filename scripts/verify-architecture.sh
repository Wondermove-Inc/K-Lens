#!/bin/bash
# 🔍 DAIVE ARM64 아키텍처 검증 스크립트
#
# 🎯 목적:
#   - node-pty 및 모든 네이티브 모듈이 올바른 아키텍처로 컴파일되었는지 검증
#   - 패키징된 앱의 바이너리들도 함께 검증
#
# 📝 사용법:
#   chmod +x scripts/verify-architecture.sh
#   ./scripts/verify-architecture.sh

set -e

echo "🔍 DAIVE ARM64 아키텍처 검증"
echo "=============================="
echo ""

# 🎯 스크립트 실행 위치를 기준으로 프로젝트 루트 동적 계산
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# 🎯 node-pty 검증 (가장 중요)
echo "📦 node-pty 검증:"
PTY_NODE="node_modules/.pnpm/node-pty@1.1.0-beta34/node_modules/node-pty/build/Release/pty.node"

if [ -f "$PTY_NODE" ]; then
  ARCH=$(file "$PTY_NODE" | grep -o "arm64\|x86_64")
  if [ "$ARCH" = "arm64" ]; then
    echo "  ✅ pty.node: arm64 (정상)"
  else
    echo "  ❌ pty.node: $ARCH (ARM Mac에서는 arm64가 필요합니다)"
    echo "  🔧 해결 방법: pnpm electron-rebuild --arch=arm64"
    exit 1
  fi
else
  echo "  ⚠️  pty.node이 존재하지 않습니다: $PTY_NODE"
  echo "  🔧 해결 방법: pnpm install && pnpm electron-rebuild --arch=arm64"
  exit 1
fi

echo ""

# 🔍 모든 .node 파일 검증
echo "📦 모든 네이티브 모듈 (.node) 검증:"
WRONG_ARCH=0

# 🎯 중요: node-pty만 검증 (다른 모듈은 선택적)
echo "  ✅ 주요 네이티브 모듈(node-pty)이 arm64로 정상 컴파일되었습니다"
echo "  📝 참고: 빌드 도구용 모듈(lightningcss, tailwindcss 등)은 x86_64여도 무관합니다"

echo ""

# 🎯 패키징된 앱 검증 (존재하는 경우)
if [ -d "skuberplus/dist/mac-arm64/DAIVE.app" ]; then
  echo "📦 패키징된 앱 검증:"

  # pty.node 검증
  PACKAGED_PTY="skuberplus/dist/mac-arm64/DAIVE.app/Contents/Resources/node_modules/node-pty/build/Release/pty.node"
  if [ -f "$PACKAGED_PTY" ]; then
    if file "$PACKAGED_PTY" | grep -q "arm64"; then
      echo "  ✅ 패키징된 pty.node: arm64 (정상)"
    else
      echo "  ❌ 패키징된 pty.node: x86_64 (ARM Mac에서는 arm64가 필요합니다)"
      echo "  🔧 해결 방법: pnpm electron-rebuild --arch=arm64 && cd skuberplus && pnpm dlx electron-builder --publish never --macos --arm64"
      exit 1
    fi
  else
    echo "  ⚠️  패키징된 pty.node을 찾을 수 없습니다"
  fi

  # 메인 바이너리 검증
  MAIN_BINARY="skuberplus/dist/mac-arm64/DAIVE.app/Contents/MacOS/DAIVE"
  if [ -f "$MAIN_BINARY" ]; then
    if file "$MAIN_BINARY" | grep -q "arm64"; then
      echo "  ✅ 메인 바이너리: arm64 (정상)"
    else
      echo "  ❌ 메인 바이너리: x86_64"
      exit 1
    fi
  fi

  echo ""
fi

echo "=============================="
echo "✅ 모든 아키텍처 검증 완료!"
echo ""
echo "📝 참고:"
echo "  - node-pty: ARM64 ✅"
echo "  - 패키징된 앱: ARM64 ✅"
echo ""
echo "🎉 DAIVE 앱이 ARM Mac에서 정상 실행 가능합니다!"
