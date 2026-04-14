/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getOrInsertMap } from "@skuberplus/utilities";
import crypto from "crypto";
import { promisify } from "util";
import { ipcMainHandle } from "../../../../common/ipc";

import type { ClusterId } from "../../../../common/cluster-types";

const randomBytes = promisify(crypto.randomBytes);

export class ShellRequestAuthenticator {
  private tokens = new Map<ClusterId, Map<string, Uint8Array>>();

  init() {
    ipcMainHandle("cluster:shell-api", async (event, clusterId, tabId) => {
      const authToken = Uint8Array.from(await randomBytes(128));
      const forCluster = getOrInsertMap(this.tokens, clusterId);

      forCluster.set(tabId, authToken);

      return authToken;
    });

    /**
     * 🎯 목적: 여러 탭의 인증 토큰을 한 번에 병렬 생성
     *
     * @param clusterId - 클러스터 ID
     * @param tabIds - 탭 ID 배열
     * @returns Map<tabId, authToken>
     *
     * 📝 주의사항:
     * - Promise.all로 모든 crypto.randomBytes를 병렬 실행
     * - N개 탭 토큰 생성 시간 ≈ 1개 토큰 생성 시간 (~15ms)
     *
     * 🔄 변경이력:
     * - 2025-10-28: 배치 토큰 생성으로 IPC 순차 처리 병목 해결
     * - 2025-10-29: 디버그 로그 추가 (tokenHash 포함)
     */
    ipcMainHandle("cluster:shell-api-batch", async (event, clusterId, tabIds: string[]) => {
      const forCluster = getOrInsertMap(this.tokens, clusterId);

      // 모든 토큰을 병렬로 생성
      const tokenPromises = tabIds.map(async (tabId) => {
        const authToken = Uint8Array.from(await randomBytes(128));
        forCluster.set(tabId, authToken);

        return [tabId, Array.from(authToken)] as const;
      });

      // Promise.all로 병렬 실행
      const results = await Promise.all(tokenPromises);

      // Object 형태로 반환 (Map은 IPC로 직렬화 안 됨)
      return Object.fromEntries(results);
    });

    /**
     * 🎯 목적: Main Process의 토큰을 명시적으로 삭제
     *
     * @param clusterId - 클러스터 ID
     * @param tabId - 탭 ID
     * @returns 삭제 성공 여부
     *
     * 📝 주의사항:
     * - 재연결 전에 호출하여 토큰 충돌 방지
     * - 토큰이 없어도 false 반환하고 에러는 발생하지 않음
     *
     * 🔄 변경이력: 2025-10-29 - Token race condition 해결을 위한 명시적 삭제 IPC 추가
     */
    ipcMainHandle("cluster:shell-api-delete", async (event, clusterId, tabId) => {
      const forCluster = this.tokens.get(clusterId);

      if (forCluster) {
        const deleted = forCluster.delete(tabId);

        return deleted;
      }

      return false;
    });
  }

  /**
   * 🎯 목적: 토큰 인증 (peek only - 토큰 삭제하지 않음)
   *
   * @param clusterId - 클러스터 ID
   * @param tabId - 탭 ID
   * @param token - Base64 인코딩된 인증 토큰
   * @returns 인증 성공 여부
   *
   * 📝 주의사항:
   * - 이 메서드는 토큰을 검증만 하고 삭제하지 않음 (peek)
   * - 실제 토큰 소비는 WebSocket handshake 완료 후 consumeToken() 호출 필요
   *
   * 🔄 변경이력:
   * - Original: 인증 성공 시 즉시 토큰 삭제 (single-use)
   * - 2025-10-29: Token race condition 해결을 위해 peek 방식으로 변경
   */
  authenticate = (clusterId: ClusterId, tabId: string, token: string | undefined): boolean => {
    const clusterTokens = this.tokens.get(clusterId);

    if (!clusterTokens || !tabId || !token) {
      return false;
    }

    const authToken = clusterTokens.get(tabId);
    const buf = Uint8Array.from(Buffer.from(token, "base64"));

    if (authToken instanceof Uint8Array && authToken.length === buf.length && crypto.timingSafeEqual(authToken, buf)) {
      return true;
    }

    return false;
  };

  /**
   * 🎯 목적: WebSocket handshake 성공 후 토큰 소비 (삭제)
   *
   * @param clusterId - 클러스터 ID
   * @param tabId - 탭 ID
   * @returns 토큰 삭제 성공 여부
   *
   * 📝 주의사항:
   * - authenticate()로 인증 성공한 후에만 호출해야 함
   * - WebSocket handshake가 완료된 시점에 호출하여 토큰 재사용 방지
   *
   * 🔄 변경이력: 2025-10-29 - Token race condition 해결을 위한 명시적 consume 메서드 추가
   */
  consumeToken = (clusterId: ClusterId, tabId: string): boolean => {
    const clusterTokens = this.tokens.get(clusterId);

    if (clusterTokens) {
      const deleted = clusterTokens.delete(tabId);

      return deleted;
    }

    return false;
  };
}
