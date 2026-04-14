/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * SecurityRbacPanel 컴포넌트 단위 test
 */

import { render, screen } from "@testing-library/react";
import React from "react";
import { FindingType, type RbacFinding, ScannerSource, Severity } from "../../../../common/security/security-finding";
import { SecurityRbacPanel } from "../security-rbac-panel";

jest.mock("@skuberplus/storybook-shadcn/src/components/ui/card", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}));

jest.mock("@skuberplus/storybook-shadcn/src/components/ui/badge", () => ({
  Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
}));

jest.mock("lucide-react", () => ({
  ShieldAlert: () => <svg data-testid="icon-shield-alert" />,
}));

const makeRbac = (overrides: Partial<RbacFinding> = {}): RbacFinding => ({
  id: `rbac-${Math.random()}`,
  type: FindingType.RBAC,
  severity: Severity.High,
  source: ScannerSource.Kubescape,
  title: "Dangerous RBAC",
  description: "desc",
  resource: { kind: "ClusterRoleBinding", name: "admin-binding", namespace: "" },
  subject: "system:serviceaccount:default:my-sa",
  riskyPermissions: ["*:*", "secrets:get"],
  references: [],
  detectedAt: "2026-03-09T00:00:00.000Z",
  remediation: undefined,
  ...overrides,
});

describe("SecurityRbacPanel", () => {
  describe("상태별 플레이스홀더", () => {
    it("idle: RBAC 안내 문구가 표시된다", () => {
      render(<SecurityRbacPanel status="idle" findings={[]} />);
      expect(screen.getByText(/Run a scan to see RBAC risks/)).toBeInTheDocument();
    });

    it("scanning: 스캔 중 메시지가 표시된다", () => {
      render(<SecurityRbacPanel status="scanning" findings={[]} />);
      expect(screen.getByText("Scanning...")).toBeInTheDocument();
    });

    it("error: 오류 메시지가 표시된다", () => {
      render(<SecurityRbacPanel status="error" findings={[]} />);
      expect(screen.getByText(/An error occurred during scanning/)).toBeInTheDocument();
    });

    it("complete + 0건: RBAC 없음 메시지가 표시된다", () => {
      render(<SecurityRbacPanel status="complete" findings={[]} />);
      expect(screen.getByText(/No RBAC risks found/)).toBeInTheDocument();
    });
  });

  describe("RBAC 없는 findings (비RBAC)", () => {
    it("CVE finding만 있으면 RBAC 없음 메시지가 표시된다", () => {
      const cveFinding = { ...makeRbac(), type: FindingType.CVE } as any;
      render(<SecurityRbacPanel status="complete" findings={[cveFinding]} />);
      expect(screen.getByText(/No RBAC risks found/)).toBeInTheDocument();
    });
  });

  describe("RBAC 데이터 표시", () => {
    it("subject명이 렌더링된다", () => {
      render(<SecurityRbacPanel status="complete" findings={[makeRbac()]} />);
      expect(screen.getByText("system:serviceaccount:default:my-sa")).toBeInTheDocument();
    });

    it("severity 배지가 렌더링된다", () => {
      render(<SecurityRbacPanel status="complete" findings={[makeRbac({ severity: Severity.Critical })]} />);
      expect(screen.getByText("Critical")).toBeInTheDocument();
    });

    it("riskyPermissions가 표시된다", () => {
      render(<SecurityRbacPanel status="complete" findings={[makeRbac()]} />);
      expect(screen.getByText("*:*")).toBeInTheDocument();
      expect(screen.getByText("secrets:get")).toBeInTheDocument();
    });

    it("6개 초과 권한은 +n 배지로 표시된다", () => {
      const finding = makeRbac({ riskyPermissions: ["a", "b", "c", "d", "e", "f", "g", "h"] });
      render(<SecurityRbacPanel status="complete" findings={[finding]} />);
      expect(screen.getByText("+2")).toBeInTheDocument();
    });

    it("건수 배지가 표시된다", () => {
      render(<SecurityRbacPanel status="complete" findings={[makeRbac()]} />);
      expect(screen.getByText("1")).toBeInTheDocument();
    });
  });

  describe("subject 그룹화", () => {
    it("동일 subject의 findings가 1개 행으로 그룹화된다", () => {
      const findings = [
        makeRbac({ subject: "sa-a", title: "Finding-1" }),
        makeRbac({ subject: "sa-a", title: "Finding-2" }),
        makeRbac({ subject: "sa-b", title: "Finding-3" }),
      ];
      render(<SecurityRbacPanel status="complete" findings={findings} />);
      const subjects = screen.getAllByText(/^sa-/);
      expect(subjects).toHaveLength(2);
    });

    it("심각도 높은 subject가 먼저 표시된다", () => {
      const findings = [
        makeRbac({ subject: "low-sa", severity: Severity.Low }),
        makeRbac({ subject: "critical-sa", severity: Severity.Critical }),
      ];
      render(<SecurityRbacPanel status="complete" findings={findings} />);
      const subjects = screen.getAllByText(/-sa$/);
      expect(subjects[0].textContent).toBe("critical-sa");
    });

    it("중복 권한이 제거된다", () => {
      const findings = [
        makeRbac({ subject: "sa-a", riskyPermissions: ["*:*", "secrets:get"] }),
        makeRbac({ subject: "sa-a", riskyPermissions: ["*:*", "pods:delete"] }),
      ];
      render(<SecurityRbacPanel status="complete" findings={findings} />);
      // "*:*"은 1번만 렌더링
      expect(screen.getAllByText("*:*")).toHaveLength(1);
    });
  });
});
