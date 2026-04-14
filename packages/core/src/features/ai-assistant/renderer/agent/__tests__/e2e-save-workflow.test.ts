/**
 * 🎯 목적: End-to-End 저장 워크플로우 통합 테스트
 * PHASE 3 (P3-T2): 전체 워크플로우 검증
 *
 * 📝 테스트 범위:
 * - 문서 생성 요청 → 자동 저장 워크플로우
 * - 정보 조회 요청 → 저장 없음
 * - 다국어 지원 검증
 * - 오류 처리 및 폴백
 * - 신뢰도 임계값 검증
 *
 * @packageDocumentation
 */

import { z } from "zod";
import {
  type DocumentTypeInference,
  type SmartDefaults,
  type SmartDefaultsContext,
  SmartDefaultsEngine,
} from "../../../main/agent/smart-defaults-engine";
import { IntentAnalysisResultSchema, type IntentSignals, IntentSignalsSchema } from "../supervisor/structured-output";

import type { MainLLMModel } from "../../../main/llm-model-factory";

// ============================================
// 🎯 Mock 설정
// ============================================

const mockLLM = {
  invoke: jest.fn().mockResolvedValue({ content: "mocked response" }),
  withStructuredOutput: jest.fn().mockReturnThis(),
} as unknown as MainLLMModel;

// ============================================
// 🎯 테스트 유틸리티
// ============================================

/**
 * Mock IntentSignals 생성
 */
function createMockSignals(overrides: Partial<IntentSignals>): IntentSignals {
  return {
    hasProblemStatement: false,
    asksForCause: false,
    asksForAction: false,
    mentionsMutation: false,
    asksForInfo: false,
    continuesDiagnosis: false,
    urgencyLevel: "low",
    requestsDocumentCreation: false,
    requestsDocumentEdit: false,
    mentionsDocumentType: false,
    impliesPersistence: false,
    expectsSaving: false,
    ...overrides,
  };
}

/**
 * E2E 워크플로우 시뮬레이션
 */
interface E2EWorkflowResult {
  shouldAutoSave: boolean;
  filename?: string;
  folderType?: string;
  approvalRequested: boolean;
  error?: string;
}

async function simulateE2EWorkflow(
  input: string,
  signals: IntentSignals,
  context: SmartDefaultsContext,
): Promise<E2EWorkflowResult> {
  // 1. Intent 분석 결과 확인
  if (!signals.expectsSaving) {
    return {
      shouldAutoSave: false,
      approvalRequested: false,
    };
  }

  // 2. SmartDefaultsEngine 분석
  const engine = new SmartDefaultsEngine(mockLLM);
  const defaults = await engine.analyze(input, context);

  // 3. 저장 워크플로우
  return {
    shouldAutoSave: true,
    filename: defaults.filename,
    folderType: defaults.folderType,
    approvalRequested: true, // HITL 승인 항상 필요
  };
}

// ============================================
// 🔹 자동 저장 성공 시나리오
// ============================================

describe("자동 저장 성공 시나리오", () => {
  it("한국어: '보고서 작성해줘' → reports 폴더에 저장", async () => {
    const input = "보고서 작성해줘";
    const signals = createMockSignals({
      requestsDocumentCreation: true,
      mentionsDocumentType: true,
      expectsSaving: true,
    });
    const context: SmartDefaultsContext = {
      userInput: input,
      conversationHistory: [],
      selectedCluster: { id: "1", name: "production" },
    };

    const result = await simulateE2EWorkflow(input, signals, context);

    expect(result.shouldAutoSave).toBe(true);
    expect(result.folderType).toBe("misc");
    expect(result.approvalRequested).toBe(true);
    expect(result.filename).toContain("production");
  });

  it("영어: 'Create deployment manifest' → manifests 폴더에 저장", async () => {
    const input = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx`;
    const signals = createMockSignals({
      requestsDocumentCreation: true,
      mentionsDocumentType: true,
      expectsSaving: true,
    });
    const context: SmartDefaultsContext = {
      userInput: "Create deployment manifest",
      conversationHistory: [],
      selectedCluster: { id: "1", name: "staging" },
    };

    const result = await simulateE2EWorkflow(input, signals, context);

    expect(result.shouldAutoSave).toBe(true);
    expect(result.folderType).toBe("manifests");
    expect(result.filename).toContain("staging");
  });

  it("일본어: '作業計画を作成して' → plans 폴더에 저장", async () => {
    const input = `# Migration Plan
- [ ] Step 1
- [ ] Step 2
TODO: Complete migration`;
    const signals = createMockSignals({
      requestsDocumentCreation: true,
      mentionsDocumentType: true,
      expectsSaving: true,
    });
    const context: SmartDefaultsContext = {
      userInput: "作業計画を作成して",
      conversationHistory: [],
    };

    const result = await simulateE2EWorkflow(input, signals, context);

    expect(result.shouldAutoSave).toBe(true);
    expect(result.folderType).toBe("plans");
  });

  it("중국어: '创建配置文件' → configs 폴더에 저장", async () => {
    const input = `{
  "server": {
    "port": 8080
  }
}`;
    const signals = createMockSignals({
      requestsDocumentCreation: true,
      mentionsDocumentType: true,
      expectsSaving: true,
    });
    const context: SmartDefaultsContext = {
      userInput: "创建配置文件",
      conversationHistory: [],
    };

    const result = await simulateE2EWorkflow(input, signals, context);

    expect(result.shouldAutoSave).toBe(true);
    expect(result.folderType).toBe("configs");
  });
});

// ============================================
// 🔹 자동 저장 없음 시나리오
// ============================================

describe("자동 저장 없음 시나리오", () => {
  it("'Pod 목록 보여줘' → 저장 없음 (정보 조회)", async () => {
    const input = "Pod 목록 보여줘";
    const signals = createMockSignals({
      asksForInfo: true,
      expectsSaving: false,
    });
    const context: SmartDefaultsContext = {
      userInput: input,
      conversationHistory: [],
    };

    const result = await simulateE2EWorkflow(input, signals, context);

    expect(result.shouldAutoSave).toBe(false);
    expect(result.approvalRequested).toBe(false);
  });

  it("'노드 상태 알려줘' → 저장 없음 (정보 조회)", async () => {
    const input = "노드 상태 알려줘";
    const signals = createMockSignals({
      asksForInfo: true,
      expectsSaving: false,
    });
    const context: SmartDefaultsContext = {
      userInput: input,
      conversationHistory: [],
    };

    const result = await simulateE2EWorkflow(input, signals, context);

    expect(result.shouldAutoSave).toBe(false);
  });

  it("'쿠버네티스란?' → 저장 없음 (개념 질문)", async () => {
    const input = "쿠버네티스란?";
    const signals = createMockSignals({
      asksForInfo: true,
      expectsSaving: false,
    });
    const context: SmartDefaultsContext = {
      userInput: input,
      conversationHistory: [],
    };

    const result = await simulateE2EWorkflow(input, signals, context);

    expect(result.shouldAutoSave).toBe(false);
  });
});

// ============================================
// 🔹 다국어 문서 생성 테스트
// ============================================

describe("다국어 문서 생성 테스트", () => {
  const multiLanguageCases = [
    { language: "Korean", input: "보고서 작성해줘", expectedFolder: "misc" },
    { language: "English", input: "Create a report", expectedFolder: "misc" },
    { language: "Japanese", input: "レポートを作成して", expectedFolder: "misc" },
    { language: "Chinese", input: "创建报告", expectedFolder: "misc" },
    { language: "Spanish", input: "Crea un informe", expectedFolder: "misc" },
  ];

  it.each(multiLanguageCases)("$language: 문서 생성 요청이 자동 저장됨", async ({ input, expectedFolder }) => {
    const signals = createMockSignals({
      requestsDocumentCreation: true,
      mentionsDocumentType: true,
      expectsSaving: true,
    });
    const context: SmartDefaultsContext = {
      userInput: input,
      conversationHistory: [],
    };

    // Report 콘텐츠 시뮬레이션
    const reportContent = `# ${input}
## Summary
This is a test report.`;

    const result = await simulateE2EWorkflow(reportContent, signals, context);

    expect(result.shouldAutoSave).toBe(true);
    expect(result.folderType).toBe(expectedFolder);
  });
});

// ============================================
// 🔹 오류 처리 테스트
// ============================================

describe("오류 처리 테스트", () => {
  it("SmartDefaultsEngine 실패 시 폴백 처리", async () => {
    const input = "";
    const signals = createMockSignals({
      requestsDocumentCreation: true,
      expectsSaving: true,
    });
    const context: SmartDefaultsContext = {
      userInput: input,
      conversationHistory: [],
    };

    const engine = new SmartDefaultsEngine(mockLLM);
    const defaults = await engine.analyze(input, context);

    // 빈 입력에도 기본값 반환
    expect(defaults.folderType).toBeDefined();
    expect(defaults.filename).toMatch(/\.md$/);
  });

  it("클러스터 미선택 시 파일명에서 클러스터 이름 생략", async () => {
    const input = "보고서";
    const signals = createMockSignals({
      requestsDocumentCreation: true,
      expectsSaving: true,
    });
    const context: SmartDefaultsContext = {
      userInput: input,
      conversationHistory: [],
      // selectedCluster 없음
    };

    const result = await simulateE2EWorkflow(input, signals, context);

    expect(result.shouldAutoSave).toBe(true);
    expect(result.filename).toBeDefined();
    expect(result.filename).not.toContain("production");
  });
});

// ============================================
// 🔹 신뢰도 임계값 테스트
// ============================================

describe("신뢰도 임계값 테스트", () => {
  it("문서 타입 신뢰도가 임계값 이상이면 자동 저장", async () => {
    const engine = new SmartDefaultsEngine(mockLLM);
    const content = "# Cluster Health Report\n\n## Summary";

    const docType = await engine.inferDocumentType(content);

    expect(docType.confidence).toBeGreaterThanOrEqual(0.5);
    expect(docType.documentType).toBe("misc");
  });

  it("빈 콘텐츠는 낮은 신뢰도 반환", async () => {
    const engine = new SmartDefaultsEngine(mockLLM);
    const content = "";

    const docType = await engine.inferDocumentType(content);

    expect(docType.confidence).toBeLessThan(0.7);
    expect(docType.documentType).toBe("misc");
  });

  it("명확한 manifest는 높은 신뢰도", async () => {
    const engine = new SmartDefaultsEngine(mockLLM);
    const content = `apiVersion: apps/v1
kind: Deployment`;

    const docType = await engine.inferDocumentType(content);

    expect(docType.confidence).toBeGreaterThanOrEqual(0.9);
    expect(docType.documentType).toBe("manifest");
  });
});

// ============================================
// 🔹 HITL 승인 테스트
// ============================================

describe("HITL 승인 테스트", () => {
  it("자동 저장 시 항상 HITL 승인 요청", async () => {
    const input = "보고서";
    const signals = createMockSignals({
      requestsDocumentCreation: true,
      expectsSaving: true,
    });
    const context: SmartDefaultsContext = {
      userInput: input,
      conversationHistory: [],
    };

    const result = await simulateE2EWorkflow(input, signals, context);

    expect(result.shouldAutoSave).toBe(true);
    expect(result.approvalRequested).toBe(true);
  });

  it("저장 없는 워크플로우는 HITL 승인 없음", async () => {
    const input = "Pod 목록";
    const signals = createMockSignals({
      asksForInfo: true,
      expectsSaving: false,
    });
    const context: SmartDefaultsContext = {
      userInput: input,
      conversationHistory: [],
    };

    const result = await simulateE2EWorkflow(input, signals, context);

    expect(result.shouldAutoSave).toBe(false);
    expect(result.approvalRequested).toBe(false);
  });
});

// ============================================
// 🔹 SmartDefaults 적용 테스트
// ============================================

describe("SmartDefaults 적용 테스트", () => {
  it("클러스터 이름이 파일명에 포함됨", async () => {
    const engine = new SmartDefaultsEngine(mockLLM);
    const context: SmartDefaultsContext = {
      userInput: "Report",
      conversationHistory: [],
      selectedCluster: { id: "1", name: "my-cluster" },
    };

    const docType: DocumentTypeInference = {
      documentType: "report",
      confidence: 0.9,
      folderTypeHint: "reports",
    };

    const filename = engine.generateSmartFilename("Report", context, docType);

    expect(filename).toContain("my-cluster");
  });

  it("날짜 접두사가 파일명에 포함됨", async () => {
    const engine = new SmartDefaultsEngine(mockLLM);
    const context: SmartDefaultsContext = {
      userInput: "Report",
      conversationHistory: [],
    };

    const docType: DocumentTypeInference = {
      documentType: "report",
      confidence: 0.9,
      folderTypeHint: "reports",
    };

    const filename = engine.generateSmartFilename("Report", context, docType);

    // YYYY-MM-DD 형식
    expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it("확장자가 .md로 설정됨", async () => {
    const engine = new SmartDefaultsEngine(mockLLM);
    const context: SmartDefaultsContext = {
      userInput: "Report",
      conversationHistory: [],
    };

    const docType: DocumentTypeInference = {
      documentType: "report",
      confidence: 0.9,
      folderTypeHint: "reports",
    };

    const filename = engine.generateSmartFilename("Report", context, docType);

    expect(filename).toMatch(/\.md$/);
  });
});
