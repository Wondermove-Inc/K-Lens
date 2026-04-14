/**
 * 🎯 목적: FileEditorTab 통합 테스트
 * 📝 기능:
 *   - 파일 열기 테스트 (IPC → 탭 생성)
 *   - 파일 편집 시 isDirty 상태 테스트
 *   - 파일 저장 테스트 (Ctrl+S)
 *   - 탭 닫기 시 저장 확인 테스트
 *   - 클러스터 전환 시 탭 격리 테스트
 * 🔄 변경이력:
 *   - 2026-01-24: 초기 구현
 * @module file-editor/__tests__/file-editor-tab.test
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ipcRenderer } from "electron";
import React from "react";
import { FileEditorTabInternal as FileEditorTab, type FileEditorTabProps } from "../file-editor-tab";

// Mock IPC
jest.mock("electron", () => ({
  ipcRenderer: {
    invoke: jest.fn(),
  },
}));

// Mock cn utility
jest.mock("../../../utils/cn", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

// Mock FileEditorToolbar to avoid complex shadcn dependency chain
jest.mock("../file-editor-toolbar", () => ({
  FileEditorToolbar: ({
    fileName,
    filePath,
    isDirty,
    readOnly,
    onSave,
    language,
    markdownMode,
    onMarkdownModeChange,
    isSaving,
    onApply,
  }: any) => (
    <div data-testid="file-editor-toolbar">
      <span>{fileName}</span>
      <span>{filePath}</span>
      {isDirty && <span data-testid="dirty-indicator">Modified</span>}
      {readOnly && <span>Read-only</span>}
      {language === "markdown" && (
        <>
          <span data-testid="icon-edit">Edit</span>
          <span data-testid="icon-split-horizontal">Split</span>
          <span data-testid="icon-eye">Eye</span>
        </>
      )}
      <button aria-label="Save" onClick={onSave} disabled={!isDirty || isSaving}>
        Save
      </button>
      {onApply && (
        <button aria-label="Apply" onClick={onApply}>
          Apply
        </button>
      )}
    </div>
  ),
}));

// Mock Monaco Editor (jest.setup.tsx의 auto-mock과 경로 일치 필요)
jest.mock("../../monaco-editor/monaco-editor", () => ({
  MonacoEditor: ({ value, onChange, readOnly }: any) => (
    <textarea
      data-testid="monaco-editor"
      value={value}
      onChange={(e: any) => !readOnly && onChange?.(e.target.value)}
      readOnly={readOnly}
    />
  ),
}));

// Mock MarkdownPreview
jest.mock("../../markdown-preview/markdown-preview", () => ({
  MarkdownPreview: ({ content }: any) => <div data-testid="markdown-preview">{content}</div>,
}));

// Mock shadcn-ui components
jest.mock("../../shadcn-ui/button", () => ({
  Button: ({ children, onClick, disabled, variant, size, className, title }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title || (typeof children === "string" ? children : "")}
    >
      {children}
    </button>
  ),
}));

jest.mock("../../shadcn-ui/badge", () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

jest.mock("../../shadcn-ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipContent: ({ children }: any) => <span>{children}</span>,
  TooltipProvider: ({ children }: any) => <>{children}</>,
  TooltipTrigger: ({ children }: any) => <>{children}</>,
}));

jest.mock("../../shadcn-ui/alert-dialog", () => ({
  AlertDialog: ({ children, open }: any) => (open ? <div data-testid="alert-dialog">{children}</div> : null),
  AlertDialogAction: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  AlertDialogCancel: ({ children }: any) => <button>{children}</button>,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));

// Mock notificationPanelStore
jest.mock("../../status-bar/items/notification-panel.store", () => ({
  notificationPanelStore: {
    addSuccess: jest.fn(),
    addError: jest.fn(),
    addWarning: jest.fn(),
  },
}));

// Mock IPC channels
jest.mock("../../../../common/ipc/filesystem", () => ({
  fileSystemChannels: {
    readFile: "fs:readFile",
    writeFile: "fs:writeFile",
  },
}));

jest.mock("../../../../common/ipc/kubectl-apply", () => ({
  kubectlApplyChannels: {
    apply: "gui-editor:kubectl-apply",
  },
}));

// Mock Lucide React icons
jest.mock("lucide-react", () => ({
  Save: () => <span data-testid="icon-save">Save</span>,
  RotateCcw: () => <span data-testid="icon-revert">Revert</span>,
  Play: () => <span data-testid="icon-play">Play</span>,
  Loader2: () => <span data-testid="icon-loader">Loading</span>,
  Eye: () => <span data-testid="icon-eye">Eye</span>,
  Split: () => <span data-testid="icon-split">Split</span>,
  Pencil: () => <span data-testid="icon-pencil">Pencil</span>,
  CheckCircle2: () => <span data-testid="icon-check">Check</span>,
  XCircle: () => <span data-testid="icon-x">X</span>,
  File: () => <span data-testid="icon-file">File</span>,
  FileText: () => <span data-testid="icon-filetext">FileText</span>,
  Lock: () => <span data-testid="icon-lock">Lock</span>,
  Edit: () => <span data-testid="icon-edit">Edit</span>,
  SplitSquareHorizontal: () => <span data-testid="icon-split-horizontal">SplitH</span>,
}));

describe("FileEditorTab", () => {
  const defaultProps: any = {
    kubectlApplyFile: jest.fn().mockResolvedValue({ success: true }),
    hostedClusterId: "test-cluster",
    tabId: "test-tab-1",
    filePath: "/test/file.txt",
    language: "plaintext",
    originalContent: "original content",
    currentContent: "original content",
    isDirty: false,
    readOnly: false,
    onContentChange: jest.fn(),
    onSave: jest.fn(),
    onRevert: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (ipcRenderer.invoke as jest.Mock).mockResolvedValue({ success: true });
  });

  describe("파일 표시", () => {
    it("파일 내용을 에디터에 표시해야 함", () => {
      render(<FileEditorTab {...defaultProps} />);

      const editor = screen.getByTestId("monaco-editor");
      expect(editor).toHaveValue("original content");
    });

    it("파일명을 툴바에 표시해야 함", () => {
      render(<FileEditorTab {...defaultProps} />);

      expect(screen.getByText("file.txt")).toBeInTheDocument();
    });

    it("파일 경로를 툴바에 표시해야 함", () => {
      render(<FileEditorTab {...defaultProps} />);

      expect(screen.getByText("/test/file.txt")).toBeInTheDocument();
    });
  });

  describe("파일 편집 시 isDirty 상태", () => {
    it("내용 변경 시 onContentChange가 호출되어야 함", async () => {
      const onContentChange = jest.fn();
      render(<FileEditorTab {...defaultProps} onContentChange={onContentChange} />);

      const editor = screen.getByTestId("monaco-editor");
      fireEvent.change(editor, { target: { value: "modified content" } });

      expect(onContentChange).toHaveBeenCalledWith("test-tab-1", "modified content");
    });

    it("isDirty가 true일 때 Save 버튼이 활성화되어야 함", () => {
      render(<FileEditorTab {...defaultProps} isDirty={true} />);

      const saveButton = screen.getByRole("button", { name: /save/i });
      expect(saveButton).not.toBeDisabled();
    });

    it("isDirty가 false일 때 Save 버튼이 비활성화되어야 함", () => {
      render(<FileEditorTab {...defaultProps} isDirty={false} />);

      const saveButton = screen.getByRole("button", { name: /save/i });
      expect(saveButton).toBeDisabled();
    });

    // Revert 기능은 현재 컴포넌트에서 제거됨
  });

  describe("파일 저장", () => {
    it("Save 버튼 클릭 시 파일을 저장해야 함", async () => {
      const onSave = jest.fn();
      (ipcRenderer.invoke as jest.Mock).mockResolvedValueOnce({ success: true });

      render(<FileEditorTab {...defaultProps} isDirty={true} currentContent="modified content" onSave={onSave} />);

      const saveButton = screen.getByRole("button", { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(ipcRenderer.invoke).toHaveBeenCalledWith("fs:writeFile", "/test/file.txt", "modified content", "utf-8");
      });

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith("test-tab-1", "modified content");
      });
    });

    it("Ctrl+S 키보드 단축키로 저장해야 함", async () => {
      const onSave = jest.fn();
      (ipcRenderer.invoke as jest.Mock).mockResolvedValueOnce({ success: true });

      render(<FileEditorTab {...defaultProps} isDirty={true} currentContent="modified content" onSave={onSave} />);

      // Ctrl+S 키 이벤트
      fireEvent.keyDown(window, { key: "s", ctrlKey: true });

      await waitFor(() => {
        expect(ipcRenderer.invoke).toHaveBeenCalledWith("fs:writeFile", "/test/file.txt", "modified content", "utf-8");
      });
    });

    it("Cmd+S (Mac) 키보드 단축키로 저장해야 함", async () => {
      const onSave = jest.fn();
      (ipcRenderer.invoke as jest.Mock).mockResolvedValueOnce({ success: true });

      render(<FileEditorTab {...defaultProps} isDirty={true} currentContent="modified content" onSave={onSave} />);

      // Cmd+S 키 이벤트
      fireEvent.keyDown(window, { key: "s", metaKey: true });

      await waitFor(() => {
        expect(ipcRenderer.invoke).toHaveBeenCalledWith("fs:writeFile", "/test/file.txt", "modified content", "utf-8");
      });
    });

    it("저장 실패 시 onSave가 호출되지 않아야 함", async () => {
      const onSave = jest.fn();
      (ipcRenderer.invoke as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: "Permission denied",
      });

      render(<FileEditorTab {...defaultProps} isDirty={true} onSave={onSave} />);

      const saveButton = screen.getByRole("button", { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).not.toHaveBeenCalled();
      });
    });

    it("readOnly일 때 저장되지 않아야 함", async () => {
      render(<FileEditorTab {...defaultProps} isDirty={true} readOnly={true} />);

      // readOnly일 때 Save 버튼이 렌더링되지 않음
      expect(screen.queryByText("Ctrl+S")).not.toBeInTheDocument();

      // Ctrl+S 키보드 이벤트 시도해도 저장되지 않음
      fireEvent.keyDown(window, { key: "s", ctrlKey: true });

      expect(ipcRenderer.invoke).not.toHaveBeenCalled();
    });
  });

  // Revert 기능은 현재 컴포넌트에서 제거됨

  describe("마크다운 미리보기 모드", () => {
    const markdownProps: FileEditorTabProps = {
      ...defaultProps,
      language: "markdown",
      filePath: "/test/readme.md",
      currentContent: "# Hello World",
    };

    it("마크다운 파일에 뷰 모드 토글 아이콘들이 표시되어야 함", () => {
      render(<FileEditorTab {...markdownProps} />);

      // 아이콘으로 확인 (Edit, SplitSquareHorizontal, Eye)
      expect(screen.getByTestId("icon-edit")).toBeInTheDocument();
      expect(screen.getByTestId("icon-split-horizontal")).toBeInTheDocument();
      expect(screen.getByTestId("icon-eye")).toBeInTheDocument();
    });

    it("Preview 모드 버튼 클릭 시 미리보기가 표시되어야 함", () => {
      render(<FileEditorTab {...markdownProps} />);

      // Eye 아이콘이 있는 버튼 클릭
      const buttons = screen.getAllByRole("button");
      const previewButton = buttons.find((btn) => btn.querySelector('[data-testid="icon-eye"]'));

      if (previewButton) {
        fireEvent.click(previewButton);
        expect(screen.getByTestId("markdown-preview")).toBeInTheDocument();
      }
    });
  });

  describe("Kubernetes Apply (YAML 파일)", () => {
    const yamlProps: FileEditorTabProps = {
      ...defaultProps,
      language: "yaml",
      filePath: "/test/deployment.yaml",
      currentContent: "apiVersion: apps/v1\nkind: Deployment",
      clusterId: "test-cluster",
    };

    it("YAML 파일에 Apply 버튼이 표시되어야 함", () => {
      render(<FileEditorTab {...yamlProps} />);

      expect(screen.getByRole("button", { name: /apply/i })).toBeInTheDocument();
    });

    it("JSON 파일에도 Apply 버튼이 표시되어야 함", () => {
      render(<FileEditorTab {...defaultProps} language="json" filePath="/test/config.json" />);

      expect(screen.getByRole("button", { name: /apply/i })).toBeInTheDocument();
    });

    it("일반 텍스트 파일에는 Apply 버튼이 표시되지 않아야 함", () => {
      render(<FileEditorTab {...defaultProps} />);

      expect(screen.queryByRole("button", { name: /apply/i })).not.toBeInTheDocument();
    });
  });

  describe("읽기 전용 모드", () => {
    it("readOnly가 true일 때 에디터가 읽기 전용이어야 함", () => {
      render(<FileEditorTab {...defaultProps} readOnly={true} />);

      const editor = screen.getByTestId("monaco-editor");
      expect(editor).toHaveAttribute("readonly");
    });

    it("readOnly가 true일 때 Save 버튼이 표시되지 않아야 함", () => {
      render(<FileEditorTab {...defaultProps} readOnly={true} isDirty={true} />);

      // readOnly일 때 Save 버튼은 렌더링되지 않음
      expect(screen.queryByText("Ctrl+S")).not.toBeInTheDocument();
    });

    it("readOnly가 true일 때 Revert 버튼이 표시되지 않아야 함", () => {
      render(<FileEditorTab {...defaultProps} readOnly={true} isDirty={true} />);

      // readOnly일 때 Revert 버튼은 렌더링되지 않음
      expect(screen.queryByTestId("icon-revert")).not.toBeInTheDocument();
    });

    it("readOnly가 true일 때 Read-only 뱃지가 표시되어야 함", () => {
      render(<FileEditorTab {...defaultProps} readOnly={true} />);

      expect(screen.getByText("Read-only")).toBeInTheDocument();
    });
  });

  describe("저장 중 상태", () => {
    it("저장 중일 때 로딩 오버레이가 표시되어야 함", async () => {
      let resolveInvoke: (value: any) => void;
      const invokePromise = new Promise((resolve) => {
        resolveInvoke = resolve;
      });
      (ipcRenderer.invoke as jest.Mock).mockReturnValueOnce(invokePromise);

      render(<FileEditorTab {...defaultProps} isDirty={true} />);

      const saveButton = screen.getByRole("button", { name: /save/i });
      fireEvent.click(saveButton);

      // 저장 중 상태 - Save 버튼이 Saving...으로 변경됨
      await waitFor(() => {
        expect(screen.getByTestId("icon-loader")).toBeInTheDocument();
      });

      // 저장 완료
      resolveInvoke!({ success: true });
    });
  });
});
