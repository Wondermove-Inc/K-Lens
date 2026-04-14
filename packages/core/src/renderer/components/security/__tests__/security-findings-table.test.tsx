/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * SecurityFindingsTable 컴포넌트 단위 test
 * (필터 & 정렬 기능 포함)
 */

import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import {
  type CveFinding,
  FindingType,
  type MisconfigFinding,
  ScannerSource,
  Severity,
} from "../../../../common/security/security-finding";
import { SecurityFindingsTable } from "../security-findings-table";

// shadcn mock
jest.mock("@skuberplus/storybook-shadcn/src/components/ui/card", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}));

jest.mock("@skuberplus/storybook-shadcn/src/components/ui/badge", () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="source-badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

jest.mock("@skuberplus/storybook-shadcn/src/components/ui/button", () => ({
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));

jest.mock("@skuberplus/storybook-shadcn/src/components/ui/input", () => ({
  Input: ({ value, onChange, placeholder }: any) => (
    <input data-testid="resource-search" value={value} onChange={onChange} placeholder={placeholder} />
  ),
}));

jest.mock("@skuberplus/storybook-shadcn/src/components/ui/toggle-group", () => ({
  ToggleGroup: ({ children, value, onValueChange, type }: any) => (
    <div data-testid={`toggle-group-${type}`} data-value={Array.isArray(value) ? value.join(",") : value}>
      {React.Children.map(children, (child) =>
        React.cloneElement(child, { _onValueChange: onValueChange, _currentValue: value, _type: type }),
      )}
    </div>
  ),
  ToggleGroupItem: ({ children, value, _onValueChange, _currentValue, _type }: any) => (
    <button
      data-testid={`toggle-item-${value}`}
      onClick={() => {
        if (_type === "multiple") {
          const current: string[] = Array.isArray(_currentValue) ? _currentValue : [];
          const next = current.includes(value) ? current.filter((v: string) => v !== value) : [...current, value];
          _onValueChange?.(next);
        } else {
          _onValueChange?.(value === _currentValue ? "" : value);
        }
      }}
    >
      {children}
    </button>
  ),
}));

// react-window mock
jest.mock("react-window", () => ({
  FixedSizeList: ({ children: Row, itemCount }: any) => (
    <div data-testid="virtual-list">{Array.from({ length: itemCount }, (_, i) => Row({ index: i, style: {} }))}</div>
  ),
}));

// react-virtualized-auto-sizer mock
jest.mock("react-virtualized-auto-sizer", () => ({
  __esModule: true,
  default: ({ children }: any) => children({ width: 800 }),
}));

// lucide mock
jest.mock("lucide-react", () => ({
  ArrowUpDown: () => <svg data-testid="icon-arrow-updown" />,
  ArrowUp: () => <svg data-testid="icon-arrow-up" />,
  ArrowDown: () => <svg data-testid="icon-arrow-down" />,
  ChevronRight: () => <svg data-testid="icon-chevron-right" />,
  MoreVertical: () => <svg data-testid="icon-more-vertical" />,
  X: () => <svg data-testid="icon-x" />,
}));

// ============================================
// fixture
// ============================================

const makeCveFinding = (overrides: Partial<CveFinding> = {}): CveFinding => ({
  id: `trivy-cve-CVE-2023-1234-default-my-app-${Math.random()}`,
  type: FindingType.CVE,
  severity: Severity.High,
  source: ScannerSource.Trivy,
  title: "CVE-2023-1234",
  description: "Test vulnerability",
  resource: { kind: "Pod", name: "my-app", namespace: "default" },
  cveId: "CVE-2023-1234",
  packageName: "openssl",
  installedVersion: "1.0.0",
  fixedVersion: "1.0.1",
  cvssScore: 7.5,
  references: [],
  detectedAt: "2026-03-09T00:00:00.000Z",
  remediation: undefined,
  ...overrides,
});

const makeMisconfigFinding = (overrides: Partial<MisconfigFinding> = {}): MisconfigFinding => ({
  id: `kubescape-misconfig-C-0002-default-Pod-my-app-${Math.random()}`,
  type: FindingType.Misconfiguration,
  severity: Severity.Medium,
  source: ScannerSource.Kubescape,
  title: "Privileged container",
  description: "Container runs as privileged",
  resource: { kind: "Pod", name: "my-app", namespace: "default" },
  checkId: "C-0002",
  category: "Kubescape",
  references: [],
  detectedAt: "2026-03-09T00:00:00.000Z",
  remediation: undefined,
  ...overrides,
});

// ============================================
// test
// ============================================

describe("SecurityFindingsTable", () => {
  // ─── 상태별 UI ──────────────────────────────────────────────────

  describe("상태별 플레이스홀더", () => {
    it("idle: 스캔 안내 문구가 표시된다", () => {
      render(<SecurityFindingsTable status="idle" findings={[]} />);
      expect(screen.getByText(/Run a scan to view vulnerabilities/)).toBeInTheDocument();
    });

    it("idle: 플레이스홀더 표시 (cancelled 제거)", () => {
      render(<SecurityFindingsTable status="idle" findings={[]} />);
      expect(screen.getByText(/Run a scan to view vulnerabilities/)).toBeInTheDocument();
    });

    it("scanning: 스캔 중 메시지가 표시된다", () => {
      render(<SecurityFindingsTable status="scanning" findings={[]} />);
      expect(screen.getByText("Scanning...")).toBeInTheDocument();
    });

    it("error: 오류 메시지가 표시된다", () => {
      render(<SecurityFindingsTable status="error" findings={[]} />);
      expect(screen.getByText(/An error occurred during scanning/)).toBeInTheDocument();
    });

    it("complete + 0건: 빈 상태 메시지가 표시된다", () => {
      render(<SecurityFindingsTable status="complete" findings={[]} />);
      expect(screen.getByText(/No vulnerabilities found/)).toBeInTheDocument();
    });
  });

  // ─── 기본 렌더링 ────────────────────────────────────────────────

  describe("complete + n건 — 기본 렌더링", () => {
    it("virtual list가 렌더링된다", () => {
      render(<SecurityFindingsTable status="complete" findings={[makeCveFinding()]} />);
      expect(screen.getByTestId("virtual-list")).toBeInTheDocument();
    });

    it("헤더에 '전체건수' 배지가 표시된다", () => {
      const findings = [makeCveFinding(), makeMisconfigFinding()];
      render(<SecurityFindingsTable status="complete" findings={findings} />);
      expect(screen.getByText(/2\s*\/\s*2/)).toBeInTheDocument();
    });

    it("CVE finding Title이 렌더링된다", () => {
      render(<SecurityFindingsTable status="complete" findings={[makeCveFinding()]} />);
      expect(screen.getAllByText("CVE-2023-1234").length).toBeGreaterThanOrEqual(1);
    });

    it("CVSS 점수가 렌더링된다", () => {
      render(<SecurityFindingsTable status="complete" findings={[makeCveFinding()]} />);
      expect(screen.getByText(/CVSS 7\.5/)).toBeInTheDocument();
    });

    it("fixedVersion 화살표가 렌더링된다", () => {
      render(<SecurityFindingsTable status="complete" findings={[makeCveFinding()]} />);
      expect(screen.getByText(/→ 1\.0\.1/)).toBeInTheDocument();
    });

    it("severity 배지(High)가 렌더링된다", () => {
      render(<SecurityFindingsTable status="complete" findings={[makeCveFinding({ severity: Severity.High })]} />);
      // severity 배지는 span[class*=bg-orange], ToggleGroupItem 버튼과 구분
      const highElements = screen.getAllByText("High");
      // 적어도 1개는 존재
      expect(highElements.length).toBeGreaterThanOrEqual(1);
      // 배지용 span이 포함되어 있는지 확인
      const badge = highElements.find((el) => el.tagName === "SPAN");
      expect(badge).toBeTruthy();
    });

    it("Trivy Source 배지가 렌더링된다", () => {
      render(<SecurityFindingsTable status="complete" findings={[makeCveFinding()]} />);
      expect(screen.getByTestId("source-badge")).toHaveTextContent("Trivy");
    });

    it("Kubescape Source 배지가 렌더링된다", () => {
      render(<SecurityFindingsTable status="complete" findings={[makeMisconfigFinding()]} />);
      expect(screen.getByTestId("source-badge")).toHaveTextContent("Kubescape");
    });
  });

  // ─── 필터 툴바 UI ───────────────────────────────────────────────

  describe("필터 툴바", () => {
    it("데이터가 있을 때 severity ToggleGroup이 렌더링된다", () => {
      render(<SecurityFindingsTable status="complete" findings={[makeCveFinding()]} />);
      expect(screen.getByTestId("toggle-group-multiple")).toBeInTheDocument();
    });

    it("데이터가 있을 때 type ToggleGroup이 렌더링된다", () => {
      render(<SecurityFindingsTable status="complete" findings={[makeCveFinding()]} />);
      expect(screen.getByTestId("toggle-group-single")).toBeInTheDocument();
    });

    it("데이터가 있을 때 Resource 검색 input이 렌더링된다", () => {
      render(<SecurityFindingsTable status="complete" findings={[makeCveFinding()]} />);
      expect(screen.getByTestId("resource-search")).toBeInTheDocument();
    });

    it("데이터가 없으면 필터 툴바가 표시되지 않는다", () => {
      render(<SecurityFindingsTable status="complete" findings={[]} />);
      expect(screen.queryByTestId("resource-search")).not.toBeInTheDocument();
    });

    it("필터 없을 때 Clear 버튼이 표시되지 않는다", () => {
      render(<SecurityFindingsTable status="complete" findings={[makeCveFinding()]} />);
      expect(screen.queryByText("Reset", { exact: false })).not.toBeInTheDocument();
    });
  });

  // ─── severity 필터 ──────────────────────────────────────────────

  describe("severity 필터", () => {
    it("High 토글 클릭 시 Critical finding이 필터링된다", () => {
      const findings = [
        makeCveFinding({ severity: Severity.Critical, title: "Critical-Finding" }),
        makeCveFinding({ severity: Severity.High, title: "High-Finding" }),
      ];
      render(<SecurityFindingsTable status="complete" findings={findings} />);
      fireEvent.click(screen.getByTestId(`toggle-item-${Severity.High}`));
      expect(screen.queryByText("Critical-Finding")).not.toBeInTheDocument();
      expect(screen.getByText("High-Finding")).toBeInTheDocument();
    });

    it("severity 필터 활성화 시 Clear 버튼이 표시된다", () => {
      render(<SecurityFindingsTable status="complete" findings={[makeCveFinding()]} />);
      fireEvent.click(screen.getByTestId(`toggle-item-${Severity.High}`));
      expect(screen.getByText("Reset", { exact: false })).toBeInTheDocument();
    });

    it("Clear 버튼 클릭 시 필터가 해제된다", () => {
      const findings = [
        makeCveFinding({ severity: Severity.Critical, title: "Critical-Finding" }),
        makeCveFinding({ severity: Severity.High, title: "High-Finding" }),
      ];
      render(<SecurityFindingsTable status="complete" findings={findings} />);
      fireEvent.click(screen.getByTestId(`toggle-item-${Severity.High}`));
      fireEvent.click(screen.getByText("Reset", { exact: false }));
      expect(screen.getByText("Critical-Finding")).toBeInTheDocument();
    });
  });

  // ─── type 필터 ──────────────────────────────────────────────────

  describe("type 필터", () => {
    it("CVE Type 필터 클릭 시 Misconfig finding이 필터링된다", () => {
      const findings = [makeCveFinding({ title: "CVE-Finding" }), makeMisconfigFinding({ title: "Misconfig-Finding" })];
      render(<SecurityFindingsTable status="complete" findings={findings} />);
      fireEvent.click(screen.getByTestId(`toggle-item-${FindingType.CVE}`));
      expect(screen.queryByText("Misconfig-Finding")).not.toBeInTheDocument();
      expect(screen.getByText("CVE-Finding")).toBeInTheDocument();
    });

    it("필터 후 결과 0건이면 'No results match the current filters' 표시", () => {
      render(<SecurityFindingsTable status="complete" findings={[makeMisconfigFinding()]} />);
      fireEvent.click(screen.getByTestId(`toggle-item-${FindingType.CVE}`));
      expect(screen.getByText("No results match the current filters")).toBeInTheDocument();
    });
  });

  // ─── Resource 검색 ────────────────────────────────────────────────

  describe("Resource명 검색", () => {
    it("검색어 입력 시 title 매칭 finding만 표시된다", () => {
      const findings = [makeCveFinding({ title: "apache-vuln" }), makeCveFinding({ title: "openssl-vuln" })];
      render(<SecurityFindingsTable status="complete" findings={findings} />);
      fireEvent.change(screen.getByTestId("resource-search"), {
        target: { value: "apache" },
      });
      expect(screen.queryByText("openssl-vuln")).not.toBeInTheDocument();
      expect(screen.getByText("apache-vuln")).toBeInTheDocument();
    });

    it("대소문자를 무시하고 검색된다", () => {
      const findings = [makeCveFinding({ title: "Apache-Vuln" })];
      render(<SecurityFindingsTable status="complete" findings={findings} />);
      fireEvent.change(screen.getByTestId("resource-search"), {
        target: { value: "apache" },
      });
      expect(screen.getByText("Apache-Vuln")).toBeInTheDocument();
    });

    it("검색어 입력 시 Clear 버튼이 표시된다", () => {
      render(<SecurityFindingsTable status="complete" findings={[makeCveFinding()]} />);
      fireEvent.change(screen.getByTestId("resource-search"), {
        target: { value: "test" },
      });
      expect(screen.getByText("Reset", { exact: false })).toBeInTheDocument();
    });
  });

  // ─── 정렬 ───────────────────────────────────────────────────────

  describe("헤더 정렬", () => {
    it("기본 정렬(severity desc): Critical이 Low보다 먼저 표시된다", () => {
      const findings = [
        makeCveFinding({ severity: Severity.Low, title: "Low-Finding" }),
        makeCveFinding({ severity: Severity.Critical, title: "Critical-Finding" }),
      ];
      render(<SecurityFindingsTable status="complete" findings={findings} />);
      const items = screen.getAllByText(/-Finding/);
      expect(items[0].textContent).toBe("Critical-Finding");
    });

    it("Title 헤더 클릭 시 asc 아이콘이 표시된다", () => {
      render(<SecurityFindingsTable status="complete" findings={[makeCveFinding()]} />);
      fireEvent.click(screen.getByRole("button", { name: /Title/ }));
      expect(screen.getByTestId("icon-arrow-up")).toBeInTheDocument();
    });

    it("Title 헤더 2번 클릭 시 desc 아이콘으로 변경된다", () => {
      render(<SecurityFindingsTable status="complete" findings={[makeCveFinding()]} />);
      const titleBtn = screen.getByRole("button", { name: /Title/ });
      fireEvent.click(titleBtn);
      fireEvent.click(titleBtn);
      expect(screen.getByTestId("icon-arrow-down")).toBeInTheDocument();
    });

    it("title asc 정렬 시 알파벳 오름차순으로 정렬된다", () => {
      const findings = [makeCveFinding({ title: "zebra-vuln" }), makeCveFinding({ title: "alpha-vuln" })];
      render(<SecurityFindingsTable status="complete" findings={findings} />);
      fireEvent.click(screen.getByRole("button", { name: /Title/ }));
      const items = screen.getAllByText(/-vuln/);
      expect(items[0].textContent).toBe("alpha-vuln");
    });
  });

  // ─── 필터 건수 배지 ─────────────────────────────────────────────

  describe("필터 건수 배지", () => {
    it("필터 적용 후 'filtered/total건' 형식으로 표시된다", () => {
      const findings = [makeCveFinding({ severity: Severity.High }), makeCveFinding({ severity: Severity.Low })];
      render(<SecurityFindingsTable status="complete" findings={findings} />);
      fireEvent.click(screen.getByTestId(`toggle-item-${Severity.High}`));
      expect(screen.getByText(/1\s*\/\s*2/)).toBeInTheDocument();
    });
  });
});
