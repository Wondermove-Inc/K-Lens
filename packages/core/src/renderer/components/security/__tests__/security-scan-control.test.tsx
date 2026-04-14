/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * SecurityScanControl 컴포넌트 단위 test
 */

import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { SecurityScanControl } from "../security-scan-control";

import type { ScanState } from "../../../../features/security/renderer/security-scan-store";

// shadcn 컴포넌트 mock
jest.mock("@skuberplus/storybook-shadcn/src/components/ui/card", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@skuberplus/storybook-shadcn/src/components/ui/button", () => ({
  Button: ({ children, onClick, variant }: any) => (
    <button data-variant={variant} onClick={onClick}>
      {children}
    </button>
  ),
}));

// lucide-react mock
jest.mock("lucide-react", () => ({
  Play: () => <svg data-testid="icon-play" />,
  Square: () => <svg data-testid="icon-square" />,
  RefreshCw: () => <svg data-testid="icon-refresh" />,
}));

// Mock SecurityScanStore 빌더
function buildMockStore(overrides: Partial<ScanState> = {}) {
  const scanState: ScanState = {
    status: "idle",
    scanId: null,
    progress: 0,
    message: "",
    findingsSoFar: 0,
    completedScanners: [],
    scannedAt: null,
    findings: [],
    errorType: null,
    currentClusterId: "test-cluster",
    ...overrides,
  };

  return {
    scanState,
    get isScanning() {
      return scanState.status === "scanning" && scanState.currentClusterId === "test-cluster";
    },
    // Return findings from scanState.findings so tests can control hasClusterFindings
    getFindingsForCluster: jest.fn().mockReturnValue((scanState as { findings?: unknown[] }).findings ?? []),
    startScan: jest.fn().mockResolvedValue("scan-123"),
    cancelScan: jest.fn().mockResolvedValue(undefined),
  };
}

const BASE_PROPS = {
  contextName: undefined,
  scanMode: "sequential" as const,
  clusterId: "test-cluster",
  kubeconfigPath: "/tmp/kubeconfig",
};

describe("SecurityScanControl", () => {
  describe("idle 상태", () => {
    it("'스캔 시작' 버튼이 렌더링된다", () => {
      const store = buildMockStore({ status: "idle" });
      render(<SecurityScanControl store={store as any} {...BASE_PROPS} />);
      expect(screen.getByText("Start Scan")).toBeInTheDocument();
    });

    it("Play 아이콘이 표시된다", () => {
      const store = buildMockStore({ status: "idle" });
      render(<SecurityScanControl store={store as any} {...BASE_PROPS} />);
      expect(screen.getByTestId("icon-play")).toBeInTheDocument();
    });

    it("진행률 바가 표시되지 않는다", () => {
      const store = buildMockStore({ status: "idle" });
      render(<SecurityScanControl store={store as any} {...BASE_PROPS} />);
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("버튼 클릭 시 startScan이 호출된다", () => {
      const store = buildMockStore({ status: "idle" });
      render(<SecurityScanControl store={store as any} {...BASE_PROPS} />);
      fireEvent.click(screen.getByText("Start Scan"));
      expect(store.startScan).toHaveBeenCalledWith({
        clusterId: "test-cluster",
        kubeconfigPath: "/tmp/kubeconfig",
        contextName: undefined,
        scanMode: "sequential",
        scanner: "all",
      });
    });
  });

  describe("scanning 상태", () => {
    it("'스캔 취소' 버튼이 렌더링된다", () => {
      const store = buildMockStore({ status: "scanning", progress: 45, message: "Scanning..." });
      render(<SecurityScanControl store={store as any} {...BASE_PROPS} />);
      expect(screen.getByText("Cancel Scan")).toBeInTheDocument();
    });

    it("Square 아이콘이 표시된다", () => {
      const store = buildMockStore({ status: "scanning" });
      render(<SecurityScanControl store={store as any} {...BASE_PROPS} />);
      expect(screen.getByTestId("icon-square")).toBeInTheDocument();
    });

    it("진행률 바가 표시된다 (ARIA progressbar)", () => {
      const store = buildMockStore({ status: "scanning", progress: 60 });
      render(<SecurityScanControl store={store as any} {...BASE_PROPS} />);
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("진행률 % 숫자가 표시된다", () => {
      const store = buildMockStore({ status: "scanning", progress: 60 });
      render(<SecurityScanControl store={store as any} {...BASE_PROPS} />);
      expect(screen.getByText("60%")).toBeInTheDocument();
    });

    it("findingsSoFar > 0이면 개수가 표시된다", () => {
      const store = buildMockStore({ status: "scanning", progress: 50, findingsSoFar: 23 });
      render(<SecurityScanControl store={store as any} {...BASE_PROPS} />);
      expect(screen.getByText("23 vulnerabilities found")).toBeInTheDocument();
    });

    it("findingsSoFar = 0이면 카운터가 표시되지 않는다", () => {
      const store = buildMockStore({ status: "scanning", progress: 50, findingsSoFar: 0 });
      render(<SecurityScanControl store={store as any} {...BASE_PROPS} />);
      expect(screen.queryByText(/vulnerabilities found/)).not.toBeInTheDocument();
    });

    it("취소 버튼 클릭 시 cancelScan이 호출된다", () => {
      const store = buildMockStore({ status: "scanning" });
      render(<SecurityScanControl store={store as any} {...BASE_PROPS} />);
      fireEvent.click(screen.getByText("Cancel Scan"));
      expect(store.cancelScan).toHaveBeenCalled();
    });
  });

  describe("complete 상태", () => {
    // Use a non-empty findings array so hasClusterFindings=true → "Rescan" button shown
    const completedWithFindings = {
      status: "complete" as const,
      scannedAt: "2026-03-09T05:30:00.000Z",
      findings: [{}],
    };

    it("'재스캔' 버튼이 렌더링된다", () => {
      const store = buildMockStore(completedWithFindings);
      render(<SecurityScanControl store={store as any} {...BASE_PROPS} />);
      expect(screen.getByText("Rescan")).toBeInTheDocument();
    });

    it("RefreshCw 아이콘이 표시된다", () => {
      const store = buildMockStore(completedWithFindings);
      render(<SecurityScanControl store={store as any} {...BASE_PROPS} />);
      expect(screen.getByTestId("icon-refresh")).toBeInTheDocument();
    });

    it("완료 시각이 표시된다", () => {
      const store = buildMockStore(completedWithFindings);
      render(<SecurityScanControl store={store as any} {...BASE_PROPS} />);
      expect(screen.getByText(/Completed:/i)).toBeInTheDocument();
    });

    it("진행률 바가 표시되지 않는다", () => {
      const store = buildMockStore({ status: "complete", findings: [{}] });
      render(<SecurityScanControl store={store as any} {...BASE_PROPS} />);
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });
  });

  describe("error 상태", () => {
    it("'재스캔' 버튼이 렌더링된다", () => {
      const store = buildMockStore({ status: "error", message: "바이너리 없음" });
      render(<SecurityScanControl store={store as any} {...BASE_PROPS} />);
      expect(screen.getByText("Rescan")).toBeInTheDocument();
    });

    it("에러 메시지가 표시된다", () => {
      const store = buildMockStore({ status: "error", message: "바이너리 없음" });
      render(<SecurityScanControl store={store as any} {...BASE_PROPS} />);
      expect(screen.getByText("바이너리 없음")).toBeInTheDocument();
    });
  });

  describe("idle 상태 (cancelled 제거)", () => {
    it("'스캔 시작' 버튼이 렌더링된다", () => {
      const store = buildMockStore({ status: "idle" });
      render(<SecurityScanControl store={store as any} {...BASE_PROPS} />);
      expect(screen.getByText("Start Scan")).toBeInTheDocument();
    });
  });
});
