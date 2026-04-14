/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: MobX 어댑터와 React Table을 안전하게 연결하는 브리지 컴포넌트
 *
 * @remarks
 * 계층 분리 패턴:
 * - WelcomeDataTableLoader (observer): MobX 어댑터에서 불변 스냅샷 추출
 * - WelcomeDataTableView (순수 React): React Table 렌더링
 *
 * 이 구조로 MobX observable과 React Table이 직접 접촉하지 않도록 격리.
 *
 * 🔄 변경이력: 2025-10-17 - 초기 생성 (MobX + React Table 브리지)
 */

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";
// 🎨 shadcn/ui 컴포넌트 imports (로컬 복사본)
import { Button } from "@/components/shadcn-ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn-ui/table";

import type { ClusterRowData, WelcomeClustersAdapter } from "./welcome-clusters-adapter";

// ============================================
// 🎯 컬럼 정의 (순수 JavaScript, MobX와 무관)
// ============================================

/**
 * 🎯 목적: 클러스터 상태별 색상 매핑
 *
 * 📝 주의사항:
 * - LensKubernetesClusterStatus enum의 모든 케이스 지원
 * - DELETING은 진행 중 작업이므로 orange 계열 사용
 * - 알 수 없는 상태는 red (error) 처리
 *
 * 🔄 변경이력: 2025-10-17 - DELETING 케이스 추가, Record 타입으로 리팩토링
 */
// 🎯 THEME-024: Semantic colors for cluster status
const STATUS_COLOR_MAP: Record<string, string> = {
  connected: "text-status-success",
  disconnected: "text-muted-foreground",
  connecting: "text-status-info",
  deleting: "text-status-warning", // ✨ DELETING 상태 - warning 색상 사용
};

const columns: ColumnDef<ClusterRowData>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Cluster Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      // 🎯 Record 타입 매핑 사용, 없으면 기본값 red (error)
      const statusColor = STATUS_COLOR_MAP[status] || "text-status-error";

      return <div className={`capitalize ${statusColor}`}>{status}</div>;
    },
  },
  {
    accessorKey: "kubeVersion",
    header: "Kubernetes Version",
    cell: ({ row }) => {
      const version = row.getValue("kubeVersion") as string | undefined;

      return <div>{version || "N/A"}</div>;
    },
  },
  {
    accessorKey: "distro",
    header: "Distribution",
    cell: ({ row }) => {
      const distro = row.getValue("distro") as string | undefined;

      return <div>{distro || "Unknown"}</div>;
    },
  },
];

// ============================================
// 🎯 순수 React 컴포넌트 (MobX observer 없음)
// ============================================

interface WelcomeDataTableViewProps {
  data: ClusterRowData[];
  initialSorting?: SortingState;
}

/**
 * 🎯 목적: React Table을 렌더링하는 순수 React 컴포넌트
 *
 * @param data - 불변 스냅샷 데이터 (toJS()로 변환된 순수 객체 배열)
 * @param initialSorting - 초기 정렬 상태 (선택사항)
 *
 * 📝 주의사항:
 * - MobX observer 적용 금지 (순수 React만 사용)
 * - data는 반드시 불변 객체여야 함
 * - useState로 정렬 상태 관리 (React Table 내부 상태)
 */
function WelcomeDataTableView({ data, initialSorting = [] }: WelcomeDataTableViewProps) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  return (
    <div className="w-full mt-6">
      <h2 className="text-lg font-semibold mb-4">Your Clusters</h2>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No clusters found. Add a cluster to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ============================================
// 🎯 MobX Observer 래퍼 (브리지 레이어)
// ============================================

interface WelcomeDataTableLoaderProps {
  adapter: WelcomeClustersAdapter;
}

/**
 * 🎯 목적: CatalogEntityRegistry 어댑터에서 불변 스냅샷을 추출하여 순수 React 컴포넌트에 전달
 *
 * @param adapter - WelcomeClustersAdapter 인스턴스
 *
 * 📝 주의사항:
 * - observer() HOC로 래핑하여 MobX 반응성 활성화
 * - useMemo 사용 금지: MobX observer가 직접 tableRows 변경 감지
 * - MobX observable을 직접 전달하지 않고 toJS() 변환된 스냅샷만 전달
 *
 * 🔄 동작 흐름:
 * 1. observer()가 adapter.tableRows 읽기를 감지
 * 2. CatalogEntityRegistry.filteredItems 변경 시 tableRows computed 재계산
 * 3. observer()가 자동으로 컴포넌트 재렌더링
 * 4. WelcomeDataTableView에 새로운 순수 객체 배열 전달
 *
 * 🔄 변경이력: 2025-10-17 - useMemo 제거 (MobX 자동 추적 활용)
 */
export const WelcomeDataTableLoader = observer(({ adapter }: WelcomeDataTableLoaderProps) => {
  // 🎯 MobX observer가 직접 tableRows 변경 감지
  // adapter.tableRows는 computed getter이므로 변경 시 자동 재렌더링
  const tableData = adapter.tableRows;

  return <WelcomeDataTableView data={tableData} />;
});
