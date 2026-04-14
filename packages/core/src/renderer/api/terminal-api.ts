/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { ipcRenderer } from "electron";
import { once } from "lodash";
import isEqual from "lodash/isEqual";
import { makeObservable, observable } from "mobx";
import url from "url";
import { TerminalChannels, type TerminalMessage } from "../../common/terminal/channels";
import { WebSocketApi } from "./websocket-api";

import type { Logger } from "@skuberplus/logger";

import type { WebSocketApiDependencies, WebSocketEvents } from "./websocket-api";

enum TerminalColor {
  RED = "\u001b[31m",
  GREEN = "\u001b[32m",
  YELLOW = "\u001b[33m",
  BLUE = "\u001b[34m",
  MAGENTA = "\u001b[35m",
  CYAN = "\u001b[36m",
  GRAY = "\u001b[90m",
  LIGHT_GRAY = "\u001b[37m",
  NO_COLOR = "\u001b[0m",
}

export interface TerminalApiQuery extends Record<string, string | undefined> {
  id: string;
  node?: string;
  type?: string;
}

export interface TerminalEvents extends WebSocketEvents {
  ready: () => void;
  connected: () => void;
  "token-received": (tabId: string, token: Uint8Array) => void;
}

export interface TerminalApiDependencies extends WebSocketApiDependencies {
  readonly clusterId: string;
  readonly logger: Logger;
}

export class TerminalApi extends WebSocketApi<TerminalEvents> {
  protected size?: { width: number; height: number };

  @observable public isReady = false;
  private reconnecting = false; // 🎯 수동 재연결 진행 중 플래그
  private reconnectAttempts = 0; // 🎯 재연결 시도 횟수
  private readonly maxReconnectAttempts = 3; // 🎯 최대 재시도 횟수

  constructor(
    protected readonly dependencies: TerminalApiDependencies,
    protected readonly query: TerminalApiQuery,
  ) {
    super(dependencies, {
      flushOnOpen: false,
      pingInterval: 30,
      reconnectDelay: 0, // 🎯 자동 재연결 비활성화 (수동 재연결 로직 사용)
    });
    makeObservable(this);

    if (query.node) {
      query.type ||= "node";
    }
  }

  /**
   * 🎯 목적: Terminal WebSocket 연결 시작 (인증 토큰 기반)
   *
   * @param authToken - 선택적 인증 토큰 (외부에서 미리 생성된 경우)
   *
   * 📝 주의사항:
   * - authToken이 제공되면 IPC 요청 스킵 (배치 생성된 토큰 사용)
   * - authToken이 없으면 개별 IPC 요청으로 fallback
   * - IPC 직렬화로 인해 Uint8Array는 number[] 배열로 변환됨 (자동 처리)
   * - 부모 클래스 connect(url: string)를 오버라이드하지 않음 (타입 충돌 방지)
   *
   * 🔄 변경이력:
   * - 2025-10-29 - IPC 직렬화 타입 불일치 수정 (number[] → Uint8Array 자동 변환)
   * - 2025-10-28 - authToken parameter 추가하여 순환 의존성 해결
   * - 2025-10-28 - connect → connectWithAuth 이름 변경하여 TypeScript 오버라이드 충돌 해결
   */
  async connectWithAuth(authToken?: Uint8Array | number[]) {
    // 🎯 다중 레벨 방어: API 레벨에서도 중복 체크 (Issue #40 수정)
    if (this.isActiveSocket()) {
      return;
    }

    if (!this.socket) {
      /**
       * Only emit this message if we are not "reconnecting", so as to keep the
       * output display clean when the computer wakes from sleep
       */
      this.emitStatus("Connecting ...");
    }

    // 🎯 외부에서 제공된 토큰 우선 사용, 없으면 개별 IPC fallback
    let authTokenArray = authToken;

    if (!authTokenArray) {
      const receivedToken = await ipcRenderer.invoke("cluster:shell-api", this.dependencies.clusterId, this.query.id);
      authTokenArray = receivedToken;

      // 🎯 새 토큰 수신 이벤트 발행 (TerminalStore 캐시 업데이트용)
      const tokenForEvent =
        authTokenArray instanceof Uint8Array
          ? authTokenArray
          : authTokenArray
            ? Uint8Array.from(authTokenArray)
            : new Uint8Array(); // fallback for undefined
      this.emit("token-received", this.query.id, tokenForEvent);
    }

    // 🎯 IPC 직렬화로 인한 number[] 배열 처리
    // Electron IPC는 Uint8Array를 number[] 배열로 변환하므로 자동 변환 필요
    if (Array.isArray(authTokenArray)) {
      authTokenArray = Uint8Array.from(authTokenArray);
    }

    if (!(authTokenArray instanceof Uint8Array)) {
      throw new TypeError("ShellApi token is not a Uint8Array or number[]");
    }

    // 🎯 clusterId를 query parameter에 포함하여 Backend가 cluster를 식별할 수 있도록 함
    // URL 형식: ws://hostname:PORT/api?id=...&clusterId=...&shellToken=...
    const { hostname, protocol, port } = location;
    const socketUrl = url.format({
      protocol: protocol.includes("https") ? "wss" : "ws",
      hostname, // 🔧 원래 hostname 사용 (location.hostname)
      port,
      pathname: "/api", // 🎨 Shell API 경로 유지
      query: {
        ...this.query,
        clusterId: this.dependencies.clusterId, // 🎯 clusterId를 query parameter로 전달
        shellToken: Buffer.from(authTokenArray).toString("base64"),
      },
      slashes: true,
    });

    const onReady = once((data?: string) => {
      // 🎯 실제 연결 성공 시에만 재시도 카운터 리셋 (Issue #40 수정)
      this.reconnectAttempts = 0;
      this.isReady = true;
      this.emit("ready");
      this.removeListener("data", onReady);
      this.removeListener("connected", onReady);
      this.flush();

      // data is undefined if the event that was handled is "connected"
      if (data === undefined) {
        const lastData = window.localStorage.getItem(`${this.query.id}:last-data`);

        if (lastData) {
          /**
           * Output the last line, the makes sure that the terminal isn't completely
           * empty when the user refreshes.
           */
          this.emit("data", lastData);
        }
      }
    });

    this.prependListener("data", onReady);
    this.prependListener("connected", onReady);

    super.connect(socketUrl);
  }

  sendMessage(message: TerminalMessage) {
    return this.send(JSON.stringify(message));
  }

  sendTerminalSize(cols: number, rows: number) {
    const newSize = { width: cols, height: rows };

    if (!isEqual(this.size, newSize)) {
      this.sendMessage({
        type: TerminalChannels.RESIZE,
        data: newSize,
      });
      this.size = newSize;
    }
  }

  protected _onMessage({ data, ...evt }: MessageEvent<string>): void {
    try {
      const message = JSON.parse(data) as TerminalMessage;

      switch (message.type) {
        case TerminalChannels.STDOUT:
          /**
           * save the last data for reconnections. User localStorage because we
           * don't want this data to survive if the app is closed
           */
          window.localStorage.setItem(`${this.query.id}:last-data`, message.data);
          super._onMessage({ data: message.data, ...evt });
          break;
        case TerminalChannels.CONNECTED:
          this.emit("connected");
          break;
        default:
          this.dependencies.logger.warn(`[TERMINAL-API]: unknown or unhandleable message type`, message);
          break;
      }
    } catch (error) {
      this.dependencies.logger.error(`[TERMINAL-API]: failed to handle message`, error);
    }
  }

  protected _onOpen(evt: Event) {
    // Client should send terminal size in special channel 4,
    // But this size will be changed by terminal.fit()
    this.sendTerminalSize(120, 80);
    super._onOpen(evt);
  }

  /**
   * 🎯 목적: WebSocket 연결 종료 처리 및 수동 재연결
   *
   * 📝 주의사항:
   * - 자동 재연결(reconnectDelay: 0)은 비활성화됨
   * - 에러로 인한 종료 시 10초 후 새 토큰으로 재연결 시도
   * - reconnecting 플래그로 중복 재연결 방지
   * - 🛡️ 최대 3회 재시도 후 포기 (무한 루프 방지, Issue #40 수정)
   *
   * 🔄 변경이력:
   * - 2025-10-29 - One-Time Token과 호환되도록 수동 재연결 로직 추가
   * - 2026-01-09 - 최대 재시도 횟수 제한 추가 (Issue #40 수정)
   */
  protected _onClose(evt: CloseEvent) {
    super._onClose(evt);
    this.isReady = false;

    // 🎯 에러로 인한 종료이면 새 토큰으로 재연결 시도
    const error = evt.code !== 1000 || !evt.wasClean;
    if (error && !this.reconnecting) {
      // 🎯 최대 재시도 횟수 체크 (Issue #40: 무한 루프 방지)
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error("[TERMINAL-API] 재연결 3회 실패, 포기:", {
          tabId: this.query.id,
          attempts: this.reconnectAttempts,
        });
        return;
      }

      this.reconnectAttempts++;
      this.reconnecting = true;

      setTimeout(async () => {
        try {
          // 🎯 새 토큰 생성 후 재연결 (authToken 없이 호출 → IPC 요청)
          // 리셋은 onReady에서 수행 (여기서 하지 않음)
          await this.connectWithAuth();
        } catch (error) {
          console.error("[TERMINAL-API] 재연결 실패:", {
            tabId: this.query.id,
            error,
          });
        } finally {
          this.reconnecting = false;
        }
      }, 10000); // 10초 후 재시도
    }
  }

  protected emitStatus(data: string, options: { color?: TerminalColor; showTime?: boolean } = {}) {
    const { color, showTime } = options;
    const time = showTime ? `${new Date().toLocaleString()} ` : "";

    if (color) {
      data = `${color}${data}${TerminalColor.NO_COLOR}`;
    }

    this.emit("data", `${time}${data}\r\n`);
  }

  protected emitError(error: string) {
    this.emitStatus(error, {
      color: TerminalColor.RED,
    });
  }
}
