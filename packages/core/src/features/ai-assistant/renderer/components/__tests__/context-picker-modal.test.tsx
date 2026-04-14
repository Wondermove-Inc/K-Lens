/**
 * 🎯 목적: ContextPickerModal 컴포넌트 단위 테스트
 * 01: Context Picker Modal UI 구현
 * @packageDocumentation
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ContextType } from "../../../common/context-types";
import { ContextPickerModal } from "../context-picker-modal";

import type { ContextItem } from "../../../common/context-types";

// Mock 리소스 데이터
const mockResources: ContextItem[] = [
  { id: "pod-1", type: ContextType.POD, name: "nginx-pod-1", namespace: "default", createdAt: new Date() },
  { id: "pod-2", type: ContextType.POD, name: "nginx-pod-2", namespace: "default", createdAt: new Date() },
  { id: "deploy-1", type: ContextType.DEPLOYMENT, name: "nginx-deploy", namespace: "default", createdAt: new Date() },
  { id: "svc-1", type: ContextType.SERVICE, name: "nginx-service", namespace: "kube-system", createdAt: new Date() },
];

// Mock fetcher
const mockFetcher = jest.fn().mockResolvedValue(mockResources);

describe("ContextPickerModal 컴포넌트", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("렌더링", () => {
    it("AC1: isOpen=true일 때 모달이 표시되어야 한다", () => {
      render(<ContextPickerModal isOpen={true} onClose={jest.fn()} onSelect={jest.fn()} fetcher={mockFetcher} />);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("AC2: isOpen=false일 때 모달이 숨겨져야 한다", () => {
      render(<ContextPickerModal isOpen={false} onClose={jest.fn()} onSelect={jest.fn()} fetcher={mockFetcher} />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("모달 제목이 표시되어야 한다", () => {
      render(<ContextPickerModal isOpen={true} onClose={jest.fn()} onSelect={jest.fn()} fetcher={mockFetcher} />);
      expect(screen.getByText(/Select Context/i)).toBeInTheDocument();
    });

    it("검색 입력 필드가 표시되어야 한다", () => {
      render(<ContextPickerModal isOpen={true} onClose={jest.fn()} onSelect={jest.fn()} fetcher={mockFetcher} />);
      expect(screen.getByPlaceholderText(/Search/i)).toBeInTheDocument();
    });
  });

  describe("리소스 표시", () => {
    it("AC3: 리소스 목록이 표시되어야 한다", async () => {
      render(<ContextPickerModal isOpen={true} onClose={jest.fn()} onSelect={jest.fn()} fetcher={mockFetcher} />);

      await waitFor(() => {
        expect(screen.getByText("nginx-pod-1")).toBeInTheDocument();
        expect(screen.getByText("nginx-deploy")).toBeInTheDocument();
      });
    });

    it("로딩 중일 때 로딩 표시가 나타나야 한다", async () => {
      const slowFetcher = jest
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(mockResources), 100)));

      render(<ContextPickerModal isOpen={true} onClose={jest.fn()} onSelect={jest.fn()} fetcher={slowFetcher} />);

      expect(screen.getByTestId("loading-indicator")).toBeInTheDocument();
    });

    it("리소스가 없을 때 빈 상태 메시지가 표시되어야 한다", async () => {
      const emptyFetcher = jest.fn().mockResolvedValue([]);

      render(<ContextPickerModal isOpen={true} onClose={jest.fn()} onSelect={jest.fn()} fetcher={emptyFetcher} />);

      await waitFor(() => {
        expect(screen.getByText(/No resources found/i)).toBeInTheDocument();
      });
    });
  });

  describe("타입 필터", () => {
    it("AC4: 타입 필터 탭이 표시되어야 한다", () => {
      render(<ContextPickerModal isOpen={true} onClose={jest.fn()} onSelect={jest.fn()} fetcher={mockFetcher} />);

      expect(screen.getByRole("tab", { name: /All/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Pod/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Deployment/i })).toBeInTheDocument();
    });

    it("타입 탭 클릭 시 해당 타입만 필터링되어야 한다", async () => {
      const user = userEvent.setup();
      const typedFetcher = jest.fn().mockResolvedValue(mockResources);

      render(<ContextPickerModal isOpen={true} onClose={jest.fn()} onSelect={jest.fn()} fetcher={typedFetcher} />);

      await waitFor(() => {
        expect(screen.getByText("nginx-pod-1")).toBeInTheDocument();
      });

      const initialCalls = typedFetcher.mock.calls.length;
      const podTab = screen.getByRole("tab", { name: /Pod/i });
      await user.click(podTab);

      await waitFor(() => {
        // 탭 클릭 후 추가 호출이 있어야 함
        expect(typedFetcher.mock.calls.length).toBeGreaterThan(initialCalls);
      });
    });
  });

  describe("검색", () => {
    it("AC5: 검색어 입력 시 필터링되어야 한다", async () => {
      const user = userEvent.setup();
      const searchFetcher = jest.fn().mockResolvedValue(mockResources);

      render(<ContextPickerModal isOpen={true} onClose={jest.fn()} onSelect={jest.fn()} fetcher={searchFetcher} />);

      await waitFor(() => {
        expect(screen.getByText("nginx-pod-1")).toBeInTheDocument();
      });

      const initialCalls = searchFetcher.mock.calls.length;
      const searchInput = screen.getByPlaceholderText(/Search/i);
      await user.type(searchInput, "nginx");

      await waitFor(() => {
        // 검색어 입력 후 추가 호출이 있어야 함
        expect(searchFetcher.mock.calls.length).toBeGreaterThan(initialCalls);
      });
    });

    it("검색어 초기화 버튼이 동작해야 한다", async () => {
      const user = userEvent.setup();

      render(<ContextPickerModal isOpen={true} onClose={jest.fn()} onSelect={jest.fn()} fetcher={mockFetcher} />);

      const searchInput = screen.getByPlaceholderText(/Search/i);
      await user.type(searchInput, "nginx");

      const clearButton = screen.getByLabelText(/Clear search/i);
      await user.click(clearButton);

      expect(searchInput).toHaveValue("");
    });
  });

  describe("선택 동작", () => {
    it("AC6: 리소스 클릭 시 onSelect가 호출되어야 한다", async () => {
      const user = userEvent.setup();
      const onSelect = jest.fn();

      render(<ContextPickerModal isOpen={true} onClose={jest.fn()} onSelect={onSelect} fetcher={mockFetcher} />);

      await waitFor(() => {
        expect(screen.getByText("nginx-pod-1")).toBeInTheDocument();
      });

      await user.click(screen.getByText("nginx-pod-1"));

      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "pod-1", name: "nginx-pod-1" }));
    });

    it("다중 선택 모드에서 여러 리소스를 선택할 수 있어야 한다", async () => {
      const user = userEvent.setup();
      const onSelect = jest.fn();

      render(
        <ContextPickerModal
          isOpen={true}
          onClose={jest.fn()}
          onSelect={onSelect}
          fetcher={mockFetcher}
          multiSelect={true}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("nginx-pod-1")).toBeInTheDocument();
      });

      await user.click(screen.getByText("nginx-pod-1"));
      await user.click(screen.getByText("nginx-deploy"));

      // 확인 버튼 클릭
      const confirmButton = screen.getByRole("button", { name: /Confirm/i });
      await user.click(confirmButton);

      expect(onSelect).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: "pod-1" }), expect.objectContaining({ id: "deploy-1" })]),
      );
    });
  });

  describe("모달 닫기", () => {
    it("AC7: 닫기 버튼 클릭 시 onClose가 호출되어야 한다", async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();

      render(<ContextPickerModal isOpen={true} onClose={onClose} onSelect={jest.fn()} fetcher={mockFetcher} />);

      const closeButton = screen.getByLabelText(/Close/i);
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    it("Escape 키 누르면 onClose가 호출되어야 한다", async () => {
      const onClose = jest.fn();

      render(<ContextPickerModal isOpen={true} onClose={onClose} onSelect={jest.fn()} fetcher={mockFetcher} />);

      // 오버레이에서 Escape 키 이벤트 발생
      const overlay = screen.getByTestId("modal-overlay");
      fireEvent.keyDown(overlay, { key: "Escape" });

      expect(onClose).toHaveBeenCalled();
    });

    it("오버레이 클릭 시 onClose가 호출되어야 한다", async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();

      render(<ContextPickerModal isOpen={true} onClose={onClose} onSelect={jest.fn()} fetcher={mockFetcher} />);

      const overlay = screen.getByTestId("modal-overlay");
      await user.click(overlay);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("키보드 네비게이션", () => {
    it("AC8: 화살표 키로 리소스를 탐색할 수 있어야 한다", async () => {
      const navFetcher = jest.fn().mockResolvedValue(mockResources);

      render(<ContextPickerModal isOpen={true} onClose={jest.fn()} onSelect={jest.fn()} fetcher={navFetcher} />);

      await waitFor(() => {
        expect(screen.getByText("nginx-pod-1")).toBeInTheDocument();
      });

      // 모달 내부에서 키보드 이벤트 발생
      const modal = screen.getByRole("dialog");
      fireEvent.keyDown(modal, { key: "ArrowDown" });

      // highlighted 클래스가 적용된 요소가 있어야 함
      await waitFor(() => {
        const listItems = screen.getAllByRole("listitem");
        const hasHighlighted = listItems.some((item) => item.classList.contains("highlighted"));
        expect(hasHighlighted).toBe(true);
      });
    });

    it("Enter 키로 현재 하이라이트된 항목을 선택할 수 있어야 한다", async () => {
      const onSelect = jest.fn();
      const enterFetcher = jest.fn().mockResolvedValue(mockResources);

      render(<ContextPickerModal isOpen={true} onClose={jest.fn()} onSelect={onSelect} fetcher={enterFetcher} />);

      await waitFor(() => {
        expect(screen.getByText("nginx-pod-1")).toBeInTheDocument();
      });

      const modal = screen.getByRole("dialog");
      fireEvent.keyDown(modal, { key: "ArrowDown" });
      fireEvent.keyDown(modal, { key: "Enter" });

      await waitFor(() => {
        expect(onSelect).toHaveBeenCalled();
      });
    });
  });

  describe("에러 처리", () => {
    it("API 에러 시 에러 메시지가 표시되어야 한다", async () => {
      const errorFetcher = jest.fn().mockRejectedValue(new Error("API Error"));

      render(<ContextPickerModal isOpen={true} onClose={jest.fn()} onSelect={jest.fn()} fetcher={errorFetcher} />);

      await waitFor(() => {
        expect(screen.getByText(/An error occurred/i)).toBeInTheDocument();
      });
    });

    it("재시도 버튼이 표시되고 클릭 가능해야 한다", async () => {
      const user = userEvent.setup();
      const errorFetcher = jest.fn().mockRejectedValue(new Error("API Error"));

      render(<ContextPickerModal isOpen={true} onClose={jest.fn()} onSelect={jest.fn()} fetcher={errorFetcher} />);

      await waitFor(() => {
        expect(screen.getByText(/An error occurred/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole("button", { name: /Try again/i });
      expect(retryButton).toBeInTheDocument();

      // 버튼 클릭이 에러를 발생시키지 않아야 함
      await user.click(retryButton);

      // 클릭 후에도 에러 상태가 유지됨 (fetcher가 계속 에러를 반환하므로)
      await waitFor(() => {
        expect(screen.getByText(/An error occurred/i)).toBeInTheDocument();
      });
    });
  });

  describe("접근성", () => {
    it("모달에 적절한 ARIA 속성이 있어야 한다", () => {
      render(<ContextPickerModal isOpen={true} onClose={jest.fn()} onSelect={jest.fn()} fetcher={mockFetcher} />);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveAttribute("aria-labelledby");
    });
  });
});
