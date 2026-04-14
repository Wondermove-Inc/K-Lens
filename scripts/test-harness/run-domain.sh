#!/bin/bash
# AI 에이전트 테스트 하네스 - 도메인별 실행
# Usage: ./run-domain.sh <domain-id|all> [--json]
# Output: 사람이 읽기 쉬운 요약 (--json이면 JSON)

set -euo pipefail

DOMAIN_ID="${1-}"
OUTPUT_FORMAT="${2:-text}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DOMAINS_FILE="$REPO_ROOT/scripts/test-harness/domains.json"

if [[ -z $DOMAIN_ID ]]; then
  echo "Usage: $0 <domain-id|all> [--json]"
  echo ""
  echo "Available domains:"
  node -e "const d = require('$DOMAINS_FILE'); d.domains.forEach(x => console.log('  ' + x.id + ' - ' + x.label));"
  exit 1
fi

# 전체 도메인 실행
if [[ $DOMAIN_ID == "all" ]]; then
  DOMAIN_IDS=$(node -e "const d = require('$DOMAINS_FILE'); d.domains.forEach(x => console.log(x.id));")
  EXIT_CODE=0
  for id in $DOMAIN_IDS; do
    "$0" "$id" "$OUTPUT_FORMAT" || EXIT_CODE=1
  done
  exit "$EXIT_CODE"
fi

DOMAIN_JSON=$(node -e "
  const d = require('$DOMAINS_FILE');
  const domain = d.domains.find(x => x.id === '$DOMAIN_ID');
  if (!domain) { console.error('Domain not found: $DOMAIN_ID'); process.exit(1); }
  console.log(JSON.stringify(domain));
")

PACKAGE=$(node -e "console.log($DOMAIN_JSON.package)")
PATTERN=$(node -e "console.log($DOMAIN_JSON.pattern)")
LABEL=$(node -e "console.log($DOMAIN_JSON.label)")
OUTPUT_FILE="/tmp/jest-result-${DOMAIN_ID}.json"

echo "=== Running: $LABEL ===" >&2

cd "$REPO_ROOT/$PACKAGE"

START_TIME=$(date +%s)

npx jest \
  --testPathPattern="$PATTERN" \
  --no-coverage \
  --json \
  --outputFile="$OUTPUT_FILE" \
  --forceExit \
  2>/tmp/jest-stderr-"${DOMAIN_ID}".txt || true

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

# Jest 출력 파일 검증
if [[ ! -f $OUTPUT_FILE ]] || ! node -e "JSON.parse(require('fs').readFileSync('$OUTPUT_FILE','utf-8'))" 2>/dev/null; then
  echo "ERROR: Jest failed to produce valid output for domain '$DOMAIN_ID'" >&2
  echo "stderr:" >&2
  cat /tmp/jest-stderr-"${DOMAIN_ID}".txt >&2
  exit 1
fi

echo "Duration: ${ELAPSED}s" >&2

if [[ $OUTPUT_FORMAT == "--json" ]]; then
  cat "$OUTPUT_FILE"
else
  node -e "
    const r = require('$OUTPUT_FILE');
    const failed = [];
    for (const suite of (r.testResults || [])) {
      if (suite.status === 'failed') {
        for (const t of (suite.testResults || [])) {
          if (t.status === 'failed') {
            failed.push({ file: suite.testFilePath.replace(process.cwd() + '/', ''), test: t.fullName });
          }
        }
      }
    }
    console.log('RESULT:', r.success ? 'PASS' : 'FAIL');
    console.log('Suites:', r.numPassedTestSuites + '/' + r.numTotalTestSuites);
    console.log('Tests: ', r.numPassedTests + '/' + r.numTotalTests, '(' + r.numPendingTests + ' skipped)');
    if (failed.length > 0) {
      console.log('Failed:');
      failed.forEach(f => console.log('  -', f.file));
    }
  "
fi
