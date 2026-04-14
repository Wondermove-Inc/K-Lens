/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: KubeDataTable 컴포넌트의 TypeScript 타입 정의
 *
 * @remarks
 * 이 파일은 TanStack Table 기반 공통 데이터 테이블의 타입을 정의합니다.
 * Pod, Deployment, Service, HelmRelease 등 모든 리소스에서 재사용 가능합니다.
 *
 * 🔄 변경이력:
 * - 2025-10-29: 초기 생성 (공통 KubeDataTable 타입 시스템)
 * - 2025-10-31: KubeObject import 제거 (제네릭 타입으로 변경)
 * - 2025-10-31: KubeDataTable 반응형 레이아웃 수정 (width → minWidth)
 */

import type { ColumnDef, OnChangeFn, RowSelectionState } from "@tanstack/react-table";
import type React from "react";

/**
 * 🎯 목적: 컬럼 리사이징 상태를 localStorage에 저장하기 위한 타입
 *
 * @remarks
 * - key: 컬럼 ID (예: "name", "namespace", "status")
 * - value: 컬럼 너비 (픽셀 단위)
 */
export type ColumnSizingState = Record<string, number>;

/**
 * 🎯 목적: KubeDataTable 컴포넌트의 Props 인터페이스
 *
 * @typeParam T - 테이블 행 데이터 타입 (KubeObject, ItemObject 등)
 *
 * @remarks
 * 제네릭 타입으로 모든 리소스(Pod, Deployment, HelmRelease 등)를 지원합니다.
 *
 * 📝 주의사항:
 * - data는 MobX observable이 아닌 순수 배열이어야 함
 * - columns는 TanStack Table의 ColumnDef 형식 준수
 * - 컬럼 크기는 세션 동안만 유지됨 (새로고침 시 초기화)
 *
 * 🔄 변경이력:
 * - 2025-10-31: T extends KubeObject → T로 변경 (HelmRelease 등 비-KubeObject 타입 지원)
 */
export interface KubeDataTableProps<T = unknown> {
  /**
   * 테이블에 표시할 데이터 (순수 배열, MobX observable 아님)
   */
  data: T[];

  /**
   * TanStack Table 컬럼 정의 배열
   */
  columns: ColumnDef<T>[];

  /**
   * 컬럼 리사이징 활성화 여부 (기본값: true)
   */
  enableColumnResizing?: boolean;

  /**
   * 테이블 제목 (선택사항, 예: "Pods")
   */
  title?: string;

  /**
   * 빈 테이블일 때 표시할 메시지 (기본값: "No items found")
   */
  emptyMessage?: string;

  /**
   * 추가 CSS 클래스명
   */
  className?: string;

  /**
   * 행 클릭 핸들러 (상세정보 표시 등)
   * @param row - 클릭된 행의 데이터
   */
  onRowClick?: (row: T) => void;

  /**
   * 행 선택 활성화 여부 (기본값: false)
   */
  enableRowSelection?: boolean;

  /**
   * 선택된 행들의 변경 이벤트 핸들러
   * @param selectedRows - 선택된 행들의 데이터 배열
   */
  onSelectionChange?: (selectedRows: T[]) => void;

  /**
   * Dock(터미널) 높이 (픽셀 단위, 기본값: 0)
   * @remarks
   * Dock이 열려있을 때 테이블 maxHeight를 동적으로 조정하기 위해 사용
   */
  dockHeight?: number;

  /**
   * 테이블 위쪽 레이아웃 요소들의 총 높이 (픽셀 단위, 기본값: 200)
   * @remarks
   * 헤더, 탭, 메뉴 바, 여백 등의 높이 합계
   *
   * 계산 공식:
   * - ClusterManager Header: 40px
   * - StatusBar: 21px
   * - MainTabContainer: 36px
   * - 리소스별 상단 메뉴: 가변 (Pod의 경우 65px)
   * - 여백: 16px
   *
   * maxHeight = calc(100vh - tableOffset - dockHeight)
   *
   * @example
   * // Pod 목록의 경우
   * tableOffset={178}  // 40 + 21 + 36 + 65 + 16
   *
   * // 다른 리소스의 경우 (상단 메뉴가 다를 수 있음)
   * tableOffset={150}  // 실제 높이에 맞게 조정
   */
  tableOffset?: number;

  /**
   * 행 선택 상태 (외부에서 관리하는 경우)
   * @remarks
   * rowSelection과 setRowSelection을 함께 제공하면 외부에서 행 선택 상태를 관리할 수 있습니다.
   */
  rowSelection?: Record<string, boolean>;

  /**
   * 행 선택 상태 변경 핸들러 (외부에서 관리하는 경우)
   */
  setRowSelection?: OnChangeFn<RowSelectionState>;

  /**
   * 각 행의 고유 ID를 반환하는 함수
   * @remarks
   * 행 선택 기능을 사용할 때 권장됩니다. 제공하지 않으면 row index를 ID로 사용합니다.
   */
  getRowId?: (row: T) => string;

  /**
   * 페이지네이션 활성화 여부 (기본값: false)
   * @remarks
   * 활성화 시 스크롤 대신 페이지네이션 UI를 사용합니다.
   * CommonTable 스타일과 동일하게 구현됩니다.
   */
  enablePagination?: boolean;

  /**
   * 페이지당 기본 행 수 (기본값: 10)
   * @remarks
   * enablePagination이 true일 때만 사용됩니다.
   */
  defaultPageSize?: number;

  /**
   * 🎯 목적: 행 우클릭 시 표시할 컨텍스트 메뉴 렌더링 함수
   * @remarks
   * - 제공 시 Radix ContextMenu로 테이블 래핑
   * - 미제공 시 기존 동작 100% 유지 (breaking change 없음)
   * @param item - 우클릭된 행의 데이터
   * @returns 컨텍스트 메뉴 내용 (ContextMenuItem 등)
   */
  renderContextMenu?: (item: T) => React.ReactNode;

  /**
   * 🎯 목적: 디테일 패널에서 선택된 아이템
   * @remarks
   * row 클릭 시 해당 row에 선택 스타일(배경색 + 좌측 active bar) 적용
   * 체크박스 선택(row.getIsSelected())과는 별개의 단일 선택 상태
   *
   * 📝 주의사항:
   * - getRowId 함수가 제공되어야 정확한 비교 가능
   * - getRowId 미제공 시 참조 비교(===) 사용
   *
   * 🔄 변경이력:
   * - 2025-11-25: 초기 생성 (디테일 패널 row 선택 상태 유지 버그 수정)
   */
  selectedItem?: T;
}

/**
 * 🎯 목적: 컬럼 리사이징 헬퍼 함수의 반환 타입
 *
 * @remarks
 * useColumnResizing 커스텀 훅에서 반환하는 값의 타입입니다.
 * 컬럼 크기는 세션 동안만 유지됩니다 (새로고침 시 초기화).
 */
export interface ColumnResizingHelpers {
  /**
   * 현재 컬럼 크기 상태
   */
  columnSizing: ColumnSizingState;

  /**
   * 컬럼 크기 변경 핸들러
   */
  onColumnSizingChange: (updater: ColumnSizingState | ((old: ColumnSizingState) => ColumnSizingState)) => void;
}

/**
 * 🎯 목적: 테이블 행 액션 메뉴 아이템 타입
 *
 * @remarks
 * 각 행의 액션 메뉴(⋮ 버튼)에 표시할 항목을 정의합니다.
 *
 * 🔄 변경이력:
 * - 2025-10-31: T extends KubeObject → T로 변경 (모든 타입 지원)
 */
export interface RowAction<T = unknown> {
  /**
   * 액션 라벨 (예: "Delete", "Restart", "Edit YAML")
   */
  label: string;

  /**
   * 액션 실행 핸들러
   * @param row - 대상 행의 데이터
   */
  onClick: (row: T) => void;

  /**
   * 액션 아이콘 (lucide-react 아이콘 컴포넌트)
   */
  icon?: React.ComponentType<{ className?: string }>;

  /**
   * 위험한 액션 여부 (빨간색 표시, 기본값: false)
   */
  dangerous?: boolean;

  /**
   * 구분선 표시 여부 (이 항목 이전에 구분선 추가)
   */
  separator?: boolean;
}
