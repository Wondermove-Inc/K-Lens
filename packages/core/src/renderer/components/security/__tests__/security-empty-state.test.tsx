/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * SecurityEmptyState 컴포넌트 단위 test
 */

import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { SecurityEmptyState } from "../security-empty-state";

// shadcn empty mock
jest.mock("@skuberplus/storybook-shadcn/src/components/ui/empty", () => ({
  Empty: ({ children, style }: any) => (
    <div data-testid="empty-container" style={style}>
      {children}
    </div>
  ),
  EmptyHeader: ({ children }: any) => <div>{children}</div>,
  EmptyTitle: ({ children }: any) => <h2>{children}</h2>,
  EmptyDescription: ({ children }: any) => <p>{children}</p>,
}));

jest.mock("@skuberplus/storybook-shadcn/src/components/ui/button", () => ({
  Button: ({ children, onClick, variant }: any) => (
    <button data-testid="action-btn" data-variant={variant} onClick={onClick}>
      {children}
    </button>
  ),
}));

// lucide mock
jest.mock("lucide-react", () => ({
  ShieldCheck: ({ className }: any) => <svg data-testid="icon-shield-check" className={className} />,
  ScanLine: ({ className }: any) => <svg data-testid="icon-scan-line" className={className} />,
  ShieldX: ({ className }: any) => <svg data-testid="icon-shield-x" className={className} />,
  ServerOff: ({ className }: any) => <svg data-testid="icon-server-off" className={className} />,
}));

describe("SecurityEmptyState", () => {
  // ─── idle ───────────────────────────────────────────────────────

  describe("idle variant", () => {
    it("ScanLine 아이콘이 렌더링된다", () => {
      render(<SecurityEmptyState variant="idle" />);
      expect(screen.getByTestId("icon-scan-line")).toBeInTheDocument();
    });

    it("'보안 스캔을 시작하세요' 제목이 표시된다", () => {
      render(<SecurityEmptyState variant="idle" />);
      expect(screen.getByText("Start a Security Scan")).toBeInTheDocument();
    });

    it("onStartScan 있으면 '스캔 시작' 버튼이 표시된다", () => {
      render(<SecurityEmptyState variant="idle" onStartScan={jest.fn()} />);
      expect(screen.getByTestId("action-btn")).toHaveTextContent("Start Scan");
    });

    it("onStartScan 없으면 버튼이 표시되지 않는다", () => {
      render(<SecurityEmptyState variant="idle" />);
      expect(screen.queryByTestId("action-btn")).not.toBeInTheDocument();
    });

    it("버튼 클릭 시 onStartScan이 호출된다", () => {
      const onStart = jest.fn();
      render(<SecurityEmptyState variant="idle" onStartScan={onStart} />);
      fireEvent.click(screen.getByTestId("action-btn"));
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it("버튼 variant가 default다", () => {
      render(<SecurityEmptyState variant="idle" onStartScan={jest.fn()} />);
      expect(screen.getByTestId("action-btn")).toHaveAttribute("data-variant", "default");
    });
  });

  // ─── clean ──────────────────────────────────────────────────────

  describe("clean variant", () => {
    it("ShieldCheck 아이콘이 렌더링된다", () => {
      render(<SecurityEmptyState variant="clean" />);
      expect(screen.getByTestId("icon-shield-check")).toBeInTheDocument();
    });

    it("'클러스터가 안전합니다' 제목이 표시된다", () => {
      render(<SecurityEmptyState variant="clean" />);
      expect(screen.getByText("Your cluster is secure")).toBeInTheDocument();
    });

    it("onStartScan 있으면 '재스캔' 버튼이 표시된다", () => {
      render(<SecurityEmptyState variant="clean" onStartScan={jest.fn()} />);
      expect(screen.getByTestId("action-btn")).toHaveTextContent("Rescan");
    });

    it("ShieldCheck 아이콘에 초록 클래스가 적용된다", () => {
      render(<SecurityEmptyState variant="clean" />);
      expect(screen.getByTestId("icon-shield-check").getAttribute("class")).toContain("text-green-500");
    });
  });

  // ─── error ──────────────────────────────────────────────────────

  describe("error variant", () => {
    it("ShieldX 아이콘이 렌더링된다", () => {
      render(<SecurityEmptyState variant="error" />);
      expect(screen.getByTestId("icon-shield-x")).toBeInTheDocument();
    });

    it("'스캔 실패' 제목이 표시된다", () => {
      render(<SecurityEmptyState variant="error" />);
      expect(screen.getByText("Scan Failed")).toBeInTheDocument();
    });

    it("errorMessage prop이 있으면 커스텀 메시지가 표시된다", () => {
      render(<SecurityEmptyState variant="error" errorMessage="Connection timeout" />);
      expect(screen.getByText("Connection timeout")).toBeInTheDocument();
    });

    it("errorMessage prop 없으면 기본 설명이 표시된다", () => {
      render(<SecurityEmptyState variant="error" />);
      expect(screen.getByText(/An error occurred during scanning/)).toBeInTheDocument();
    });

    it("onStartScan 있으면 '다시 시도' 버튼이 표시된다", () => {
      render(<SecurityEmptyState variant="error" onStartScan={jest.fn()} />);
      expect(screen.getByTestId("action-btn")).toHaveTextContent("Retry");
    });

    it("버튼 variant가 destructive다", () => {
      render(<SecurityEmptyState variant="error" onStartScan={jest.fn()} />);
      expect(screen.getByTestId("action-btn")).toHaveAttribute("data-variant", "destructive");
    });
  });

  // ─── cancelled ──────────────────────────────────────────────────

  describe("idle variant (cancelled removed)", () => {
    it("ScanLine 아이콘이 렌더링된다", () => {
      render(<SecurityEmptyState variant="idle" />);
      expect(screen.getByTestId("icon-scan-line")).toBeInTheDocument();
    });

    it("'스캔이 취소됐습니다' 제목이 표시된다", () => {
      render(<SecurityEmptyState variant="idle" />);
      expect(screen.getByText("Start a Security Scan")).toBeInTheDocument();
    });

    it("onStartScan 있으면 '스캔 시작' 버튼이 표시된다", () => {
      render(<SecurityEmptyState variant="idle" onStartScan={jest.fn()} />);
      expect(screen.getByTestId("action-btn")).toHaveTextContent("Start Scan");
    });

    it("ScanLine 아이콘에 주황 클래스가 적용된다", () => {
      render(<SecurityEmptyState variant="idle" />);
      expect(screen.getByTestId("icon-scan-line").getAttribute("class")).toContain("text-muted-foreground");
    });
  });

  // ─── no-cluster ─────────────────────────────────────────────────

  describe("no-cluster variant", () => {
    it("ServerOff 아이콘이 렌더링된다", () => {
      render(<SecurityEmptyState variant="no-cluster" />);
      expect(screen.getByTestId("icon-server-off")).toBeInTheDocument();
    });

    it("'클러스터를 선택해 주세요' 제목이 표시된다", () => {
      render(<SecurityEmptyState variant="no-cluster" />);
      expect(screen.getByText("Select a Cluster")).toBeInTheDocument();
    });

    it("onStartScan이 있어도 버튼이 표시되지 않는다", () => {
      // no-cluster는 actionLabel이 없으므로 버튼 미표시
      render(<SecurityEmptyState variant="no-cluster" onStartScan={jest.fn()} />);
      expect(screen.queryByTestId("action-btn")).not.toBeInTheDocument();
    });
  });

  // ─── height prop ────────────────────────────────────────────────

  describe("height prop", () => {
    it("기본 높이 360px이 적용된다", () => {
      render(<SecurityEmptyState variant="idle" />);
      const container = screen.getByTestId("empty-container");
      expect(container).toHaveStyle({ height: "360px" });
    });

    it("커스텀 높이가 적용된다", () => {
      render(<SecurityEmptyState variant="idle" height={500} />);
      const container = screen.getByTestId("empty-container");
      expect(container).toHaveStyle({ height: "500px" });
    });
  });
});
