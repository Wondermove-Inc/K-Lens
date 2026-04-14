/**
 * 🎯 목적: SmartDefaultsEngine 단위 테스트
 * PHASE 2 (P2-T1): SmartDefaultsEngine 클래스 구조 및 인터페이스 검증
 *
 * 📝 테스트 범위:
 * - 클래스 인스턴스화 (LLM 의존성 주입)
 * - 메서드 시그니처 검증
 * - 타입 인터페이스 검증
 * - 기본 동작 검증
 *
 * @packageDocumentation
 */

import {
  type DocumentTypeInference,
  type FolderType,
  type SaveIntentAnalysis,
  type SmartDefaults,
  type SmartDefaultsContext,
  SmartDefaultsEngine,
} from "../smart-defaults-engine";

import type { MainLLMModel } from "../../llm-model-factory";

// ============================================
// 🎯 Mock LLM Model
// ============================================

/**
 * 🎯 Smart Mock LLM for testing
 *
 * 프롬프트 내용을 분석하여 적절한 문서 타입을 반환합니다.
 * inferDocumentTypeWithLLM 테스트를 위해 콘텐츠 기반 응답을 제공합니다.
 */
const createSmartMockLLM = () => {
  const invoke = jest.fn().mockImplementation((prompt: string) => {
    // 프롬프트에서 콘텐츠 미리보기 추출
    const contentMatch = prompt.match(/Content preview:\n"""\n([\s\S]*?)\n"""/);
    const content = contentMatch?.[1]?.toLowerCase() || prompt.toLowerCase();

    // 콘텐츠 기반 문서 타입 결정 (다국어 지원)
    // Report 키워드 (모든 언어)
    if (
      content.includes("report") ||
      content.includes("summary") ||
      content.includes("analysis") ||
      content.includes("보고서") ||
      content.includes("분석") ||
      content.includes("요약") ||
      content.includes("レポート") ||
      content.includes("報告") ||
      content.includes("报告") ||
      content.includes("báo cáo") ||
      content.includes("diagnostics") ||
      content.includes("root cause")
    ) {
      return Promise.resolve({ content: "report" });
    }

    // Plan 키워드 (모든 언어)
    if (
      content.includes("plan") ||
      content.includes("todo") ||
      content.includes("계획") ||
      content.includes("プラン") ||
      content.includes("计划") ||
      content.includes("kế hoạch") ||
      content.includes("migration")
    ) {
      return Promise.resolve({ content: "plan" });
    }

    // Config 키워드
    if (
      content.includes("config") ||
      content.includes("settings") ||
      content.includes("설정") ||
      content.includes("配置") ||
      content.includes("cấu hình")
    ) {
      return Promise.resolve({ content: "config" });
    }

    // Manifest 키워드
    if (content.includes("apiversion") || content.includes("kind:") || content.includes("매니페스트")) {
      return Promise.resolve({ content: "manifest" });
    }

    // 기본값
    return Promise.resolve({ content: "misc" });
  });

  return {
    invoke,
    withStructuredOutput: jest.fn().mockReturnThis(),
  } as unknown as MainLLMModel;
};

const mockLLM = createSmartMockLLM();

// ============================================
// 🔹 SmartDefaultsEngine 클래스 테스트
// ============================================

describe("SmartDefaultsEngine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // 🔹 인스턴스화 테스트
  // ============================================

  describe("인스턴스화", () => {
    it("LLM 의존성으로 인스턴스화되어야 함", () => {
      const engine = new SmartDefaultsEngine(mockLLM);
      expect(engine).toBeInstanceOf(SmartDefaultsEngine);
    });

    it("LLM 없이 인스턴스화하면 에러 발생해야 함", () => {
      expect(() => new SmartDefaultsEngine(undefined as unknown as MainLLMModel)).toThrow();
    });
  });

  // ============================================
  // 🔹 메서드 존재 테스트
  // ============================================

  describe("메서드 존재", () => {
    let engine: SmartDefaultsEngine;

    beforeEach(() => {
      engine = new SmartDefaultsEngine(mockLLM);
    });

    it("analyze 메서드가 존재해야 함", () => {
      expect(typeof engine.analyze).toBe("function");
    });

    it("inferDocumentType 메서드가 존재해야 함", () => {
      expect(typeof engine.inferDocumentType).toBe("function");
    });

    it("generateSmartFilename 메서드가 존재해야 함", () => {
      expect(typeof engine.generateSmartFilename).toBe("function");
    });
  });

  // ============================================
  // 🔹 analyze 메서드 테스트
  // ============================================

  describe("analyze 메서드", () => {
    let engine: SmartDefaultsEngine;

    beforeEach(() => {
      engine = new SmartDefaultsEngine(mockLLM);
    });

    it("SmartDefaults를 반환해야 함", async () => {
      const context: SmartDefaultsContext = {
        userInput: "보고서 작성해줘",
        conversationHistory: [],
        selectedCluster: { id: "cluster-1", name: "production" },
      };

      const result = await engine.analyze("보고서 작성해줘", context);

      expect(result).toBeDefined();
      expect(result).toHaveProperty("folderType");
      expect(result).toHaveProperty("filename");
      expect(result).toHaveProperty("documentType");
      expect(result).toHaveProperty("saveIntent");
    });

    it("context 없이도 동작해야 함", async () => {
      const minimalContext: SmartDefaultsContext = {
        userInput: "Create a report",
        conversationHistory: [],
      };

      const result = await engine.analyze("Create a report", minimalContext);
      expect(result).toBeDefined();
    });

    it("대화 히스토리에서 문제 키워드를 감지해야 함", async () => {
      const context: SmartDefaultsContext = {
        userInput: "보고서 작성해줘",
        conversationHistory: [
          { role: "user", content: "Pod가 CrashLoopBackOff 상태야" },
          { role: "assistant", content: "OOM 문제로 보입니다" },
        ],
        selectedCluster: { id: "1", name: "production" },
      };

      const result = await engine.analyze("진단 결과 보고서 작성해줘", context);

      expect(result.documentType.documentType).toBe("report");
      expect(result.folderType).toBe("reports");
    });

    it("YAML manifest 입력 시 manifests 폴더로 추론해야 함", async () => {
      const context: SmartDefaultsContext = {
        userInput: "이 manifest 저장해줘",
        conversationHistory: [],
      };

      const yamlContent = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx`;

      const result = await engine.analyze(yamlContent, context);

      expect(result.documentType.documentType).toBe("manifest");
      expect(result.folderType).toBe("manifests");
    });

    it("TODO 포함 시 plans 폴더로 추론해야 함", async () => {
      const context: SmartDefaultsContext = {
        userInput: "플랜 작성해줘",
        conversationHistory: [],
      };

      const planContent = `# Migration Plan
- [ ] Step 1: Backup
- [ ] Step 2: Migrate
TODO: Complete testing`;

      const result = await engine.analyze(planContent, context);

      expect(result.documentType.documentType).toBe("plan");
      expect(result.folderType).toBe("plans");
    });

    it("confidence 점수가 0.0 ~ 1.0 범위여야 함", async () => {
      const context: SmartDefaultsContext = {
        userInput: "보고서 작성해줘",
        conversationHistory: [],
      };

      const result = await engine.analyze("보고서 작성해줘", context);

      expect(result.documentType.confidence).toBeGreaterThanOrEqual(0);
      expect(result.documentType.confidence).toBeLessThanOrEqual(1);
      expect(result.saveIntent.confidence).toBeGreaterThanOrEqual(0);
      expect(result.saveIntent.confidence).toBeLessThanOrEqual(1);
    });

    it("클러스터 정보가 파일명에 포함되어야 함", async () => {
      const context: SmartDefaultsContext = {
        userInput: "Health report",
        conversationHistory: [],
        selectedCluster: { id: "1", name: "staging" },
      };

      const result = await engine.analyze("Health report", context);

      expect(result.filename).toContain("staging");
    });
  });

  // ============================================
  // 🔹 inferDocumentType 메서드 테스트
  // ============================================

  describe("inferDocumentType 메서드", () => {
    let engine: SmartDefaultsEngine;

    beforeEach(() => {
      engine = new SmartDefaultsEngine(mockLLM);
    });

    it("DocumentTypeInference를 반환해야 함", async () => {
      const content = "# Cluster Health Report\n\n## Summary...";
      const result = await engine.inferDocumentType(content);

      expect(result).toBeDefined();
      expect(result).toHaveProperty("documentType");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("folderTypeHint");
    });

    it("빈 콘텐츠에 대해 기본값을 반환해야 함", async () => {
      const result = await engine.inferDocumentType("");

      expect(result).toBeDefined();
      expect(result.documentType).toBe("misc");
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================
  // 🔹 generateSmartFilename 메서드 테스트
  // ============================================

  describe("generateSmartFilename 메서드", () => {
    let engine: SmartDefaultsEngine;

    beforeEach(() => {
      engine = new SmartDefaultsEngine(mockLLM);
    });

    it("유효한 파일명을 반환해야 함", () => {
      const context: SmartDefaultsContext = {
        userInput: "클러스터 헬스 리포트 작성해줘",
        conversationHistory: [],
      };

      const docType: DocumentTypeInference = {
        documentType: "report",
        confidence: 0.95,
        folderTypeHint: "reports",
      };

      const filename = engine.generateSmartFilename("클러스터 헬스 리포트", context, docType);

      expect(filename).toBeDefined();
      expect(typeof filename).toBe("string");
      expect(filename.length).toBeGreaterThan(0);
    });

    it("파일명이 .md 확장자를 가져야 함", () => {
      const context: SmartDefaultsContext = {
        userInput: "Create a deployment plan",
        conversationHistory: [],
      };

      const docType: DocumentTypeInference = {
        documentType: "plan",
        confidence: 0.9,
        folderTypeHint: "plans",
      };

      const filename = engine.generateSmartFilename("deployment plan", context, docType);

      expect(filename).toMatch(/\.md$/);
    });

    it("특수문자가 제거되어야 함", () => {
      const context: SmartDefaultsContext = {
        userInput: "Report for cluster/pod#123",
        conversationHistory: [],
      };

      const docType: DocumentTypeInference = {
        documentType: "report",
        confidence: 0.85,
        folderTypeHint: "reports",
      };

      const filename = engine.generateSmartFilename("Report for cluster/pod#123", context, docType);

      expect(filename).not.toMatch(/[\/\\#]/);
    });

    it("날짜 접두사가 포함되어야 함", () => {
      const context: SmartDefaultsContext = {
        userInput: "Health report",
        conversationHistory: [],
      };

      const docType: DocumentTypeInference = {
        documentType: "report",
        confidence: 0.9,
        folderTypeHint: "reports",
      };

      const filename = engine.generateSmartFilename("Health report", context, docType);

      // YYYY-MM-DD 형식 확인
      expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}/);
    });

    it("비ASCII 문자 (다국어) 처리가 되어야 함", () => {
      const context: SmartDefaultsContext = {
        userInput: "클러스터 상태 보고서",
        conversationHistory: [],
      };

      const docType: DocumentTypeInference = {
        documentType: "report",
        confidence: 0.9,
        folderTypeHint: "reports",
      };

      const filename = engine.generateSmartFilename("클러스터 상태 보고서", context, docType);

      expect(filename).toBeDefined();
      expect(filename.length).toBeGreaterThan(0);
      expect(filename).toMatch(/\.md$/);
    });

    it("클러스터 이름이 파일명에 포함되어야 함", () => {
      const context: SmartDefaultsContext = {
        userInput: "Health report",
        conversationHistory: [],
        selectedCluster: { id: "1", name: "production" },
      };

      const docType: DocumentTypeInference = {
        documentType: "report",
        confidence: 0.9,
        folderTypeHint: "reports",
      };

      const filename = engine.generateSmartFilename("Health report", context, docType);

      expect(filename).toContain("production");
    });

    it("한국어 제목이 유지되어야 함 (i18n)", () => {
      const context: SmartDefaultsContext = {
        userInput: "클러스터 상태 보고서",
        conversationHistory: [],
      };

      const docType: DocumentTypeInference = {
        documentType: "report",
        confidence: 0.9,
        folderTypeHint: "reports",
      };

      const filename = engine.generateSmartFilename("클러스터 상태 보고서", context, docType);

      // 한국어가 유지되어야 함
      expect(filename).toContain("클러스터");
      expect(filename).toContain("상태");
      expect(filename).toContain("보고서");
    });

    it("일본어 제목이 유지되어야 함 (i18n)", () => {
      const context: SmartDefaultsContext = {
        userInput: "クラスター状態レポート",
        conversationHistory: [],
      };

      const docType: DocumentTypeInference = {
        documentType: "report",
        confidence: 0.9,
        folderTypeHint: "reports",
      };

      const filename = engine.generateSmartFilename("クラスター状態レポート", context, docType);

      // 일본어가 유지되어야 함
      expect(filename).toContain("クラスター");
      expect(filename).toMatch(/\.md$/);
    });

    it("중국어 제목이 유지되어야 함 (i18n)", () => {
      const context: SmartDefaultsContext = {
        userInput: "集群状态报告",
        conversationHistory: [],
      };

      const docType: DocumentTypeInference = {
        documentType: "report",
        confidence: 0.9,
        folderTypeHint: "reports",
      };

      const filename = engine.generateSmartFilename("集群状态报告", context, docType);

      // 중국어가 유지되어야 함
      expect(filename).toContain("集群");
      expect(filename).toMatch(/\.md$/);
    });

    it("빈 입력 시 기본값 'document'를 사용해야 함", () => {
      const context: SmartDefaultsContext = {
        userInput: "",
        conversationHistory: [],
      };

      const docType: DocumentTypeInference = {
        documentType: "misc",
        confidence: 0.5,
        folderTypeHint: "misc",
      };

      const filename = engine.generateSmartFilename("", context, docType);

      expect(filename).toContain("misc"); // 기본 문서 타입으로 폴백
      expect(filename).toMatch(/\.md$/);
    });

    it("마크다운 헤딩에서 제목을 추출해야 함", () => {
      const context: SmartDefaultsContext = {
        userInput: "# Cluster Health Report\n\nSome content here",
        conversationHistory: [],
      };

      const docType: DocumentTypeInference = {
        documentType: "report",
        confidence: 0.9,
        folderTypeHint: "reports",
      };

      const filename = engine.generateSmartFilename("# Cluster Health Report\n\nSome content here", context, docType);

      const lowerFilename = filename.toLowerCase();
      expect(lowerFilename).toContain("cluster");
      expect(lowerFilename).toContain("health");
      expect(lowerFilename).toContain("report");
    });
  });
});

// ============================================
// 🔹 인터페이스 타입 테스트
// ============================================

describe("인터페이스 타입", () => {
  it("SmartDefaultsContext 인터페이스가 올바른 속성을 가져야 함", () => {
    const context: SmartDefaultsContext = {
      userInput: "test input",
      conversationHistory: [{ role: "user", content: "hi" }],
      selectedCluster: { id: "1", name: "test" },
    };

    expect(context.userInput).toBeDefined();
    expect(context.conversationHistory).toBeDefined();
    expect(context.selectedCluster).toBeDefined();
  });

  it("DocumentTypeInference 인터페이스가 올바른 속성을 가져야 함", () => {
    const inference: DocumentTypeInference = {
      documentType: "report",
      confidence: 0.95,
      folderTypeHint: "reports",
    };

    expect(inference.documentType).toBe("report");
    expect(inference.confidence).toBe(0.95);
    expect(inference.folderTypeHint).toBe("reports");
  });

  it("SaveIntentAnalysis 인터페이스가 올바른 속성을 가져야 함", () => {
    const analysis: SaveIntentAnalysis = {
      shouldSave: true,
      confidence: 0.9,
      reason: "User explicitly requested file save",
    };

    expect(analysis.shouldSave).toBe(true);
    expect(analysis.confidence).toBe(0.9);
    expect(analysis.reason).toBeDefined();
  });

  it("SmartDefaults 인터페이스가 올바른 속성을 가져야 함", () => {
    const defaults: SmartDefaults = {
      folderType: "reports",
      filename: "2026-01-29-cluster-health-report.md",
      documentType: {
        documentType: "report",
        confidence: 0.95,
        folderTypeHint: "reports",
      },
      saveIntent: {
        shouldSave: true,
        confidence: 0.9,
        reason: "Document creation with implicit save expectation",
      },
    };

    expect(defaults.folderType).toBe("reports");
    expect(defaults.filename).toMatch(/\.md$/);
    expect(defaults.documentType).toBeDefined();
    expect(defaults.saveIntent).toBeDefined();
  });
});

// ============================================
// 🔹 문서 타입 감지 테스트 (P2-T2)
// ============================================

describe("문서 타입 감지 (inferDocumentType)", () => {
  let engine: SmartDefaultsEngine;

  beforeEach(() => {
    engine = new SmartDefaultsEngine(mockLLM);
  });

  describe("Kubernetes manifest 감지", () => {
    const manifestExamples = [
      {
        description: "Deployment YAML",
        content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  replicas: 3`,
        expectedType: "manifest",
      },
      {
        description: "Service YAML",
        content: `apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  selector:
    app: nginx`,
        expectedType: "manifest",
      },
      {
        description: "Pod YAML",
        content: `apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod`,
        expectedType: "manifest",
      },
      {
        description: "ConfigMap YAML",
        content: `apiVersion: v1
kind: ConfigMap
metadata:
  name: game-config
data:
  game.properties: |
    enemies=aliens`,
        expectedType: "manifest",
      },
    ];

    it.each(manifestExamples)("$description → manifest", async ({ content, expectedType }) => {
      const result = await engine.inferDocumentType(content);
      expect(result.documentType).toBe(expectedType);
      expect(result.folderTypeHint).toBe("manifests");
    });
  });

  describe("Markdown report 감지", () => {
    const reportExamples = [
      {
        description: "Health report (EN)",
        content: `# Cluster Health Report
## Summary
The cluster is healthy with all nodes running.
## Analysis
- Node count: 5
- Pod status: All running`,
        expectedType: "report",
      },
      {
        description: "Health report (KO)",
        content: `# 클러스터 상태 보고서
## 요약
모든 노드가 정상 작동 중입니다.
## 분석
- 노드 수: 5
- Pod 상태: 모두 실행 중`,
        expectedType: "report",
      },
      {
        description: "Diagnostic report",
        content: `# Diagnostic Report
## Issue Description
Pod CrashLoopBackOff detected
## Root Cause Analysis
Memory limit exceeded`,
        expectedType: "report",
      },
    ];

    it.each(reportExamples)("$description → report", async ({ content, expectedType }) => {
      const result = await engine.inferDocumentType(content);
      expect(result.documentType).toBe(expectedType);
      expect(result.folderTypeHint).toBe("reports");
    });
  });

  describe("TODO/Plan 감지", () => {
    const planExamples = [
      {
        description: "TODO list",
        content: `# Deployment Plan
- [ ] Scale up replicas
- [ ] Update image version
- [x] Test in staging`,
        expectedType: "plan",
      },
      {
        description: "Action plan",
        content: `# Migration Plan
## Phase 1
1. Backup data
2. Stop services
## Phase 2
TODO: Complete migration`,
        expectedType: "plan",
      },
    ];

    it.each(planExamples)("$description → plan", async ({ content, expectedType }) => {
      const result = await engine.inferDocumentType(content);
      expect(result.documentType).toBe(expectedType);
      expect(result.folderTypeHint).toBe("plans");
    });
  });

  describe("Config 감지", () => {
    const configExamples = [
      {
        description: "JSON config",
        content: `{
  "database": {
    "host": "localhost",
    "port": 5432
  },
  "cache": {
    "enabled": true
  }
}`,
        expectedType: "config",
      },
      {
        description: "YAML config (non-k8s)",
        content: `server:
  port: 8080
  host: 0.0.0.0
logging:
  level: debug
  format: json`,
        expectedType: "config",
      },
    ];

    it.each(configExamples)("$description → config", async ({ content, expectedType }) => {
      const result = await engine.inferDocumentType(content);
      expect(result.documentType).toBe(expectedType);
      expect(result.folderTypeHint).toBe("configs");
    });
  });

  describe("Misc/Unknown 감지", () => {
    it("일반 텍스트 → misc", async () => {
      const content = "Hello, this is just some random text without any structure.";
      const result = await engine.inferDocumentType(content);
      expect(result.documentType).toBe("misc");
    });

    it("빈 문자열 → misc", async () => {
      const result = await engine.inferDocumentType("");
      expect(result.documentType).toBe("misc");
    });
  });

  describe("Confidence score", () => {
    it("신뢰도 점수가 0.0 ~ 1.0 사이여야 함", async () => {
      const content = "# Cluster Health Report\n## Summary";
      const result = await engine.inferDocumentType(content);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("명확한 manifest는 높은 신뢰도를 가져야 함", async () => {
      const content = `apiVersion: apps/v1
kind: Deployment`;
      const result = await engine.inferDocumentType(content);
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe("Multi-language support", () => {
    it("일본어 레포트 감지", async () => {
      const content = `# クラスターレポート
## 概要
すべてのノードが正常に動作しています。`;
      const result = await engine.inferDocumentType(content);
      expect(result.documentType).toBe("report");
    });

    it("중국어 레포트 감지", async () => {
      const content = `# 集群报告
## 摘要
所有节点都在正常运行。`;
      const result = await engine.inferDocumentType(content);
      expect(result.documentType).toBe("report");
    });
  });
});

// ============================================
// 🔹 FolderType 매핑 테스트
// ============================================

describe("FolderType 매핑", () => {
  const folderTypeCases: Array<{
    docType: DocumentTypeInference["documentType"];
    expectedFolder: FolderType;
  }> = [
    { docType: "report", expectedFolder: "reports" },
    { docType: "plan", expectedFolder: "plans" },
    { docType: "manifest", expectedFolder: "manifests" },
    { docType: "config", expectedFolder: "configs" },
    { docType: "misc", expectedFolder: "misc" },
  ];

  it.each(folderTypeCases)("$docType → $expectedFolder 매핑이 올바라야 함", async ({ docType, expectedFolder }) => {
    const inference: DocumentTypeInference = {
      documentType: docType,
      confidence: 0.9,
      folderTypeHint: expectedFolder,
    };

    expect(inference.folderTypeHint).toBe(expectedFolder);
  });
});
