/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { DetailPanelActionsMenu } from "./detail-panel-actions-menu";

import type { Meta, StoryObj } from "@storybook/react";

/**
 * 🎯 목적: DetailPanelActionsMenu 컴포넌트 Storybook 스토리
 *
 * @remarks
 * - 위험 액션만 표시 (Delete, Force Delete, Force Finalize, Cordon/Uncordon/Drain)
 * - 자주 쓰는 액션은 DetailPanelQuickActions로 분리됨
 * - shadcn DropdownMenu 기반 액션 메뉴 UI
 *
 * 🔄 변경이력:
 * - 2026-01-27: 위험 액션만 남기고 Quick Actions로 분리 (UX 개선)
 */

const meta = {
  title: "UI/DetailPanelActionsMenu",
  component: DetailPanelActionsMenu,
  tags: ["autodocs"],
  argTypes: {
    object: {
      description: "Kubernetes 리소스 객체 (kind 확인용)",
    },
    onDelete: { action: "Delete clicked" },
    onForceDelete: { action: "Force Delete clicked" },
    onForceFinalize: { action: "Force Finalize clicked" },
    onCordon: { action: "Cordon clicked" },
    onUncordon: { action: "Uncordon clicked" },
    onDrain: { action: "Drain clicked" },
  },
} satisfies Meta<typeof DetailPanelActionsMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 🎯 Pod 리소스용 액션 메뉴 (Delete, Force Delete)
 */
export const PodActions: Story = {
  args: {
    object: {
      kind: "Pod",
      apiVersion: "v1",
    },
    onDelete: () => console.log("Delete Pod"),
    onForceDelete: () => console.log("Force Delete Pod"),
  },
};

/**
 * 🎯 Node 리소스용 액션 메뉴 (Cordon, Uncordon, Drain, Delete)
 */
export const NodeActions: Story = {
  args: {
    object: {
      kind: "Node",
      apiVersion: "v1",
    },
    onCordon: () => console.log("Cordon Node"),
    onUncordon: () => console.log("Uncordon Node"),
    onDrain: () => console.log("Drain Node"),
    onDelete: () => console.log("Delete Node"),
  },
};

/**
 * 🎯 Deployment 리소스용 액션 메뉴 (Delete만)
 */
export const DeploymentActions: Story = {
  args: {
    object: {
      kind: "Deployment",
      apiVersion: "apps/v1",
    },
    onDelete: () => console.log("Delete Deployment"),
  },
};

/**
 * 🎯 Force Finalize 액션 포함 (Finalizer 제거)
 */
export const WithForceFinalize: Story = {
  args: {
    object: {
      kind: "Namespace",
      apiVersion: "v1",
    },
    onForceFinalize: () => console.log("Force Finalize Namespace"),
    onDelete: () => console.log("Delete Namespace"),
  },
};

/**
 * 🎯 Delete만 제공
 */
export const DeleteOnly: Story = {
  args: {
    object: {
      kind: "Secret",
      apiVersion: "v1",
    },
    onDelete: () => console.log("Delete Secret"),
  },
};
