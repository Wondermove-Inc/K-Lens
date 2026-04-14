/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: DetailPanel 전용 섹션 및 필드 컴포넌트
 *
 * @remarks
 * - DrawerTitle 대체: DetailPanelSection
 * - DrawerItem 대체: DetailPanelField, DetailPanelFieldGroup
 * - shadcn 스타일 기반 통일된 디자인
 *
 * 📝 주의사항:
 * - DetailPanel 내부에서만 사용
 * - 모든 DetailPanel이 이 컴포넌트를 사용하여 일관성 확보
 *
 * 🔄 변경이력:
 * - 2025-11-12: 초기 생성 (DrawerTitle/DrawerItem 레거시 대체)
 */

import React from "react";
import { cn } from "../../lib/utils";

/**
 * 🎯 목적: DetailPanel 섹션 제목 컴포넌트
 *
 * @remarks DrawerTitle 대체 컴포넌트
 *
 * @example
 * <DetailPanelSection title="Containers">
 *   {children}
 * </DetailPanelSection>
 */
export interface DetailPanelSectionProps {
  /**
   * 섹션 제목
   */
  title: string;

  /**
   * 섹션 내용 (필드, 테이블 등)
   */
  children: React.ReactNode;

  /**
   * 추가 CSS 클래스
   */
  className?: string;
}

export function DetailPanelSection({ title, children, className }: DetailPanelSectionProps) {
  return (
    <div className={cn("mt-8", className)}>
      <h3 className="text-base font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

/**
 * 🎯 목적: DetailPanel 필드 그룹 컨테이너
 *
 * @remarks
 * - 여러 DetailPanelField를 감싸는 컨테이너
 * - Grid 레이아웃과 border 스타일 적용
 *
 * @example
 * <DetailPanelFieldGroup>
 *   <DetailPanelField label="Status">Running</DetailPanelField>
 *   <DetailPanelField label="Image">nginx:latest</DetailPanelField>
 * </DetailPanelFieldGroup>
 */
export interface DetailPanelFieldGroupProps {
  /**
   * 필드들
   */
  children: React.ReactNode;

  /**
   * 추가 CSS 클래스
   */
  className?: string;
}

export function DetailPanelFieldGroup({ children, className }: DetailPanelFieldGroupProps) {
  return <div className={cn("flex flex-col", className)}>{children}</div>;
}

/**
 * 🎯 목적: DetailPanel 개별 필드 (key-value)
 *
 * @remarks DrawerItem 대체 컴포넌트
 *
 * @example
 * <DetailPanelField label="Image">
 *   <Badge>nginx:latest</Badge>
 * </DetailPanelField>
 */
export interface DetailPanelFieldProps {
  /**
   * 필드 라벨 (왼쪽)
   */
  label: string;

  /**
   * 필드 값 (오른쪽)
   */
  children: React.ReactNode;

  /**
   * 필드 숨김 여부
   */
  hidden?: boolean;

  /**
   * 추가 CSS 클래스
   */
  className?: string;
}

export function DetailPanelField({ label, children, hidden = false, className }: DetailPanelFieldProps) {
  if (hidden) {
    return null;
  }

  return (
    <div className={cn("grid grid-cols-[140px_1fr] gap-x-4 py-3 border-b border-border last:border-b-0", className)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}
