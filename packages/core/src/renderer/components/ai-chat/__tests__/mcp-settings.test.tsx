/**
 * 🎯 목적: MCP Settings 컴포넌트 테스트
 * 01: MCPSettings 페이지 컴포넌트 (TDD)
 *
 * 📝 테스트 범위:
 * - 서버 목록 표시
 * - 서버 추가/수정/삭제
 * - 연결 상태 표시
 * - 연결 테스트
 *
 * @packageDocumentation
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { mcpConfigStore } from "../../../../features/ai-assistant/common/mcp-config";
import { MCPSettings } from "../mcp-settings";

// ============================================
// 🎯 테스트 설정
// ============================================

describe("MCPSettings 컴포넌트", () => {
  beforeEach(() => {
    mcpConfigStore.reset();
  });

  // ============================================
  // 기본 렌더링
  // ============================================

  describe("기본 렌더링", () => {
    it("헤더와 설명을 표시해야 함", () => {
      render(<MCPSettings />);

      expect(screen.getByText("MCP Server Settings")).toBeInTheDocument();
      expect(screen.getByText(/Model Context Protocol/)).toBeInTheDocument();
    });

    it("서버 추가 버튼이 있어야 함", () => {
      render(<MCPSettings />);

      expect(screen.getByRole("button", { name: /Add Server/ })).toBeInTheDocument();
    });

    it("서버가 없을 때 빈 상태 메시지를 표시해야 함", () => {
      render(<MCPSettings />);

      expect(screen.getByText(/No MCP servers registered/)).toBeInTheDocument();
    });
  });

  // ============================================
  // 서버 목록 표시
  // ============================================

  describe("서버 목록 표시", () => {
    it("등록된 서버를 목록으로 표시해야 함", () => {
      mcpConfigStore.addServer({
        name: "Filesystem Server",
        type: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem"],
        enabled: true,
      });

      render(<MCPSettings />);

      expect(screen.getByText("Filesystem Server")).toBeInTheDocument();
    });

    it("서버 타입을 표시해야 함", () => {
      mcpConfigStore.addServer({
        name: "Test Server",
        type: "stdio",
        command: "node",
        enabled: true,
      });

      render(<MCPSettings />);

      expect(screen.getByText("stdio")).toBeInTheDocument();
    });

    it("여러 서버를 표시해야 함", () => {
      mcpConfigStore.addServer({
        name: "Server 1",
        type: "stdio",
        command: "node",
        enabled: true,
      });
      mcpConfigStore.addServer({
        name: "Server 2",
        type: "http",
        url: "http://localhost:3000",
        enabled: true,
      });

      render(<MCPSettings />);

      expect(screen.getByText("Server 1")).toBeInTheDocument();
      expect(screen.getByText("Server 2")).toBeInTheDocument();
    });

    it("서버 활성화 상태를 토글로 표시해야 함", () => {
      mcpConfigStore.addServer({
        name: "Active Server",
        type: "stdio",
        command: "node",
        enabled: true,
      });

      render(<MCPSettings />);

      const toggle = screen.getByRole("switch", { name: /Enable/ });
      expect(toggle).toBeChecked();
    });
  });

  // ============================================
  // 연결 상태 표시
  // ============================================

  describe("연결 상태 표시", () => {
    it("disconnected 상태를 표시해야 함", () => {
      const id = mcpConfigStore.addServer({
        name: "Disconnected Server",
        type: "stdio",
        command: "node",
        enabled: true,
      });
      mcpConfigStore.setServerStatus(id, "disconnected");

      render(<MCPSettings />);

      expect(screen.getAllByText(/Disconnected/).length).toBeGreaterThanOrEqual(1);
    });

    it("connecting 상태를 표시해야 함", () => {
      const id = mcpConfigStore.addServer({
        name: "Connecting Server",
        type: "stdio",
        command: "node",
        enabled: true,
      });
      mcpConfigStore.setServerStatus(id, "connecting");

      render(<MCPSettings />);

      expect(screen.getAllByText(/Connecting/).length).toBeGreaterThanOrEqual(1);
    });

    it("connected 상태를 표시해야 함", () => {
      const id = mcpConfigStore.addServer({
        name: "Connected Server",
        type: "stdio",
        command: "node",
        enabled: true,
      });
      mcpConfigStore.setServerStatus(id, "connected");

      render(<MCPSettings />);

      expect(screen.getAllByText(/Connected/).length).toBeGreaterThanOrEqual(1);
    });

    it("error 상태와 에러 메시지를 표시해야 함", () => {
      const id = mcpConfigStore.addServer({
        name: "Error Server",
        type: "stdio",
        command: "node",
        enabled: true,
      });
      mcpConfigStore.setServerStatus(id, "error", "Connection failed");

      render(<MCPSettings />);

      expect(screen.getAllByText(/Error/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Connection failed")).toBeInTheDocument();
    });
  });

  // ============================================
  // 서버 추가
  // ============================================

  describe("서버 추가", () => {
    it("추가 버튼 클릭 시 폼 모달이 열려야 함", async () => {
      render(<MCPSettings />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Add Server/ }));
      });

      expect(screen.getByText("Add New MCP Server")).toBeInTheDocument();
    });

    it("stdio 서버를 추가할 수 있어야 함", async () => {
      const user = userEvent.setup();
      render(<MCPSettings />);

      // 추가 버튼 클릭
      await act(async () => {
        await user.click(screen.getByRole("button", { name: /Add Server/ }));
      });

      // 폼 입력
      await act(async () => {
        await user.type(screen.getByLabelText(/Server Name/), "New Server");
        await user.type(screen.getByLabelText(/Command/), "node");
        await user.type(screen.getByLabelText(/Arguments/), "server.js");
      });

      // 저장
      await act(async () => {
        await user.click(screen.getByRole("button", { name: /Save/ }));
      });

      // 목록에 추가됨
      await waitFor(() => {
        expect(screen.getByText("New Server")).toBeInTheDocument();
      });
    });

    it("http 서버를 추가할 수 있어야 함", async () => {
      const user = userEvent.setup();
      render(<MCPSettings />);

      await act(async () => {
        await user.click(screen.getByRole("button", { name: /Add Server/ }));
      });

      // 타입 변경
      await act(async () => {
        await user.click(screen.getByLabelText(/HTTP/));
      });

      // 폼 입력
      await act(async () => {
        await user.type(screen.getByLabelText(/Server Name/), "HTTP Server");
        await user.type(screen.getByLabelText(/URL/), "http://localhost:3000");
      });

      // 저장
      await act(async () => {
        await user.click(screen.getByRole("button", { name: /Save/ }));
      });

      await waitFor(() => {
        expect(screen.getByText("HTTP Server")).toBeInTheDocument();
      });
    });

    it("취소 버튼으로 모달을 닫을 수 있어야 함", async () => {
      const user = userEvent.setup();
      render(<MCPSettings />);

      await act(async () => {
        await user.click(screen.getByRole("button", { name: /Add Server/ }));
      });

      await act(async () => {
        await user.click(screen.getByRole("button", { name: /Cancel/ }));
      });

      await waitFor(() => {
        expect(screen.queryByText("Add New MCP Server")).not.toBeInTheDocument();
      });
    });

    it("필수 필드가 비어있으면 에러를 표시해야 함", async () => {
      const user = userEvent.setup();
      render(<MCPSettings />);

      await act(async () => {
        await user.click(screen.getByRole("button", { name: /Add Server/ }));
      });

      // 빈 상태로 저장 시도
      await act(async () => {
        await user.click(screen.getByRole("button", { name: /Save/ }));
      });

      await waitFor(() => {
        expect(screen.getByText(/서버 이름은 필수입니다/)).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // 서버 수정
  // ============================================

  describe("서버 수정", () => {
    it("수정 버튼 클릭 시 편집 모달이 열려야 함", async () => {
      mcpConfigStore.addServer({
        name: "Editable Server",
        type: "stdio",
        command: "node",
        enabled: true,
      });
      const user = userEvent.setup();
      render(<MCPSettings />);

      await act(async () => {
        await user.click(screen.getByRole("button", { name: /Edit/ }));
      });

      expect(screen.getByText("Edit MCP Server")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Editable Server")).toBeInTheDocument();
    });

    it("서버 정보를 수정할 수 있어야 함", async () => {
      mcpConfigStore.addServer({
        name: "Original Name",
        type: "stdio",
        command: "node",
        enabled: true,
      });
      const user = userEvent.setup();
      render(<MCPSettings />);

      // 수정 버튼 클릭
      await act(async () => {
        await user.click(screen.getByRole("button", { name: /Edit/ }));
      });

      // 이름 변경
      const nameInput = screen.getByLabelText(/Server Name/);
      await act(async () => {
        await user.clear(nameInput);
        await user.type(nameInput, "Updated Name");
      });

      // 저장
      await act(async () => {
        await user.click(screen.getByRole("button", { name: /Save/ }));
      });

      await waitFor(() => {
        expect(screen.getByText("Updated Name")).toBeInTheDocument();
        expect(screen.queryByText("Original Name")).not.toBeInTheDocument();
      });
    });
  });

  // ============================================
  // 서버 삭제
  // ============================================

  describe("서버 삭제", () => {
    it("삭제 버튼 클릭 시 확인 대화상자가 표시되어야 함", async () => {
      mcpConfigStore.addServer({
        name: "To Delete",
        type: "stdio",
        command: "node",
        enabled: true,
      });
      const user = userEvent.setup();
      render(<MCPSettings />);

      await act(async () => {
        await user.click(screen.getByRole("button", { name: /Delete/ }));
      });

      expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
    });

    it("확인 시 서버가 삭제되어야 함", async () => {
      mcpConfigStore.addServer({
        name: "To Delete",
        type: "stdio",
        command: "node",
        enabled: true,
      });
      const user = userEvent.setup();
      render(<MCPSettings />);

      // 삭제 버튼 (서버 카드)
      await act(async () => {
        const deleteButtons = screen.getAllByRole("button", { name: /Delete/ });
        await user.click(deleteButtons[0]);
      });

      // 확인 모달의 Delete 버튼
      await act(async () => {
        const deleteButtons = screen.getAllByRole("button", { name: /Delete/ });
        await user.click(deleteButtons[deleteButtons.length - 1]);
      });

      await waitFor(() => {
        expect(screen.queryByText("To Delete")).not.toBeInTheDocument();
        expect(screen.getByText(/No MCP servers registered/)).toBeInTheDocument();
      });
    });

    it("취소 시 서버가 유지되어야 함", async () => {
      mcpConfigStore.addServer({
        name: "Keep Me",
        type: "stdio",
        command: "node",
        enabled: true,
      });
      const user = userEvent.setup();
      render(<MCPSettings />);

      await act(async () => {
        await user.click(screen.getByRole("button", { name: /Delete/ }));
      });

      await act(async () => {
        await user.click(screen.getByRole("button", { name: /Cancel/ }));
      });

      expect(screen.getByText("Keep Me")).toBeInTheDocument();
    });
  });

  // ============================================
  // 활성화 토글
  // ============================================

  describe("활성화 토글", () => {
    it("토글 클릭 시 활성화 상태가 변경되어야 함", async () => {
      mcpConfigStore.addServer({
        name: "Toggle Server",
        type: "stdio",
        command: "node",
        enabled: true,
      });
      const user = userEvent.setup();
      render(<MCPSettings />);

      const toggle = screen.getByRole("switch", { name: /Enable/ });
      expect(toggle).toBeChecked();

      await act(async () => {
        await user.click(toggle);
      });

      expect(toggle).not.toBeChecked();
    });
  });

  // ============================================
  // 접근성
  // ============================================

  describe("접근성", () => {
    it("적절한 ARIA 레이블이 있어야 함", () => {
      mcpConfigStore.addServer({
        name: "Accessible Server",
        type: "stdio",
        command: "node",
        enabled: true,
      });

      render(<MCPSettings />);

      expect(screen.getByRole("region", { name: /MCP Server Settings/ })).toBeInTheDocument();
    });

    it("키보드로 네비게이션이 가능해야 함", async () => {
      mcpConfigStore.addServer({
        name: "Keyboard Nav",
        type: "stdio",
        command: "node",
        enabled: true,
      });
      const user = userEvent.setup();
      render(<MCPSettings />);

      // Tab으로 포커스 이동
      await user.tab();
      expect(screen.getByRole("button", { name: /Add Server/ })).toHaveFocus();
    });
  });
});
