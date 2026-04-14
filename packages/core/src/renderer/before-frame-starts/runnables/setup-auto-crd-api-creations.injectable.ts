/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { KubeApi } from "@skuberplus/kube-api";
import { maybeKubeApiInjectable } from "@skuberplus/kube-api-specifics";
import { KubeObject } from "@skuberplus/kube-object";
import { logErrorInjectionToken, logInfoInjectionToken, logWarningInjectionToken } from "@skuberplus/logger";
import { reaction } from "mobx";
import { customResourceDefinitionApiInjectionToken } from "../../../common/k8s-api/api-manager/crd-api-token";
import { injectableDifferencingRegistratorWith } from "../../../common/utils/registrator-helper";
import customResourceDefinitionStoreInjectable from "../../components/custom-resource-definitions/store.injectable";
import { beforeClusterFrameStartsSecondInjectionToken } from "../tokens";

import type { CustomResourceDefinition } from "@skuberplus/kube-object";

const setupAutoCrdApiCreationsInjectable = getInjectable({
  id: "setup-auto-crd-api-creations",
  instantiate: (di) => ({
    run: () => {
      // 🔇 개발 로그 제거: CRD 자동 설정 로그
      // console.info("[setup-auto-crd] run 호출");

      const customResourceDefinitionStore = di.inject(customResourceDefinitionStoreInjectable);
      const injectableDifferencingRegistrator = injectableDifferencingRegistratorWith(di);

      // 🔇 개발 로그 제거
      // console.info("[setup-auto-crd] store 초기화 완료", { ... });

      reaction(
        () => customResourceDefinitionStore.getItems().map(toCrdApiInjectable),
        injectableDifferencingRegistrator,
        {
          fireImmediately: true,
          onError: (error) => {
            // 에러 발생해도 reaction 계속 동작 (MobX 공식 권장 방식)
            console.warn("[setup-auto-crd-api-creations] Reaction error:", error);
          },
        },
      );
    },
  }),
  injectionToken: beforeClusterFrameStartsSecondInjectionToken,
});

export default setupAutoCrdApiCreationsInjectable;

const toCrdApiInjectable = (crd: CustomResourceDefinition) =>
  getInjectable({
    id: `default-kube-api-for-custom-resource-definition-${crd.getResourceApiBase()}`,
    instantiate: (di) => {
      const objectConstructor = class extends KubeObject {
        static readonly kind = crd.getResourceKind();
        static readonly namespaced = crd.isNamespaced();
        static readonly apiBase = crd.getResourceApiBase();
      };

      return new KubeApi(
        {
          logError: di.inject(logErrorInjectionToken),
          logInfo: di.inject(logInfoInjectionToken),
          logWarn: di.inject(logWarningInjectionToken),
          maybeKubeApi: di.inject(maybeKubeApiInjectable),
        },
        { objectConstructor },
      );
    },
    injectionToken: customResourceDefinitionApiInjectionToken,
  });
