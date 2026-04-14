/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { useState } from "react";
import { Button } from "./button";
import { DetailPanel } from "./detail-panel";

import type { Meta, StoryObj } from "@storybook/react";

/**
 * 🎯 목적: DetailPanel 컴포넌트 Storybook 스토리
 *
 * @remarks
 * - shadcn UI 기반 우측 슬라이드 패널
 * - 액션 메뉴 통합 (Edit, Delete, Shell, Logs, Attach)
 * - Pod와 일반 리소스의 메뉴 차이 확인
 */

const meta = {
  title: "UI/DetailPanel",
  component: DetailPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof DetailPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 🎯 Pod 디테일 패널 (모든 액션 메뉴 포함)
 */
export const PodDetailWithActions: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <>
        <Button onClick={() => setIsOpen(true)}>Open Pod Detail Panel</Button>
        <DetailPanel
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="nginx-deployment-abc123"
          subtitle="Namespace: default"
          object={{
            kind: "Pod",
            apiVersion: "v1",
          }}
          onEdit={() => console.log("Edit Pod")}
          onDelete={() => console.log("Delete Pod")}
          onShell={() => console.log("Open Pod Shell")}
          onLogs={() => console.log("View Pod Logs")}
          onAttach={() => console.log("Attach to Pod")}
        >
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Status</h3>
              <p className="text-sm text-muted-foreground">Running</p>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">IP Address</h3>
              <p className="text-sm text-muted-foreground">10.244.0.5</p>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Node</h3>
              <p className="text-sm text-muted-foreground">node-1</p>
            </div>
          </div>
        </DetailPanel>
      </>
    );
  },
};

/**
 * 🎯 Deployment 디테일 패널 (Edit, Delete만)
 */
export const DeploymentDetailWithActions: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <>
        <Button onClick={() => setIsOpen(true)}>Open Deployment Detail Panel</Button>
        <DetailPanel
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="nginx-deployment"
          subtitle="Namespace: default"
          object={{
            kind: "Deployment",
            apiVersion: "apps/v1",
          }}
          onEdit={() => console.log("Edit Deployment")}
          onDelete={() => console.log("Delete Deployment")}
        >
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Replicas</h3>
              <p className="text-sm text-muted-foreground">3 / 3</p>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Strategy</h3>
              <p className="text-sm text-muted-foreground">RollingUpdate</p>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Selector</h3>
              <p className="text-sm text-muted-foreground">app=nginx</p>
            </div>
          </div>
        </DetailPanel>
      </>
    );
  },
};

/**
 * 🎯 액션 메뉴 없는 기본 패널
 */
export const BasicDetailPanel: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <>
        <Button onClick={() => setIsOpen(true)}>Open Basic Detail Panel</Button>
        <DetailPanel isOpen={isOpen} onClose={() => setIsOpen(false)} title="Basic Panel" subtitle="No actions menu">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">This is a basic detail panel without action menu.</p>
          </div>
        </DetailPanel>
      </>
    );
  },
};
