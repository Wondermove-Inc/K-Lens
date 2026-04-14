/**
 * 벤치마크 리포트 생성기
 *
 * E2E 테스트 및 성능 검증
 *
 * 벤치마크 결과를 다양한 형식으로 출력합니다.
 *
 * @module report-generator
 */

import type { BenchmarkResult } from "./benchmark-runner";

/**
 * 리포트 형식
 */
export type ReportFormat = "console" | "json" | "markdown" | "summary";

/**
 * 리포트 옵션 인터페이스
 */
export interface ReportOptions {
  /**
   * 리포트 제목
   */
  title?: string;

  /**
   * 출력 형식
   */
  format?: ReportFormat;

  /**
   * 상세 정보 포함 여부
   */
  detailed?: boolean;

  /**
   * 타임스탬프 포함 여부
   */
  includeTimestamp?: boolean;
}

/**
 * 집계된 리포트 데이터
 */
export interface AggregatedReport {
  /**
   * 리포트 제목
   */
  title: string;

  /**
   * 생성 시각
   */
  generatedAt: string;

  /**
   * 총 벤치마크 수
   */
  totalBenchmarks: number;

  /**
   * 성공 벤치마크 수
   */
  successfulBenchmarks: number;

  /**
   * 실패 벤치마크 수
   */
  failedBenchmarks: number;

  /**
   * 벤치마크 결과 목록
   */
  benchmarks: BenchmarkResult[];

  /**
   * 전체 통계
   */
  summary: {
    /**
     * 총 반복 횟수
     */
    totalIterations: number;

    /**
     * 총 실행 시간 (ms)
     */
    totalTimeMs: number;

    /**
     * 전체 평균 실행 시간 (ms)
     */
    overallAvgTimeMs: number;

    /**
     * 전체 평균 ops/sec
     */
    overallOpsPerSecond: number;
  };
}

/**
 * 벤치마크 리포트 생성기
 *
 * @example
 * ```typescript
 * const generator = new ReportGenerator();
 * const results: BenchmarkResult[] = [...];
 *
 * // 콘솔 출력
 * generator.generate(results, { format: "console" });
 *
 * // JSON 문자열 반환
 * const json = generator.generate(results, { format: "json" });
 *
 * // 마크다운 문자열 반환
 * const md = generator.generate(results, { format: "markdown" });
 * ```
 */
export class ReportGenerator {
  /**
   * 리포트 생성
   *
   * @param results 벤치마크 결과 배열
   * @param options 리포트 옵션
   * @returns 리포트 문자열 (console 형식 제외)
   */
  generate(results: BenchmarkResult[], options?: ReportOptions): string {
    const { title = "벤치마크 리포트", format = "console", detailed = false, includeTimestamp = true } = options ?? {};

    const aggregated = this.aggregate(results, title);

    switch (format) {
      case "console":
        return this.formatConsole(aggregated, detailed);
      case "json":
        return this.formatJson(aggregated, detailed);
      case "markdown":
        return this.formatMarkdown(aggregated, detailed, includeTimestamp);
      case "summary":
        return this.formatSummary(aggregated);
      default:
        return this.formatConsole(aggregated, detailed);
    }
  }

  /**
   * 결과 집계
   *
   * @param results 벤치마크 결과 배열
   * @param title 리포트 제목
   * @returns 집계된 리포트 데이터
   */
  aggregate(results: BenchmarkResult[], title: string): AggregatedReport {
    const successfulBenchmarks = results.filter((r) => r.success);
    const failedBenchmarks = results.filter((r) => !r.success);

    const totalIterations = successfulBenchmarks.reduce((sum, r) => sum + r.iterations, 0);
    const totalTimeMs = successfulBenchmarks.reduce((sum, r) => sum + r.totalTimeMs, 0);
    const overallAvgTimeMs =
      totalIterations > 0
        ? successfulBenchmarks.reduce((sum, r) => sum + r.avgTimeMs * r.iterations, 0) / totalIterations
        : 0;
    const overallOpsPerSecond = totalTimeMs > 0 ? (totalIterations / totalTimeMs) * 1000 : 0;

    return {
      title,
      generatedAt: new Date().toISOString(),
      totalBenchmarks: results.length,
      successfulBenchmarks: successfulBenchmarks.length,
      failedBenchmarks: failedBenchmarks.length,
      benchmarks: results,
      summary: {
        totalIterations,
        totalTimeMs,
        overallAvgTimeMs,
        overallOpsPerSecond,
      },
    };
  }

  /**
   * 콘솔 형식 포맷
   *
   * @param report 집계된 리포트
   * @param detailed 상세 정보 포함 여부
   * @returns 포맷된 문자열
   * @private
   */
  private formatConsole(report: AggregatedReport, detailed: boolean): string {
    const lines: string[] = [];

    lines.push("");
    lines.push(`═══════════════════════════════════════════════════════`);
    lines.push(`  ${report.title}`);
    lines.push(`  Generated: ${report.generatedAt}`);
    lines.push(`═══════════════════════════════════════════════════════`);
    lines.push("");

    for (const result of report.benchmarks) {
      if (result.success) {
        lines.push(`✅ ${result.name}`);
        lines.push(`   반복: ${result.iterations}회`);
        lines.push(`   평균: ${result.avgTimeMs.toFixed(3)}ms`);
        lines.push(`   P50:  ${result.p50TimeMs.toFixed(3)}ms`);
        lines.push(`   P90:  ${result.p90TimeMs.toFixed(3)}ms`);
        lines.push(`   P99:  ${result.p99TimeMs.toFixed(3)}ms`);
        lines.push(`   ops/sec: ${result.opsPerSecond.toFixed(2)}`);

        if (detailed) {
          lines.push(`   최소: ${result.minTimeMs.toFixed(3)}ms`);
          lines.push(`   최대: ${result.maxTimeMs.toFixed(3)}ms`);
          lines.push(`   총시간: ${result.totalTimeMs.toFixed(3)}ms`);
        }
      } else {
        lines.push(`❌ ${result.name}`);
        lines.push(`   에러: ${result.error}`);
      }
      lines.push("");
    }

    lines.push(`───────────────────────────────────────────────────────`);
    lines.push(`  총 벤치마크: ${report.totalBenchmarks}개`);
    lines.push(`  성공: ${report.successfulBenchmarks}개`);
    lines.push(`  실패: ${report.failedBenchmarks}개`);
    lines.push(`  총 반복: ${report.summary.totalIterations}회`);
    lines.push(`  전체 평균: ${report.summary.overallAvgTimeMs.toFixed(3)}ms`);
    lines.push(`  전체 ops/sec: ${report.summary.overallOpsPerSecond.toFixed(2)}`);
    lines.push(`───────────────────────────────────────────────────────`);
    lines.push("");

    return lines.join("\n");
  }

  /**
   * JSON 형식 포맷
   *
   * @param report 집계된 리포트
   * @param detailed 상세 정보 포함 여부
   * @returns JSON 문자열
   * @private
   */
  private formatJson(report: AggregatedReport, detailed: boolean): string {
    if (detailed) {
      return JSON.stringify(report, null, 2);
    }

    // 간략 버전: times 배열 제외
    const simplified = {
      ...report,
      benchmarks: report.benchmarks.map((b) => {
        const { times, ...rest } = b;
        return rest;
      }),
    };

    return JSON.stringify(simplified, null, 2);
  }

  /**
   * 마크다운 형식 포맷
   *
   * @param report 집계된 리포트
   * @param detailed 상세 정보 포함 여부
   * @param includeTimestamp 타임스탬프 포함 여부
   * @returns 마크다운 문자열
   * @private
   */
  private formatMarkdown(report: AggregatedReport, detailed: boolean, includeTimestamp: boolean): string {
    const lines: string[] = [];

    lines.push(`# ${report.title}`);
    lines.push("");

    if (includeTimestamp) {
      lines.push(`> Generated: ${report.generatedAt}`);
      lines.push("");
    }

    lines.push("## 요약");
    lines.push("");
    lines.push(`| 항목 | 값 |`);
    lines.push(`|------|-----|`);
    lines.push(`| 총 벤치마크 | ${report.totalBenchmarks}개 |`);
    lines.push(`| 성공 | ${report.successfulBenchmarks}개 |`);
    lines.push(`| 실패 | ${report.failedBenchmarks}개 |`);
    lines.push(`| 총 반복 | ${report.summary.totalIterations}회 |`);
    lines.push(`| 전체 평균 | ${report.summary.overallAvgTimeMs.toFixed(3)}ms |`);
    lines.push(`| 전체 ops/sec | ${report.summary.overallOpsPerSecond.toFixed(2)} |`);
    lines.push("");

    lines.push("## 벤치마크 결과");
    lines.push("");

    if (detailed) {
      lines.push(`| 벤치마크 | 반복 | 평균 | P50 | P90 | P99 | 최소 | 최대 | ops/sec | 상태 |`);
      lines.push(`|----------|------|------|-----|-----|-----|------|------|---------|------|`);

      for (const result of report.benchmarks) {
        if (result.success) {
          lines.push(
            `| ${result.name} | ${result.iterations} | ${result.avgTimeMs.toFixed(2)}ms | ${result.p50TimeMs.toFixed(2)}ms | ${result.p90TimeMs.toFixed(2)}ms | ${result.p99TimeMs.toFixed(2)}ms | ${result.minTimeMs.toFixed(2)}ms | ${result.maxTimeMs.toFixed(2)}ms | ${result.opsPerSecond.toFixed(1)} | ✅ |`,
          );
        } else {
          lines.push(`| ${result.name} | - | - | - | - | - | - | - | - | ❌ |`);
        }
      }
    } else {
      lines.push(`| 벤치마크 | 반복 | 평균 | P90 | ops/sec | 상태 |`);
      lines.push(`|----------|------|------|-----|---------|------|`);

      for (const result of report.benchmarks) {
        if (result.success) {
          lines.push(
            `| ${result.name} | ${result.iterations} | ${result.avgTimeMs.toFixed(2)}ms | ${result.p90TimeMs.toFixed(2)}ms | ${result.opsPerSecond.toFixed(1)} | ✅ |`,
          );
        } else {
          lines.push(`| ${result.name} | - | - | - | - | ❌ |`);
        }
      }
    }

    lines.push("");

    // 실패한 벤치마크가 있으면 에러 표시
    const failed = report.benchmarks.filter((b) => !b.success);
    if (failed.length > 0) {
      lines.push("## 실패 상세");
      lines.push("");
      for (const result of failed) {
        lines.push(`### ${result.name}`);
        lines.push("");
        lines.push("```");
        lines.push(result.error ?? "Unknown error");
        lines.push("```");
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  /**
   * 간략 요약 형식 포맷
   *
   * @param report 집계된 리포트
   * @returns 요약 문자열
   * @private
   */
  private formatSummary(report: AggregatedReport): string {
    const lines: string[] = [];

    lines.push(`${report.title}: ${report.successfulBenchmarks}/${report.totalBenchmarks} 성공`);
    lines.push(
      `평균: ${report.summary.overallAvgTimeMs.toFixed(2)}ms, ${report.summary.overallOpsPerSecond.toFixed(0)} ops/sec`,
    );

    return lines.join("\n");
  }
}

/**
 * 싱글톤 리포트 생성기 인스턴스
 */
export const reportGenerator = new ReportGenerator();
