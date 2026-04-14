/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Port Forward 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - 공통 DetailPanel 컴포넌트 사용 (packages/storybook-shadcn/src/components/ui/detail-panel.tsx)
 *   - PortForwardItem은 KubeObject가 아님 (임시 세션 객체)
 *   - shadcn DropdownMenu로 액션 제공 (Open, Edit, Start/Stop, Delete)
 *   - Delete 시 ConfirmDialog 표시 (다른 리소스와 동일 패턴)
 *   - Resource Name을 Pod/Service 상세로 링크 연결
 * 🔄 변경이력:
 *   - 2025-11-18: Delete 액션에 ConfirmDialog 추가
 *   - 2025-11-18: shadcn DetailPanel 마이그레이션 (legacy Drawer 제거)
 *   - 2025-11-18: PortForwardMenu 로직 통합 (shadcn DropdownMenu 사용)
 */

import "./port-forward-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { podApiInjectable, serviceApiInjectable } from "@skuberplus/kube-api-specifics";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { Button } from "@skuberplus/storybook-shadcn/src/components/ui/button";
import { DetailPanel } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@skuberplus/storybook-shadcn/src/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableRow } from "@skuberplus/storybook-shadcn/src/components/ui/table";
import { CirclePlay, Edit, ExternalLink, MoreVertical, OctagonPause, Trash } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";
import { Link } from "react-router-dom";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { portForwardAddress } from "../../port-forward";
import openPortForwardInjectable from "../../port-forward/open-port-forward.injectable";
import portForwardDialogModelInjectable from "../../port-forward/port-forward-dialog-model/port-forward-dialog-model.injectable";
import portForwardStoreInjectable from "../../port-forward/port-forward-store/port-forward-store.injectable";
import openConfirmDialogInjectable from "../confirm-dialog/open.injectable";
import getDetailsUrlInjectable from "../kube-detail-params/get-details-url.injectable";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";

import type { PodApi, ServiceApi } from "@skuberplus/kube-api";

import type { Cluster } from "../../../common/cluster/cluster";
import type { PortForwardItem, PortForwardStore } from "../../port-forward";
import type { OpenPortForward } from "../../port-forward/open-port-forward.injectable";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { GetDetailsUrl } from "../kube-detail-params/get-details-url.injectable";

export interface PortForwardDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 Port Forward 객체
   */
  portForward: PortForwardItem | undefined;

  /**
   * 패널 닫기 콜백
   */
  onClose: () => void;
}

interface Dependencies {
  serviceApi: ServiceApi;
  podApi: PodApi;
  getDetailsUrl: GetDetailsUrl;
  portForwardStore: PortForwardStore;
  openPortForwardDialog: (item: PortForwardItem) => void;
  openPortForward: OpenPortForward;
  openConfirmDialog: OpenConfirmDialog;
  hostedCluster: Cluster | undefined;
}

/**
 * Resource Name을 Pod/Service 상세로 링크하는 헬퍼 함수
 */
function renderResourceNameLink(
  portForward: PortForwardItem,
  serviceApi: ServiceApi,
  podApi: PodApi,
  getDetailsUrl: GetDetailsUrl,
) {
  const name = portForward.getName();
  const api =
    {
      service: serviceApi,
      pod: podApi,
    }[portForward.kind] || null;

  if (!api) {
    return <span className="text-sm">{name}</span>;
  }

  return (
    <Link
      to={getDetailsUrl(
        api.formatUrlForNotListing({
          name,
          namespace: portForward.getNs(),
        }),
      )}
      className="text-primary hover:underline text-sm"
    >
      {name}
    </Link>
  );
}

/**
 * Port Forward 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param portForward - 표시할 Port Forward 객체
 * @param onClose - 패널 닫기 콜백
 */
const NonInjectedPortForwardDetailPanel = observer((props: PortForwardDetailPanelProps & Dependencies) => {
  const {
    isOpen,
    portForward,
    onClose,
    serviceApi,
    podApi,
    getDetailsUrl,
    portForwardStore,
    openPortForwardDialog,
    openPortForward,
    openConfirmDialog,
    hostedCluster,
  } = props;

  // ⚠️ Port Forward 객체가 없으면 렌더링하지 않음
  if (!portForward) {
    return null;
  }

  // ============================================
  // 🎯 액션 핸들러 함수들 (DropdownMenu용)
  // ============================================

  /**
   * Open 액션: 브라우저에서 Port Forward 열기 (Active 상태일 때만)
   */
  const handleOpen = () => {
    openPortForward(portForward);
  };

  /**
   * Edit 액션: Port Forward 설정 편집 (Dialog)
   */
  const handleEdit = () => {
    openPortForwardDialog(portForward);
  };

  /**
   * Delete 액션: Port Forward 중지 및 제거 (Confirm Dialog → Store 호출)
   */
  const handleDelete = () => {
    const address = portForwardAddress(portForward);

    openConfirmDialog({
      ok: async () => {
        try {
          await portForwardStore.remove(portForward);
          onClose();
        } catch (error) {
          // 🎯 FIX-037: NotificationPanel으로 마이그레이션
          // 🆕 FIX-038: clusterName metadata 추가
          const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
          notificationPanelStore.addError(
            "network",
            "Port Forward Delete Failed",
            `Error occurred stopping the port-forward from port ${portForward.forwardPort}. The port-forward may still be active.`,
            { clusterName },
          );
        }
      },
      labelOk: "Delete",
      message: (
        <p>
          Are you sure you want to delete port forward <b>{address}</b>?
          <br />
          <span className="text-sm text-muted-foreground">
            This will stop and remove: {portForward.kind}/{portForward.getName()} (port {portForward.getPort()})
          </span>
        </p>
      ),
    });
  };

  /**
   * Start 액션: Port Forward 시작
   */
  const handleStart = async () => {
    const pf = await portForwardStore.start(portForward);

    if (pf.status === "Disabled") {
      const { name, kind, forwardPort } = portForward;

      // 🎯 FIX-037: NotificationPanel으로 마이그레이션
      // 🆕 FIX-038: clusterName metadata 추가
      const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
      notificationPanelStore.addError(
        "network",
        "Port Forward Start Failed",
        `Error occurred starting port-forward, the local port ${forwardPort} may not be available or the ${kind} ${name} may not be reachable`,
        { clusterName },
      );
    }
  };

  /**
   * Stop 액션: Port Forward 중지
   */
  const handleStop = () => {
    portForwardStore.stop(portForward);
  };

  const isActive = portForward.status === "Active";

  return (
    <DetailPanel
      isOpen={isOpen}
      onClose={onClose}
      title={`Port Forward: ${portForwardAddress(portForward)}`}
      subtitle={`Namespace: ${portForward.getNs()}`}
      width="w-full md:w-[600px]"
      headerActions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="액션 메뉴">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* ============================================ */}
            {/* 🎯 Port Forward 액션들 */}
            {/* ============================================ */}

            {/* Open in Browser (Active 상태일 때만) */}
            {isActive && (
              <DropdownMenuItem onClick={handleOpen}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Open in Browser
              </DropdownMenuItem>
            )}

            {/* Edit */}
            <DropdownMenuItem onClick={handleEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>

            {/* Start/Stop (상태에 따라) */}
            {isActive ? (
              <DropdownMenuItem onClick={handleStop}>
                <OctagonPause className="mr-2 h-4 w-4" />
                Stop
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={handleStart}>
                <CirclePlay className="mr-2 h-4 w-4" />
                Start
              </DropdownMenuItem>
            )}

            {/* ============================================ */}
            {/* 🎯 Separator + Destructive 액션 (빨간색 강조) */}
            {/* ============================================ */}
            <DropdownMenuSeparator />

            <DropdownMenuItem variant="destructive" onClick={handleDelete}>
              <Trash className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {/* ============================================ */}
      {/* 📋 Port Forward 정보 테이블 */}
      {/* ============================================ */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Port Forward Information</h3>
        <Table>
          <TableBody>
            {/* Resource Name - Pod/Service로 링크 */}
            <TableRow>
              <TableCell className="w-1/3 font-medium">Resource Name</TableCell>
              <TableCell>{renderResourceNameLink(portForward, serviceApi, podApi, getDetailsUrl)}</TableCell>
            </TableRow>

            {/* Kind - Badge */}
            <TableRow>
              <TableCell className="font-medium">Kind</TableCell>
              <TableCell>
                <Badge variant="outline">{portForward.getKind()}</Badge>
              </TableCell>
            </TableRow>

            {/* Pod Port */}
            <TableRow>
              <TableCell className="font-medium">Pod Port</TableCell>
              <TableCell>
                <code className="rounded bg-muted px-1.5 py-0.5 text-sm">{portForward.getPort()}</code>
              </TableCell>
            </TableRow>

            {/* Local Port */}
            <TableRow>
              <TableCell className="font-medium">Local Port</TableCell>
              <TableCell>
                <code className="rounded bg-muted px-1.5 py-0.5 text-sm">{portForward.getForwardPort()}</code>
              </TableCell>
            </TableRow>

            {/* Protocol */}
            <TableRow>
              <TableCell className="font-medium">Protocol</TableCell>
              <TableCell>
                <Badge variant="outline">{portForward.getProtocol()}</Badge>
              </TableCell>
            </TableRow>

            {/* Address */}
            <TableRow>
              <TableCell className="font-medium">Address</TableCell>
              <TableCell>
                <code className="rounded bg-muted px-1.5 py-0.5 text-sm">{portForward.getAddress()}</code>
              </TableCell>
            </TableRow>

            {/* Status - Badge with color */}
            <TableRow>
              <TableCell className="font-medium">Status</TableCell>
              <TableCell>
                <Badge variant={isActive ? "default" : "secondary"}>{portForward.getStatus()}</Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </DetailPanel>
  );
});

/**
 * DI 패턴 적용된 Port Forward Detail Panel
 */
export const PortForwardDetails = withInjectables<Dependencies, PortForwardDetailPanelProps>(
  NonInjectedPortForwardDetailPanel,
  {
    getProps: (di, props) => ({
      ...props,
      serviceApi: di.inject(serviceApiInjectable),
      podApi: di.inject(podApiInjectable),
      getDetailsUrl: di.inject(getDetailsUrlInjectable),
      portForwardStore: di.inject(portForwardStoreInjectable),
      openPortForwardDialog: di.inject(portForwardDialogModelInjectable).open,
      openPortForward: di.inject(openPortForwardInjectable),
      openConfirmDialog: di.inject(openConfirmDialogInjectable),
      hostedCluster: di.inject(hostedClusterInjectable),
    }),
  },
);
