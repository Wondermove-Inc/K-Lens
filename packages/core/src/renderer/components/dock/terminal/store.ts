/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { action, observable } from "mobx";
import { WebSocketApiState } from "../../../api/websocket-api";

import type { CreateTerminalApi } from "../../../api/create-terminal-api.injectable";
import type { TerminalApi } from "../../../api/terminal-api";
import type { DockTab, TabId } from "../dock/store";
import type { CreateTerminal } from "./create-terminal.injectable";
import type { Terminal } from "./terminal";

export interface ITerminalTab extends DockTab {
  node?: string; // activate node shell mode
}

interface Dependencies {
  createTerminal: CreateTerminal;
  createTerminalApi: CreateTerminalApi;
}

export class TerminalStore {
  protected terminals = observable.map<TabId, Terminal>();
  protected connections = observable.map<TabId, TerminalApi>();
  protected tokenCache = observable.map<TabId, Uint8Array>();

  constructor(private dependencies: Dependencies) {}

  /**
   * 🎯 목적: Terminal과 API 생성 (연결은 하지 않음)
   *
   * 📝 주의사항:
   * - api.connect()를 호출하지 않음 ("connecting" 메시지 출력하지 않음)
   * - 크기 조정 후 connectTerminal()을 호출해야 함
   *
   * 🔄 변경이력: 2025-10-28 - 마운트 순서 문제 해결을 위해 connect()에서 분리
   */
  @action
  createTerminal(tab: ITerminalTab) {
    if (this.isConnected(tab.id)) {
      return;
    }

    const api = this.dependencies.createTerminalApi(
      {
        id: tab.id,
        node: tab.node,
      },
      tab.clusterId ? { clusterId: tab.clusterId } : undefined,
    );
    const terminal = this.dependencies.createTerminal(tab.id, api);

    this.connections.set(tab.id, api);
    this.terminals.set(tab.id, terminal);

    // api.connect() 호출하지 않음!
  }

  /**
   * 🎯 목적: Terminal 연결 (\"connecting\" 메시지 출력)
   *
   * 📝 주의사항:
   * - createTerminal() 이후에 호출해야 함
   * - 크기 조정이 완료된 후 호출해야 \"%\" 기호 방지
   * - 캐시된 토큰이 있으면 api.connectWithAuth()에 전달하여 IPC 요청 스킵
   * - 🛡️ 중복 호출 가드: isReady 또는 isActiveSocket()이면 무시
   *
   * 🔄 변경이력:
   * - 2025-10-28 - 캐시된 토큰을 api.connectWithAuth()에 전달하여 순환 의존성 해결
   * - 2026-01-09 - 중복 호출 가드 강화 (Issue #40 수정)
   */
  @action
  connectTerminal(tabId: TabId) {
    const api = this.connections.get(tabId);

    if (!api) {
      console.warn("[TERMINAL-STORE-CONNECT] API를 찾을 수 없음:", { tabId });
      return;
    }

    // 🎯 가드를 맨 앞에 배치 (리스너 등록 전에!)
    // 이미 연결됨/연결중이면 무시하여 WebSocket 충돌 방지
    if (api.isReady || api.isActiveSocket()) {
      return;
    }

    // 🎯 가드 통과 후에 리스너 등록 (메모리 누수 방지)
    api.once("token-received", (receivedTabId: string, token: Uint8Array) => {
      this.setTokenCache(receivedTabId, token);
    });

    // 🎯 캐시된 토큰 가져오기
    const cachedToken = this.tokenCache.get(tabId);

    const terminal = this.terminals.get(tabId);
    if (terminal) {
      terminal.ensureSizeFallback();
    }

    // 🎯 캐시된 토큰을 api.connectWithAuth()에 전달 (없으면 undefined → IPC fallback)
    api.connectWithAuth(cachedToken);
  }

  /**
   * 🎯 목적: Terminal 생성 및 연결 (호환성용)
   *
   * 📝 주의사항:
   * - 기존 코드 호환성을 위해 유지
   * - 내부적으로 createTerminal() + connectTerminal() 호출
   *
   * 🔄 변경이력: 2025-10-28 - createTerminal/connectTerminal로 리팩토링
   */
  @action
  connect(tab: ITerminalTab) {
    this.createTerminal(tab);
    this.connectTerminal(tab.id);
  }

  /**
   * 🎯 목적: 배치 생성된 토큰을 캐시에 저장
   *
   * 📝 주의사항:
   * - Dock.componentDidMount에서 배치 토큰 생성 후 호출
   * - TerminalApi.connect에서 캐시 확인 후 사용
   *
   * 🔄 변경이력: 2025-10-28 - 배치 토큰 생성으로 IPC 병목 해결
   */
  @action
  setTokenCache(tabId: TabId, token: Uint8Array) {
    this.tokenCache.set(tabId, token);
  }

  /**
   * 🎯 목적: 캐시된 토큰 가져오기
   *
   * @returns Uint8Array | undefined - 캐시된 토큰 (없으면 undefined)
   *
   * 📝 주의사항:
   * - undefined 반환 시 TerminalApi가 개별 IPC 요청으로 fallback
   *
   * 🔄 변경이력: 2025-10-28 - 배치 토큰 생성으로 IPC 병목 해결
   */
  getTokenCache(tabId: TabId): Uint8Array | undefined {
    return this.tokenCache.get(tabId);
  }

  /**
   * 🎯 목적: 캐시된 토큰 삭제 (재연결 전 명시적 삭제용)
   *
   * @param tabId - 삭제할 탭 ID
   * @returns boolean - 삭제 성공 여부 (토큰이 있었으면 true, 없었으면 false)
   *
   * 📝 주의사항:
   * - 재연결 전 Main Process 토큰과 함께 삭제하여 토큰 race condition 방지
   * - 토큰이 없어도 에러 발생하지 않음 (false 반환)
   *
   * 🔄 변경이력: 2025-10-29 - Token race condition 해결을 위한 명시적 삭제 메서드 추가
   */
  @action
  deleteTokenCache(tabId: TabId): boolean {
    return this.tokenCache.delete(tabId);
  }

  @action
  destroy(tabId: TabId) {
    const terminal = this.terminals.get(tabId);
    const terminalApi = this.connections.get(tabId);

    terminal?.destroy();
    terminalApi?.destroy();
    this.connections.delete(tabId);
    this.terminals.delete(tabId);
    this.tokenCache.delete(tabId); // 🎯 토큰 캐시 정리
  }

  /**
   * @deprecated use `this.destroy()` instead
   */
  disconnect(tabId: TabId) {
    this.destroy(tabId);
  }

  /**
   * 🎯 목적: Terminal 재연결 (기존 연결 정리 후 캐시된 토큰으로 재연결)
   *
   * 📝 주의사항:
   * - 기존 WebSocket 연결 destroy (async 처리)
   * - 토큰 캐시 유지 (배치 생성된 토큰 재사용)
   * - 캐시된 토큰으로 재연결 (IPC 요청 없음)
   *
   * 🔄 변경이력:
   * - 2025-10-29 - 캐시 정리 로직 추가로 토큰 불일치 방지
   * - 2025-10-29 - async destroy 처리 추가, 토큰 캐시 유지로 변경
   */
  async reconnect(tabId: TabId) {
    const api = this.connections.get(tabId);
    if (!api) return;

    // 🛡️ Await async destroy to avoid race conditions
    if (typeof api.destroy === "function") {
      await Promise.resolve(api.destroy());
    }

    // 🎯 Keep token cache (don't delete!)
    // this.deleteTokenCache(tabId); ← DO NOT call - reuse batch-generated token

    // 🎯 Reconnect with cached token
    const cachedToken = this.tokenCache.get(tabId);
    await api.connectWithAuth(cachedToken);
  }

  isConnected(tabId: TabId) {
    return Boolean(this.connections.get(tabId));
  }

  isDisconnected(tabId: TabId) {
    return this.connections.get(tabId)?.readyState === WebSocketApiState.CLOSED;
  }

  getTerminal(tabId: TabId) {
    return this.terminals.get(tabId);
  }

  getTerminalApi(tabId: TabId) {
    return this.connections.get(tabId);
  }

  reset() {
    this.connections.forEach((_, tabId) => {
      this.destroy(tabId);
    });
  }
}
