/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Pod } from "@skuberplus/kube-object";
import autoBind from "auto-bind";
import compact from "lodash/compact";
import groupBy from "lodash/groupBy";
import { KubeObjectStore } from "../../../common/k8s-api/kube-object.store";

import type { KubeEventApi } from "@skuberplus/kube-api";
import type { KubeEvent, KubeObject } from "@skuberplus/kube-object";

import type { KubeObjectStoreDependencies, KubeObjectStoreOptions } from "../../../common/k8s-api/kube-object.store";
import type { GetPodById } from "../workloads-pods/get-pod-by-id.injectable";

export interface EventStoreDependencies extends KubeObjectStoreDependencies {
  getPodById: GetPodById;
}

export class EventStore extends KubeObjectStore<KubeEvent, KubeEventApi> {
  public declare readonly limit: number;

  constructor(
    protected readonly dependencies: EventStoreDependencies,
    api: KubeEventApi,
    opts: KubeObjectStoreOptions = {},
  ) {
    super(dependencies, api, { limit: 1000, ...opts });
    autoBind(this);
  }

  protected bindWatchEventsUpdater() {
    return super.bindWatchEventsUpdater(5000);
  }

  protected sortItems(items: KubeEvent[]) {
    return super.sortItems(
      items,
      [
        (event) => -event.getCreationTimestamp(), // keep events order as timeline ("fresh" on top)
      ],
      "asc",
    );
  }

  /**
   * 🎯 목적: 특정 Kubernetes 리소스에 관련된 이벤트를 필터링하여 반환 (메모리 필터링)
   *
   * @param obj - 이벤트를 조회할 Kubernetes 리소스 객체
   * @returns 해당 리소스와 관련된 KubeEvent 배열
   *
   * 📝 주의사항:
   * - UID 기반 매칭을 우선 시도 (가장 정확)
   * - UID가 없는 경우 Name + Namespace + Kind 조합으로 폴백
   * - Watch 이벤트 기반으로 캐시된 이벤트에서 필터링 (bufferSize: 50000)
   * - 정확한 이벤트 조회가 필요하면 loadEventsForObject() 사용 권장
   *
   * 🔄 변경이력:
   * - 2026-01-15: 필터링 로직 개선 - UID 및 Name/Namespace/Kind 폴백 추가
   * - 2026-01-19: JSDoc 보완 - loadEventsForObject() 메서드 안내 추가
   */
  getEventsByObject(obj: KubeObject): KubeEvent[] {
    return this.items.filter((evt) => {
      const { involvedObject } = evt;

      // UID 기반 매칭 (가장 정확한 비교)
      if (involvedObject.uid && obj.metadata.uid === involvedObject.uid) {
        return true;
      }

      // Name + Namespace + Kind 폴백 (UID가 없거나 매칭 실패 시)
      return (
        involvedObject.name === obj.getName() &&
        involvedObject.namespace === obj.getNs() &&
        involvedObject.kind === obj.kind
      );
    });
  }

  /**
   * 🎯 목적: 특정 Kubernetes 리소스의 이벤트를 API에서 직접 조회 (서버 사이드 필터링)
   *
   * @param obj - 이벤트를 조회할 Kubernetes 리소스 객체
   * @returns 해당 리소스와 관련된 KubeEvent 배열 (Promise)
   *
   * 📝 주의사항:
   * - kubectl describe와 동일한 fieldSelector 사용
   * - 1000개 제한 없이 해당 리소스의 모든 이벤트 조회
   * - 디테일 패널처럼 정확한 이벤트가 필요한 경우 사용
   * - 클러스터 오버뷰 등 전체 이벤트 필요 시 getEventsByObject() 사용
   *
   * 🔄 변경이력:
   * - 2026-01-19: 신규 추가 - 디테일 패널 이벤트 표시 정확도 개선
   */
  async loadEventsForObject(obj: KubeObject): Promise<KubeEvent[]> {
    const fieldSelector: string[] = [`involvedObject.name=${obj.getName()}`, `involvedObject.kind=${obj.kind}`];

    // 네임스페이스가 있는 경우에만 추가
    const namespace = obj.getNs();

    if (namespace) {
      fieldSelector.push(`involvedObject.namespace=${namespace}`);
    }

    try {
      const events = await this.api.list({ namespace: namespace || "" }, { fieldSelector });

      return this.sortItems(events ?? []);
    } catch (error) {
      // API 호출 실패 시 메모리 필터링으로 폴백
      return this.getEventsByObject(obj);
    }
  }

  getWarnings() {
    const warnings = this.items.filter((event) => event.type == "Warning");
    const groupsByInvolvedObject = groupBy(warnings, (warning) => warning.involvedObject.uid);
    const eventsWithError = Object.values(groupsByInvolvedObject).map((events) => {
      const recent = events[0];
      const { kind, uid } = recent.involvedObject;

      if (kind == Pod.kind) {
        // Wipe out running pods
        const pod = this.dependencies.getPodById(uid);

        if (!pod || (!pod.hasIssues() && (pod.spec?.priority ?? 0) < 500000)) {
          return undefined;
        }
      }

      return recent;
    });

    return compact(eventsWithError);
  }

  getWarningsCount() {
    return this.getWarnings().length;
  }
}
