/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 파일 기반 대화 히스토리 저장
 *
 * SQLite 대신 JSONL 파일로 대화를 저장합니다.
 * - 크래시에 안전 (append-only)
 * - 백업/복구 쉬움
 * - 네이티브 모듈 불필요
 *
 * 📁 저장 구조:
 * ~/Library/Application Support/Skuber+ Client/
 *   ai-assistant/
 *     conversations/
 *       2025-01-12-abc123.jsonl
 *     thread-index.json
 *
 * 🔄 변경이력:
 * - 2025-12-29: 초기 생성 (파일 기반 저장으로 전환)
 */

import fs from "fs";
import path from "path";

import type { ThreadInfo, ThreadMessage } from "../common/agent-ipc-channels";

// ============================================
// 🎯 타입 정의
// ============================================

/**
 * 🎯 JSONL 이벤트 타입
 */
export type ConversationEvent = MetaEvent | MessageEvent | ToolCallEvent | ToolResultEvent;

interface MetaEvent {
  type: "meta";
  threadId: string;
  createdAt: string;
  context?: {
    clusterId?: string;
    namespace?: string;
  };
}

/**
 * 🎯 메시지 이벤트
 *
 * 📝 2026-01-13: 해결
 * - presentation, toolApprovalResult, planSnapshot, planStatusMessageData 추가
 * - 대화방 전환 시 UI 메타데이터 복원 지원
 */
interface MessageEvent {
  type: "message";
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  /** 🆕 메시지 표현 방식 */
  presentation?: "chat" | "log" | "tool-approval-result" | "plan-viewer" | "plan-status-message";
  /** 🆕 Tool 승인 결과 데이터 */
  toolApprovalResult?: {
    approved: boolean;
    command: string;
    timestamp: string;
    yamlContent?: string;
    diffStats?: { additions: number; deletions: number };
    filePath?: string;
    output?: string;
  };
  /** 🆕 Plan 상태 스냅샷 */
  planSnapshot?: ThreadMessage["planSnapshot"];
  /** 🆕 Plan 상태 메시지 데이터 */
  planStatusMessageData?: ThreadMessage["planStatusMessageData"];
}

interface ToolCallEvent {
  type: "tool_call";
  name: string;
  args: Record<string, unknown>;
  timestamp: string;
}

interface ToolResultEvent {
  type: "tool_result";
  name: string;
  result: string;
  timestamp: string;
}

/**
 * 🎯 인덱스 파일 구조
 */
interface ThreadIndex {
  version: number;
  threads: ThreadIndexEntry[];
}

interface ThreadIndexEntry extends ThreadInfo {
  filePath: string;
}

/**
 * 🎯 ConversationLogger 설정
 */
export interface ConversationLoggerConfig {
  /** 앱 데이터 디렉토리 */
  appDataPath: string;
}

// ============================================
// 🎯 ConversationLogger 클래스
// ============================================

export class ConversationLogger {
  private readonly basePath: string;
  private readonly conversationsPath: string;
  private readonly indexPath: string;
  private index: Map<string, ThreadIndexEntry> = new Map();
  private indexSaveTimeout: NodeJS.Timeout | null = null;
  private initialized = false;

  constructor(config: ConversationLoggerConfig) {
    this.basePath = path.join(config.appDataPath, "ai-assistant");
    this.conversationsPath = path.join(this.basePath, "conversations");
    this.indexPath = path.join(this.basePath, "thread-index.json");
  }

  // ============================================
  // 🎯 초기화
  // ============================================

  /**
   * 🎯 초기화 (앱 시작 시 호출)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 디렉토리 생성
    await this.ensureDirectories();

    // 인덱스 로드
    await this.loadIndex();

    this.initialized = true;
    console.log(`[ConversationLogger] 초기화 완료 (${this.index.size}개 스레드)`);
  }

  private async ensureDirectories(): Promise<void> {
    if (!fs.existsSync(this.conversationsPath)) {
      fs.mkdirSync(this.conversationsPath, { recursive: true });
      console.log(`[ConversationLogger] 디렉토리 생성: ${this.conversationsPath}`);
    }
  }

  // ============================================
  // 🎯 인덱스 관리
  // ============================================

  private async loadIndex(): Promise<void> {
    if (fs.existsSync(this.indexPath)) {
      try {
        const content = fs.readFileSync(this.indexPath, "utf-8");
        const data: ThreadIndex = JSON.parse(content);
        this.index = new Map(data.threads.map((t) => [t.threadId, t]));
        console.log(`[ConversationLogger] 인덱스 로드 완료: ${this.index.size}개 스레드`);
        return;
      } catch (error) {
        console.warn("[ConversationLogger] 인덱스 로드 실패, 재생성:", error);
      }
    }

    // 인덱스 파일 없거나 손상 시 재생성
    await this.rebuildIndex();
  }

  private async rebuildIndex(): Promise<void> {
    console.log("[ConversationLogger] 인덱스 재생성 시작...");
    this.index.clear();

    if (!fs.existsSync(this.conversationsPath)) {
      return;
    }

    const files = fs.readdirSync(this.conversationsPath).filter((f) => f.endsWith(".jsonl"));

    for (const fileName of files) {
      try {
        const filePath = path.join(this.conversationsPath, fileName);
        const entry = await this.parseThreadFile(filePath);
        if (entry) {
          this.index.set(entry.threadId, entry);
        }
      } catch (error) {
        console.warn(`[ConversationLogger] 파일 파싱 실패: ${fileName}`, error);
      }
    }

    await this.saveIndex();
    console.log(`[ConversationLogger] 인덱스 재생성 완료: ${this.index.size}개 스레드`);
  }

  private async parseThreadFile(filePath: string): Promise<ThreadIndexEntry | null> {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());

    if (lines.length === 0) return null;

    let threadId = "";
    let createdAt = "";
    let lastMessage = "";
    let lastUpdatedAt = "";
    let messageCount = 0;

    for (const line of lines) {
      try {
        const event = JSON.parse(line) as ConversationEvent;

        if (event.type === "meta") {
          threadId = event.threadId;
          createdAt = event.createdAt;
        } else if (event.type === "message") {
          messageCount++;
          lastMessage = event.content;
          lastUpdatedAt = event.timestamp;
        }
      } catch {
        // 파싱 실패 라인 무시
      }
    }

    if (!threadId) return null;

    return {
      threadId,
      title: this.generateTitle(lastMessage),
      lastMessage: lastMessage.slice(0, 100) + (lastMessage.length > 100 ? "..." : ""),
      lastUpdatedAt: lastUpdatedAt || createdAt,
      messageCount,
      filePath: path.relative(this.conversationsPath, filePath),
    };
  }

  private generateTitle(lastMessage: string): string {
    const firstLine = lastMessage.split("\n")[0].trim();
    if (firstLine.length > 0 && firstLine.length <= 50) {
      return firstLine;
    }
    if (firstLine.length > 50) {
      return firstLine.slice(0, 47) + "...";
    }
    return "새 대화";
  }

  private async saveIndex(): Promise<void> {
    const data: ThreadIndex = {
      version: 1,
      threads: Array.from(this.index.values()),
    };
    fs.writeFileSync(this.indexPath, JSON.stringify(data, null, 2), "utf-8");
  }

  private saveIndexDebounced(): void {
    if (this.indexSaveTimeout) {
      clearTimeout(this.indexSaveTimeout);
    }
    this.indexSaveTimeout = setTimeout(() => {
      this.saveIndex().catch((e) => console.error("[ConversationLogger] 인덱스 저장 실패:", e));
    }, 1000);
  }

  // ============================================
  // 🎯 Thread 생성/로깅
  // ============================================

  /**
   * 🎯 새 Thread 생성
   */
  async createThread(threadId: string, context?: { clusterId?: string; namespace?: string }): Promise<void> {
    await this.initialize();

    const now = new Date().toISOString();
    const datePrefix = now.slice(0, 10); // "2026-01-30"
    const timePrefix = now.slice(11, 19).replace(/:/g, ""); // "143542"
    const fileName = `${datePrefix}-${timePrefix}-${threadId.slice(0, 8)}.jsonl`;
    const filePath = path.join(this.conversationsPath, fileName);

    // 메타 이벤트 작성
    const metaEvent: MetaEvent = {
      type: "meta",
      threadId,
      createdAt: now,
      context,
    };

    fs.writeFileSync(filePath, JSON.stringify(metaEvent) + "\n", "utf-8");

    // 인덱스 업데이트
    this.index.set(threadId, {
      threadId,
      title: "새 대화",
      lastMessage: "",
      lastUpdatedAt: now,
      messageCount: 0,
      filePath: fileName,
    });

    this.saveIndexDebounced();
    console.log(`[ConversationLogger] Thread 생성: ${threadId} → ${fileName}`);
  }

  /**
   * 🎯 메시지 로깅
   *
   * 📝 2026-01-13: 해결
   * - metadata 파라미터 추가로 확장 속성(presentation, toolApprovalResult 등) 저장 지원
   */
  async logMessage(
    threadId: string,
    role: "user" | "assistant" | "system",
    content: string,
    metadata?: {
      presentation?: ThreadMessage["presentation"];
      toolApprovalResult?: ThreadMessage["toolApprovalResult"];
      planSnapshot?: ThreadMessage["planSnapshot"];
      planStatusMessageData?: ThreadMessage["planStatusMessageData"];
    },
  ): Promise<void> {
    await this.initialize();

    const entry = this.index.get(threadId);
    if (!entry) {
      console.warn(`[ConversationLogger] Thread 없음: ${threadId}`);
      return;
    }

    const timestamp = new Date().toISOString();
    const event: MessageEvent = {
      type: "message",
      role,
      content,
      timestamp,
    };

    // 📝 2026-01-13: 확장 속성 추가
    if (metadata?.presentation) {
      event.presentation = metadata.presentation;
    }
    if (metadata?.toolApprovalResult) {
      event.toolApprovalResult = metadata.toolApprovalResult;
    }
    if (metadata?.planSnapshot) {
      event.planSnapshot = metadata.planSnapshot;
    }
    if (metadata?.planStatusMessageData) {
      event.planStatusMessageData = metadata.planStatusMessageData;
    }

    const filePath = path.join(this.conversationsPath, entry.filePath);
    fs.appendFileSync(filePath, JSON.stringify(event) + "\n", "utf-8");

    // 인덱스 업데이트
    entry.lastMessage = content.slice(0, 100) + (content.length > 100 ? "..." : "");
    entry.lastUpdatedAt = timestamp;
    entry.messageCount++;

    if (entry.title === "새 대화" && role === "user") {
      entry.title = this.generateTitle(content);
    }

    this.saveIndexDebounced();
  }

  /**
   * 🎯 Tool 호출 로깅
   */
  async logToolCall(threadId: string, name: string, args: Record<string, unknown>): Promise<void> {
    await this.initialize();

    const entry = this.index.get(threadId);
    if (!entry) return;

    const event: ToolCallEvent = {
      type: "tool_call",
      name,
      args,
      timestamp: new Date().toISOString(),
    };

    const filePath = path.join(this.conversationsPath, entry.filePath);
    fs.appendFileSync(filePath, JSON.stringify(event) + "\n", "utf-8");
  }

  /**
   * 🎯 Tool 결과 로깅
   */
  async logToolResult(threadId: string, name: string, result: string): Promise<void> {
    await this.initialize();

    const entry = this.index.get(threadId);
    if (!entry) return;

    const event: ToolResultEvent = {
      type: "tool_result",
      name,
      result: result.slice(0, 5000), // 결과 길이 제한
      timestamp: new Date().toISOString(),
    };

    const filePath = path.join(this.conversationsPath, entry.filePath);
    fs.appendFileSync(filePath, JSON.stringify(event) + "\n", "utf-8");
  }

  // ============================================
  // 🎯 Thread 조회 (Past Chats UI용)
  // ============================================

  /**
   * 🎯 Thread 목록 조회
   */
  async listThreads(limit = 50): Promise<ThreadInfo[]> {
    await this.initialize();

    return Array.from(this.index.values())
      .sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt))
      .slice(0, limit)
      .map(({ filePath, ...info }) => info);
  }

  /**
   * 🎯 Thread 메시지 로드
   *
   * 📝 2026-01-13: 해결
   * - 확장 속성(presentation, toolApprovalResult, planSnapshot 등) 복원 추가
   */
  async getThreadMessages(threadId: string): Promise<ThreadMessage[]> {
    await this.initialize();

    const entry = this.index.get(threadId);
    if (!entry) {
      console.warn(`[ConversationLogger] Thread 없음: ${threadId}`);
      return [];
    }

    const filePath = path.join(this.conversationsPath, entry.filePath);
    if (!fs.existsSync(filePath)) {
      console.warn(`[ConversationLogger] 파일 없음: ${filePath}`);
      return [];
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const messages: ThreadMessage[] = [];

    for (const line of content.split("\n")) {
      if (!line.trim()) continue;

      try {
        const event = JSON.parse(line) as ConversationEvent;
        if (event.type === "message") {
          // 📝 2026-01-13: 확장 속성 포함하여 메시지 생성
          const message: ThreadMessage = {
            role: event.role,
            content: event.content,
            timestamp: event.timestamp,
          };

          // 확장 속성이 있으면 추가
          if (event.presentation) {
            message.presentation = event.presentation;
          }
          if (event.toolApprovalResult) {
            message.toolApprovalResult = event.toolApprovalResult;
          }
          if (event.planSnapshot) {
            message.planSnapshot = event.planSnapshot;
          }
          if (event.planStatusMessageData) {
            message.planStatusMessageData = event.planStatusMessageData;
          }

          messages.push(message);
        }
      } catch {
        // 파싱 실패 라인 무시
      }
    }

    return messages;
  }

  /**
   * 🎯 Thread 삭제
   */
  async deleteThread(threadId: string): Promise<boolean> {
    await this.initialize();

    const entry = this.index.get(threadId);
    if (!entry) {
      return false;
    }

    const filePath = path.join(this.conversationsPath, entry.filePath);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      this.index.delete(threadId);
      this.saveIndexDebounced();
      console.log(`[ConversationLogger] Thread 삭제: ${threadId}`);
      return true;
    } catch (error) {
      console.error(`[ConversationLogger] Thread 삭제 실패: ${threadId}`, error);
      return false;
    }
  }

  /**
   * 🎯 Thread 존재 여부 확인
   */
  hasThread(threadId: string): boolean {
    return this.index.has(threadId);
  }

  /**
   * 🎯 종료 (인덱스 저장 보장)
   */
  async close(): Promise<void> {
    if (this.indexSaveTimeout) {
      clearTimeout(this.indexSaveTimeout);
    }
    await this.saveIndex();
    console.log("[ConversationLogger] 종료");
  }
}
