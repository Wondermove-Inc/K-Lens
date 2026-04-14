/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import URLParse from "url-parse";
import { Server as WebSocketServer } from "ws";
import getClusterByIdInjectable from "../../../features/cluster/storage/common/get-by-id.injectable";
import openShellSessionInjectable from "../../shell-session/create-shell-session.injectable";
import shellRequestAuthenticatorInjectable from "./shell-request-authenticator/shell-request-authenticator.injectable";

import type { LensProxyApiRequest } from "../lens-proxy";

const shellApiRequestInjectable = getInjectable({
  id: "shell-api-request",

  instantiate: (di): LensProxyApiRequest => {
    const openShellSession = di.inject(openShellSessionInjectable);
    const authenticator = di.inject(shellRequestAuthenticatorInjectable);
    const getClusterById = di.inject(getClusterByIdInjectable);
    const logger = di.inject(loggerInjectionToken);

    return ({ req, socket, head }) => {
      // 🎯 [TIMING] WebSocket upgrade 요청 시작
      const upgradeStartTime = Date.now();
      logger.info(`[TIMING-MAIN] WebSocket upgrade 요청 수신`);

      // 🎯 Query parameter에서 clusterId를 직접 추출하여 cluster 객체 가져오기
      // getClusterForRequest를 사용하지 않아 URL path 변경 없음 (Shell API는 /api 경로 유지)
      const {
        query: { node: nodeName, shellToken, id: tabId, clusterId },
      } = new URLParse(req.url, true);

      // 🔍 Phase 2: 디버그 로깅 - Request 정보
      logger.info(`[SHELL-API-REQUEST] WebSocket upgrade 요청 수신:`, {
        url: req.url,
        tabId: tabId || "MISSING",
        clusterId: clusterId || "MISSING",
        hasShellToken: !!shellToken,
        nodeName: nodeName || "local",
      });

      const cluster = clusterId ? getClusterById(clusterId) : undefined;

      // 🔍 Phase 2: 디버그 로깅 - Cluster 조회 결과
      logger.info(`[SHELL-API-REQUEST] Cluster 조회 결과:`, {
        clusterId,
        clusterFound: !!cluster,
        clusterName: cluster?.name || "N/A",
      });

      // 🔍 Phase 2: 디버그 로깅 - 인증 전 상태 체크
      if (!tabId) {
        logger.warn(`[SHELL-API-REQUEST] 인증 실패 - tabId 누락`);
      }
      if (!cluster) {
        logger.warn(`[SHELL-API-REQUEST] 인증 실패 - Cluster를 찾을 수 없음 (clusterId: ${clusterId})`);
      }
      if (cluster && tabId && !authenticator.authenticate(cluster.id, tabId, shellToken)) {
        logger.warn(`[SHELL-API-REQUEST] 인증 실패 - shellToken 불일치 (clusterId: ${cluster.id}, tabId: ${tabId})`);
      }

      if (!tabId || !cluster || !authenticator.authenticate(cluster.id, tabId, shellToken)) {
        // 🎯 HTTP/1.1 응답 형식으로 변경 (ERR_INVALID_HTTP_RESPONSE 방지)
        logger.error(`[SHELL-API-REQUEST] WebSocket upgrade 거부 - HTTP 401 응답 전송`);
        socket.write("HTTP/1.1 401 Unauthorized\r\n");
        socket.write("Content-Type: text/plain\r\n");
        socket.write("Content-Length: 22\r\n");
        socket.write("Connection: close\r\n");
        socket.write("\r\n");
        socket.write("Invalid shell request");
        socket.end();
      } else {
        // 🔍 Phase 2: 디버그 로깅 - WebSocket upgrade 시작
        logger.info(`[SHELL-API-REQUEST] WebSocket upgrade 시작:`, {
          clusterId: cluster.id,
          clusterName: cluster.name,
          tabId,
          nodeName: nodeName || "local",
        });

        const ws = new WebSocketServer({ noServer: true });

        // 🎯 [TIMING] WebSocket handshake 시작
        const handshakeStartTime = Date.now();
        logger.info(`[TIMING-MAIN] WebSocket handshake 시작: ${handshakeStartTime - upgradeStartTime}ms`);

        ws.handleUpgrade(req, socket, head, (websocket) => {
          // 🎯 [TIMING] Handshake 완료, Shell 세션 생성 시작
          const handshakeElapsed = Date.now() - handshakeStartTime;
          logger.info(`[TIMING-MAIN] WebSocket handshake 완료: ${handshakeElapsed}ms`);
          logger.info(`[TIMING-MAIN] Shell 세션 생성 시작`);

          // 🔄 원본 코드 복원: websocket.once("open", ...) 패턴
          // 서버 측 WebSocket에서 "open" 이벤트는 발생하지 않지만,
          // 이는 의도된 설계로 토큰이 삭제되지 않아 재연결 시 재사용 가능
          websocket.once("open", () => {
            authenticator.consumeToken(cluster.id, tabId);
            logger.info(`[SHELL-AUTH] WebSocket OPEN 완료, 토큰 소비됨:`, {
              clusterId: cluster.id,
              tabId,
            });
          });

          const sessionStartTime = Date.now();
          openShellSession({ websocket, cluster, tabId, nodeName })
            .then(() => {
              // 🎯 [TIMING] Shell 세션 생성 완료
              const sessionElapsed = Date.now() - sessionStartTime;
              const totalElapsed = Date.now() - upgradeStartTime;
              logger.info(`[TIMING-MAIN] Shell 세션 생성 완료: ${sessionElapsed}ms`);
              logger.info(`[TIMING-MAIN] 전체 WebSocket 연결 완료: ${totalElapsed}ms`);
            })
            .catch((error) =>
              logger.error(`[SHELL-SESSION]: failed to open a ${nodeName ? "node" : "local"} shell`, error),
            );
        });
      }
    };
  },
});

export default shellApiRequestInjectable;
