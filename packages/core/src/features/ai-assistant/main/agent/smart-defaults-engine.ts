/**
 * 🎯 목적: Smart Defaults Engine - 문서 저장을 위한 지능적 기본값 추론
 *
 * 사용자 입력과 대화 컨텍스트를 분석하여 문서 저장에 필요한
 * 파라미터(folderType, filename)를 자동으로 추론합니다.
 *
 * 📝 핵심 기능:
 * - 문서 타입 추론 (LLM 기반)
 * - 스마트 파일명 생성 (다국어 지원)
 * - 저장 의도 분석
 * - FolderType 매핑
 *
 * 🌍 다국어 지원: LLM 의미론적 판단 (키워드 매칭 금지)
 *
 * @packageDocumentation
 */

import type { MainLLMModel } from "../llm-model-factory";

// ============================================
// 🎯 타입 정의
// ============================================

/**
 * 허용된 FolderType 값
 */
export type FolderType = "reports" | "plans" | "manifests" | "configs" | "misc";

/**
 * 허용된 DocumentType 값
 */
export type DocumentType = "report" | "plan" | "manifest" | "config" | "misc";

/**
 * 대화 히스토리 메시지 타입
 */
export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * 클러스터 정보 타입
 */
export interface ClusterInfo {
  id: string;
  name: string;
}

/**
 * 🎯 SmartDefaultsContext - 분석에 필요한 컨텍스트
 *
 * 사용자 입력과 대화 히스토리를 포함하여 LLM이
 * 문맥을 파악할 수 있도록 합니다.
 */
export interface SmartDefaultsContext {
  /** 현재 사용자 입력 */
  userInput: string;
  /** 이전 대화 히스토리 */
  conversationHistory: ConversationMessage[];
  /** 선택된 클러스터 정보 (선택적) */
  selectedCluster?: ClusterInfo;
}

/**
 * 🎯 DocumentTypeInference - 문서 타입 추론 결과
 *
 * LLM이 문서 내용이나 사용자 요청을 분석하여
 * 문서 타입을 추론한 결과입니다.
 */
export interface DocumentTypeInference {
  /** 추론된 문서 타입 */
  documentType: DocumentType;
  /** 추론 신뢰도 (0.0 ~ 1.0) */
  confidence: number;
  /** 매핑된 폴더 타입 힌트 */
  folderTypeHint: FolderType;
}

/**
 * 🎯 SaveIntentAnalysis - 저장 의도 분석 결과
 *
 * 사용자가 파일 저장을 원하는지 분석한 결과입니다.
 */
export interface SaveIntentAnalysis {
  /** 저장해야 하는지 여부 */
  shouldSave: boolean;
  /** 분석 신뢰도 (0.0 ~ 1.0) */
  confidence: number;
  /** 분석 근거 */
  reason: string;
}

/**
 * 🎯 SmartDefaults - 최종 스마트 기본값
 *
 * analyze() 메서드의 반환 타입으로,
 * 문서 저장에 필요한 모든 추론된 값을 포함합니다.
 */
export interface SmartDefaults {
  /** 추론된 폴더 타입 */
  folderType: FolderType;
  /** 생성된 파일명 (확장자 포함) */
  filename: string;
  /** 문서 타입 추론 결과 */
  documentType: DocumentTypeInference;
  /** 저장 의도 분석 결과 */
  saveIntent: SaveIntentAnalysis;
}

// ============================================
// 🎯 상수 정의
// ============================================

/**
 * DocumentType → FolderType 매핑
 */
const DOCUMENT_TYPE_TO_FOLDER: Record<DocumentType, FolderType> = {
  report: "reports",
  plan: "plans",
  manifest: "manifests",
  config: "configs",
  misc: "misc",
};

// ============================================
// 🎯 SmartDefaultsEngine 클래스
// ============================================

/**
 * 🎯 SmartDefaultsEngine - 문서 저장을 위한 지능적 기본값 추론 엔진
 *
 * 사용자 입력과 대화 컨텍스트를 분석하여 문서 저장에 필요한
 * 파라미터(folderType, filename)를 자동으로 추론합니다.
 *
 * @example
 * ```typescript
 * const engine = new SmartDefaultsEngine(llm);
 *
 * const context: SmartDefaultsContext = {
 *   userInput: "보고서 작성해줘",
 *   conversationHistory: [],
 *   selectedCluster: { id: "1", name: "production" },
 * };
 *
 * const defaults = await engine.analyze("보고서 작성해줘", context);
 * // defaults.folderType === "reports"
 * // defaults.filename === "2026-01-29-report.md"
 * ```
 */
export class SmartDefaultsEngine {
  /** LLM 모델 인스턴스 (향후 LLM 기반 추론에 사용 예정) */
  private readonly llm: MainLLMModel;

  /**
   * SmartDefaultsEngine 생성자
   *
   * @param llm - LLM 모델 인스턴스 (향후 LLM 기반 추론에 사용 예정)
   * @throws LLM이 undefined/null이면 에러 발생
   */
  constructor(llm: MainLLMModel) {
    if (!llm) {
      throw new Error("SmartDefaultsEngine requires an LLM instance");
    }
    this.llm = llm;
  }

  /**
   * 🎯 LLM 인스턴스 getter (향후 LLM 기반 추론에 사용)
   */
  getLLM(): MainLLMModel {
    return this.llm;
  }

  /**
   * 🎯 사용자 입력과 컨텍스트를 분석하여 스마트 기본값 생성
   *
   * @param input - 사용자 입력 텍스트
   * @param context - 분석 컨텍스트 (대화 히스토리, 클러스터 정보 등)
   * @returns 추론된 스마트 기본값
   *
   * @example
   * ```typescript
   * const defaults = await engine.analyze("클러스터 헬스 리포트 만들어줘", context);
   * ```
   */
  async analyze(input: string, context: SmartDefaultsContext): Promise<SmartDefaults> {
    // 1. 문서 타입 추론
    const documentType = await this.inferDocumentType(input);

    // 2. 저장 의도 분석
    const saveIntent = this.analyzeSaveIntent(input, documentType);

    // 3. 스마트 파일명 생성
    const filename = this.generateSmartFilename(input, context, documentType);

    // 4. FolderType 매핑
    const folderType = documentType.folderTypeHint;

    return {
      folderType,
      filename,
      documentType,
      saveIntent,
    };
  }

  /**
   * 🎯 문서 타입 추론 (구조 감지 + LLM 의미론)
   *
   * 문서 내용이나 사용자 요청을 분석하여 문서 타입을 추론합니다.
   * 1. 구조 기반 감지 (Kubernetes manifest, JSON/YAML config 등)
   * 2. LLM 의미론적 분석 (다국어 지원)
   *
   * 🌍 다국어 지원: LLM이 의미론적으로 판단하므로 모든 언어 지원
   *
   * @param content - 분석할 텍스트 (문서 내용 또는 사용자 요청)
   * @returns 문서 타입 추론 결과
   */
  async inferDocumentType(content: string): Promise<DocumentTypeInference> {
    // 빈 콘텐츠 처리
    if (!content || content.trim().length === 0) {
      return {
        documentType: "misc",
        confidence: 0.5,
        folderTypeHint: "misc",
      };
    }

    // 1. 구조 기반 감지 (우선순위 높음 - 빠르고 정확)
    const structureResult = this.detectByStructure(content);
    if (structureResult) {
      return structureResult;
    }

    // 2. LLM 의미론적 분석 (다국어 지원)
    try {
      const llmResult = await this.inferDocumentTypeWithLLM(content);
      if (llmResult) {
        return llmResult;
      }
    } catch (error) {
      // LLM 실패 시 폴백으로 계속 진행
      console.warn("[SmartDefaultsEngine] LLM inference failed, using fallback:", error);
    }

    // 3. 기본값 (LLM 실패 시)
    return {
      documentType: "misc",
      confidence: 0.6,
      folderTypeHint: "misc",
    };
  }

  /**
   * 🎯 LLM 기반 문서 타입 추론 (다국어 지원)
   *
   * LLM을 사용하여 문서의 의미론적 타입을 추론합니다.
   * 모든 언어를 지원하며, 키워드 매칭이 아닌 의미 기반 분석을 수행합니다.
   *
   * @param content - 분석할 텍스트
   * @returns 문서 타입 추론 결과 또는 null
   */
  private async inferDocumentTypeWithLLM(content: string): Promise<DocumentTypeInference | null> {
    // 콘텐츠 미리보기 (토큰 절약)
    const preview = content.slice(0, 500);

    const prompt = `Analyze the following document content and determine its type.

Document types:
- report: Analysis reports, status reports, health checks, summaries (보고서, レポート, 报告, báo cáo, informe, etc.)
- plan: Work plans, migration plans, action plans, roadmaps (계획, プラン, 计划, kế hoạch, plan, etc.)
- manifest: Kubernetes YAML manifests, deployment configs (매니페스트, マニフェスト, 清单, etc.)
- config: Configuration files, settings (설정, 設定, 配置, cấu hình, configuración, etc.)
- misc: Other documents that don't fit above categories

Content preview:
"""
${preview}
"""

Respond with ONLY the document type (one word): report, plan, manifest, config, or misc`;

    try {
      const response = await this.llm.invoke(prompt);

      // LLM 응답에서 타입 추출
      const responseText = typeof response.content === "string" ? response.content.toLowerCase().trim() : "";

      const validTypes: DocumentType[] = ["report", "plan", "manifest", "config", "misc"];
      const detectedType = validTypes.find((t) => responseText.includes(t)) || "misc";

      return {
        documentType: detectedType,
        confidence: detectedType === "misc" ? 0.6 : 0.85,
        folderTypeHint: DOCUMENT_TYPE_TO_FOLDER[detectedType],
      };
    } catch {
      return null;
    }
  }

  /**
   * 🎯 구조 기반 문서 타입 감지
   *
   * 문서의 구조적 특성을 분석하여 타입을 감지합니다.
   * - Kubernetes manifest: apiVersion + kind
   * - JSON config: { ... } 구조
   * - YAML config: key: value 구조 (non-k8s)
   *
   * @param content - 분석할 텍스트
   * @returns 감지된 문서 타입 또는 null (감지 실패 시)
   */
  private detectByStructure(content: string): DocumentTypeInference | null {
    const trimmedContent = content.trim();

    // 1. Kubernetes manifest 감지 (apiVersion + kind)
    const hasApiVersion = /apiVersion\s*:\s*\S+/i.test(content);
    const hasKind = /kind\s*:\s*\S+/i.test(content);

    if (hasApiVersion && hasKind) {
      return {
        documentType: "manifest",
        confidence: 0.95,
        folderTypeHint: "manifests",
      };
    }

    // 2. JSON config 감지 (객체 구조)
    if (trimmedContent.startsWith("{") && trimmedContent.endsWith("}")) {
      try {
        JSON.parse(trimmedContent);
        return {
          documentType: "config",
          confidence: 0.9,
          folderTypeHint: "configs",
        };
      } catch {
        // JSON 파싱 실패 - 계속 진행
      }
    }

    // 3. YAML config 감지 (key: value 구조, non-k8s)
    const yamlKeyValuePattern = /^\s*[\w-]+\s*:/gm;
    const yamlMatches = content.match(yamlKeyValuePattern) || [];
    const hasMultipleYamlLines = yamlMatches.length >= 2;

    if (hasMultipleYamlLines && !hasApiVersion && !hasKind) {
      // 다양한 설정 관련 키워드 확인
      const configKeywords = [
        "server",
        "database",
        "port",
        "host",
        "logging",
        "cache",
        "timeout",
        "enabled",
        "level",
        "format",
        "url",
        "connection",
        "settings",
      ];
      const lowerContent = content.toLowerCase();
      const hasConfigKeywords = configKeywords.some((k) => lowerContent.includes(k + ":"));

      if (hasConfigKeywords) {
        return {
          documentType: "config",
          confidence: 0.85,
          folderTypeHint: "configs",
        };
      }
    }

    // 4. TODO/Plan 감지 (체크박스 또는 TODO 키워드)
    const hasTodoCheckbox = /- \[[ x]\]/i.test(content);
    const hasTodoKeyword = /\bTODO\b/i.test(content);

    if (hasTodoCheckbox || hasTodoKeyword) {
      return {
        documentType: "plan",
        confidence: 0.85,
        folderTypeHint: "plans",
      };
    }

    // 구조 감지 실패
    return null;
  }

  /**
   * 🎯 스마트 파일명 생성
   *
   * 사용자 입력과 문서 타입을 기반으로 의미 있는 파일명을 생성합니다.
   * 다국어 입력도 처리하며, 안전한 파일명을 보장합니다.
   *
   * @param input - 사용자 입력 또는 문서 제목
   * @param context - 분석 컨텍스트
   * @param docType - 문서 타입 추론 결과
   * @returns 생성된 파일명 (확장자 포함)
   *
   * @example
   * ```typescript
   * const filename = engine.generateSmartFilename(
   *   "클러스터 헬스 리포트",
   *   context,
   *   { documentType: "report", confidence: 0.9, folderTypeHint: "reports" }
   * );
   * // "2026-01-29-production-클러스터-헬스-리포트.md"
   * ```
   */
  generateSmartFilename(input: string, context: SmartDefaultsContext, docType: DocumentTypeInference): string {
    // 1. 날짜+시간 접두사
    const today = new Date();
    const iso = today.toISOString();
    const datePrefix = `${iso.slice(0, 10)}-${iso.slice(11, 19).replace(/:/g, "")}`; // YYYY-MM-DD-HHmmss

    // 2. 제목 추출 (마크다운 헤딩 또는 입력 텍스트)
    const title = this.extractTitle(input);

    // 3. 슬러그 생성 (i18n 지원)
    const slug = this.sanitizeFilenameI18n(title, docType.documentType);

    // 4. 클러스터 이름 (있으면 추가)
    const clusterName = context.selectedCluster?.name;
    const clusterSlug = clusterName ? this.sanitizeFilenameI18n(clusterName, "") : "";

    // 5. 확장자
    const extension = ".md";

    // 6. 파일명 조합
    if (clusterSlug) {
      return `${datePrefix}-${clusterSlug}-${slug}${extension}`;
    }
    return `${datePrefix}-${slug}${extension}`;
  }

  /**
   * 🎯 제목 추출
   *
   * 마크다운 헤딩이 있으면 추출, 없으면 전체 텍스트 사용
   *
   * @param input - 입력 텍스트
   * @returns 추출된 제목
   */
  private extractTitle(input: string): string {
    if (!input || input.trim().length === 0) {
      return "";
    }

    // 마크다운 헤딩 추출 (# 또는 ## 등)
    const headingMatch = input.match(/^#+\s*(.+)$/m);
    if (headingMatch && headingMatch[1]) {
      return headingMatch[1].trim();
    }

    // 첫 줄만 사용 (너무 길면 잘라냄)
    const firstLine = input.split("\n")[0].trim();
    return firstLine;
  }

  /**
   * 🎯 저장 의도 분석 (규칙 기반)
   *
   * 문서 타입과 사용자 입력을 기반으로 저장 의도를 분석합니다.
   *
   * @param input - 사용자 입력
   * @param docType - 문서 타입 추론 결과
   * @returns 저장 의도 분석 결과
   */
  private analyzeSaveIntent(input: string, docType: DocumentTypeInference): SaveIntentAnalysis {
    const lowerInput = input.toLowerCase();

    // 명시적 저장 요청 패턴 (다국어)
    const explicitSavePatterns = ["저장", "save", "保存", "guardar", "파일로", "as file", "클러스터에", "to cluster"];

    const hasExplicitSave = explicitSavePatterns.some((p) => lowerInput.includes(p));

    if (hasExplicitSave) {
      return {
        shouldSave: true,
        confidence: 0.95,
        reason: "User explicitly requested file save",
      };
    }

    // 문서 타입에 따른 암묵적 저장 기대
    const implicitSaveTypes: DocumentType[] = ["report", "plan", "manifest", "config"];

    if (implicitSaveTypes.includes(docType.documentType)) {
      return {
        shouldSave: true,
        confidence: 0.8,
        reason: `Document type '${docType.documentType}' implies persistence expectation`,
      };
    }

    return {
      shouldSave: false,
      confidence: 0.7,
      reason: "No save intent detected",
    };
  }

  /**
   * 🎯 파일명 안전화 (다국어 지원 - i18n)
   *
   * 입력 텍스트를 안전한 파일명으로 변환합니다.
   * Unicode 문자 (한국어, 일본어, 중국어 등)를 유지합니다.
   *
   * @param input - 원본 텍스트
   * @param fallback - 폴백 값 (빈 결과 시 사용)
   * @returns 안전한 파일명 슬러그
   */
  private sanitizeFilenameI18n(input: string, fallback: string): string {
    if (!input || input.trim().length === 0) {
      return fallback || "document";
    }

    let slug = input
      // 파일명에 사용할 수 없는 특수문자 제거 (Unicode 문자는 유지)
      // \p{L} = Unicode 문자, \p{N} = Unicode 숫자
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      // 공백을 하이픈으로 변환
      .replace(/\s+/g, "-")
      // 연속 하이픈 정규화
      .replace(/-+/g, "-")
      // 앞뒤 하이픈 제거
      .replace(/^-|-$/g, "")
      .trim();

    // 최대 길이 제한 (50자)
    if (slug.length > 50) {
      slug = slug.substring(0, 50).replace(/-+$/, "");
    }

    // 빈 결과 방지
    if (!slug || slug.length === 0) {
      return fallback || "document";
    }

    return slug;
  }
}
