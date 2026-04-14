/**
 * 🎯 목적: Pod 상세 정보 내부 컨텐츠 컴포넌트 (KubeObjectDetails 시스템 호환)
 *
 * @remarks
 * - KubeObjectDetails 시스템에서 사용 (DetailPanel wrapper 제외)
 * - shadcn UI 컴포넌트 (Table, Badge) 사용
 * - PodDetailPanel과 동일한 내부 컨텐츠 제공
 *
 * 🔄 변경이력:
 * - 2025-11-13: 초기 생성 (PodDetailPanel 내부 컨텐츠 분리)
 */

import "./pod-details.scss";

import { Pod } from "@skuberplus/kube-object";
import { Table, TableBody, TableCell, TableRow } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { cssNames, formatDuration } from "@skuberplus/utilities";
import kebabCase from "lodash/kebabCase";
import { observer } from "mobx-react";
import React from "react";
import { KubeObjectConditionsDrawer } from "../kube-object-conditions";
import { KubeEventDetailsSection } from "../kube-object-details/kube-event-details-section";
import { KubeObjectMetaSection } from "../kube-object-details/kube-object-meta-section";
import { PodDetailsContainers } from "./details/containers/pod-details-containers";
import { PodDetailsEphemeralContainers } from "./details/containers/pod-details-ephemeral-containers";
import { PodDetailsInitContainers } from "./details/containers/pod-details-init-containers";
import { PodVolumes } from "./details/volumes/view";
import { PodDetailsAffinities } from "./pod-details-affinities";
import { PodDetailsSecrets } from "./pod-details-secrets";
import { PodDetailsTolerations } from "./pod-details-tolerations";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export interface PodDetailsContentProps extends KubeObjectDetailsProps<Pod> {}

/**
 * Pod 상세 정보 내부 컨텐츠 컴포넌트
 *
 * @param object - 표시할 Pod 객체
 */
export const PodDetailsContent = observer((props: PodDetailsContentProps) => {
  const { object: pod } = props;

  if (!pod || !(pod instanceof Pod)) {
    return null;
  }

  const { status, spec } = pod;
  const { podIP } = status ?? {};
  const podIPs = pod.getIPs();
  const { nodeName } = spec ?? {};
  const nodeSelector = pod.getNodeSelectors();

  const priorityClassName = pod.getPriorityClassName();
  const runtimeClassName = pod.getRuntimeClassName();
  const serviceAccountName = pod.getServiceAccountName();

  return (
    <>
      {/* ============================================ */}
      {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
      {/* ============================================ */}
      <KubeObjectMetaSection object={pod} />

      {/* ============================================ */}
      {/* 📋 속성 테이블 - shadcn Table 컴포넌트 사용 */}
      {/* ============================================ */}
      <Table>
        <TableBody>
          {/* Status */}
          <TableRow>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <span className="text-foreground text-sm">Status</span>
            </TableCell>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <Badge variant="outline" className={cssNames(kebabCase(pod.getStatusMessage()))}>
                {pod.getStatusMessage()}
              </Badge>
            </TableCell>
          </TableRow>

          {/* Node */}
          {nodeName && (
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Node</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{nodeName}</span>
              </TableCell>
            </TableRow>
          )}

          {/* Pod IP */}
          {podIP && (
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Pod IP</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{podIP}</span>
              </TableCell>
            </TableRow>
          )}

          {/* Pod IPs */}
          {podIPs.length > 0 && (
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Pod IPs</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <div className="flex flex-wrap gap-1">
                  {podIPs.map((ip) => (
                    <Badge key={ip} variant="outline">
                      {ip}
                    </Badge>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          )}

          {/* Service Account */}
          <TableRow>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <span className="text-foreground text-sm">Service Account</span>
            </TableCell>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <span className="text-foreground text-sm">{serviceAccountName}</span>
            </TableCell>
          </TableRow>

          {/* Priority Class */}
          {priorityClassName && (
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Priority Class</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{priorityClassName}</span>
              </TableCell>
            </TableRow>
          )}

          {/* QoS Class */}
          <TableRow>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <span className="text-foreground text-sm">QoS Class</span>
            </TableCell>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <span className="text-foreground text-sm">{pod.getQosClass()}</span>
            </TableCell>
          </TableRow>

          {/* Runtime Class */}
          {runtimeClassName && (
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Runtime Class</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{runtimeClassName}</span>
              </TableCell>
            </TableRow>
          )}

          {/* Termination Grace Period */}
          <TableRow>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <span className="text-foreground text-sm">Termination Grace Period</span>
            </TableCell>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <span className="text-foreground text-sm">
                {formatDuration((pod.spec.terminationGracePeriodSeconds ?? 30) * 1000, false)}
              </span>
            </TableCell>
          </TableRow>

          {/* Node Selector */}
          {nodeSelector.length > 0 && (
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Node Selector</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <div className="flex flex-wrap gap-1">
                  {nodeSelector.map((label) => (
                    <Badge key={label} variant="outline">
                      {label}
                    </Badge>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* ============================================ */}
      {/* 📦 추가 섹션 - 기존 컴포넌트 재사용 */}
      {/* ============================================ */}

      {/* Tolerations */}
      <div className="mt-8">
        <PodDetailsTolerations workload={pod} />
      </div>

      {/* Affinities */}
      <div className="mt-8">
        <PodDetailsAffinities workload={pod} />
      </div>

      {/* Secrets */}
      {pod.getSecrets().length > 0 && (
        <div className="mt-8">
          <span className="text-foreground text-base font-medium">Secrets</span>
          <PodDetailsSecrets pod={pod} />
        </div>
      )}

      {/* Conditions */}
      <div className="mt-8">
        <KubeObjectConditionsDrawer object={pod} />
      </div>

      {/* Init Containers */}
      <div className="mt-8">
        <PodDetailsInitContainers pod={pod} />
      </div>

      {/* Containers */}
      <div className="mt-8">
        <PodDetailsContainers pod={pod} />
      </div>

      {/* Ephemeral Containers */}
      <div className="mt-8">
        <PodDetailsEphemeralContainers pod={pod} />
      </div>

      {/* Volumes */}
      <div className="mt-8">
        <PodVolumes pod={pod} />
      </div>

      {/* ============================================ */}
      {/* 📋 Events 섹션 */}
      {/* ============================================ */}
      <KubeEventDetailsSection object={pod} />
    </>
  );
});
