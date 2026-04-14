/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Kubernetes 리소스 테이블을 위한 공통 레이아웃 컴포넌트
 *
 * @remarks
 * - 상단 메뉴 바 (제목, 네임스페이스 필터, 검색) 제공
 * - shadcn UI 컴포넌트 기반 (Input)
 * - showNamespaceFilter로 네임스페이스 필터 표시 제어
 * - NamespaceSelectSingle 컴포넌트 사용 (namespaceStore 통합)
 * - children으로 KubeDataTable 전달
 *
 * 📝 주의사항:
 * - showNamespaceFilter=true일 때만 네임스페이스 필터 표시 (namespace-scoped 리소스)
 * - cluster-scoped 리소스는 showNamespaceFilter=false 또는 생략
 * - headerActions로 추가 액션 전달 가능 (확장성)
 * - 레이아웃만 제공하며 상태 관리는 부모 컴포넌트에서 처리
 *
 * 🔄 변경이력:
 * - 2025-10-31: 초기 생성 (CommonTable 패턴 기반)
 * - 2025-10-31: headerActions slot 방식으로 변경 (네임스페이스 관련 props 제거)
 * - 2025-11-01: namespaces props 추가 (통합 컴포넌트 방식, 빌드 에러 해결)
 * - 2025-11-01: NamespaceSelectSingle 컴포넌트 통합 (Events 패턴 기반)
 */

import { Input } from "@skuberplus/storybook-shadcn";
import { Search } from "lucide-react";
import React from "react";
import { NamespaceSelectMulti } from "../../namespaces/namespace-select-multi";

/**
 * 🎯 목적: ResourceTableLayout Props 인터페이스
 */
export interface ResourceTableLayoutProps {
  /**
   * 테이블 제목 (예: "Pods", "Deployments")
   */
  title: string;

  /**
   * 필터링된 아이템 개수
   */
  itemCount: number;

  /**
   * 검색 입력 값
   */
  searchValue: string;

  /**
   * 검색 입력 변경 콜백
   * @param value - 입력된 검색어
   */
  onSearchChange: (value: string) => void;

  /**
   * 검색 입력 placeholder (선택사항, 기본값: "Search...")
   */
  searchPlaceholder?: string;

  /**
   * 네임스페이스 필터 표시 여부 (선택사항)
   * - true: NamespaceSelectSingle 컴포넌트 표시 (namespace-scoped 리소스)
   * - false 또는 생략: 네임스페이스 필터 숨김 (cluster-scoped 리소스)
   */
  showNamespaceFilter?: boolean;

  /**
   * 헤더 추가 액션 (선택사항)
   * - 네임스페이스 필터 외 추가 컴포넌트 전달 가능
   */
  headerActions?: React.ReactNode;

  /**
   * 테이블 콘텐츠 (KubeDataTable 등)
   */
  children: React.ReactNode;

  /**
   * 추가 CSS 클래스
   */
  className?: string;
}

/**
 * 🎯 목적: Kubernetes 리소스 테이블을 위한 공통 레이아웃
 *
 * @param props - ResourceTableLayoutProps
 * @returns 상단 메뉴 바 + 테이블 레이아웃
 *
 * 📝 사용 예시 1 (Namespace-scoped 리소스):
 * ```typescript
 * <ResourceTableLayout
 *   title="Pods"
 *   itemCount={filteredPods.length}
 *   showNamespaceFilter={true}
 *   searchValue={searchValue}
 *   onSearchChange={setSearchValue}
 *   searchPlaceholder="Search pods..."
 * >
 *   <KubeDataTable data={filteredPods} columns={podColumns} />
 * </ResourceTableLayout>
 * ```
 *
 * 📝 사용 예시 2 (Cluster-scoped 리소스):
 * ```typescript
 * <ResourceTableLayout
 *   title="Priority Classes"
 *   itemCount={filteredItems.length}
 *   searchValue={searchValue}
 *   onSearchChange={setSearchValue}
 * >
 *   <KubeDataTable data={filteredItems} columns={columns} />
 * </ResourceTableLayout>
 * ```
 */
export function ResourceTableLayout({
  title,
  itemCount,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  showNamespaceFilter = false,
  headerActions,
  children,
  className = "",
}: ResourceTableLayoutProps) {
  // 🎯 itemCount에 따라 단/복수 표기
  const itemLabel = `${itemCount} ${itemCount === 1 ? "item" : "items"}`;

  return (
    <div className={`flex h-full w-full flex-col ${className}`}>
      {/* ============================================ */}
      {/* 🎯 상단 메뉴: 제목, 네임스페이스 필터, 검색, 헤더 액션 */}
      {/* ============================================ */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-5 px-5 py-4">
        {/* 왼쪽: 제목 및 아이템 개수 */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <h2 className="text-lg font-semibold">{title}</h2>
          <span className="text-sm !text-muted-foreground">{itemLabel}</span>
        </div>

        {/* 오른쪽: 네임스페이스 필터, 검색, 헤더 액션 */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          {/* 🎯 네임스페이스 필터 (namespace-scoped 리소스만 표시) */}
          {showNamespaceFilter && (
            <NamespaceSelectMulti id={`${title.toLowerCase().replace(/\s+/g, "-")}-namespace-select`} />
          )}

          {/* 🔍 검색 입력 (반응형 너비) */}
          <div className="relative w-full sm:w-48 md:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              data-search-input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" || e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="pl-8"
            />
          </div>

          {/* 🎯 추가 헤더 액션 (Delete 버튼 등, 검색 후 배치) */}
          {headerActions}
        </div>
      </div>

      {/* ============================================ */}
      {/* 📋 테이블 영역 (children) */}
      {/* ============================================ */}
      <div className="flex-1">{children}</div>
    </div>
  );
}
