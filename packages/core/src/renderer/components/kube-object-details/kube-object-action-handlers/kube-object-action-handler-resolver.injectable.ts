/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: KubeObject의 kind에 맞는 액션 핸들러를 찾아서 반환하는 리졸버
 *
 * 📝 주의사항:
 *   - kind가 일치하는 핸들러 우선 사용
 *   - 일치하는 핸들러가 없으면 기본 핸들러("*") 사용
 *   - 핸들러들을 병합하여 반환 (kind 핸들러 + 기본 핸들러)
 *
 * 🔄 변경이력:
 *   - 2026-01-06: 초기 생성 (클러스터 오버뷰 Warning 패널 개선)
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { computedInjectManyInjectable } from "@ogre-tools/injectable-extension-for-mobx";
import {
  type KubeObjectActionHandlers,
  kubeObjectActionHandlerInjectionToken,
} from "./kube-object-action-handler-injection-token";

import type { KubeObject } from "@skuberplus/kube-object";

export interface KubeObjectActionHandlerResolver {
  /**
   * 주어진 KubeObject에 대한 액션 핸들러들을 반환
   *
   * @param object - Kubernetes 리소스 객체
   * @param onClose - 패널 닫기 콜백
   * @returns 액션 핸들러 객체 (kind 핸들러 + 기본 핸들러 병합)
   */
  resolve: (object: KubeObject | undefined, onClose?: () => void) => KubeObjectActionHandlers;
}

/**
 * 🎯 KubeObject 액션 핸들러 리졸버
 * - kind에 맞는 핸들러 찾기
 * - 기본 핸들러("*")와 병합
 */
const kubeObjectActionHandlerResolverInjectable = getInjectable({
  id: "kube-object-action-handler-resolver",

  instantiate: (di): KubeObjectActionHandlerResolver => {
    const computedInjectMany = di.inject(computedInjectManyInjectable);

    // 모든 등록된 액션 핸들러 수집
    const handlers = computedInjectMany(kubeObjectActionHandlerInjectionToken);

    return {
      resolve: (object: KubeObject | undefined, onClose?: () => void): KubeObjectActionHandlers => {
        if (!object) {
          return {};
        }

        const kind = object.kind;
        const apiVersion = object.apiVersion;
        const allHandlers = handlers.get();

        // 기본 핸들러 찾기 (kind === "*")
        const defaultHandler = allHandlers.find((h) => h.kind === "*");

        // kind가 일치하는 핸들러 찾기
        const kindHandler = allHandlers.find((h) => {
          if (h.kind !== kind) return false;
          // apiVersions가 빈 배열이면 모든 버전 지원
          if (h.apiVersions.length === 0) return true;

          return h.apiVersions.includes(apiVersion);
        });

        // 핸들러들 병합 (기본 핸들러 + kind 핸들러)
        // kind 핸들러가 있으면 우선 사용
        const defaultHandlers = defaultHandler ? defaultHandler.getHandlers(object, onClose) : {};
        const kindHandlers = kindHandler ? kindHandler.getHandlers(object, onClose) : {};

        // kind 핸들러가 기본 핸들러를 오버라이드
        return {
          ...defaultHandlers,
          ...kindHandlers,
        };
      },
    };
  },

  lifecycle: lifecycleEnum.singleton,
});

export default kubeObjectActionHandlerResolverInjectable;
