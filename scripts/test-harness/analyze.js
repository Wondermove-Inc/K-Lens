#!/usr/bin/env node
/**
 * AI 에이전트 테스트 하네스 - 결과 분석기
 * Usage: node analyze.js <jest-json-output-file> [domain-id]
 * Output: JSON summary
 */

const fs = require("fs");

function analyzeResult(jsonPath, domainId) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  } catch (e) {
    return { error: `Failed to parse ${jsonPath}: ${e.message}` };
  }

  const summary = {
    timestamp: new Date().toISOString(),
    domain: domainId || null,
    success: raw.success,
    stats: {
      suites: {
        total: raw.numTotalTestSuites,
        passed: raw.numPassedTestSuites,
        failed: raw.numFailedTestSuites,
        skipped: raw.numPendingTestSuites || 0,
      },
      tests: {
        total: raw.numTotalTests,
        passed: raw.numPassedTests,
        failed: raw.numFailedTests,
        skipped: raw.numPendingTests,
      },
      duration_ms: raw.testResults?.reduce((sum, r) => sum + (r.perfStats?.runtime || 0), 0) || 0,
    },
    warnings: [],
    failures: [],
    slowSuites: [],
  };

  // 테스트 0개 매칭 경고
  if (raw.numTotalTestSuites === 0) {
    summary.warnings.push("No test suites matched - pattern may be stale");
  }

  for (const suite of raw.testResults || []) {
    // 실패 수집
    if (suite.status === "failed") {
      for (const test of suite.testResults || []) {
        if (test.status === "failed") {
          summary.failures.push({
            file: suite.testFilePath.replace(process.cwd() + "/", ""),
            suite: test.ancestorTitles?.join(" > ") || "",
            test: test.title,
            fullName: test.fullName,
            error: (test.failureMessages || [])
              .map((m) =>
                m
                  .split("\n")
                  .filter((l) => l.trim())
                  .slice(0, 5)
                  .join("\n"),
              )
              .join("\n---\n")
              .slice(0, 1000),
          });
        }
      }
    }

    // 느린 테스트 수집 (> 5s)
    const runtime = suite.perfStats?.runtime || 0;
    if (runtime > 5000) {
      summary.slowSuites.push({
        file: suite.testFilePath.replace(process.cwd() + "/", ""),
        duration_ms: runtime,
      });
    }
  }

  // warnings 비어있으면 제거
  if (summary.warnings.length === 0) {
    delete summary.warnings;
  }

  return summary;
}

const jsonPath = process.argv[2];
const domainId = process.argv[3];
if (!jsonPath) {
  console.error("Usage: node analyze.js <jest-json-output-file> [domain-id]");
  process.exit(1);
}

const result = analyzeResult(jsonPath, domainId);
console.log(JSON.stringify(result, null, 2));
