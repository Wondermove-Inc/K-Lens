/**
 * 🎯 목적: ToolApprovalDiff 컴포넌트 테스트
 * 02: Tool 승인 UI에 Diff 통합 (TDD - RED)
 *
 * 📝 테스트 범위:
 * - 기본 렌더링
 * - Diff 표시
 * - 파일 경로 표시
 * - 승인/거부 버튼
 * - 접기/펼치기
 *
 * @packageDocumentation
 */

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import {
  ToolApprovalType,
  type ToolApprovalWithDiff,
} from "../../../../features/ai-assistant/common/tool-approval-types";
import { ToolApprovalDiff } from "../tool-approval-diff";

// ============================================
// 🎯 테스트 데이터
// ============================================

/** 파일 수정 승인 요청 */
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

/** Bash 승인 요청 */
const BASH_APPROVAL: ToolApprovalWithDiff = {
  id: "approval-4",
  toolName: "Bash",
  toolType: ToolApprovalType.COMMAND,
  description: "npm 설치",
  requiresApproval: true,
  createdAt: Date.now(),
  command: "npm install lodash",
  status: "pending",
};

/** 🆕 PHASE 4: save_to_cluster 승인 요청 (metadata 포함) */
const SAVE_TO_CLUSTER_APPROVAL: ToolApprovalWithDiff = {
  id: "approval-5",
  toolName: "save_to_cluster",
  toolType: ToolApprovalType.FILE_WRITE,
  description: "Save to cluster: health-report-20260129.md",
  requiresApproval: true,
  createdAt: Date.now(),
  filePath: "/home/user/daive-documents/production-cluster/reports/health-report-20260129.md",
  newContent: "# Cluster Health Report\n\n## Summary\n\nCluster is healthy.",
  status: "pending",
  metadata: {
    clusterName: "production-cluster",
    folderType: "reports",
    filename: "health-report-20260129.md",
    filesize: 58,
    preview: "# Cluster Health Report\n\n## Summary\n\nCluster is healthy.",
  },
};

/** 🆕 PHASE 4: metadata 없는 FILE_WRITE 승인 (하위 호환성) */
const FILE_WRITE_NO_METADATA_APPROVAL: ToolApprovalWithDiff = {
  id: "approval-6",
  toolName: "write_file",
  toolType: ToolApprovalType.FILE_WRITE,
  description: "파일 쓰기",
  requiresApproval: true,
  createdAt: Date.now(),
  filePath: "/home/user/test.md",
  newContent: "Test content",
  status: "pending",
  // metadata 없음 - 하위 호환성 테스트
};

// ============================================
// 🎯 기본 렌더링 테스트
// ============================================

describe("ToolApprovalDiff", () => {
  describe("기본 렌더링", () => {
    it("컴포넌트가 렌더링되어야 함", () => {
      render(<ToolApprovalDiff approval={FILE_EDIT_APPROVAL} onApprove={jest.fn()} onReject={jest.fn()} />);

      // Tool 승인 요청 region 확인 (Card와 DiffViewer 모두 region을 가지므로 aria-label로 구분)
      expect(screen.getByRole("region", { name: /Tool 승인 요청/ })).toBeInTheDocument();
    });

    it("Tool 이름을 표시해야 함", () => {
      render(<ToolApprovalDiff approval={FILE_EDIT_APPROVAL} onApprove={jest.fn()} onReject={jest.fn()} />);

      expect(screen.getByText(/Edit/)).toBeInTheDocument();
    });

    it("설명을 표시해야 함", () => {
      render(<ToolApprovalDiff approval={FILE_EDIT_APPROVAL} onApprove={jest.fn()} onReject={jest.fn()} />);

      expect(screen.getByText(/src\/index\.ts 파일 수정/)).toBeInTheDocument();
    });
  });

  // ============================================
  // 파일 수정 Tool 테스트
  // ============================================

  describe("파일 수정 Tool (FILE_EDIT)", () => {
    it("파일 경로를 표시해야 함", () => {
      render(<ToolApprovalDiff approval={FILE_EDIT_APPROVAL} onApprove={jest.fn()} onReject={jest.fn()} />);

      // 파일 경로가 여러 곳에 표시되므로 getAllBy 사용
      const filePaths = screen.getAllByText(/\/src\/index\.ts/);
      expect(filePaths.length).toBeGreaterThan(0);
    });

    it("DiffViewer를 렌더링해야 함", () => {
      render(<ToolApprovalDiff approval={FILE_EDIT_APPROVAL} onApprove={jest.fn()} onReject={jest.fn()} />);

      // DiffViewer region 확인 (파일 이름으로 구분)
      expect(screen.getByRole("region", { name: /Diff:.*index\.ts/i })).toBeInTheDocument();
    });

    it("추가된 라인을 표시해야 함", () => {
      render(<ToolApprovalDiff approval={FILE_EDIT_APPROVAL} onApprove={jest.fn()} onReject={jest.fn()} />);

      // 추가된 라인 확인 (여러 매칭이 있을 수 있으므로 getAllBy 사용)
      // useEffect, useCallback import 추가 확인
      const useEffectTexts = screen.getAllByText(/useEffect/);
      expect(useEffectTexts.length).toBeGreaterThan(0);
      const useCallbackTexts = screen.getAllByText(/useCallback/);
      expect(useCallbackTexts.length).toBeGreaterThan(0);
    });

    it("삭제된 라인을 표시해야 함", () => {
      render(<ToolApprovalDiff approval={FILE_EDIT_APPROVAL} onApprove={jest.fn()} onReject={jest.fn()} />);

      // 통계에 삭제된 라인 수 표시 확인
      const stats = screen.getByTestId("diff-statistics");
      expect(stats).toBeInTheDocument();
      // -1 삭제 라인이 있음
      expect(stats).toHaveTextContent("-");
    });
  });

  // ============================================
  // 파일 생성 Tool 테스트
  // ============================================

  describe("파일 생성 Tool (FILE_CREATE)", () => {
    it("새 파일 배지를 표시해야 함", () => {
      render(<ToolApprovalDiff approval={FILE_CREATE_APPROVAL} onApprove={jest.fn()} onReject={jest.fn()} />);

      // "새 파일" 배지가 여러 곳에 표시될 수 있음 (헤더 + DiffViewer)
      const newFileBadges = screen.getAllByText(/새 파일/);
      expect(newFileBadges.length).toBeGreaterThan(0);
    });

    it("새 파일 내용을 표시해야 함", () => {
      render(<ToolApprovalDiff approval={FILE_CREATE_APPROVAL} onApprove={jest.fn()} onReject={jest.fn()} />);

      expect(screen.getByText(/newFunction/)).toBeInTheDocument();
    });
  });

  // ============================================
  // kubectl Tool 테스트
  // ============================================

  describe("kubectl Tool (KUBECTL)", () => {
    it("명령어를 표시해야 함", () => {
      render(<ToolApprovalDiff approval={KUBECTL_APPROVAL} onApprove={jest.fn()} onReject={jest.fn()} />);

      expect(screen.getByText(/kubectl apply/)).toBeInTheDocument();
    });

    it("YAML 내용을 표시해야 함", () => {
      render(<ToolApprovalDiff approval={KUBECTL_APPROVAL} onApprove={jest.fn()} onReject={jest.fn()} />);

      // YAML 내용 표시 (kind: Deployment가 여러 곳에 표시될 수 있음)
      const deploymentTexts = screen.getAllByText(/Deployment/);
      expect(deploymentTexts.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // Bash Tool 테스트
  // ============================================

  describe("Bash Tool (COMMAND)", () => {
    it("명령어를 표시해야 함", () => {
      render(<ToolApprovalDiff approval={BASH_APPROVAL} onApprove={jest.fn()} onReject={jest.fn()} />);

      expect(screen.getByText(/npm install lodash/)).toBeInTheDocument();
    });
  });

  // ============================================
  // 승인/거부 버튼 테스트
  // ============================================

  describe("승인/거부 버튼", () => {
    it("승인 버튼이 있어야 함", () => {
      render(<ToolApprovalDiff approval={FILE_EDIT_APPROVAL} onApprove={jest.fn()} onReject={jest.fn()} />);

      expect(screen.getByRole("button", { name: /승인|yes|approve/i })).toBeInTheDocument();
    });

    it("거부 버튼이 있어야 함", () => {
      render(<ToolApprovalDiff approval={FILE_EDIT_APPROVAL} onApprove={jest.fn()} onReject={jest.fn()} />);

      expect(screen.getByRole("button", { name: /거부|no|reject/i })).toBeInTheDocument();
    });

    it("승인 버튼 클릭 시 onApprove가 호출되어야 함", async () => {
      const onApprove = jest.fn();
      const user = userEvent.setup();

      render(<ToolApprovalDiff approval={FILE_EDIT_APPROVAL} onApprove={onApprove} onReject={jest.fn()} />);

      await user.click(screen.getByRole("button", { name: /승인|yes|approve/i }));

      expect(onApprove).toHaveBeenCalledWith(FILE_EDIT_APPROVAL.id);
    });

    it("거부 버튼 클릭 시 onReject가 호출되어야 함", async () => {
      const onReject = jest.fn();
      const user = userEvent.setup();

      render(<ToolApprovalDiff approval={FILE_EDIT_APPROVAL} onApprove={jest.fn()} onReject={onReject} />);

      await user.click(screen.getByRole("button", { name: /거부|no|reject/i }));

      expect(onReject).toHaveBeenCalledWith(FILE_EDIT_APPROVAL.id);
    });

    it("isSubmitting=true일 때 버튼이 비활성화되어야 함", () => {
      render(
        <ToolApprovalDiff approval={FILE_EDIT_APPROVAL} onApprove={jest.fn()} onReject={jest.fn()} isSubmitting />,
      );

      expect(screen.getByRole("button", { name: /승인|yes|approve/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /거부|no|reject/i })).toBeDisabled();
    });
  });

  // ============================================
  // 접근성 테스트
  // ============================================

  describe("접근성", () => {
    it("적절한 ARIA 레이블이 있어야 함", () => {
      render(<ToolApprovalDiff approval={FILE_EDIT_APPROVAL} onApprove={jest.fn()} onReject={jest.fn()} />);

      // Tool 승인 요청 region 확인
      const toolRegion = screen.getByRole("region", { name: /Tool 승인 요청/ });
      expect(toolRegion).toHaveAttribute("aria-label");
    });
  });

  // ============================================
  // 스타일링 테스트
  // ============================================

  describe("스타일링", () => {
    it("className이 적용되어야 함", () => {
      render(
        <ToolApprovalDiff
          approval={FILE_EDIT_APPROVAL}
          onApprove={jest.fn()}
          onReject={jest.fn()}
          className="custom-class"
        />,
      );

      // Tool 승인 요청 region에 custom class 적용 확인
      const toolRegion = screen.getByRole("region", { name: /Tool 승인 요청/ });
      expect(toolRegion).toHaveClass("custom-class");
    });
  });

  // ============================================
  // 🆕 PHASE 4: 파일 메타데이터 표시 테스트
  // ============================================

  describe("파일 메타데이터 표시 (PHASE 4)", () => {
    it("metadata가 있으면 클러스터 이름을 표시해야 함", () => {
      render(<ToolApprovalDiff approval={SAVE_TO_CLUSTER_APPROVAL} onApprove={jest.fn()} onReject={jest.fn()} />);

      // 클러스터 이름이 경로에도 포함되므로 getAllBy 사용
      const clusterTexts = screen.getAllByText(/production-cluster/);
      expect(clusterTexts.length).toBeGreaterThan(0);
    });

    it("metadata가 있으면 폴더 타입을 표시해야 함", () => {
      render(<ToolApprovalDiff approval={SAVE_TO_CLUSTER_APPROVAL} onApprove={jest.fn()} onReject={jest.fn()} />);

      // "reports"가 경로에도 포함되므로 getAllBy 사용
      const reportsTexts = screen.getAllByText(/reports/);
      expect(reportsTexts.length).toBeGreaterThan(0);
    });

    it("metadata가 있으면 파일 크기를 표시해야 함", () => {
      render(<ToolApprovalDiff approval={SAVE_TO_CLUSTER_APPROVAL} onApprove={jest.fn()} onReject={jest.fn()} />);

      // 58 bytes -> "58 B"
      expect(screen.getByText(/58 B/)).toBeInTheDocument();
    });

    it("metadata가 없어도 정상적으로 렌더링되어야 함 (하위 호환성)", () => {
      render(
        <ToolApprovalDiff approval={FILE_WRITE_NO_METADATA_APPROVAL} onApprove={jest.fn()} onReject={jest.fn()} />,
      );

      // 컴포넌트가 정상적으로 렌더링되어야 함
      expect(screen.getByRole("region", { name: /Tool 승인 요청/ })).toBeInTheDocument();
      // 파일 내용이 표시되어야 함
      expect(screen.getByText(/Test content/)).toBeInTheDocument();
    });

    it("save_to_cluster Tool에 Save File 배지가 표시되어야 함", () => {
      render(<ToolApprovalDiff approval={SAVE_TO_CLUSTER_APPROVAL} onApprove={jest.fn()} onReject={jest.fn()} />);

      expect(screen.getByText(/Save File/)).toBeInTheDocument();
    });

    it("metadata.documentType이 있으면 문서 타입 배지를 표시해야 함", () => {
      const approvalWithDocType: ToolApprovalWithDiff = {
        ...SAVE_TO_CLUSTER_APPROVAL,
        id: "approval-7",
        metadata: {
          ...SAVE_TO_CLUSTER_APPROVAL.metadata,
          documentType: "report",
          confidence: 0.95,
        },
      };

      render(<ToolApprovalDiff approval={approvalWithDocType} onApprove={jest.fn()} onReject={jest.fn()} />);

      // 문서 타입 배지와 체크마크 (신뢰도 >= 0.7)
      expect(screen.getByText(/report.*✓/)).toBeInTheDocument();
    });
  });
});
