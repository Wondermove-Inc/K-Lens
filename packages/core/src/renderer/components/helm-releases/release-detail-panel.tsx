/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Helm Release 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - shadcn DetailPanel 컴포넌트 사용
 *   - Release 기본 정보, 차트 정보, 업데이트 이력 표시
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 * 🔄 변경이력:
 *   - 2025-11-02: 초기 생성 (shadcn DetailPanel 기반)
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableRow } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { kebabCase } from "lodash/fp";
import { observer } from "mobx-react";
import moment from "moment-timezone";
import React, { useEffect, useRef, useState } from "react";
import { DetailPanel } from "../common/detail-panel";
import openConfirmDialogInjectable from "../confirm-dialog/open.injectable";
import createUpgradeChartTabInjectable from "../dock/upgrade-chart/create-upgrade-chart-tab.injectable";
import deleteReleaseInjectable from "./delete-release/delete-release.injectable";
import openHelmReleaseRollbackDialogInjectable from "./dialog/open.injectable";

import type { Logger } from "@skuberplus/logger";

import type { HelmRelease } from "../../../common/k8s-api/endpoints/helm-releases.api";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { OpenHelmReleaseRollbackDialog } from "./dialog/open.injectable";

/**
 * 🎯 목적: ReleaseDetailPanel Props 인터페이스
 */
export interface ReleaseDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 Helm Release 객체
   */
  release: HelmRelease | undefined;

  /**
   * 패널 닫기 콜백
   */
  onClose: () => void;
}

interface Dependencies {
  logger: Logger;
  createUpgradeChartTab: (release: HelmRelease) => string;
  deleteRelease: (release: HelmRelease) => Promise<void>;
  openConfirmDialog: OpenConfirmDialog;
  openRollbackDialog: OpenHelmReleaseRollbackDialog;
}

/**
 * 🎯 목적: Helm Release 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param release - 표시할 Helm Release 객체
 * @param onClose - 패널 닫기 콜백
 */
const NonInjectedReleaseDetailPanel = observer(
  ({
    isOpen,
    release,
    onClose,
    logger,
    createUpgradeChartTab,
    deleteRelease,
    openConfirmDialog,
    openRollbackDialog,
  }: ReleaseDetailPanelProps & Dependencies) => {
    // ============================================
    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 유지
    // ============================================
    const [renderRelease, setRenderRelease] = useState<HelmRelease | undefined>(release);
    const clearTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const prevIsOpenRef = useRef(true);

    useEffect(() => {
      // 새로 선택된 리소스 반영
      if (release) {
        setRenderRelease(release);
      }

      // 패널 닫힘 애니메이션 처리
      const wasOpen = prevIsOpenRef.current;

      if (!isOpen && wasOpen) {
        clearTimerRef.current = setTimeout(() => {
          setRenderRelease(undefined);
        }, 320);
      }

      if (isOpen && clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = undefined;
      }

      prevIsOpenRef.current = isOpen;

      return () => {
        if (clearTimerRef.current) {
          clearTimeout(clearTimerRef.current);
        }
      };
    }, [isOpen, release]);

    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 사용
    const item = renderRelease;

    if (!item) {
      return null;
    }

    // ============================================
    // 🎯 액션 핸들러 함수들 (DetailPanelActionsMenu용)
    // ============================================

    /**
     * Upgrade 액션: 업그레이드 차트 탭 열기
     */
    const handleUpgrade = () => {
      createUpgradeChartTab(item);
    };

    /**
     * Rollback 액션: Helm Release 롤백 다이얼로그 열기
     * 📝 주의: revision이 1보다 클 때만 표시 (이전 버전이 있을 때만)
     */
    const handleRollback = () => {
      openRollbackDialog(item);
    };

    /**
     * Delete 액션: 확인 다이얼로그 후 Helm Release 삭제
     */
    const handleDelete = () => {
      openConfirmDialog({
        message: `Are you sure you want to delete Helm Release "${item.getName()}" from namespace "${item.getNs()}"?`,
        labelOk: "Delete",
        okButtonProps: { className: "bg-destructive text-destructive-foreground hover:bg-destructive/90" },
        ok: async () => {
          await deleteRelease(item);
          onClose();
        },
      });
    };

    // 🎯 Release 속성 데이터 추출
    const name = item.getName();
    const namespace = item.getNs();
    const chart = item.getChart();
    const chartWithVersion = item.getChart(true);
    const revision = item.getRevision();
    const version = item.getVersion();
    const appVersion = item.appVersion;
    const status = item.getStatus();
    const updated = item.updated;
    const updatedFormatted = item.getUpdated();

    // 🎯 Rollback 표시 조건: revision이 1보다 클 때만 (이전 버전이 있을 때만)
    const hasRollback = revision > 1;

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={name}
        subtitle={`Namespace: ${namespace}`}
        object={{ kind: "HelmRelease" }}
        onUpgrade={handleUpgrade}
        onRollback={hasRollback ? handleRollback : undefined}
        onDelete={handleDelete}
      >
        <div className="space-y-4">
          {/* ============================================ */}
          {/* 📋 기본 정보 테이블 */}
          {/* ============================================ */}
          <div>
            <h3 className="text-foreground text-base font-medium mb-2">Release Information</h3>
            <Table>
              <TableBody>
                {/* Status */}
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px] w-[180px]">
                    <span className="text-foreground text-sm">Status</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <Badge variant="outline" className={kebabCase(status)}>
                      {status}
                    </Badge>
                  </TableCell>
                </TableRow>

                {/* Revision */}
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">Revision</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">{revision}</span>
                  </TableCell>
                </TableRow>

                {/* Updated */}
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">Updated</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <div className="flex flex-col gap-1">
                      <span className="text-foreground text-sm">{updatedFormatted}</span>
                      {updated && (
                        <span className="text-muted-foreground text-xs">
                          {moment(updated.replace(/\s\w*$/, "")).format("YYYY-MM-DD HH:mm:ss")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* ============================================ */}
          {/* 📦 차트 정보 테이블 */}
          {/* ============================================ */}
          <div>
            <h3 className="text-foreground text-base font-medium mb-2">Chart Information</h3>
            <Table>
              <TableBody>
                {/* Chart */}
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px] w-[180px]">
                    <span className="text-foreground text-sm">Chart</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">{chart}</span>
                  </TableCell>
                </TableRow>

                {/* Chart with Version */}
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">Chart (with version)</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">{chartWithVersion}</span>
                  </TableCell>
                </TableRow>

                {/* Version */}
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">Chart Version</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">{version}</span>
                  </TableCell>
                </TableRow>

                {/* App Version */}
                {appVersion && (
                  <TableRow>
                    <TableCell className="border-border border-b px-2 py-[14px]">
                      <span className="text-foreground text-sm">App Version</span>
                    </TableCell>
                    <TableCell className="border-border border-b px-2 py-[14px]">
                      <span className="text-foreground text-sm">{appVersion}</span>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DetailPanel>
    );
  },
);

/**
 * DI 패턴 적용된 Release Detail Panel
 */
export const ReleaseDetailPanel = withInjectables<Dependencies, ReleaseDetailPanelProps>(
  NonInjectedReleaseDetailPanel,
  {
    getProps: (di, props) => ({
      ...props,
      logger: di.inject(loggerInjectionToken),
      createUpgradeChartTab: di.inject(createUpgradeChartTabInjectable),
      deleteRelease: di.inject(deleteReleaseInjectable),
      openConfirmDialog: di.inject(openConfirmDialogInjectable),
      openRollbackDialog: di.inject(openHelmReleaseRollbackDialogInjectable),
    }),
  },
);
