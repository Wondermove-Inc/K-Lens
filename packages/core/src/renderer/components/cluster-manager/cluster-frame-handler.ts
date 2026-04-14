/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { onceDefined } from "@skuberplus/utilities";
import assert from "assert";
import { action, makeObservable, observable, when } from "mobx";
import { getClusterFrameUrl } from "../../../common/utils";

import type { Logger } from "@skuberplus/logger";
import type { Disposer } from "@skuberplus/utilities";

import type { ClusterId } from "../../../common/cluster-types";
import type { GetClusterById } from "../../../features/cluster/storage/common/get-by-id.injectable";

export interface LensView {
  isLoaded: boolean;
  frame: HTMLIFrameElement;
}

interface Dependencies {
  readonly logger: Logger;
  getClusterById: GetClusterById;
  emitClusterVisibility: (clusterId: ClusterId | null) => void;
}

export class ClusterFrameHandler {
  private readonly views = observable.map<string, LensView>();
  private visibleClusterId: ClusterId | null = null;

  constructor(protected readonly dependencies: Dependencies) {
    makeObservable(this);
  }

  public hasLoadedView(clusterId: string): boolean {
    return Boolean(this.views.get(clusterId)?.isLoaded);
  }

  public hasAnyView(): boolean {
    return this.views.size > 0;
  }

  public hasAnyLoadedView(): boolean {
    for (const view of this.views.values()) {
      if (view.isLoaded) {
        return true;
      }
    }

    return false;
  }

  public hasVisibleView(): boolean {
    // 🎯 목적: 실제로 화면에 노출된 iframe이 있는지 확인 (로드만 된 숨김 iframe 제외)
    return Boolean(this.visibleClusterId && this.views.get(this.visibleClusterId));
  }

  @action
  public initView(clusterId: ClusterId) {
    const cluster = this.dependencies.getClusterById(clusterId);

    if (!cluster) {
      this.dependencies.logger.warn(`[LENS-VIEW]: not initializing view; unknown clusterId="${clusterId}"`);

      return;
    }

    const parentElem = document.getElementById("lens-views");

    assert(parentElem, "DOM with #lens-views must be present");

    if (this.views.has(clusterId)) {
      return;
    }

    this.dependencies.logger.info(`[LENS-VIEW]: init dashboard, clusterId=${clusterId}`);
    const iframe = document.createElement("iframe");

    iframe.id = `cluster-frame-${cluster.id}`;
    iframe.name = cluster.contextName.get();
    iframe.setAttribute("src", getClusterFrameUrl(clusterId));
    iframe.setAttribute("allow", "clipboard-read; clipboard-write");
    // ⚠️ 중요: 신규 프레임은 기본적으로 숨겨서 기존 화면을 유지하고, setVisibleCluster 시점에만 노출
    iframe.classList.add("hidden");

    // 🎯 목적: iframe이 #lens-views의 전체 공간을 차지하도록 설정
    // 문제: iframe 기본 width가 300px로 제한되어 내부 MainLayout이 잘림
    // 해결: width/height 100% 설정 (DevTools 테스트로 확인 완료)
    iframe.style.cssText = "width: 100%; height: 100%; border: none;";

    iframe.addEventListener(
      "load",
      action(() => {
        this.dependencies.logger.info(`[LENS-VIEW]: frame for clusterId=${clusterId} has loaded`);
        const view = this.views.get(clusterId);

        assert(view, `view for ${clusterId} MUST still exist here`);
        view.isLoaded = true;
      }),
      { once: true },
    );
    this.views.set(clusterId, { frame: iframe, isLoaded: false });
    parentElem.appendChild(iframe);

    this.dependencies.logger.info(`[LENS-VIEW]: waiting cluster to be ready, clusterId=${clusterId}`);

    const dispose = when(
      () => cluster.ready.get(),
      () => this.dependencies.logger.info(`[LENS-VIEW]: cluster is ready, clusterId=${clusterId}`),
    );

    when(
      // cluster.disconnect is set to `false` when the cluster starts to connect
      () => !cluster.disconnected.get(),
      () => {
        // 🎯 목적: 클러스터 연결 감지 후 cleanup 로직 등록
        // 📝 주의사항: Main tab 생성은 init-cluster-frame.ts에서 iframe 컨텍스트로 이동됨
        // 🔄 변경이력: 2025-10-26 - Main tab 생성 로직 제거 (MainTabStore 인스턴스 분리 문제 해결)

        when(
          () => {
            const cluster = this.dependencies.getClusterById(clusterId);

            return Boolean(!cluster || (cluster.disconnected.get() && this.views.get(clusterId)?.isLoaded));
          },
          () => {
            this.dependencies.logger.info(`[LENS-VIEW]: remove dashboard, clusterId=${clusterId}`);
            if (this.visibleClusterId === clusterId) {
              this.visibleClusterId = null;
            }
            this.views.delete(clusterId);

            // Must only remove iframe from DOM after it unloads old code. Else it crashes
            iframe.addEventListener("load", () => parentElem.removeChild(iframe), {
              once: true,
            });

            // This causes the old code to be unloaded.
            iframe.setAttribute("src", "");

            dispose();
          },
        );
      },
    );
  }

  private prevVisibleClusterChange?: Disposer;

  public setVisibleCluster(clusterId: ClusterId | null): void {
    // Clear the previous when ASAP
    this.prevVisibleClusterChange?.();
    this.visibleClusterId = null;

    this.dependencies.logger.info(`[LENS-VIEW]: refreshing iframe views, visible cluster id=${clusterId}`);
    this.dependencies.emitClusterVisibility(null);

    for (const { frame: view } of this.views.values()) {
      view.classList.add("hidden");
    }

    const cluster = clusterId ? this.dependencies.getClusterById(clusterId) : undefined;

    if (cluster && clusterId) {
      this.prevVisibleClusterChange = onceDefined(
        () => {
          const view = this.views.get(clusterId);

          if (cluster.available.get() && cluster.ready.get() && view?.isLoaded) {
            return view;
          }

          return undefined;
        },
        (view: LensView) => {
          this.dependencies.logger.info(`[LENS-VIEW]: cluster id=${clusterId} should now be visible`);
          view.frame.classList.remove("hidden");
          view.frame.focus();
          this.dependencies.emitClusterVisibility(clusterId);
          this.visibleClusterId = clusterId;
        },
      );
    }
  }

  public clearVisibleCluster() {
    this.setVisibleCluster(null);
  }
}
