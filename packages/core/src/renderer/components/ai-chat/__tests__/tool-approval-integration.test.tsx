/**
 * 🎯 목적: ToolApprovalPrompt Diff 통합 테스트
 * 02: Tool 승인 UI에 Diff 통합 (TDD - RED)
 *
 * 📝 테스트 범위:
 * - ToolApprovalPrompt에 approval 속성 추가
 * - Diff가 있을 때 DiffViewer 표시
 * - 기존 기능 유지 (stdin, requestString)
 *
 * @packageDocumentation
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import {
  ToolApprovalType,
  type ToolApprovalWithDiff,
} from "../../../../features/ai-assistant/common/tool-approval-types";
import { ToolApprovalPrompt } from "../tool-approval";

// ============================================
// 🎯 테스트 데이터
// ============================================

/** 파일 수정 승인 요청 (Diff 포함) */
const FILE_EDIT_APPROVAL: ToolApprovalWithDiff = {
  id: "approval-1",
  toolName: "Edit",
  toolType: ToolApprovalType.FILE_EDIT,
  description: "src/index.ts 파일 수정",
  requiresApproval: true,
  createdAt: Date.now(),
  filePath: "/src/index.ts",
  diff: `--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,4 @@
 import React from "react";
-import { useState } from "react";
+import { useState, useEffect } from "react";
+import { useCallback } from "react";`,
  oldContent: 'import React from "react";\nimport { useState } from "react";',
  newContent:
    'import React from "react";\nimport { useState, useEffect } from "react";\nimport { useCallback } from "react";',
  status: "pending",
};

/** 파일 생성 승인 요청 */
const FILE_CREATE_APPROVAL: ToolApprovalWithDiff = {
  id: "approval-2",
  toolName: "Write",
  toolType: ToolApprovalType.FILE_CREATE,
  description: "새 파일 생성",
  requiresApproval: true,
  createdAt: Date.now(),
  filePath: "/src/new-file.ts",
  newContent: 'export function newFunction() {\n  return "new";\n}',
  status: "pending",
};

/** kubectl 승인 요청 */
const KUBECTL_APPROVAL: ToolApprovalWithDiff = {
  id: "approval-3",
  toolName: "kubectl",
  toolType: ToolApprovalType.KUBECTL,
  description: "Deployment 생성",
  requiresApproval: true,
  createdAt: Date.now(),
  stdin: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: nginx",
  command: "kubectl apply -f -",
  status: "pending",
};

// ============================================
// 🎯 통합 테스트
// ============================================

describe("ToolApprovalPrompt Diff 통합", () => {
  describe("approval 속성이 있을 때", () => {
    it("FILE_EDIT 타입이면 DiffViewer를 표시해야 함", () => {
      render(
        <ToolApprovalPrompt
          question="이 파일을 수정하시겠습니까?"
          options={["Yes", "No"]}
          approval={FILE_EDIT_APPROVAL}
          onSelect={jest.fn()}
        />,
      );

      // DiffViewer가 렌더링되어야 함
      expect(screen.getByRole("region", { name: /Diff:.*index\.ts/i })).toBeInTheDocument();
    });

    it("FILE_CREATE 타입이면 새 파일 Diff를 표시해야 함", () => {
      render(
        <ToolApprovalPrompt
          question="이 파일을 생성하시겠습니까?"
          options={["Yes", "No"]}
          approval={FILE_CREATE_APPROVAL}
          onSelect={jest.fn()}
        />,
      );

      // 새 파일 배지가 표시되어야 함
      const newFileBadges = screen.getAllByText(/새 파일/);
      expect(newFileBadges.length).toBeGreaterThan(0);
    });

    it("KUBECTL 타입이면 명령어와 YAML을 표시해야 함", () => {
      render(
        <ToolApprovalPrompt
          question="이 Kubernetes 리소스를 생성하시겠습니까?"
          options={["Yes", "No"]}
          approval={KUBECTL_APPROVAL}
          onSelect={jest.fn()}
        />,
      );

      // 명령어가 표시되어야 함
      expect(screen.getByText(/kubectl apply/)).toBeInTheDocument();
    });

    it("승인 버튼 클릭 시 onSelect가 호출되어야 함", async () => {
      const onSelect = jest.fn();
      const user = userEvent.setup();

      render(
        <ToolApprovalPrompt
          question="이 파일을 수정하시겠습니까?"
          options={["Yes", "No"]}
          approval={FILE_EDIT_APPROVAL}
          onSelect={onSelect}
        />,
      );

      await user.click(screen.getByRole("button", { name: /Approve/i }));

      expect(onSelect).toHaveBeenCalled();
    });

    it("거부 버튼 클릭 시 onSelect가 호출되어야 함", async () => {
      const onSelect = jest.fn();
      const user = userEvent.setup();

      render(
        <ToolApprovalPrompt
          question="이 파일을 수정하시겠습니까?"
          options={["Yes", "No"]}
          approval={FILE_EDIT_APPROVAL}
          onSelect={onSelect}
        />,
      );

      await user.click(screen.getByRole("button", { name: /Reject/i }));

      expect(onSelect).toHaveBeenCalled();
    });
  });

  describe("approval 속성이 없을 때 (기존 동작)", () => {
    it("기본 질문과 옵션 버튼이 표시되어야 함", () => {
      render(
        <ToolApprovalPrompt
          question="kubectl 명령을 실행하시겠습니까?"
          options={["Yes", "No"]}
          stdin="apiVersion: v1\nkind: Pod\nmetadata:\n  name: test"
          onSelect={jest.fn()}
        />,
      );

      // 질문과 옵션 버튼이 표시되어야 함
      expect(screen.getByText(/kubectl 명령을 실행하시겠습니까?/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Yes/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /No/ })).toBeInTheDocument();
    });

    it("requestString이 있으면 일반 요청 표시해야 함", () => {
      render(
        <ToolApprovalPrompt
          question="이 명령을 실행하시겠습니까?"
          options={["Yes", "No"]}
          requestString="npm install lodash"
          onSelect={jest.fn()}
        />,
      );

      expect(screen.getByText(/npm install lodash/)).toBeInTheDocument();
    });
  });

  describe("isSubmitting 상태", () => {
    it("isSubmitting=true일 때 승인/거부 버튼이 비활성화되어야 함", () => {
      render(
        <ToolApprovalPrompt
          question="이 파일을 수정하시겠습니까?"
          options={["Yes", "No"]}
          approval={FILE_EDIT_APPROVAL}
          isSubmitting
          onSelect={jest.fn()}
        />,
      );

      // 승인/거부 버튼만 비활성화 확인 (접기 버튼 제외)
      expect(screen.getByRole("button", { name: /Approve/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /Reject/i })).toBeDisabled();
    });
  });
});
