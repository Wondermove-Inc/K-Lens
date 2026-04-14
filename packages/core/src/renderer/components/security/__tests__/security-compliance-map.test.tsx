/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * SecurityComplianceMap 컴포넌트 단위 test
 */

import { render, screen } from "@testing-library/react";
import React from "react";
import {
  type CveFinding,
  FindingType,
  type MisconfigFinding,
  ScannerSource,
  Severity,
} from "../../../../common/security/security-finding";
import { SecurityComplianceMap } from "../security-compliance-map";

jest.mock("@skuberplus/storybook-shadcn/src/components/ui/card", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}));

jest.mock("lucide-react", () => ({
  ShieldCheck: () => <svg data-testid="icon-shield-check" />,
}));

const makeCve = (severity: Severity): CveFinding => ({
  id: `trivy-cve-${Math.random()}`,
  type: FindingType.CVE,
  severity,
  source: ScannerSource.Trivy,
  title: "CVE-test",
  description: "",
  resource: { kind: "Pod", name: "app", namespace: "default" },
  cveId: "CVE-2023-0001",
  packageName: "pkg",
  installedVersion: "1.0",
  fixedVersion: undefined,
  cvssScore: undefined,
  references: [],
  detectedAt: "2026-03-09T00:00:00.000Z",
  remediation: undefined,
});

const makeMisconfig = (severity: Severity): MisconfigFinding => ({
  id: `kubescape-${Math.random()}`,
  type: FindingType.Misconfiguration,
  severity,
  source: ScannerSource.Kubescape,
  title: "Misconfig",
  description: "",
  resource: { kind: "Pod", name: "app", namespace: "default" },
  checkId: "C-0001",
  category: "Kubescape",
  references: [],
  detectedAt: "2026-03-09T00:00:00.000Z",
  remediation: undefined,
});

describe("SecurityComplianceMap", () => {
  describe("상태별 플레이스홀더", () => {
    it("idle: 안내 문구가 표시된다", () => {
      render(<SecurityComplianceMap status="idle" findings={[]} />);
      expect(screen.getByText(/Run a scan to see compliance status/)).toBeInTheDocument();
    });

    it("scanning: 분석 중 메시지가 표시된다", () => {
      render(<SecurityComplianceMap status="scanning" findings={[]} />);
      expect(screen.getByText("Analyzing...")).toBeInTheDocument();
    });

    it("error: 오류 메시지가 표시된다", () => {
      render(<SecurityComplianceMap status="error" findings={[]} />);
      expect(screen.getByText(/An error occurred during scanning/)).toBeInTheDocument();
    });
  });

  describe("complete 상태", () => {
    it("'컨테이너 보안'과 '설정 준수' 두 소스 카드가 렌더링된다", () => {
      render(<SecurityComplianceMap status="complete" findings={[]} />);
      expect(screen.getByText("Container Security")).toBeInTheDocument();
      expect(screen.getByText("Configuration Compliance")).toBeInTheDocument();
    });

    it("finding 0건이면 '취약점 없음 ✅' 표시된다", () => {
      render(<SecurityComplianceMap status="complete" findings={[]} />);
      const emptyMessages = screen.getAllByText("No vulnerabilities");
      expect(emptyMessages).toHaveLength(2);
    });

    it("Trivy findings만 있으면 '컨테이너 보안' 카드에 건수가 표시된다", () => {
      const findings = [makeCve(Severity.High), makeCve(Severity.Medium)];
      render(<SecurityComplianceMap status="complete" findings={findings} />);
      expect(screen.getByText("2 total")).toBeInTheDocument();
    });

    it("Kubescape findings만 있으면 '설정 준수' 카드에 건수가 표시된다", () => {
      const findings = [makeMisconfig(Severity.Low)];
      render(<SecurityComplianceMap status="complete" findings={findings} />);
      expect(screen.getByText("1 total")).toBeInTheDocument();
    });
  });

  describe("통과율 계산", () => {
    it("Critical/High 0건이면 100% 표시된다", () => {
      const findings = [makeCve(Severity.Medium), makeCve(Severity.Low)];
      render(<SecurityComplianceMap status="complete" findings={findings} />);
      expect(screen.getAllByText("100%").length).toBeGreaterThanOrEqual(1);
    });

    it("전체 4건 중 Critical 1 + High 1이면 통과율 50%", () => {
      const findings = [
        makeCve(Severity.Critical),
        makeCve(Severity.High),
        makeCve(Severity.Medium),
        makeCve(Severity.Low),
      ];
      render(<SecurityComplianceMap status="complete" findings={findings} />);
      expect(screen.getByText("50%")).toBeInTheDocument();
    });

    it("전체가 Critical이면 통과율 0%", () => {
      const findings = [makeCve(Severity.Critical), makeCve(Severity.Critical)];
      render(<SecurityComplianceMap status="complete" findings={findings} />);
      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("findings 0건이면 통과율 100%", () => {
      render(<SecurityComplianceMap status="complete" findings={[]} />);
      const hundredPcts = screen.getAllByText("100%");
      expect(hundredPcts.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("소스 분리", () => {
    it("Trivy와 Kubescape findings가 각각 분리 집계된다", () => {
      const findings = [
        makeCve(Severity.Critical), // Trivy: 1건
        makeMisconfig(Severity.Low), // Kubescape: 1건
      ];
      render(<SecurityComplianceMap status="complete" findings={findings} />);
      // 총 1건 두 번 (각 소스별)
      expect(screen.getAllByText("1 total")).toHaveLength(2);
    });
  });
});
