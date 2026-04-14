/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: TanStack Table 기반 공통 Kubernetes 리소스 테이블 컴포넌트
 *
 * @remarks
 * - shadcn/ui 컴포넌트 사용 (기존 UI 스타일 완전 유지)
 * - TanStack Table 기능 추가 (컬럼 리사이징, 정렬, 필터링)
 * - Pod, Deployment, Service 등 모든 Kubernetes 리소스에서 재사용 가능
 * - Full-Width Resizable 패턴 (픽셀 기반 리사이징, 작은 화면은 가로 스크롤)
 *
 * 🔄 변경이력:
 * - 2025-10-29: 초기 생성
 * - 2025-10-31: Full-Width Resizable 패턴 적용 (TanStack Table 공식 권장)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@skuberplus/storybook-shadcn";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "@skuberplus/storybook-shadcn/src/components/ui/empty";
import { Input } from "@skuberplus/storybook-shadcn/src/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skuberplus/storybook-shadcn/src/components/ui/select";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Info } from "lucide-react";
import { reaction } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "../../shadcn-ui/context-menu";
import tableFocusManagerInjectable from "../../table/table-focus-manager.injectable";
import { useColumnResizing } from "./use-column-resizing";

import type { ItemObject } from "@skuberplus/list-layout";

import type { Cell } from "@tanstack/react-table";

import type { TableFocusManager } from "../../table/table-focus-manager";
import type { KubeDataTableProps } from "./types";

/**
 * 🎯 목적: 테이블 행 높이 상수 (px)
 * @remarks 페이지네이션 사용 시 maxHeight 계산에 사용
 */
const ROW_HEIGHT = 45;

/**
 * 🎯 목적: 테이블 헤더 높이 상수 (px)
 * @remarks 페이지네이션 사용 시 maxHeight 계산에 사용
 */
const HEADER_HEIGHT = 45;

/**
 * 🎯 목적: 페이지네이션 컨트롤 영역 여백 (px)
 * @remarks 터미널 dock과 겹침 방지용 추가 여백
 */
const PAGINATION_HEIGHT = 12;

/**
 * 🎯 목적: Kubernetes 리소스 및 기타 리소스를 표시하는 공통 데이터 테이블
 *
 * @typeParam T - 테이블 행 데이터 타입 (KubeObject, ItemObject 등)
 *
 * @param props - KubeDataTableProps
 * @returns React 컴포넌트
 *
 * 📝 주의사항:
 * - data는 MobX observable이 아닌 순수 배열이어야 함
 * - columns는 TanStack Table의 ColumnDef 형식 준수
 * - enableColumnResizing이 true일 때 컬럼 드래그로 크기 조절 가능
 * - 컬럼 크기는 세션 동안만 유지됨 (새로고침 시 초기화)
 *
 * 🔄 사용 예시:
 * ```typescript
 * // KubeObject 타입
 * <KubeDataTable
 *   data={pods}
 *   columns={podColumns}
 *   enableColumnResizing={true}
 *   title="Pods"
 *   onRowClick={(pod) => console.log(pod)}
 * />
 *
 * // ItemObject 타입 (HelmRelease 등)
 * <KubeDataTable
 *   data={releases}
 *   columns={releaseColumns}
 *   enableColumnResizing={true}
 * />
 * ```
 *
 * 🔄 변경이력:
 * - 2025-10-31: T extends KubeObject → T (HelmRelease 등 비-KubeObject 타입 지원)
 */
interface Dependencies {
  tableFocusManager: TableFocusManager;
}

const NonInjectedKubeDataTable = observer(function NonInjectedKubeDataTable<T = unknown>({
  tableFocusManager,
  data,
  columns,
  enableColumnResizing = true,
  title,
  emptyMessage = "No items found",
  className = "",
  onRowClick,
  enableRowSelection = false,
  onSelectionChange,
  dockHeight = 0,
  tableOffset = 200,
  rowSelection: externalRowSelection,
  setRowSelection: externalSetRowSelection,
  getRowId,
  enablePagination = false,
  defaultPageSize = 40,
  selectedItem,
  renderContextMenu,
}: KubeDataTableProps<T> & Dependencies) {
  // 🎯 정렬 상태 관리
  const [sorting, setSorting] = React.useState<SortingState>([]);

  // 🎯 페이지네이션 상태 관리
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize,
  });

  // 🎯 페이지 입력 필드 상태 관리 (null: 미편집 상태, string: 편집 중)
  const [pageInputValue, setPageInputValue] = React.useState<string | null>(null);

  // 🎯 행 선택 상태 관리 (내부 또는 외부)
  const [internalRowSelection, setInternalRowSelection] = React.useState({});
  const rowSelection = externalRowSelection !== undefined ? externalRowSelection : internalRowSelection;
  const setRowSelection = externalSetRowSelection !== undefined ? externalSetRowSelection : setInternalRowSelection;

  // 🎯 우클릭된 행 추적 (컨텍스트 메뉴용)
  const [contextRow, setContextRow] = React.useState<T | null>(null);

  // 🎯 컬럼 리사이징 상태 (세션 동안만 유지)
  const { columnSizing, onColumnSizingChange } = useColumnResizing();

  // 🎯 TanStack Table 초기화
  const table = useReactTable({
    data,
    columns,
    // 정렬
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    // 행 선택
    enableRowSelection,
    onRowSelectionChange: setRowSelection,
    getRowId,
    // 컬럼 리사이징
    enableColumnResizing,
    columnResizeMode: "onChange", // 실시간 리사이징
    onColumnSizingChange,
    // 페이지네이션
    ...(enablePagination && {
      getPaginationRowModel: getPaginationRowModel(),
      onPaginationChange: setPagination,
      autoResetPageIndex: false, // 🎯 데이터 변경 시 페이지 유지 (실시간 업데이트 대응)
    }),
    // 필수
    getCoreRowModel: getCoreRowModel(),
    // 상태
    state: {
      sorting,
      rowSelection,
      columnSizing,
      ...(enablePagination && { pagination }),
    },
  });

  // 🎯 선택된 행 변경 시 콜백 실행
  React.useEffect(() => {
    if (onSelectionChange) {
      const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);
      onSelectionChange(selectedRows);
    }
  }, [rowSelection, onSelectionChange, table]);

  // 🎯 TFM에 정렬된 전체 아이템 동기화
  React.useEffect(() => {
    const sortedRows = table.getSortedRowModel().rows;
    const items: ItemObject[] = sortedRows
      .map((row) => row.original)
      .filter(
        (item): item is T & ItemObject =>
          item != null && typeof (item as any).getId === "function" && typeof (item as any).getName === "function",
      );
    tableFocusManager.setItems(items);
  }, [data, sorting, tableFocusManager, table]);

  // 🎯 TFM에 페이지 크기 동기화 (Ctrl+F/B 페이지 이동용)
  React.useEffect(() => {
    if (enablePagination) {
      tableFocusManager.pageSize = pagination.pageSize;
    }
    return () => {
      tableFocusManager.pageSize = 0;
    };
  }, [enablePagination, pagination.pageSize, tableFocusManager]);

  // 🎯 언마운트 시 TFM 리셋
  React.useEffect(() => {
    return () => tableFocusManager.reset();
  }, [tableFocusManager]);

  // 🎯 포커스 인덱스 → 스크롤 + 페이지 전환
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    return reaction(
      () => tableFocusManager.focusedIndex,
      (idx) => {
        if (idx === null) return;

        // 페이지네이션: 포커스 행이 현재 페이지 밖이면 페이지 전환
        // functional updater로 항상 최신 pageIndex 참조 (stale closure 방지)
        if (enablePagination && pagination.pageSize > 0) {
          const targetPage = Math.floor(idx / pagination.pageSize);
          setPagination((prev) => {
            if (prev.pageIndex === targetPage) return prev;
            return { ...prev, pageIndex: targetPage };
          });
        }

        // DOM 스크롤
        requestAnimationFrame(() => {
          const container = tableContainerRef.current;
          if (!container) return;
          const rows = container.querySelectorAll("[data-table-row]");
          const displayIdx = enablePagination && pagination.pageSize > 0 ? idx % pagination.pageSize : idx;
          rows[displayIdx]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
      },
    );
  }, [tableFocusManager, enablePagination, pagination.pageSize]);

  return (
    <div className={`w-full px-5 ${className}`}>
      {/* 제목 (선택사항) */}
      {title && <h2 className="text-lg font-semibold mb-4">{title}</h2>}

      {/* 테이블 - 스토리북 CommonTable 스타일 적용 (원본과 동일) */}
      <div
        className="relative w-full overflow-hidden rounded-md border flex flex-col"
        style={{
          maxHeight: enablePagination
            ? `min(${ROW_HEIGHT * pagination.pageSize + HEADER_HEIGHT}px, calc(100vh - ${tableOffset}px - ${dockHeight}px - ${PAGINATION_HEIGHT}px))` // 🎯 페이지네이션: 행 수 또는 가용 공간 중 작은 값
            : `calc(100vh - ${tableOffset}px - ${dockHeight}px)`, // 🎯 스크롤: 뷰포트 기준 높이
        }}
      >
        {/* 🎯 테이블 스크롤 영역 - renderContextMenu 제공 시 ContextMenu로 조건부 래핑 */}
        {(() => {
          // 테이블 본체 (한 번만 정의, ContextMenu 유무와 무관하게 동일)
          const tableContent = (
            <div ref={tableContainerRef} className="overflow-auto flex-1 min-h-0">
              <Table enableResizing={enableColumnResizing} style={{ width: "100%" }} {...({} as any)}>
                {/* 헤더 - bg-muted 배경, border-b 제거, sticky 고정 */}
                <TableHeader className="bg-muted [&_tr]:border-b-0 sticky top-0 z-10">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="hover:bg-muted border-b bg-muted">
                      {headerGroup.headers.map((header) => {
                        return (
                          <TableHead
                            key={header.id}
                            className={header.id === "actions" ? "text-right" : "text-left"}
                            style={{
                              // 🎯 TanStack Table의 getSize()로 컬럼 너비 동적 적용
                              width: header.getSize(),
                            }}
                          >
                            <div className="relative [&_button]:!justify-start">
                              {/* 컬럼 내용 - 스토리북 스타일 (Button 직접 렌더링) */}
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}

                              {/* 컬럼 리사이징 핸들 - 스토리북 스타일 */}
                              {enableColumnResizing && header.column.getCanResize() && (
                                <div
                                  onMouseDown={header.getResizeHandler()}
                                  onTouchStart={header.getResizeHandler()}
                                  className="border-border hover:border-primary absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none border-r select-none"
                                  style={{
                                    transform: header.column.getIsResizing() ? "translateX(0.5px)" : "",
                                  }}
                                />
                              )}
                            </div>
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableHeader>

                {/* 바디 */}
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row, localRowIndex) => {
                      // 🎯 절대 인덱스 계산 (페이지네이션 고려)
                      const absoluteRowIndex = enablePagination
                        ? pagination.pageIndex * pagination.pageSize + localRowIndex
                        : localRowIndex;

                      // 🎯 체크박스 선택 상태
                      const isCheckboxSelected = row.getIsSelected();

                      // 🎯 디테일 패널 선택 상태 확인
                      const isDetailSelected =
                        selectedItem != null &&
                        (getRowId ? getRowId(row.original) === getRowId(selectedItem) : selectedItem === row.original);

                      // 🎯 체크박스 선택 또는 디테일 패널 선택 중 하나라도 선택되면 선택 상태
                      const isSelected = isCheckboxSelected || isDetailSelected;

                      // 🎯 키보드 포커스 상태
                      const isFocused = tableFocusManager.focusedIndex === absoluteRowIndex;

                      return (
                        <TableRow
                          key={row.id}
                          data-table-row
                          data-state={isSelected ? "selected" : undefined}
                          onContextMenu={renderContextMenu ? () => setContextRow(row.original) : undefined}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            const cellElement = target.closest("[data-column-id]");
                            const columnId = cellElement?.getAttribute("data-column-id");
                            if (columnId !== "select") {
                              tableFocusManager.setFocusedIndex(absoluteRowIndex);
                              onRowClick?.(row.original);
                            }
                          }}
                          className={`cursor-pointer transition-colors ${
                            isFocused
                              ? "ring-1 ring-primary ring-inset border-b-primary"
                              : isSelected
                                ? "bg-muted/50"
                                : "hover:bg-muted/50"
                          }`}
                        >
                          {row.getVisibleCells().map((cell: Cell<T, unknown>, cellIndex: number) => (
                            <TableCell
                              key={cell.id}
                              data-column-id={cell.column.id}
                              className="relative text-left"
                              style={{ width: cell.column.getSize() }}
                            >
                              {cellIndex === 0 && isSelected && (
                                <div className="bg-primary absolute top-0 left-0 h-full w-0.5" />
                              )}
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-[220px]">
                        <div className="flex h-full w-full items-center justify-center">
                          <Empty className="border-border">
                            <EmptyHeader>
                              <EmptyMedia variant="icon">
                                <Info />
                              </EmptyMedia>
                              <EmptyDescription>{emptyMessage}</EmptyDescription>
                            </EmptyHeader>
                          </Empty>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          );

          // renderContextMenu가 있으면 ContextMenu로 래핑, 없으면 그대로 렌더링
          return renderContextMenu ? (
            <ContextMenu
              onOpenChange={(open) => {
                if (!open) setContextRow(null);
              }}
            >
              <ContextMenuTrigger asChild>{tableContent}</ContextMenuTrigger>
              {contextRow && (
                <ContextMenuContent className="min-w-[200px]">{renderContextMenu(contextRow)}</ContextMenuContent>
              )}
            </ContextMenu>
          ) : (
            tableContent
          );
        })()}
      </div>

      {/* 페이지네이션 컨트롤 - CommonTable 스타일 (border 컨테이너 바깥) */}
      {enablePagination && (
        <div className="flex items-center justify-between px-5 mt-4">
          {/* 선택된 행 개수 표시 */}
          <div className="text-muted-foreground flex-1 text-sm">
            {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s)
            selected.
          </div>

          {/* 페이지 이동 버튼 */}
          <div className="flex items-center space-x-2">
            <div className="text-muted-foreground text-sm flex items-center gap-1">
              <span>Page</span>
              <Input
                type="number"
                min={1}
                max={table.getPageCount()}
                value={pageInputValue ?? table.getState().pagination.pageIndex + 1}
                onChange={(e) => setPageInputValue(e.target.value)}
                onBlur={() => {
                  if (pageInputValue === null || pageInputValue === "") {
                    setPageInputValue(null);
                    return;
                  }
                  const page = Math.max(1, Math.min(Number(pageInputValue), table.getPageCount()));
                  table.setPageIndex(page - 1);
                  setPageInputValue(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (pageInputValue === null || pageInputValue === "") {
                      setPageInputValue(null);
                      return;
                    }
                    const page = Math.max(1, Math.min(Number(pageInputValue), table.getPageCount()));
                    table.setPageIndex(page - 1);
                    setPageInputValue(null);
                  }
                }}
                className="h-8 w-14 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span>of {table.getPageCount()}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.firstPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-8 w-8 p-0"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.lastPage()}
              disabled={!table.getCanNextPage()}
              className="h-8 w-8 p-0"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Rows per page 선택 */}
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value: string) => {
                table.setPageSize(Number(value));
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={table.getState().pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
});

export const KubeDataTable = withInjectables<Dependencies, KubeDataTableProps<unknown>>(NonInjectedKubeDataTable, {
  getProps: (di, props) => ({
    ...props,
    tableFocusManager: di.inject(tableFocusManagerInjectable),
  }),
}) as <T>(props: KubeDataTableProps<T>) => React.ReactElement;
