/**
 * 🎯 목적: Tool Approval Diff 타입 테스트
 * 02: Tool 승인 UI에 Diff 통합 (TDD - RED)
 *
 * 📝 테스트 범위:
 * - ToolApprovalType 열거형
 * - ToolApprovalWithDiff 인터페이스
 * - 팩토리 함수
 * - 유틸리티 함수
 *
 * @packageDocumentation
 */

import {
  createToolApprovalRequest,
  extractDiffFromToolInput,
  extractFilePathFromToolInput,
  isFileModificationTool,
  type ToolApprovalRequest,
  ToolApprovalType,
  type ToolApprovalWithDiff,
} from "../tool-approval-types";

// ============================================
// 🎯 테스트 데이터
// ============================================

/** 파일 수정 Tool 입력 */
const FILE_EDIT_INPUT = {
  file_path: "/src/index.ts",
  old_string: "const x = 1;",
  new_string: "const x = 2;",
};

/** kubectl Tool 입력 */
const KUBECTL_INPUT = {
  command: "kubectl apply -f deployment.yaml",
};

/** Bash Tool 입력 */
const BASH_INPUT = {
  command: "npm install",
};

// ============================================
// 🎯 ToolApprovalType 열거형 테스트
// ============================================

describe("ToolApprovalType", () => {
  it("FILE_EDIT 타입이 정의되어야 함", () => {
    expect(ToolApprovalType.FILE_EDIT).toBe("file_edit");
  });

  it("FILE_CREATE 타입이 정의되어야 함", () => {
    expect(ToolApprovalType.FILE_CREATE).toBe("file_create");
  });

  it("FILE_DELETE 타입이 정의되어야 함", () => {
    expect(ToolApprovalType.FILE_DELETE).toBe("file_delete");
  });

  it("COMMAND 타입이 정의되어야 함", () => {
    expect(ToolApprovalType.COMMAND).toBe("command");
  });

  it("KUBECTL 타입이 정의되어야 함", () => {
    expect(ToolApprovalType.KUBECTL).toBe("kubectl");
  });

  it("GENERIC 타입이 정의되어야 함", () => {
    expect(ToolApprovalType.GENERIC).toBe("generic");
  });
});

// ============================================
// 🎯 ToolApprovalWithDiff 인터페이스 테스트
// ============================================

describe("ToolApprovalWithDiff", () => {
  it("필수 속성이 있어야 함", () => {
    const approval: ToolApprovalWithDiff = {
      id: "test-1",
      toolName: "Edit",
      toolType: ToolApprovalType.FILE_EDIT,
      description: "파일 수정",
      requiresApproval: true,
      createdAt: Date.now(),
    };

    expect(approval.id).toBe("test-1");
    expect(approval.toolName).toBe("Edit");
    expect(approval.toolType).toBe(ToolApprovalType.FILE_EDIT);
    expect(approval.description).toBe("파일 수정");
    expect(approval.requiresApproval).toBe(true);
    expect(typeof approval.createdAt).toBe("number");
  });

  it("Diff 관련 옵션 속성이 있어야 함", () => {
    const approval: ToolApprovalWithDiff = {
      id: "test-2",
      toolName: "Edit",
      toolType: ToolApprovalType.FILE_EDIT,
      description: "파일 수정",
      requiresApproval: true,
      createdAt: Date.now(),
      // Diff 관련
      filePath: "/src/index.ts",
      diff: "--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1 +1 @@\n-const x = 1;\n+const x = 2;",
      oldContent: "const x = 1;",
      newContent: "const x = 2;",
    };

    expect(approval.filePath).toBe("/src/index.ts");
    expect(approval.diff).toContain("---");
    expect(approval.oldContent).toBe("const x = 1;");
    expect(approval.newContent).toBe("const x = 2;");
  });

  it("YAML/stdin 옵션 속성이 있어야 함", () => {
    const approval: ToolApprovalWithDiff = {
      id: "test-3",
      toolName: "kubectl",
      toolType: ToolApprovalType.KUBECTL,
      description: "kubectl 명령어",
      requiresApproval: true,
      createdAt: Date.now(),
      stdin: "apiVersion: v1\nkind: Pod",
      command: "kubectl apply -f -",
    };

    expect(approval.stdin).toContain("apiVersion");
    expect(approval.command).toBe("kubectl apply -f -");
  });
});

// ============================================
// 🎯 ToolApprovalRequest 인터페이스 테스트
// ============================================

describe("ToolApprovalRequest", () => {
  it("기본 속성이 있어야 함", () => {
    const request: ToolApprovalRequest = {
      question: "이 파일을 수정하시겠습니까?",
      options: ["Yes", "No"],
      approval: {
        id: "test-1",
        toolName: "Edit",
        toolType: ToolApprovalType.FILE_EDIT,
        description: "파일 수정",
        requiresApproval: true,
        createdAt: Date.now(),
      },
    };

    expect(request.question).toBe("이 파일을 수정하시겠습니까?");
    expect(request.options).toEqual(["Yes", "No"]);
    expect(request.approval).toBeDefined();
  });

  it("actionSummary 옵션 속성이 있어야 함", () => {
    const request: ToolApprovalRequest = {
      question: "이 파일을 수정하시겠습니까?",
      options: ["Yes", "No"],
      actionSummary: "/src/index.ts 파일 수정",
      approval: {
        id: "test-1",
        toolName: "Edit",
        toolType: ToolApprovalType.FILE_EDIT,
        description: "파일 수정",
        requiresApproval: true,
        createdAt: Date.now(),
      },
    };

    expect(request.actionSummary).toBe("/src/index.ts 파일 수정");
  });
});

// ============================================
// 🎯 팩토리 함수 테스트
// ============================================

describe("createToolApprovalRequest", () => {
  it("기본 Tool Approval 요청을 생성해야 함", () => {
    const request = createToolApprovalRequest({
      toolName: "Edit",
      description: "파일 수정",
      toolInput: FILE_EDIT_INPUT,
    });

    expect(request.approval.id).toBeDefined();
    expect(request.approval.toolName).toBe("Edit");
    expect(request.approval.description).toBe("파일 수정");
    expect(request.question).toContain("승인");
    expect(request.options).toContain("Yes");
    expect(request.options).toContain("No");
  });

  it("파일 수정 Tool일 때 Diff 정보를 포함해야 함", () => {
    const request = createToolApprovalRequest({
      toolName: "Edit",
      description: "파일 수정",
      toolInput: FILE_EDIT_INPUT,
    });

    expect(request.approval.toolType).toBe(ToolApprovalType.FILE_EDIT);
    expect(request.approval.filePath).toBe("/src/index.ts");
    expect(request.approval.oldContent).toBe("const x = 1;");
    expect(request.approval.newContent).toBe("const x = 2;");
  });

  it("kubectl Tool일 때 타입이 KUBECTL이어야 함", () => {
    const request = createToolApprovalRequest({
      toolName: "kubectl",
      description: "kubectl 명령어",
      toolInput: KUBECTL_INPUT,
    });

    expect(request.approval.toolType).toBe(ToolApprovalType.KUBECTL);
  });

  it("Bash Tool일 때 타입이 COMMAND이어야 함", () => {
    const request = createToolApprovalRequest({
      toolName: "Bash",
      description: "명령어 실행",
      toolInput: BASH_INPUT,
    });

    expect(request.approval.toolType).toBe(ToolApprovalType.COMMAND);
  });

  it("알 수 없는 Tool일 때 타입이 GENERIC이어야 함", () => {
    const request = createToolApprovalRequest({
      toolName: "UnknownTool",
      description: "알 수 없는 도구",
      toolInput: {},
    });

    expect(request.approval.toolType).toBe(ToolApprovalType.GENERIC);
  });

  it("createdAt이 자동 생성되어야 함", () => {
    const before = Date.now();
    const request = createToolApprovalRequest({
      toolName: "Edit",
      description: "파일 수정",
      toolInput: FILE_EDIT_INPUT,
    });
    const after = Date.now();

    expect(request.approval.createdAt).toBeGreaterThanOrEqual(before);
    expect(request.approval.createdAt).toBeLessThanOrEqual(after);
  });
});

// ============================================
// 🎯 유틸리티 함수 테스트
// ============================================

describe("isFileModificationTool", () => {
  it("Edit Tool은 true를 반환해야 함", () => {
    expect(isFileModificationTool("Edit")).toBe(true);
  });

  it("Write Tool은 true를 반환해야 함", () => {
    expect(isFileModificationTool("Write")).toBe(true);
  });

  it("Bash Tool은 false를 반환해야 함", () => {
    expect(isFileModificationTool("Bash")).toBe(false);
  });

  it("kubectl Tool은 false를 반환해야 함", () => {
    expect(isFileModificationTool("kubectl")).toBe(false);
  });

  it("대소문자를 구분하지 않아야 함", () => {
    expect(isFileModificationTool("edit")).toBe(true);
    expect(isFileModificationTool("EDIT")).toBe(true);
    expect(isFileModificationTool("write")).toBe(true);
    expect(isFileModificationTool("WRITE")).toBe(true);
  });
});

describe("extractDiffFromToolInput", () => {
  it("Edit Tool 입력에서 Diff를 추출해야 함", () => {
    const result = extractDiffFromToolInput("Edit", FILE_EDIT_INPUT);

    expect(result).toEqual({
      oldContent: "const x = 1;",
      newContent: "const x = 2;",
    });
  });

  it("old_string/new_string이 없으면 null을 반환해야 함", () => {
    const result = extractDiffFromToolInput("Edit", { file_path: "/src/index.ts" });

    expect(result).toBeNull();
  });

  it("파일 수정 Tool이 아니면 null을 반환해야 함", () => {
    const result = extractDiffFromToolInput("Bash", { command: "npm install" });

    expect(result).toBeNull();
  });
});

describe("extractFilePathFromToolInput", () => {
  it("file_path 속성에서 경로를 추출해야 함", () => {
    const result = extractFilePathFromToolInput(FILE_EDIT_INPUT);

    expect(result).toBe("/src/index.ts");
  });

  it("filePath 속성에서도 경로를 추출해야 함", () => {
    const result = extractFilePathFromToolInput({ filePath: "/src/app.ts" });

    expect(result).toBe("/src/app.ts");
  });

  it("경로가 없으면 null을 반환해야 함", () => {
    const result = extractFilePathFromToolInput({ command: "npm install" });

    expect(result).toBeNull();
  });
});

// ============================================
// 🎯 FileApprovalMetadata 테스트
// PHASE 4 - UX Flow Improvement
// ============================================

describe("FileApprovalMetadata", () => {
  it("ToolApprovalWithDiff는 metadata 필드를 지원해야 함", () => {
    const approval: ToolApprovalWithDiff = {
      id: "test-metadata-1",
      toolName: "save_to_cluster",
      toolType: ToolApprovalType.FILE_WRITE,
      description: "클러스터에 파일 저장",
      requiresApproval: true,
      createdAt: Date.now(),
      filePath: "/daive-documents/my-cluster/reports/health-report.md",
      newContent: "# Health Report\n\nCluster is healthy.",
      status: "pending",
      // 🆕 metadata 필드
      metadata: {
        clusterName: "my-cluster",
        folderType: "reports",
        filename: "health-report.md",
        filesize: 45,
        preview: "# Health Report\n\nCluster is healthy.",
      },
    };

    expect(approval.metadata).toBeDefined();
    expect(approval.metadata?.clusterName).toBe("my-cluster");
    expect(approval.metadata?.folderType).toBe("reports");
    expect(approval.metadata?.filename).toBe("health-report.md");
    expect(approval.metadata?.filesize).toBe(45);
    expect(approval.metadata?.preview).toBe("# Health Report\n\nCluster is healthy.");
  });

  it("metadata가 없어도 ToolApprovalWithDiff는 유효해야 함 (하위 호환성)", () => {
    const approval: ToolApprovalWithDiff = {
      id: "test-metadata-2",
      toolName: "write_file",
      toolType: ToolApprovalType.FILE_WRITE,
      description: "파일 쓰기",
      requiresApproval: true,
      createdAt: Date.now(),
      // metadata 없음
    };

    expect(approval.metadata).toBeUndefined();
  });

  it("metadata.allowPathEdit 플래그를 지원해야 함", () => {
    const approval: ToolApprovalWithDiff = {
      id: "test-metadata-3",
      toolName: "save_to_cluster",
      toolType: ToolApprovalType.FILE_WRITE,
      description: "클러스터에 파일 저장",
      requiresApproval: true,
      createdAt: Date.now(),
      metadata: {
        allowPathEdit: true,
      },
    };

    expect(approval.metadata?.allowPathEdit).toBe(true);
  });

  it("metadata 부분 필드만 지정할 수 있어야 함", () => {
    const approval: ToolApprovalWithDiff = {
      id: "test-metadata-4",
      toolName: "save_to_cluster",
      toolType: ToolApprovalType.FILE_WRITE,
      description: "클러스터에 파일 저장",
      requiresApproval: true,
      createdAt: Date.now(),
      metadata: {
        clusterName: "production",
        // 나머지 필드는 생략
      },
    };

    expect(approval.metadata?.clusterName).toBe("production");
    expect(approval.metadata?.folderType).toBeUndefined();
    expect(approval.metadata?.filename).toBeUndefined();
  });

  it("metadata.documentType 필드를 지원해야 함", () => {
    const approval: ToolApprovalWithDiff = {
      id: "test-metadata-5",
      toolName: "save_to_cluster",
      toolType: ToolApprovalType.FILE_WRITE,
      description: "클러스터에 파일 저장",
      requiresApproval: true,
      createdAt: Date.now(),
      metadata: {
        documentType: "report",
        confidence: 0.95,
      },
    };

    expect(approval.metadata?.documentType).toBe("report");
    expect(approval.metadata?.confidence).toBe(0.95);
  });
});
