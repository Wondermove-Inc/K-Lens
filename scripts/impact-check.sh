#!/bin/bash
# 사이드 이펙트 및 크래시 가능성 자동 검사
# quality-gate.sh에서 호출됨
# exit 0 = 통과, exit 2 = 차단 (에이전트가 수정 후 재실행)
#
# 📝 목적: /check 스킬을 유저에게 보여주는 대신, 에이전트끼리 자동으로 검사/수정
# 📝 검사 전략:
#   1. TypeScript 컴파일 (tsc --noEmit) = 확정적 검사 → 실패 시 차단
#   2. export 시그니처 변경 감지 = 참고용 경고 → tsc 통과 시 차단하지 않음
#      (tsc가 통과했으면 타입 호환성은 이미 보장됨)

set -uo pipefail

HAS_TSC_ERROR=false
WARNINGS=()

# 1. TypeScript 컴파일 체크 (확정적 사이드이펙트 감지)
echo "  [impact] TypeScript 컴파일 검사..."
TSC_OUTPUT=$(npx tsc --noEmit -p packages/core/tsconfig.json 2>&1) || true
if [[ -n $TSC_OUTPUT ]]; then
  HAS_TSC_ERROR=true
  echo ""
  echo "  ❌ TypeScript 컴파일 오류:"
  echo "$TSC_OUTPUT" | head -30
fi

# 2. export 시그니처 변경 감지 (참고용 경고)
echo "  [impact] export 시그니처 변경 감지..."
CHANGED_TS_FILES=$(git diff --name-only -- '*.ts' '*.tsx' 2>/dev/null | grep -v 'static/build' | grep -v 'dist/' | grep -v 'node_modules' | head -30)

for file in $CHANGED_TS_FILES; do
  if [[ ! -f $file ]]; then
    continue
  fi

  # 삭제된 export 라인 감지
  EXPORT_CHANGES=$(git diff -- "$file" | grep -E '^\-.*export (function|class|interface|type|const)' | head -5) || true
  if [[ -n $EXPORT_CHANGES ]]; then
    while IFS= read -r line; do
      SYMBOL=$(echo "$line" | sed -E 's/.*export (function|class|interface|type|const) ([a-zA-Z_][a-zA-Z0-9_]*).*/\2/')
      if [[ -n $SYMBOL ]] && [[ $SYMBOL != "$line" ]]; then
        # 소스 파일에서만 사용처 검색 (build artifact 제외)
        USAGES=$(grep -rl "$SYMBOL" --include='*.ts' --include='*.tsx' packages/core/src/ 2>/dev/null | grep -v "$file" | head -3) || true
        if [[ -n $USAGES ]]; then
          WARNINGS+=("  ⚠️ $file: '$SYMBOL' 시그니처 변경 → 사용처: $(echo "$USAGES" | tr '\n' ', ')")
        fi
      fi
    done <<<"$EXPORT_CHANGES"
  fi
done

# 결과 판정
if [[ $HAS_TSC_ERROR == true ]]; then
  echo ""
  echo "  ❌ [impact] TypeScript 컴파일 실패 — 수정 필요"
  exit 2
fi

# 경고 출력 (차단하지 않음 — tsc 통과 = 타입 호환성 보장)
if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  echo ""
  echo "  ℹ️ [impact] export 변경 감지 (tsc 통과로 타입 호환성 확인됨):"
  for warn in "${WARNINGS[@]}"; do
    echo "$warn"
  done
fi

echo "  [impact] ✅ 검사 통과"
exit 0
