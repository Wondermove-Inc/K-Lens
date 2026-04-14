/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Kubeconfig 클러스터 추가 Dialog 컴포넌트 (injectable 패턴)
 *
 * Welcome 화면에서 팝업으로 kubeconfig를 추가할 수 있는 Dialog입니다.
 * 기존 AddCluster 페이지의 로직을 재사용하며, Monaco Editor를 포함합니다.
 *
 * 📝 주의사항:
 * - 모든 스타일은 shadcn Tailwind CSS 토큰 사용
 * - injectable 패턴: state/open/close/view 4파일 구조
 * - state injectable로부터 모든 상태 주입받음
 * - Monaco Editor 높이는 h-96 (384px)
 *
 * 🔄 변경이력:
 * - 2025-10-24: injectable 패턴으로 리팩토링 (state/open/close 분리)
 * - 2025-10-24: 초기 생성
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { isDefined, iter } from "@skuberplus/utilities";
import * as fse from "fs-extra";
import { debounce } from "lodash";
import { AlertCircle } from "lucide-react";
import { action, computed, makeObservable } from "mobx";
import { observer } from "mobx-react";
import * as React from "react";
import { Component } from "react";
import * as uuid from "uuid";
import emitAppEventInjectable from "../../../../common/app-event-bus/emit-event.injectable";
import getCustomKubeConfigFilePathInjectable from "../../../../common/app-paths/get-custom-kube-config-directory/get-custom-kube-config-directory.injectable";
import navigateToCatalogInjectable from "../../../../common/front-end-routing/routes/catalog/navigate-to-catalog.injectable";
import navigateToWelcomeInjectable from "../../../../common/front-end-routing/routes/welcome/navigate-to-welcome.injectable";
import { loadConfigFromString, splitConfig } from "../../../../common/kube-helpers";
import getDirnameOfPathInjectable from "../../../../common/path/get-dirname.injectable";
import { MonacoEditor } from "../../monaco-editor";
// shadcn/ui 컴포넌트 imports
import { Alert, AlertTitle } from "../../shadcn-ui/alert";
import { Button } from "../../shadcn-ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../shadcn-ui/dialog";
import { ScrollArea } from "../../shadcn-ui/scroll-area";
import { notificationPanelStore } from "../../status-bar/items/notification-panel.store";
import closeAddClusterDialogInjectable from "./close.injectable";
import addClusterDialogStateInjectable from "./state.injectable";

import type { KubeConfig } from "@skuberplus/kubernetes-client-node";

import type { EmitAppEvent } from "../../../../common/app-event-bus/emit-event.injectable";
import type { NavigateToCatalog } from "../../../../common/front-end-routing/routes/catalog/navigate-to-catalog.injectable";
import type { GetDirnameOfPath } from "../../../../common/path/get-dirname.injectable";
import type { AddClusterDialogState, Option } from "./state.injectable";

/**
 * 🎯 목적: AddClusterDialog의 Props 인터페이스 (빈 인터페이스)
 *
 * 📝 주의사항:
 * - injectable 패턴에서는 Props가 필요 없음 (state injectable로 관리)
 * - DialogProps를 extend하지 않음 (내부적으로 state.isOpen 사용)
 */
export interface AddClusterDialogProps {}

/**
 * 🎯 목적: AddClusterDialog의 DI 의존성 인터페이스
 *
 * 📝 주의사항:
 * - state injectable 추가 (모든 상태 관리)
 * - closeAddClusterDialog injectable 추가 (닫기 액션)
 * - 기존 6개 의존성 유지
 */
interface Dependencies {
  state: AddClusterDialogState;
  closeAddClusterDialog: () => void;
  getCustomKubeConfigDirectory: (directoryName: string) => string;
  navigateToCatalog: NavigateToCatalog;
  navigateToWelcome: () => void;
  getDirnameOfPath: GetDirnameOfPath;
  emitAppEvent: EmitAppEvent;
}

/**
 * 🎯 목적: kubeconfig에서 컨텍스트 추출
 *
 * @param config - Kubernetes 설정 객체
 * @returns 컨텍스트 이름과 검증 결과 맵
 */
function getContexts(config: KubeConfig): Map<string, Option> {
  return new Map(
    splitConfig(config).map(({ config, validationResult }) => [
      config.currentContext,
      {
        config,
        error: validationResult.error?.toString(),
      },
    ]),
  );
}

/**
 * 🎯 목적: AddClusterDialog 컴포넌트 (DI 주입 전, injectable 패턴)
 *
 * 주요 기능:
 * - Kubeconfig YAML 입력 및 검증
 * - Monaco Editor를 사용한 편집
 * - 클러스터 추가 및 Catalog 페이지 이동
 *
 * 📝 주의사항:
 * - MobX observer로 감싸서 상태 변경 시 자동 리렌더링
 * - state injectable로부터 모든 상태 주입받음
 * - Dialog의 open은 state.isOpen.get()으로 제어
 * - 모든 스타일은 shadcn Tailwind CSS token 사용 (bg-background, text-foreground 등)
 */
class NonInjectedAddClusterDialog extends Component<AddClusterDialogProps & Dependencies> {
  constructor(props: AddClusterDialogProps & Dependencies) {
    super(props);
    makeObservable(this);
  }

  componentDidUpdate(prevProps: AddClusterDialogProps & Dependencies) {
    const { state, emitAppEvent } = this.props;

    // 🎯 목적: Dialog가 열릴 때 앱 이벤트 발생
    const wasOpen = prevProps.state.isOpen.get();
    const isOpen = state.isOpen.get();

    if (!wasOpen && isOpen) {
      emitAppEvent({ name: "cluster-add", action: "start" });
    }
  }

  /**
   * 🎯 목적: 모든 오류 메시지 통합
   *
   * @returns 검증 오류 및 파싱 오류 배열
   */
  @computed get allErrors(): string[] {
    const { state } = this.props;
    return [...state.errors, ...iter.map(state.kubeContexts.values(), ({ error }) => error)].filter(isDefined);
  }

  /**
   * 🎯 목적: Kubeconfig 텍스트를 파싱하여 컨텍스트 추출 (debounce 적용)
   *
   * 📝 주의사항:
   * - 500ms debounce로 입력 중 과도한 파싱 방지
   * - 오류 발생 시 errors 배열에 추가
   */
  readonly refreshContexts = debounce(
    action(() => {
      const { state } = this.props;
      const { config, error } = loadConfigFromString(state.customConfig.get().trim() || "{}");

      state.kubeContexts.replace(getContexts(config));

      if (error) {
        state.errors.push(error.toString());
      }

      if (config.contexts.length === 0) {
        state.errors.push('No contexts defined, either missing the "contexts" field, or it is empty.');
      }
    }),
    500,
  );

  /**
   * 🎯 목적: 클러스터 추가 실행
   *
   * 주요 작업:
   * - kubeconfig 파일을 커스텀 디렉토리에 저장
   * - 성공 시 Catalog 페이지로 이동 및 Dialog 닫기
   * - 실패 시 에러 알림 표시
   *
   * 📝 주의사항:
   * - 파일 권한은 0o600 (소유자만 읽기/쓰기)
   * - 성공 시 closeAddClusterDialog 호출하여 Dialog 닫기
   */
  addClusters = action(async () => {
    const {
      state,
      closeAddClusterDialog,
      emitAppEvent,
      getCustomKubeConfigDirectory,
      getDirnameOfPath,
      navigateToWelcome,
    } = this.props;

    state.isWaiting.set(true);
    emitAppEvent({ name: "cluster-add", action: "click" });

    try {
      const absPath = getCustomKubeConfigDirectory(uuid.v4());

      await fse.ensureDir(getDirnameOfPath(absPath));
      await fse.writeFile(absPath, state.customConfig.get().trim(), { encoding: "utf-8", mode: 0o600 });

      // 🎯 FIX-037: NotificationPanel으로 마이그레이션
      notificationPanelStore.addSuccess(
        "cluster",
        "Clusters Added",
        `Successfully added ${state.kubeContexts.size} new cluster(s)`,
      );
      closeAddClusterDialog(); // Dialog 닫기

      return navigateToWelcome();
    } catch (error) {
      // 🎯 FIX-037: NotificationPanel으로 마이그레이션
      notificationPanelStore.addError("cluster", "Add Clusters Failed", `Failed to add clusters: ${error}`);
      state.isWaiting.set(false);
    }
  });

  render() {
    const { state, closeAddClusterDialog } = this.props;

    return (
      <Dialog open={state.isOpen.get()} onOpenChange={(open) => !open && closeAddClusterDialog()}>
        <DialogContent
          className="bg-background border-border flex h-[85%] max-w-[70%] flex-col overflow-y-auto sm:h-[90%] sm:max-w-[65%] lg:max-w-[60%] xl:max-w-[55%]"
          onCloseAutoFocus={(e) => {
            // ✅ Dialog 닫을 때 pointer-events 복원 (포커스 트랩 방지)
            e.preventDefault();
            // body에서 pointer-events: none 강제 제거
            setTimeout(() => {
              document.body.style.removeProperty("pointer-events");
            }, 0);
          }}
        >
          {/* ========================================
              🎯 Dialog Header
              ======================================== */}
          <DialogHeader className="gap-1.5">
            <DialogTitle className="text-foreground">Add Clusters from Kubeconfig</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Clusters added here are <strong>not</strong> merged into the <code>~/.kube/config</code> file.{" "}
              <a
                href="https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/"
                rel="noreferrer"
                target="_blank"
                className="text-primary hover:underline"
              >
                Read more about adding clusters.
              </a>
            </DialogDescription>
          </DialogHeader>

          {/* ========================================
              🎯 Monaco Editor 영역
              ======================================== */}
          <div className="bg-muted/30 border-border flex min-h-0 flex-1 flex-col rounded-lg border shadow-sm">
            <MonacoEditor
              autoFocus
              className="h-full min-h-[400px]"
              value={state.customConfig.get()}
              onChange={(value) => {
                state.customConfig.set(value);
                state.errors.clear();
                this.refreshContexts();
              }}
            />
          </div>

          {/* ========================================
              🎯 검증 오류 표시 (Alert 컴포넌트 사용)
              ======================================== */}
          {this.allErrors.length > 0 && (
            <div className="mt-6 mb-6 w-full">
              <ScrollArea className="h-32">
                <div className="flex flex-col gap-2 pr-4">
                  {this.allErrors.map((error, index) => (
                    <Alert key={index} variant="destructive" className="w-full">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>{error}</AlertTitle>
                    </Alert>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* ========================================
              🎯 Dialog Footer (버튼 영역)
              ======================================== */}
          <DialogFooter className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline" className="bg-muted/30 border-border hover:bg-muted/50">
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={this.addClusters}
              disabled={state.kubeContexts.size === 0 || state.isWaiting.get()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {state.isWaiting.get() ? "Adding..." : state.kubeContexts.size === 1 ? "Add cluster" : "Add clusters"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
}

/**
 * 🎯 목적: DI가 적용된 AddClusterDialog 컴포넌트 (injectable 패턴)
 *
 * @exports AddClusterDialog
 *
 * 📝 주의사항:
 * - state injectable과 closeAddClusterDialog injectable 주입
 * - 기존 6개 injectable 모두 유지
 */
export const AddClusterDialog = withInjectables<Dependencies, AddClusterDialogProps>(
  observer(NonInjectedAddClusterDialog),
  {
    getProps: (di, props) => ({
      ...props,
      state: di.inject(addClusterDialogStateInjectable),
      closeAddClusterDialog: di.inject(closeAddClusterDialogInjectable),
      getCustomKubeConfigDirectory: di.inject(getCustomKubeConfigFilePathInjectable),
      navigateToCatalog: di.inject(navigateToCatalogInjectable),
      navigateToWelcome: di.inject(navigateToWelcomeInjectable),
      getDirnameOfPath: di.inject(getDirnameOfPathInjectable),
      emitAppEvent: di.inject(emitAppEventInjectable),
    }),
  },
);
