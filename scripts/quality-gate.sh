#!/bin/bash
# 품질 게이트 스크립트
# TaskCompleted Hook에서 호출됨
# exit 0 = 통과, exit 2 = 차단 (다시 작업)

# Jest 메모리 제한 (OOM 방지)
export NODE_OPTIONS="--max-old-space-size=4096"

echo "🔍 품질 게이트 검사 시작..."

# 1. 사이드이펙트 검사 (TypeScript 컴파일 + export 시그니처 변경)
# 📝 /check 스킬 대체 — 에이전트가 자동으로 감지/수정하도록 exit 2 반환
echo "1/4 사이드이펙트 검사..."
if ! bash scripts/impact-check.sh 2>&1; then
  echo "❌ 사이드이펙트 감지 - 수정 필요" >&2
  exit 2
fi
echo "✅ 사이드이펙트 없음"

# 2. 린트 검사 (trunk: shell 스크립트)
echo "2/4 린트 검사..."
if ! pnpm lint 2>&1; then
  echo "❌ 린트 실패 - 수정 필요" >&2
  exit 2
fi
echo "✅ 린트 통과"

# 3. biome 검사 (TS/JS 코드 품질 + 포맷)
echo "3/4 biome 검사..."
if ! pnpm biome:check 2>&1; then
  echo "❌ biome 검사 실패 - 수정 필요" >&2
  exit 2
fi
echo "✅ biome 통과"

# 4. 유닛 테스트 실행 (turbo run test:unit)
# 📝 --bail만 jest passthrough로 전달. --maxWorkers, --runInBand 등은 각 패키지 package.json에서 관리.
# 메모리 제한은 상단 NODE_OPTIONS로 처리.
echo "4/4 유닛 테스트 실행..."
if ! pnpm test:unit -- --bail 2>&1; then
  echo "❌ 테스트 실패 - 수정 필요" >&2
  exit 2
fi
echo "✅ 테스트 통과"

echo "✅ 품질 게이트 전체 통과"
exit 0
