/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Welcome 컴포넌트 shadcn 마이그레이션 버전
 *
 * 주요 변경사항:
 * - SCSS → Tailwind CSS 100% 변환
 * - HTML elements → shadcn/ui 컴포넌트 (Card, Button)
 * - @skuberplus/icon → lucide-react 아이콘 (로고 제외)
 * - MobX observer + DI 패턴 유지
 * - MainLayout wrapper 유지
 *
 * 📝 주의사항:
 * - 4개 DI 의존성 반드시 유지
 * - handleSyncKubeconfig 핸들러 유지
 * - Tailwind 시맨틱 색상 클래스 사용 (bg-background, text-foreground 등)
 *
 * 🔄 변경이력:
 * - 2025-10-21: 초기 생성 (shadcn 마이그레이션)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Icon } from "@skuberplus/icon";
import { CircleHelp, FolderSync, Plus } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";
// DAIVE 기존 시스템 imports
import navigateToAddClusterInjectable from "../../common/front-end-routing/routes/add-cluster/navigate-to-add-cluster.injectable";
import { forumsUrl } from "../../common/vars";
import productNameInjectable from "../../common/vars/product-name.injectable";
import openPathPickingDialogInjectable from "../../features/path-picking-dialog/renderer/pick-paths.injectable";
import { MainLayout } from "../components/layout/main-layout";
import { Sidebar } from "../components/layout/sidebar";
// shadcn/ui 컴포넌트 imports
import { Button } from "../components/shadcn-ui/button";
import { Card, CardContent, CardHeader } from "../components/shadcn-ui/card";
import { Hotbar } from "../components/shadcn-ui/hotbar";
import addSyncEntriesInjectable from "../initializers/add-sync-entries.injectable";

import type { OpenPathPickingDialog } from "../../features/path-picking-dialog/renderer/pick-paths.injectable";

export const defaultWidth = 320;

/**
 * 🎯 목적: Welcome 컴포넌트의 DI 의존성 인터페이스
 *
 * 📝 주의사항:
 * - 4개 의존성 모두 필수
 * - withInjectables에서 주입됨
 */
interface Dependencies {
  productName: string;
  navigateToAddCluster: () => void;
  openPathPickingDialog: OpenPathPickingDialog;
  addSyncEntries: (filePaths: string[]) => void;
}

/**
 * 🎯 목적: Welcome 컴포넌트 (DI 주입 전)
 *
 * 주요 기능:
 * - Header 섹션: 로고 + 제품명 + 설명
 * - Action Cards: kubeconfig 추가/동기화
 * - Help 섹션: Github 도움말 링크
 *
 * 📝 주의사항:
 * - MobX observer로 감싸서 Props 변경 시 자동 리렌더링
 * - MainLayout wrapper 반드시 유지
 */
const NonInjectedWelcomeShadcn = observer(
  ({ productName, navigateToAddCluster, openPathPickingDialog, addSyncEntries }: Dependencies) => {
    // 🔗 kubeconfig 파일 동기화 핸들러
    const handleSyncKubeconfig = () => {
      openPathPickingDialog({
        message: "Select kubeconfig file",
        buttonLabel: "Sync",
        properties: ["showHiddenFiles", "multiSelections", "openFile"],
        onPick: addSyncEntries,
      });
    };

    return (
      <MainLayout hotbar={<Hotbar />} sidebar={<Sidebar />}>
        {/* 🎯 메인 컨테이너: MainLayout이 제공하는 영역 내에서 중앙 정렬 */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-12 p-8">
          {/* ========================================
              🎯 Header 섹션: 로고 + 제목 + 설명
              ======================================== */}
          <div className="flex flex-col items-center gap-4">
            {/* 로고 + 제목 wrapper */}
            <div className="flex flex-col items-center gap-3">
              {/* 로고 (기존 Icon 컴포넌트 유지) */}
              <Icon svg="logo-lens" className="h-12 w-12" welcomeLogo data-testid="welcome-logo" />
              {/* 제목 (DI로 주입된 productName 사용) */}
              <h1 className="text-foreground text-4xl leading-none font-medium">{productName}</h1>
            </div>
            {/* 부제목 */}
            <p className="text-muted-foreground text-base leading-none">
              Kubernetes IDE · Simplified Cluster Management
            </p>
          </div>

          {/* ========================================
              🎯 Action Cards 섹션: kubeconfig 추가/동기화
              ======================================== */}
          <div className="flex items-center gap-4">
            {/* Card 1: Add from kubeconfig */}
            <Card className="w-[420px]">
              <CardHeader>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-base leading-none font-semibold">Add from kubeconfig</h3>
                  <p className="text-muted-foreground text-sm leading-5">
                    Add clusters directly from your kubeconfig file
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  <Button className="gap-2" onClick={() => navigateToAddCluster()}>
                    <Plus className="h-4 w-4" />
                    Add from kubeconfig
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Sync kubeconfig */}
            <Card className="w-[420px]">
              <CardHeader>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-base leading-none font-semibold">Sync kubeconfig</h3>
                  <p className="text-muted-foreground text-sm leading-5">
                    Automatically sync and manage your kubeconfig files
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  <Button className="gap-2" onClick={handleSyncKubeconfig}>
                    <FolderSync className="h-4 w-4" />
                    Sync kubeconfig
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ========================================
              🎯 Help 섹션: Github 도움말 링크
              ======================================== */}
          <div className="border-border flex w-[860px] items-start gap-4 rounded-lg border p-4">
            {/* 아이콘 영역 */}
            <div className="bg-muted border-border flex h-8 w-8 shrink-0 items-center justify-center rounded-md border">
              <CircleHelp className="h-4 w-4" />
            </div>

            {/* 콘텐츠 영역 */}
            <div className="flex flex-1 flex-col gap-1">
              <h4 className="text-sm font-medium">Need Help?</h4>
              <p className="text-muted-foreground text-sm leading-5">Get help and support from the community</p>
            </div>

            {/* 액션 영역 */}
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => window.open(forumsUrl, "_blank", "noreferrer")}>
                Get help on Github
              </Button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  },
);

/**
 * 🎯 목적: Welcome 컴포넌트 (DI 주입 완료)
 *
 * 📝 주의사항:
 * - withInjectables로 4개 의존성 자동 주입
 * - 외부에서는 이 컴포넌트만 사용
 */
export const WelcomeShadcn = withInjectables<Dependencies>(NonInjectedWelcomeShadcn, {
  getProps: (di) => ({
    productName: di.inject(productNameInjectable),
    navigateToAddCluster: di.inject(navigateToAddClusterInjectable),
    openPathPickingDialog: di.inject(openPathPickingDialogInjectable),
    addSyncEntries: di.inject(addSyncEntriesInjectable),
  }),
});
