/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "@skuberplus/storybook-shadcn/src/components/ui/empty";
import { MousePointer } from "lucide-react";
import React from "react";
import styles from "./empty-tabs-screen.module.scss";

/**
 * 🎯 목적: 모든 탭이 닫힐 때 표시되는 완전히 빈 화면
 *
 * @description
 * - 아무 내용도 표시하지 않는 완전한 빈 화면
 * - 배경색만 설정하여 깔끔한 UI 제공
 * - 불필요한 텍스트나 로고 없음
 *
 * 📝 주의사항:
 * - 탭이 하나도 없을 때만 표시됨
 * - 테마 시스템과 호환되도록 CSS 변수 사용
 *
 * 🔄 변경이력: 2025-09-26 - 빈 화면으로 단순화 (모든 내용 제거)
 */
export const EmptyTabsScreen: React.FC = () => {
  return (
    <div className={styles.emptyTabsScreen}>
      <div className="bg-background flex min-h-full w-full items-center justify-center p-5">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MousePointer />
            </EmptyMedia>
            <EmptyDescription>Click the resource you want to check.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  );
};
