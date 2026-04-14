#!/bin/bash
# shellcheck disable=SC2129
# scripts/analyze-source-features.sh
#
# 🎯 목적: TypeScript/TSX 파일을 분석하여 기능 검증 체크리스트 생성
#
# 사용법:
#   bash scripts/analyze-source-features.sh <source-file> <output-file>
#
# 예시:
#   bash scripts/analyze-source-features.sh \
#     packages/core/src/renderer/components/welcome/welcome.tsx \
#     docs/plan/active/features/welcome-checklist.md

set -euo pipefail

# 인자 확인
if [[ $# -ne 2 ]]; then
  echo "사용법: $0 <source-file> <output-file>"
  echo "예시: $0 welcome.tsx welcome-checklist.md"
  exit 1
fi

SOURCE_FILE=$1
OUTPUT_FILE=$2

# 파일 존재 확인
if [[ ! -f $SOURCE_FILE ]]; then
  echo "❌ 오류: 소스 파일을 찾을 수 없습니다: $SOURCE_FILE"
  exit 1
fi

# 출력 디렉토리 생성
mkdir -p "$(dirname "$OUTPUT_FILE")"

# 파일명 추출
FILE_NAME=$(basename "$SOURCE_FILE")

echo "🔍 소스 분석 시작: $SOURCE_FILE"

# ============================================
# Markdown 파일 헤더 생성
# ============================================
cat >"$OUTPUT_FILE" <<EOF
# ${FILE_NAME} 기능 검증 체크리스트

> 이 파일은 \`analyze-source-features.sh\` 스크립트로 자동 생성되었습니다.
> 소스 파일: \`$SOURCE_FILE\`
> 생성 시간: $(date '+%Y-%m-%d %H:%M:%S')

---

EOF

# ============================================
# 1. UI 요소 분석
# ============================================
echo "✅ UI 요소 분석 중..."

cat >>"$OUTPUT_FILE" <<EOF
## 1. UI 요소

### 주요 컴포넌트

EOF

# JSX 요소 추출 (< 로 시작하는 태그)
# 예: <Button>, <Icon>, <MainLayout>
rg '<([A-Z][A-Za-z0-9_]*)[> ]' "$SOURCE_FILE" -n --no-heading | while IFS=: read -r line_num content; do
  # 컴포넌트명 추출
  component=$(echo "$content" | sed -E 's/.*<([A-Z][A-Za-z0-9_]*).*/\1/')

  # data-testid 추출
  testid=$(echo "$content" | grep -o 'data-testid="[^"]*"' | sed 's/data-testid="\([^"]*\)"/\1/' || echo "")

  echo "- [ ] \`<${component}>\` 컴포넌트" >>"$OUTPUT_FILE"
  echo "  - 위치: ${FILE_NAME}:${line_num}" >>"$OUTPUT_FILE"

  if [[ -n $testid ]]; then
    echo "  - data-testid: \"${testid}\"" >>"$OUTPUT_FILE"
  fi

  echo "  - 확인 방법: E2E 테스트에서 검증 필요" >>"$OUTPUT_FILE"
  echo "" >>"$OUTPUT_FILE"
done

# 버튼 요소 별도 분석
cat >>"$OUTPUT_FILE" <<EOF

### 버튼 요소

EOF

rg '<button' "$SOURCE_FILE" -n -A 2 --no-heading | grep -E '^[0-9]+:' | while IFS=: read -r line_num content; do
  # 버튼 텍스트 추출 (간단한 케이스만)
  button_text=$(echo "$content" | sed -E 's/.*>([^<]+)<.*/\1/' | grep -v '<button' || echo "")

  # onClick 핸들러 추출
  onclick=$(echo "$content" | grep -o 'onClick={[^}]*}' | sed 's/onClick={\([^}]*\)}/\1/' || echo "")

  if [[ -n $button_text ]] && [[ $button_text != "$content" ]]; then
    echo "- [ ] \"${button_text}\" 버튼" >>"$OUTPUT_FILE"
  else
    echo "- [ ] 버튼 요소" >>"$OUTPUT_FILE"
  fi

  echo "  - 위치: ${FILE_NAME}:${line_num}" >>"$OUTPUT_FILE"

  if [[ -n $onclick ]]; then
    echo "  - 이벤트: \`onClick={${onclick}}\`" >>"$OUTPUT_FILE"
  fi

  echo "  - 확인 방법: E2E 테스트에서 검증 필요" >>"$OUTPUT_FILE"
  echo "" >>"$OUTPUT_FILE"
done

UI_COUNT=$(rg '<([A-Z][A-Za-z0-9_]*)' "$SOURCE_FILE" | wc -l | tr -d ' ')
echo "  - UI 요소 발견: ${UI_COUNT}개"

# ============================================
# 2. 이벤트 핸들러 분석
# ============================================
echo "✅ 이벤트 핸들러 분석 중..."

cat >>"$OUTPUT_FILE" <<EOF

## 2. 이벤트 핸들러

EOF

rg 'on(Click|Change|Submit|KeyDown|KeyUp|Focus|Blur|Input)=\{' "$SOURCE_FILE" -n --no-heading | while IFS=: read -r line_num content; do
  # 이벤트 타입 추출
  event_type=$(echo "$content" | sed -E 's/.*on([A-Za-z]+)=.*/\1/')

  # 핸들러 함수명 추출
  handler=$(echo "$content" | grep -o 'on[A-Za-z]*={[^}]*}' | sed -E 's/on[A-Za-z]*=\{([^}]*)\}/\1/')

  echo "- [ ] \`on${event_type}={${handler}}\` - 이벤트 핸들러" >>"$OUTPUT_FILE"
  echo "  - 위치: ${FILE_NAME}:${line_num}" >>"$OUTPUT_FILE"
  echo "  - 확인 방법: E2E 테스트에서 검증 필요" >>"$OUTPUT_FILE"
  echo "" >>"$OUTPUT_FILE"
done

HANDLER_COUNT=$(rg 'on(Click|Change|Submit)=\{' "$SOURCE_FILE" | wc -l | tr -d ' ')
echo "  - 이벤트 핸들러 발견: ${HANDLER_COUNT}개"

# ============================================
# 3. 의존성 주입 (DI) 분석
# ============================================
echo "✅ 의존성 주입 분석 중..."

cat >>"$OUTPUT_FILE" <<EOF

## 3. 의존성 주입 (Dependency Injection)

EOF

# withInjectables의 getProps에서 di.inject 추출
rg 'di\.inject\(' "$SOURCE_FILE" -n --no-heading | while IFS=: read -r line_num content; do
  # Injectable 이름 추출
  injectable=$(echo "$content" | grep -o 'di\.inject([^)]*)' | sed 's/di\.inject(\([^)]*\))/\1/')

  echo "- [ ] \`${injectable}\` Injectable" >>"$OUTPUT_FILE"
  echo "  - 위치: ${FILE_NAME}:${line_num}" >>"$OUTPUT_FILE"
  echo "  - 확인 방법: DI 컨테이너 등록 확인 필요" >>"$OUTPUT_FILE"
  echo "" >>"$OUTPUT_FILE"
done

DI_COUNT=$(rg 'di\.inject\(' "$SOURCE_FILE" | wc -l | tr -d ' ')
echo "  - 의존성 주입 발견: ${DI_COUNT}개"

# ============================================
# 4. Props 인터페이스 분석
# ============================================
echo "✅ Props 인터페이스 분석 중..."

cat >>"$OUTPUT_FILE" <<EOF

## 4. Props 인터페이스

EOF

# interface 또는 type 정의 추출
# 🎯 수정: Props 또는 Dependencies로 끝나는 인터페이스명 검색
rg '(interface|type)\s+[A-Za-z0-9_]*(Props|Dependencies)\s*\{' "$SOURCE_FILE" -n --no-heading | while IFS=: read -r line_num content; do
  # 인터페이스명 추출
  interface_name=$(echo "$content" | sed -E 's/.*(interface|type)\s+([A-Za-z0-9_]+).*/\2/')

  echo "- [ ] \`${interface_name}\` - Props/Dependencies 정의" >>"$OUTPUT_FILE"
  echo "  - 위치: ${FILE_NAME}:${line_num}" >>"$OUTPUT_FILE"
  echo "  - 속성:" >>"$OUTPUT_FILE"

  # 인터페이스 본문 추출: sed로 줄 번호 범위 지정 (다음 15줄)
  # 🎯 수정: rg 대신 sed 사용하여 정확한 줄 번호 범위 추출
  end_line=$((line_num + 15))
  sed -n "${line_num},${end_line}p" "$SOURCE_FILE" | grep -E '^\s+[a-z]' | while read -r prop_line; do
    prop_name=$(echo "$prop_line" | sed -E 's/.*\s+([a-zA-Z0-9_?]+):.*/\1/')
    if [[ -n $prop_name ]]; then
      echo "    - \`${prop_name}\`" >>"$OUTPUT_FILE"
    fi
  done

  echo "" >>"$OUTPUT_FILE"
done

echo "  - Props 인터페이스 분석 완료"

# ============================================
# 5. 추가 확인 필요 항목
# ============================================
cat >>"$OUTPUT_FILE" <<EOF

## 5. 추가 확인 필요 항목 (E2E 테스트 작성 시 참고)

EOF

# data-testid 누락 확인
BUTTONS_WITHOUT_TESTID=$(rg '<button' "$SOURCE_FILE" | rg -v 'data-testid' | wc -l | tr -d ' ')
if [[ $BUTTONS_WITHOUT_TESTID -gt 0 ]]; then
  echo "- [ ] data-testid 속성 추가 필요: 버튼 ${BUTTONS_WITHOUT_TESTID}개" >>"$OUTPUT_FILE"
fi

# 로딩 상태 확인
if ! rg -q '(isLoading|loading|Loading)' "$SOURCE_FILE"; then
  echo "- [ ] 로딩 상태 UI 확인 (현재 소스에서 미발견)" >>"$OUTPUT_FILE"
fi

# 에러 상태 확인
if ! rg -q '(isError|error|Error)' "$SOURCE_FILE"; then
  echo "- [ ] 에러 상태 UI 확인 (현재 소스에서 미발견)" >>"$OUTPUT_FILE"
fi

# 빈 상태 확인
if ! rg -q '(isEmpty|empty|Empty|No data|No items)' "$SOURCE_FILE"; then
  echo "- [ ] 빈 상태 UI 확인 (현재 소스에서 미발견)" >>"$OUTPUT_FILE"
fi

echo "" >>"$OUTPUT_FILE"

# ============================================
# 완료 메시지
# ============================================
echo ""
echo "✅ 소스 분석 완료!"
echo "✅ UI 요소 분석 완료: ${UI_COUNT}개 요소 발견"
echo "✅ 이벤트 핸들러 분석 완료: ${HANDLER_COUNT}개 핸들러 발견"
echo "✅ 의존성 주입 분석 완료: ${DI_COUNT}개 DI 발견"
echo "✅ Props 인터페이스 분석 완료"
echo ""
echo "📋 체크리스트 생성됨: $OUTPUT_FILE"
echo ""
echo "👉 다음 단계:"
echo "   1. 생성된 체크리스트 검토"
echo "   2. E2E 테스트 케이스 작성"
echo "   3. Shadcn 버전 구현 시 참고"
