#!/usr/bin/env node
/**
 * 🎯 THEME-015: 하드코딩된 색상 검증 스크립트
 * 📝 JSX/TSX 파일에서 인라인 스타일의 하드코딩된 색상을 감지합니다.
 *
 * 사용법:
 *   node scripts/check-hardcoded-colors.js [files...]
 *   node scripts/check-hardcoded-colors.js --staged  # git staged files only
 *
 * 종료 코드:
 *   0: 문제 없음
 *   1: 하드코딩된 색상 발견
 *
 * @packageDocumentation
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// 색상 감지 패턴
const COLOR_PATTERNS = {
  HEX: /#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g,
  RGB: /\brgba?\s*\([^)]+\)/gi,
  HSL: /\bhsla?\s*\([^)]+\)/gi,
  NAMED:
    /\b(red|blue|green|yellow|orange|purple|pink|cyan|magenta|white|black|gray|grey|brown|navy|teal|maroon|olive|lime|aqua|fuchsia|silver)\b/gi,
};

// 허용되는 패턴 (예외)
const ALLOWED_PATTERNS = [
  /var\s*\(--[^)]+\)/g, // CSS 변수
  /oklch\s*\([^)]+\)/gi, // OKLCH 색상 (modern CSS)
  /currentColor/gi,
  /inherit/gi,
  /transparent/gi,
  /initial/gi,
  /unset/gi,
];

// 색상 관련 CSS 속성
const COLOR_PROPERTIES = [
  "color",
  "backgroundColor",
  "background",
  "borderColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "outlineColor",
  "fill",
  "stroke",
  "textDecorationColor",
  "caretColor",
  "columnRuleColor",
  "stopColor",
  "floodColor",
  "lightingColor",
];

/**
 * 🎯 파일에서 하드코딩된 색상을 검색합니다.
 * @param {string} filePath - 검사할 파일 경로
 * @returns {Array<{line: number, column: number, value: string, property: string}>} 발견된 문제 목록
 */
function checkFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const issues = [];

  // JSX style 속성 패턴: style={{ ... }} 또는 style={...}
  const styleRegex = /style\s*=\s*\{\s*\{([^}]*)\}\s*\}|style\s*=\s*\{([^}]+)\}/g;

  lines.forEach((line, lineIndex) => {
    let match;

    // style 속성 내용 추출
    while ((match = styleRegex.exec(line)) !== null) {
      const styleContent = match[1] || match[2];

      // 색상 속성 검사
      for (const property of COLOR_PROPERTIES) {
        const propRegex = new RegExp(`${property}\\s*:\\s*["']?([^,"'}]+)["']?`, "gi");
        let propMatch;

        while ((propMatch = propRegex.exec(styleContent)) !== null) {
          const value = propMatch[1].trim();

          // 허용된 패턴인지 확인
          const isAllowed = ALLOWED_PATTERNS.some((pattern) => pattern.test(value));

          if (!isAllowed) {
            // 하드코딩된 색상 검사
            for (const [type, pattern] of Object.entries(COLOR_PATTERNS)) {
              if (pattern.test(value)) {
                issues.push({
                  line: lineIndex + 1,
                  column: propMatch.index + 1,
                  value: value,
                  property: property,
                  type: type,
                });
                break;
              }
              // 정규식 lastIndex 리셋
              pattern.lastIndex = 0;
            }
          }
        }
      }
    }

    // 정규식 lastIndex 리셋
    styleRegex.lastIndex = 0;
  });

  return issues;
}

/**
 * 🎯 Git staged 파일 목록을 가져옵니다.
 * @returns {string[]} 파일 경로 목록
 */
function getStagedFiles() {
  try {
    const output = execSync("git diff --cached --name-only --diff-filter=ACMR", {
      encoding: "utf-8",
    });
    return output
      .trim()
      .split("\n")
      .filter((f) => f && (f.endsWith(".tsx") || f.endsWith(".jsx")));
  } catch {
    return [];
  }
}

/**
 * 🎯 메인 실행 함수
 */
function main() {
  const args = process.argv.slice(2);
  let files = [];

  if (args.includes("--staged")) {
    files = getStagedFiles();
  } else if (args.length > 0) {
    files = args.filter((f) => f.endsWith(".tsx") || f.endsWith(".jsx"));
  } else {
    // 기본: 모든 TSX/JSX 파일 검사
    console.log("사용법: node scripts/check-hardcoded-colors.js [files...] | --staged");
    console.log("       --staged: git staged 파일만 검사");
    process.exit(0);
  }

  if (files.length === 0) {
    console.log("검사할 JSX/TSX 파일이 없습니다.");
    process.exit(0);
  }

  let totalIssues = 0;
  const results = [];

  for (const file of files) {
    if (!fs.existsSync(file)) {
      continue;
    }

    const issues = checkFile(file);
    if (issues.length > 0) {
      totalIssues += issues.length;
      results.push({ file, issues });
    }
  }

  // 결과 출력
  if (results.length > 0) {
    console.log("\n🎨 THEME-015: 하드코딩된 색상 감지됨\n");
    console.log("CSS 변수(var(--color-*)) 또는 oklch()를 사용하세요.\n");

    for (const { file, issues } of results) {
      console.log(`📁 ${file}`);
      for (const issue of issues) {
        console.log(`   ${issue.line}:${issue.column} - ${issue.property}: "${issue.value}" (${issue.type})`);
      }
      console.log("");
    }

    console.log(`총 ${totalIssues}개의 하드코딩된 색상이 발견되었습니다.`);
    console.log("\n권장 수정 방법:");
    console.log("  - Hex (#fff) → var(--color-foreground) 또는 Tailwind 클래스");
    console.log("  - rgb()/hsl() → oklch() 또는 CSS 변수");
    console.log("  - 명명된 색상 (red) → var(--color-destructive)");
    process.exit(1);
  }

  console.log(`✅ ${files.length}개 파일 검사 완료 - 하드코딩된 색상 없음`);
  process.exit(0);
}

main();
