/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Agent 스트림 이벤트 버스 (Renderer)
 *
 * Agent 스트림 이벤트를 구독자들에게 전달하는 이벤트 버스입니다.
 * Main → Renderer 스트림 이벤트의 허브 역할을 합니다.
 *
 * 🔄 변경이력:
 * - 2025-12-16: 초기 생성 (Phase 2 Extension Host 패턴)
 * - 2026-01-18: 수정 - 이벤트 중복 필터링 추가
 *               (Main Process의 sendMessageToChannel이 모든 webContents + frames에
 *               브로드캐스트하여 3번 중복 발생 → 해시 기반 중복 제거)
 */

import { getInjectable } from "@ogre-tools/injectable";

import type { AgentStreamEvent } from "../common/agent-ipc-channels";

/**
 * 🎯 이벤트 해시 생성
 *
 * 이벤트의 고유성을 판단하기 위한 해시 문자열을 생성합니다.
 * 동일한 이벤트가 여러 번 전달되어도 해시가 같으면 중복으로 판단합니다.
 */
const generateEventHash = (event: AgentStreamEvent): string => {
  const baseHash = event.type;

  switch (event.type) {
    case "message-chunk":
      // message-chunk는 chunk 내용과 messageId로 구분
      return `${baseHash}:${event.messageId}:${event.chunk}`;
    case "message-complete":
      return `${baseHash}:${event.messageId}:${event.content?.slice(0, 50)}`;
    case "tool-execution":
      return `${baseHash}:${event.toolName}:${event.status}:${JSON.stringify(event.input ?? event.result)?.slice(0, 100)}`;
    case "interrupt":
      return `${baseHash}:${event.threadId}:${event.interruptType}`;
    case "complete":
      return `${baseHash}:${event.threadId}`;
    case "error":
      return `${baseHash}:${event.error}`;
    case "debate-start":
      return `${baseHash}:${event.threadId}:${event.roundNumber}`;
    case "debate-expert-response":
      return `${baseHash}:${event.threadId}:${event.expertId}:${event.status}`;
    case "debate-consensus":
      return `${baseHash}:${event.threadId}:${event.consensus?.slice(0, 50)}`;
    default:
      return `${baseHash}:${JSON.stringify(event).slice(0, 100)}`;
  }
};

/**
 * 🎯 Agent 스트림 이벤트 버스 클래스
 *
 * ⚠️ 중복 이벤트 필터링:
 * Main Process의 sendMessageToChannel은 모든 webContents와 등록된 frames에
 * 메시지를 브로드캐스트합니다. 이로 인해 동일한 이벤트가 여러 번 전달됩니다.
 * 해시 기반 중복 제거로 구독자에게는 한 번만 전달합니다.
 */
class AgentStreamEventBus {
  private listeners: Set<(event: AgentStreamEvent) => void> = new Set();

  /**
   * 🎯 최근 이벤트 해시 캐시 (중복 필터링용)
   *
   * TTL: 100ms (동일 이벤트가 여러 webContents에서 거의 동시에 도착)
   * 최대 크기: 1000개 (메모리 제한)
   */
  private recentEventHashes: Map<string, number> = new Map();
  private readonly DEDUP_TTL_MS = 100;
  private readonly MAX_CACHE_SIZE = 1000;

  /**
   * 🎯 이벤트 구독
   *
   * @param callback - 이벤트 핸들러
   * @returns unsubscribe 함수
   */
  subscribe(callback: (event: AgentStreamEvent) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * 🎯 중복 이벤트 확인
   *
   * @param hash - 이벤트 해시
   * @returns 중복 여부
   */
  private isDuplicate(hash: string): boolean {
    const now = Date.now();
    const lastSeen = this.recentEventHashes.get(hash);

    if (lastSeen && now - lastSeen < this.DEDUP_TTL_MS) {
      return true;
    }

    // 캐시 정리 (오래된 항목 제거)
    if (this.recentEventHashes.size >= this.MAX_CACHE_SIZE) {
      const cutoff = now - this.DEDUP_TTL_MS;
      for (const [key, time] of this.recentEventHashes) {
        if (time < cutoff) {
          this.recentEventHashes.delete(key);
        }
      }
    }

    this.recentEventHashes.set(hash, now);
    return false;
  }

  /**
   * 🎯 이벤트 발행
   *
   * @param event - 스트림 이벤트
   */
  emit(event: AgentStreamEvent): void {
    // 🎯 중복 이벤트 필터링
    const hash = generateEventHash(event);
    if (this.isDuplicate(hash)) {
      // 중복 이벤트는 무시
      return;
    }

    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("[AgentStreamEventBus] 리스너 에러:", error);
      }
    });
  }
}

/**
 * 🎯 Agent 스트림 이벤트 버스 Injectable
 */
const agentStreamEventBusInjectable = getInjectable({
  id: "ai-assistant-agent-stream-event-bus",
  instantiate: () => new AgentStreamEventBus(),
});

export default agentStreamEventBusInjectable;
