/**
 * @jest-environment node
 */
/**
 * security-score.ts unit tests
 *
 * Formula (ratio-based with MIN_FINDING_BASELINE + 1-decimal precision + 99.9 cap):
 *   weightedSum    = Σ(severity_weight × count)
 *   effectiveTotal = max(totalFindings, MIN_FINDING_BASELINE=10)
 *   maxWeightedSum = effectiveTotal × 10
 *   raw            = (1 - weightedSum / maxWeightedSum) × 100
 *   score          = min(99.9, Math.round(raw × 10) / 10)   [when findings > 0]
 *   score          = 100                                      [when no findings]
 *
 * Weights: CRITICAL=10, HIGH=5, MEDIUM=2, LOW=1, UNKNOWN=0.5
 *
 * Grade thresholds:
 *   A (Perfect):         score = 100       — No findings
 *   B (Action Required): score 90 ~ 99.9   — Findings present but score is high
 *   C (Moderate Risk):   score 80 ~ 89
 *   D (High Risk):       score 70 ~ 79     — Immediate action recommended
 *   F (Critical Risk):   score 0  ~ 69     — Severe vulnerabilities
 */

import { FindingType, ScannerSource, Severity } from "../security-finding";
import {
  calculateSecurityScore,
  calculateWeightedOverallScore,
  SecurityGrade,
  type SecurityScore,
  toGrade,
} from "../security-score";

import type { AnySecurityFinding } from "../security-finding";

// ─────────────────────────────────────────────
// Helper: finding factory
// ─────────────────────────────────────────────

function makeFinding(severity: Severity, count = 1): AnySecurityFinding[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `finding-${severity}-${i}`,
    type: FindingType.Misconfiguration,
    severity,
    source: ScannerSource.Trivy,
    title: `Test ${severity} finding`,
    description: "test",
    resource: { kind: "Pod", name: `pod-${i}`, namespace: "default" },
    detectedAt: "2026-03-09T00:00:00Z",
  }));
}

// ─────────────────────────────────────────────
// calculateSecurityScore()
// ─────────────────────────────────────────────

describe("calculateSecurityScore()", () => {
  describe("No findings", () => {
    it("empty array → score 100 (integer), grade A, totalFindings 0", () => {
      const result = calculateSecurityScore([]);
      expect(result.score).toBe(100);
      expect(result.grade).toBe(SecurityGrade.A);
      expect(result.totalFindings).toBe(0);
    });

    it("all breakdown counts are 0", () => {
      const { breakdown } = calculateSecurityScore([]);
      expect(breakdown[Severity.Critical]).toBe(0);
      expect(breakdown[Severity.High]).toBe(0);
      expect(breakdown[Severity.Medium]).toBe(0);
      expect(breakdown[Severity.Low]).toBe(0);
      expect(breakdown[Severity.Unknown]).toBe(0);
    });
  });

  describe("99.9 cap — score < 100 when findings exist", () => {
    it("UNKNOWN 1 → score 99.5 (not 100, distinguishes from no-finding state)", () => {
      // ws=0.5, effectiveTotal=10, maxWs=100 → raw=99.5
      const result = calculateSecurityScore(makeFinding(Severity.Unknown, 1));
      expect(result.score).toBe(99.5);
      expect(result.score).toBeLessThan(100);
    });

    it("any finding results in score < 100", () => {
      const severities = [Severity.Critical, Severity.High, Severity.Medium, Severity.Low, Severity.Unknown];
      for (const sev of severities) {
        const result = calculateSecurityScore(makeFinding(sev, 1));
        expect(result.score).toBeLessThan(100);
      }
    });
  });

  describe("1-decimal precision", () => {
    it("large mixed cluster → 71.0", () => {
      const findings: AnySecurityFinding[] = [
        ...makeFinding(Severity.Critical, 35),
        ...makeFinding(Severity.High, 82),
        ...makeFinding(Severity.Medium, 127),
        ...makeFinding(Severity.Low, 92),
        ...makeFinding(Severity.Unknown, 55),
      ];
      const result = calculateSecurityScore(findings);
      // ws=1133.5, eff=391, maxWs=3910 → raw=71.0102... → 71.0
      expect(result.score).toBe(71.0);
      expect(result.grade).toBe(SecurityGrade.C);
      expect(result.totalFindings).toBe(391);
    });

    it("score has at most 1 decimal place", () => {
      const result = calculateSecurityScore(makeFinding(Severity.Unknown, 1));
      expect(result.score).toBe(Math.round(result.score * 10) / 10);
    });
  });

  describe("MIN_FINDING_BASELINE=10 (finding count < 10)", () => {
    it("CRITICAL 1 → score 90.0, grade B (finding exists → not A)", () => {
      // ws=10, effectiveTotal=10, maxWs=100 → 90.0
      // score 90~99.9 = grade B (Action Required)
      const result = calculateSecurityScore(makeFinding(Severity.Critical, 1));
      expect(result.score).toBe(90.0);
      expect(result.grade).toBe(SecurityGrade.B);
    });

    it("CRITICAL 5 → score 50.0, grade D (effectiveTotal=10)", () => {
      // ws=50, effectiveTotal=10, maxWs=100 → 50.0
      const result = calculateSecurityScore(makeFinding(Severity.Critical, 5));
      expect(result.score).toBe(50.0);
      expect(result.grade).toBe(SecurityGrade.D);
    });

    it("HIGH 1 → score 95.0, grade B (effectiveTotal=10, findings exist)", () => {
      // ws=5, effectiveTotal=10, maxWs=100 → 95.0
      // score 90~99.9 = grade B
      const result = calculateSecurityScore(makeFinding(Severity.High, 1));
      expect(result.score).toBe(95.0);
      expect(result.grade).toBe(SecurityGrade.B);
    });

    it("CRITICAL 1 + HIGH 1 (total 2) → score 85.0, grade B", () => {
      // ws=15, effectiveTotal=10, maxWs=100 → 85.0
      // score 85~99.9 = grade B
      const findings = [...makeFinding(Severity.Critical, 1), ...makeFinding(Severity.High, 1)];
      const result = calculateSecurityScore(findings);
      expect(result.score).toBe(85.0);
      expect(result.grade).toBe(SecurityGrade.B);
    });

    it("inversion resolved: CRITICAL 1 (90.0) > CRITICAL 5 (50.0)", () => {
      const score1 = calculateSecurityScore(makeFinding(Severity.Critical, 1)).score;
      const score5 = calculateSecurityScore(makeFinding(Severity.Critical, 5)).score;
      expect(score1).toBeGreaterThan(score5);
    });

    it("inversion resolved: CRITICAL 1 (90.0) > CRITICAL5+LOW5 (45.0)", () => {
      const score1 = calculateSecurityScore(makeFinding(Severity.Critical, 1)).score;
      const score5l5 = calculateSecurityScore([
        ...makeFinding(Severity.Critical, 5),
        ...makeFinding(Severity.Low, 5),
      ]).score;
      expect(score1).toBeGreaterThan(score5l5);
    });
  });

  describe("finding count ≥ 10 — effectiveTotal = actualTotal", () => {
    it("CRITICAL 10 → score 0.0, grade F", () => {
      // ws=100, effectiveTotal=10, maxWs=100 → 0.0
      const result = calculateSecurityScore(makeFinding(Severity.Critical, 10));
      expect(result.score).toBe(0.0);
      expect(result.grade).toBe(SecurityGrade.F);
    });

    it("HIGH 10 → score 50.0, grade D", () => {
      const result = calculateSecurityScore(makeFinding(Severity.High, 10));
      expect(result.score).toBe(50.0);
      expect(result.grade).toBe(SecurityGrade.D);
    });

    it("MEDIUM 10 → score 80.0, grade C", () => {
      // score 70~84 = grade C (Moderate Risk)
      const result = calculateSecurityScore(makeFinding(Severity.Medium, 10));
      expect(result.score).toBe(80.0);
      expect(result.grade).toBe(SecurityGrade.C);
    });

    it("LOW 10 → score 90.0, grade B (findings exist → not A)", () => {
      // score 90~99.9 = grade B (Action Required)
      const result = calculateSecurityScore(makeFinding(Severity.Low, 10));
      expect(result.score).toBe(90.0);
      expect(result.grade).toBe(SecurityGrade.B);
    });

    it("UNKNOWN 10 → score 95.0, grade B (findings exist → not A)", () => {
      // score 90~99.9 = grade B (Action Required)
      const result = calculateSecurityScore(makeFinding(Severity.Unknown, 10));
      expect(result.score).toBe(95.0);
      expect(result.grade).toBe(SecurityGrade.B);
    });

    it("LOW 9 + CRITICAL 1 (total 10) → score 81.0, grade C", () => {
      // ws=9+10=19, effectiveTotal=10, maxWs=100 → 81.0
      // score 85~99.9 = grade B
      const findings = [...makeFinding(Severity.Low, 9), ...makeFinding(Severity.Critical, 1)];
      const result = calculateSecurityScore(findings);
      expect(result.score).toBe(81.0);
      expect(result.grade).toBe(SecurityGrade.C);
    });
  });

  describe("Grade A is exclusive to score=100 (no findings)", () => {
    it("any finding → grade is never A", () => {
      const cases = [
        makeFinding(Severity.Low, 1),
        makeFinding(Severity.Unknown, 1),
        makeFinding(Severity.Medium, 1),
        makeFinding(Severity.High, 1),
        makeFinding(Severity.Critical, 1),
      ];
      for (const findings of cases) {
        const result = calculateSecurityScore(findings);
        expect(result.grade).not.toBe(SecurityGrade.A);
      }
    });

    it("no findings → grade A", () => {
      expect(calculateSecurityScore([]).grade).toBe(SecurityGrade.A);
    });
  });

  describe("breakdown accuracy", () => {
    it("severity counts are correctly reflected in breakdown", () => {
      const findings: AnySecurityFinding[] = [
        ...makeFinding(Severity.Critical, 3),
        ...makeFinding(Severity.High, 7),
        ...makeFinding(Severity.Medium, 5),
      ];
      const { breakdown, totalFindings } = calculateSecurityScore(findings);
      expect(breakdown[Severity.Critical]).toBe(3);
      expect(breakdown[Severity.High]).toBe(7);
      expect(breakdown[Severity.Medium]).toBe(5);
      expect(breakdown[Severity.Low]).toBe(0);
      expect(breakdown[Severity.Unknown]).toBe(0);
      expect(totalFindings).toBe(15);
    });

    it("totalFindings is actual finding count, not effectiveTotal", () => {
      const result = calculateSecurityScore(makeFinding(Severity.Critical, 1));
      expect(result.totalFindings).toBe(1);
    });
  });

  describe("score range guarantee (0 ~ 99.9, or 100 when no findings)", () => {
    it("no findings → 100", () => {
      expect(calculateSecurityScore([]).score).toBe(100);
    });

    it("with findings → score is between 0 and 99.9 inclusive", () => {
      const cases = [
        makeFinding(Severity.Critical, 1),
        makeFinding(Severity.Critical, 100),
        makeFinding(Severity.Unknown, 1),
        makeFinding(Severity.Low, 1000),
      ];
      for (const findings of cases) {
        const { score } = calculateSecurityScore(findings);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(99.9);
      }
    });
  });
});

// ─────────────────────────────────────────────
// toGrade() — boundary analysis
// ─────────────────────────────────────────────

describe("toGrade() boundary values", () => {
  const cases: Array<[number, SecurityGrade]> = [
    [100, SecurityGrade.A], // Perfect: no findings only
    [99.9, SecurityGrade.B], // Needs Attention
    [90, SecurityGrade.B],
    [85, SecurityGrade.B],
    [84.9, SecurityGrade.C], // Moderate Risk
    [70, SecurityGrade.C],
    [69.9, SecurityGrade.D], // High Risk
    [50, SecurityGrade.D],
    [49.9, SecurityGrade.F], // Critical Risk
    [60, SecurityGrade.D],
    [0, SecurityGrade.F],
  ];

  test.each(cases)("score %s → grade %s", (score, expected) => {
    expect(toGrade(score)).toBe(expected);
  });
});

// ─────────────────────────────────────────────
// calculateWeightedOverallScore — workloadTimedOut
// ─────────────────────────────────────────────

describe("calculateWeightedOverallScore — workloadTimedOut", () => {
  const emptyBreakdown = () => ({
    [Severity.Critical]: 0,
    [Severity.High]: 0,
    [Severity.Medium]: 0,
    [Severity.Low]: 0,
    [Severity.Unknown]: 0,
  });

  const makeScore = (score: number): SecurityScore => ({
    score,
    grade: toGrade(score),
    breakdown: emptyBreakdown(),
    totalFindings: 0,
  });

  it("타임아웃 없으면 가중 평균 그대로 (platform 80 / workload 60 → 72)", () => {
    const result = calculateWeightedOverallScore(makeScore(80), makeScore(60), false);
    expect(result.score).toBe(72);
  });

  it("workloadTimedOut=true면 platform 단독 점수 반환 (workload 100점 부풀림 방지)", () => {
    // Trivy 타임아웃 → findings=0 → workloadScore=100이지만 무시해야 함
    const platform = makeScore(72);
    const workload = makeScore(100); // 타임아웃으로 인한 가짜 100점
    const result = calculateWeightedOverallScore(platform, workload, true);
    expect(result.score).toBe(72); // workload 무시, platform 그대로
  });

  it("workloadTimedOut=true이고 workload=null이면 platform 단독 점수", () => {
    const result = calculateWeightedOverallScore(makeScore(85), null, true);
    expect(result.score).toBe(85);
  });
});
