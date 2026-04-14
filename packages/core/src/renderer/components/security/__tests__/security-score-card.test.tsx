/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * SecurityScoreCard 컴포넌트 단위 test
 */

import { render, screen } from "@testing-library/react";
import React from "react";
import { Severity } from "../../../../common/security/security-finding";
import { SecurityGrade } from "../../../../common/security/security-score";
import { SecurityScoreCard } from "../security-score-card";

// shadcn 컴포넌트 mock
jest.mock("@skuberplus/storybook-shadcn/src/components/ui/card", () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}));

jest.mock("@skuberplus/storybook-shadcn/src/components/ui/badge", () => ({
  Badge: ({ children, variant }: any) => <span data-variant={variant}>{children}</span>,
}));

const makeScore = (overrides = {}) => ({
  score: 71.0,
  grade: SecurityGrade.C,
  totalFindings: 10,
  breakdown: {
    [Severity.Critical]: 2,
    [Severity.High]: 3,
    [Severity.Medium]: 3,
    [Severity.Low]: 1,
    [Severity.Unknown]: 1,
  },
  ...overrides,
});

describe("SecurityScoreCard", () => {
  describe("idle 상태", () => {
    it("-- 표시와 안내 문구가 렌더링된다", () => {
      render(<SecurityScoreCard status="idle" score={null} />);
      expect(screen.getByText("--")).toBeInTheDocument();
      expect(screen.getByText("Run a scan to get started")).toBeInTheDocument();
    });
  });

  describe("idle 상태 (cancelled 제거)", () => {
    it("idle과 동일한 UI가 렌더링된다", () => {
      render(<SecurityScoreCard status="idle" score={null} />);
      expect(screen.getByText("--")).toBeInTheDocument();
    });
  });

  describe("scanning 상태", () => {
    it("스캔 중 텍스트가 렌더링된다", () => {
      render(<SecurityScoreCard status="scanning" score={null} progress={45} />);
      expect(screen.getByText("Scanning...")).toBeInTheDocument();
    });

    it("진행률 숫자가 표시된다", () => {
      render(<SecurityScoreCard status="scanning" score={null} progress={60} />);
      expect(screen.getByText("60%")).toBeInTheDocument();
    });

    it("progress 미지정 시 0% 표시", () => {
      render(<SecurityScoreCard status="scanning" score={null} />);
      expect(screen.getByText("0%")).toBeInTheDocument();
    });
  });

  describe("complete 상태", () => {
    it("점수가 렌더링된다", () => {
      render(<SecurityScoreCard status="complete" score={makeScore()} />);
      expect(screen.getByText("71")).toBeInTheDocument();
    });

    it("등급이 렌더링된다", () => {
      render(<SecurityScoreCard status="complete" score={makeScore()} />);
      const gradeC = screen.getAllByText("C");
      expect(gradeC.length).toBeGreaterThanOrEqual(1);
    });

    it("총 finding 수가 렌더링된다", () => {
      render(<SecurityScoreCard status="complete" score={makeScore()} />);
      expect(screen.getByText(/10 vulnerabilities found/)).toBeInTheDocument();
    });

    it("A등급 점수 표시", () => {
      render(
        <SecurityScoreCard
          status="complete"
          score={makeScore({
            score: 95,
            grade: SecurityGrade.A,
            totalFindings: 0,
            breakdown: {
              [Severity.Critical]: 0,
              [Severity.High]: 0,
              [Severity.Medium]: 0,
              [Severity.Low]: 0,
              [Severity.Unknown]: 0,
            },
          })}
        />,
      );
      const gradeA = screen.getAllByText("A");
      expect(gradeA.length).toBeGreaterThanOrEqual(1);
    });

    it("F등급 점수 표시", () => {
      render(<SecurityScoreCard status="complete" score={makeScore({ score: 20, grade: SecurityGrade.F })} />);
      const gradeF = screen.getAllByText("F");
      expect(gradeF.length).toBeGreaterThanOrEqual(1);
    });

    it("totalFindings가 0이면 severity 분포 바가 렌더링되지 않는다", () => {
      const zeroBreakdown = {
        [Severity.Critical]: 0,
        [Severity.High]: 0,
        [Severity.Medium]: 0,
        [Severity.Low]: 0,
        [Severity.Unknown]: 0,
      };
      render(
        <SecurityScoreCard
          status="complete"
          score={makeScore({ score: 100, grade: SecurityGrade.A, totalFindings: 0, breakdown: zeroBreakdown })}
        />,
      );
      // breakdown 범례가 없는지 확인 (severity breakdown 영역 자체가 없어야 함)
      // 등급 기준 표에 Critical이 존재하므로 severity bar 영역으로 체크
      const badges = document.querySelectorAll(".gap-x-3.gap-y-1 span.rounded-full");
      expect(badges.length).toBe(0);
    });

    it("severity breakdown badge가 렌더링된다", () => {
      render(<SecurityScoreCard status="complete" score={makeScore()} />);
      expect(screen.getAllByText("Critical").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("High").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("error 상태", () => {
    it("스캔 실패 텍스트가 렌더링된다", () => {
      render(<SecurityScoreCard status="error" score={null} />);
      expect(screen.getByText("Scan Failed")).toBeInTheDocument();
    });

    it("에러 메시지가 렌더링된다", () => {
      render(<SecurityScoreCard status="error" score={null} errorMessage="Trivy 바이너리를 찾을 수 없습니다" />);
      expect(screen.getByText("Trivy 바이너리를 찾을 수 없습니다")).toBeInTheDocument();
    });

    it("에러 메시지 없으면 메시지 없이 렌더링된다", () => {
      render(<SecurityScoreCard status="error" score={null} />);
      expect(screen.queryByText("undefined")).not.toBeInTheDocument();
    });
  });
});
