/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: PrometheusHandler 단위 테스트
 * 📝 Provider 아키텍처 제거 후 (2026-01-09) 현재 API에 맞게 재작성
 *
 * 현재 PrometheusHandler API:
 * - getPrometheusDetails(): Promise<{ prometheusPath: string }>
 * - setupPrometheus(preferences: unknown): void
 */

import directoryForTempInjectable from "../../common/app-paths/directory-for-temp/directory-for-temp.injectable";
import directoryForUserDataInjectable from "../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import { Cluster } from "../../common/cluster/cluster";
import writeJsonFileInjectable from "../../common/fs/write-json-file.injectable";
import prometheusHandlerInjectable from "../cluster/prometheus-handler/prometheus-handler.injectable";
import { getDiForUnitTesting } from "../getDiForUnitTesting";
import createKubeAuthProxyInjectable from "../kube-auth-proxy/create-kube-auth-proxy.injectable";
import lensProxyPortInjectable from "../lens-proxy/lens-proxy-port.injectable";

import type { DiContainer } from "@ogre-tools/injectable";

describe("PrometheusHandler", () => {
  let di: DiContainer;
  let cluster: Cluster;

  beforeEach(() => {
    di = getDiForUnitTesting();

    di.override(directoryForUserDataInjectable, () => "/some-directory-for-user-data");
    di.override(directoryForTempInjectable, () => "/some-directory-for-temp");
    di.override(writeJsonFileInjectable, () => () => Promise.resolve());
    di.override(createKubeAuthProxyInjectable, () => () => ({}) as any);
    di.inject(lensProxyPortInjectable).set(9191);

    cluster = new Cluster({
      id: "some-cluster-id",
      contextName: "some-context-name",
      kubeConfigPath: "/some-kube-config-path",
    });
  });

  describe("getPrometheusDetails", () => {
    it("should return prometheusPath", async () => {
      const handler = di.inject(prometheusHandlerInjectable, cluster);
      const details = await handler.getPrometheusDetails();

      expect(details).toHaveProperty("prometheusPath");
      expect(typeof details.prometheusPath).toBe("string");
    });
  });

  describe("setupPrometheus", () => {
    it("should not throw when called with preferences", () => {
      const handler = di.inject(prometheusHandlerInjectable, cluster);

      expect(() => handler.setupPrometheus({ some: "preference" })).not.toThrow();
    });
  });
});
