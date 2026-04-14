/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@skuberplus/storybook-shadcn/src/components/ui/empty";
// 🎯 shadcn UI 컴포넌트 import
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skuberplus/storybook-shadcn/src/components/ui/table";
import {
  type ColumnDef,
  type ColumnSizingState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { CircleCheckBig, Loader2, TriangleAlert } from "lucide-react";
import { computed, makeObservable } from "mobx";
import { observer } from "mobx-react";
import React, { Component } from "react";
import apiManagerInjectable from "../../../common/k8s-api/api-manager/manager.injectable";
import eventStoreInjectable from "../events/store.injectable";
import kubeSelectedUrlParamInjectable from "../kube-detail-params/kube-selected-url.injectable";
import toggleKubeDetailsPaneInjectable from "../kube-detail-params/toggle-details.injectable";
import { KubeObjectAge } from "../kube-object/age";
import namespaceStoreInjectable from "../namespaces/store.injectable";
import nodeStoreInjectable from "../nodes/store.injectable";

import type { ApiManager } from "../../../common/k8s-api/api-manager";
import type { PageParam } from "../../navigation/page-param";
import type { EventStore } from "../events/store";
import type { ToggleKubeDetailsPane } from "../kube-detail-params/toggle-details.injectable";
import type { NamespaceStore } from "../namespaces/store";
import type { NodeStore } from "../nodes/store";

export interface ClusterIssuesProps {
  className?: string;
}

/**
 * 🎯 목적: Warning 데이터 타입 정의
 */
interface Warning {
  getId: () => string;
  getName: () => string;
  kind: string;
  message: string | undefined;
  selfLink: string;
  renderAge: () => React.ReactElement;
  ageMs: number;
}

/**
 * 🎯 목적: Warnings DataTable 컴포넌트 (TanStack Table 기반)
 * 🔄 변경: 컬럼 리사이징 기능 추가
 */
const WarningsDataTable = observer(
  ({
    warnings,
    kubeSelectedUrlParam,
    toggleKubeDetailsPane,
  }: {
    warnings: Warning[];
    kubeSelectedUrlParam: PageParam<string>;
    toggleKubeDetailsPane: ToggleKubeDetailsPane;
  }) => {
    // 🎯 컬럼 리사이징 상태 관리
    const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});

    // 🎯 컬럼 정의 (size: 기본 너비 설정)
    const columns: ColumnDef<Warning>[] = React.useMemo(
      () => [
        {
          accessorKey: "message",
          header: "Message",
          size: 300, // 🎯 기본 너비 (px)
          minSize: 100,
          // 🎯 방어적 코딩: 빈 문자열도 fallback 처리
          // 🔄 변경: max-w-0 제거 - 텍스트가 숨겨지는 문제 수정
          cell: ({ row }) => {
            const displayMessage = row.original.message || "<no message>";
            return (
              <div className="truncate" title={displayMessage}>
                {displayMessage}
              </div>
            );
          },
        },
        {
          accessorKey: "name",
          header: "Object",
          size: 180,
          minSize: 80,
          cell: ({ row }) => (
            <div className="truncate" title={row.original.getName()}>
              {row.original.getName()}
            </div>
          ),
        },
        {
          accessorKey: "kind",
          header: "Type",
          size: 120,
          minSize: 60,
          cell: ({ row }) => (
            <div className="truncate" title={row.original.kind}>
              {row.original.kind}
            </div>
          ),
        },
        {
          accessorKey: "age",
          header: "Age",
          size: 100,
          minSize: 60,
          cell: ({ row }) => row.original.renderAge(),
        },
      ],
      [],
    );

    // 🎯 TanStack Table 인스턴스 생성 (컬럼 리사이징 활성화)
    const table = useReactTable({
      data: warnings,
      columns,
      getCoreRowModel: getCoreRowModel(),
      // 🎯 컬럼 리사이징 설정
      enableColumnResizing: true,
      columnResizeMode: "onChange",
      onColumnSizingChange: setColumnSizing,
      state: {
        columnSizing,
      },
    });

    return (
      <Table
        enableResizing={true}
        containerClassName="rounded-md border overflow-auto max-h-[400px]"
        style={{ width: "100%" }}
      >
        <TableHeader className="bg-muted sticky top-0 z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-muted border-b bg-muted">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} style={{ width: header.getSize() }} className="relative">
                  <div className="relative">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    {/* 🎯 컬럼 리사이징 핸들 */}
                    {header.column.getCanResize() && (
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
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => {
            const isSelected = row.original.selfLink === kubeSelectedUrlParam.get();
            return (
              <TableRow
                key={row.id}
                className={`cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-muted/50 border-l-2 border-l-primary"
                    : "hover:bg-muted/50 border-l-2 border-l-transparent"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  toggleKubeDetailsPane(row.original.selfLink);
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  },
);

interface Dependencies {
  nodeStore: NodeStore;
  namespaceStore: NamespaceStore;
  eventStore: EventStore;
  apiManager: ApiManager;
  kubeSelectedUrlParam: PageParam<string>;
  toggleKubeDetailsPane: ToggleKubeDetailsPane;
}

/**
 * 🎯 목적: Cluster Issues (경고/에러) 테이블 컴포넌트
 * - Node와 Event에서 경고 메시지 수집
 * - shadcn UI Table 스타일 사용
 */
class NonInjectedClusterIssues extends Component<ClusterIssuesProps & Dependencies> {
  constructor(props: ClusterIssuesProps & Dependencies) {
    super(props);
    makeObservable(this);
  }

  async componentDidMount() {
    // 🎯 모든 네임스페이스의 이벤트를 로드하기 위해 명시적으로 빈 배열 전달
    await this.props.namespaceStore.loadAll({ namespaces: [] });
    const namespaces = this.props.namespaceStore.items.map((ns) => ns.getName());

    // 🎯 Node와 Event 스토어를 병렬로 로드 (KIND 클러스터 타이밍 이슈 해결)
    await Promise.all([this.props.nodeStore.loadAll(), this.props.eventStore.loadAll({ namespaces })]);
  }

  /**
   * 🎯 목적: Node 경고 + Event 경고 통합 목록 반환
   */
  @computed get warnings(): Warning[] {
    return [
      // Node 경고
      // 🎯 Node 경고: message가 없으면 reason, type 순으로 fallback
      ...this.props.nodeStore.items.flatMap((node) =>
        node.getWarningConditions().map(({ message, reason, type }) => ({
          selfLink: node.selfLink,
          getId: () => node.getId(),
          getName: () => node.getName(),
          kind: node.kind,
          message: message || reason || type || "<no message>",
          renderAge: () => <KubeObjectAge key="age" object={node} />,
          ageMs: -node.getCreationTimestamp(),
        })),
      ),
      // 🎯 Event 경고: message가 없으면 reason 순으로 fallback
      ...this.props.eventStore.getWarnings().map((warning) => ({
        getId: () => warning.involvedObject.uid,
        getName: () => warning.involvedObject.name,
        renderAge: () => <KubeObjectAge key="age" object={warning} />,
        ageMs: -warning.getCreationTimestamp(),
        message: warning.message || warning.reason || "<no message>",
        kind: warning.kind,
        selfLink: this.props.apiManager.lookupApiLink(warning.involvedObject, warning),
      })),
    ];
  }

  /**
   * 🎯 목적: 테이블 콘텐츠 렌더링
   * - 로딩 중: Empty 컴포넌트
   * - 경고 없음: 성공 메시지
   * - 경고 있음: shadcn Table
   */
  renderContent() {
    const { warnings } = this;
    const { kubeSelectedUrlParam, toggleKubeDetailsPane } = this.props;

    // 로딩 중 (eventStore와 nodeStore 모두 로드 완료 대기)
    if (!this.props.eventStore.isLoaded || !this.props.nodeStore.isLoaded) {
      return (
        <Empty className="h-[300px]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>Loading Warnings...</EmptyTitle>
            <EmptyDescription>Collecting cluster issue data...</EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    // 경고 없음
    if (!warnings.length) {
      return (
        <Empty className="h-[300px]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {/* 🎯 THEME-024: Semantic color for no issues indicator */}
              <CircleCheckBig className="h-6 w-6 text-status-success" />
            </EmptyMedia>
            <EmptyTitle>No Issues Found</EmptyTitle>
            <EmptyDescription>Everything is fine in the Cluster</EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    // 경고 있음 - DataTable 컴포넌트 사용
    return (
      <div className="space-y-4">
        {/* 헤더 - 🎯 THEME-024: Semantic color for warnings */}
        <div className="flex items-center gap-2">
          <TriangleAlert className="h-4 w-4 text-status-warning" />
          <h3 className="text-sm font-medium text-status-warning">Warnings: {warnings.length}</h3>
        </div>

        {/* DataTable (TanStack Table 기반) */}
        <WarningsDataTable
          warnings={warnings}
          kubeSelectedUrlParam={kubeSelectedUrlParam}
          toggleKubeDetailsPane={toggleKubeDetailsPane}
        />
      </div>
    );
  }

  render() {
    return <div className={`flex flex-col ${this.props.className || ""}`}>{this.renderContent()}</div>;
  }
}

export const ClusterIssues = withInjectables<Dependencies, ClusterIssuesProps>(observer(NonInjectedClusterIssues), {
  getProps: (di, props) => ({
    ...props,
    apiManager: di.inject(apiManagerInjectable),
    eventStore: di.inject(eventStoreInjectable),
    namespaceStore: di.inject(namespaceStoreInjectable),
    nodeStore: di.inject(nodeStoreInjectable),
    kubeSelectedUrlParam: di.inject(kubeSelectedUrlParamInjectable),
    toggleKubeDetailsPane: di.inject(toggleKubeDetailsPaneInjectable),
  }),
});
