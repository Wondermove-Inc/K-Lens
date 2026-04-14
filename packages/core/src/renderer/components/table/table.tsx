/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./table.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { cssNames, isDefined } from "@skuberplus/utilities";
import assert from "assert";
import autoBindReact from "auto-bind/react";
import { computed, makeObservable } from "mobx";
import { observer } from "mobx-react";
import React, { Component, createRef } from "react";
import { VirtualList } from "../virtual-list";
import columnWidthStoreInjectable from "./column-width-store.injectable";
import orderByUrlParamInjectable from "./order-by-url-param.injectable";
import sortByUrlParamInjectable from "./sort-by-url-param.injectable";
import { getSorted } from "./sorting";
import { TableHead } from "./table-head";
import tableModelInjectable from "./table-model/table-model.injectable";
import { TableRow } from "./table-row";

import type { ItemObject } from "@skuberplus/list-layout";
import type { StrictReactNode } from "@skuberplus/utilities";

import type { PageParam } from "../../navigation/page-param";
import type { VirtualListRef } from "../virtual-list/virtual-list";
import type { ColumnWidthStore } from "./column-width-store";
import type { ExtendedTableCellProps, TableCellElem } from "./table-cell";
import type { TableHeadElem } from "./table-head";
import type { TableModel } from "./table-model/table-model";
import type { TableRowElem, TableRowProps } from "./table-row";

export type TableSortBy = string;
export type TableOrderBy = "asc" | "desc";
export interface TableSortParams {
  sortBy: TableSortBy;
  orderBy: TableOrderBy;
}
export type TableSortCallback<Item> = (data: Item) => undefined | string | number | (string | number)[];
export type TableSortCallbacks<Item> = Record<string, TableSortCallback<Item>>;

export interface TableProps<Item> extends React.DOMAttributes<HTMLDivElement> {
  /**
   * Used for persisting sort order and visible columns
   */
  tableId?: string;
  /**
   * The raw data for the table
   */
  items?: Item[];
  /**
   * Optional addition class names for the root HTML element
   */
  className?: string;
  /**
   * Setup auto-sizing for all columns (flex: 1 0)
   */
  autoSize?: boolean;
  /**
   * Highlight rows on hover
   */
  selectable?: boolean;
  /**
   * Use scrollbar if content is bigger than parent's height
   */
  scrollable?: boolean;
  /**
   * @deprecated Unused
   */
  storageKey?: string;
  /**
   * Define sortable callbacks for every column in `<TableHead><TableCell sortBy="someCol"></TableCell></TableHead>`
   * @sortItem argument in the callback is an object, provided in `<TableRow sortItem={someColDataItem}></TableRow>`
   */
  sortable?: TableSortCallbacks<Item>;
  /**
   * sorting state is managed globally from url params
   */
  sortSyncWithUrl?: boolean;
  /**
   * default sorting params
   */
  sortByDefault?: Partial<TableSortParams>;
  /**
   * callback on sort change
   *
   * Default: global sync with url
   */
  onSort?: (params: TableSortParams) => void;
  /**
   * This is shown when {@link TableProps.items} is empty
   */
  noItems?: StrictReactNode;
  /**
   * Allows to scroll list to selected item
   */
  selectedItemId?: string;

  /**
   * Use virtual list component to render only visible rows. By default uses a
   * auto sizer to fill available height
   */
  virtual?: boolean;
  /**
   * Only used when virtual is true. Sets the virtual list to be a fixed height.
   * Needed when used in contexts that already have a parent component that
   * is `overflow-y: scroll`,
   */
  virtualHeight?: number;
  /**
   * Row padding in pixels
   */
  rowPadding?: number;
  /**
   * Row line height in pixels
   */
  rowLineHeight?: number;
  customRowHeights?: (item: Item, lineHeight: number, paddings: number) => number;
  getTableRow?: (uid: string) => React.ReactElement<TableRowProps<Item>> | undefined | null;
  renderRow?: (item: Item) => React.ReactElement<TableRowProps<Item>> | undefined | null;
}

interface Dependencies {
  model: TableModel;
  columnWidthStore: ColumnWidthStore;
  sortByUrlParam: PageParam<string>;
  orderByUrlParam: PageParam<string>;
}

@observer
class NonInjectedTable<Item extends ItemObject> extends Component<TableProps<Item> & Dependencies> {
  static defaultProps: TableProps<any> = {
    scrollable: true,
    autoSize: true,
    rowPadding: 8,
    rowLineHeight: 17,
    sortSyncWithUrl: true,
    customRowHeights: (item, lineHeight, paddings) => lineHeight + paddings,
  };

  private virtualListRef = createRef<VirtualListRef>();
  constructor(props: TableProps<Item> & Dependencies) {
    super(props);
    makeObservable(this);
    autoBindReact(this);
  }

  componentDidMount() {
    const { sortable, tableId } = this.props;

    if (sortable && !tableId) {
      console.error("Table must have props.tableId if props.sortable is specified");
    }

    // 🎯 목적: 컬럼 설정 등록 및 저장된 너비 복원
    this.registerTableColumns();
    this.applyStoredColumnWidths();
  }

  /**
   * 🎯 목적: 테이블 컬럼들을 ColumnWidthStore에 등록
   */
  private registerTableColumns() {
    const { tableId, children } = this.props;

    if (!tableId) {
      return;
    }

    // 🔍 헤더에서 컬럼 정보 추출
    const content = React.Children.toArray(children) as (TableRowElem<Item> | TableHeadElem)[];
    const headElem = content.find((elem) => elem.type === TableHead);

    if (!headElem) {
      return;
    }

    const columns = React.Children.toArray(headElem.props.children) as TableCellElem[];
    const columnConfigs = columns.map((elem, index) => {
      // 🎯 체크박스 컬럼 처리
      if (elem.props.checkbox) {
        return {
          id: "checkbox",
          defaultWidth: 32, // 체크박스 고정 너비
          minWidth: 32,
          maxWidth: 32,
          resizable: false, // 체크박스는 리사이즈 불가능
        };
      }

      // 🎯 일반 컬럼 처리
      const columnId =
        elem.props.sortBy ||
        elem.props.id ||
        elem.props.className ||
        (typeof elem.props.children === "string"
          ? elem.props.children.toLowerCase().replace(/\s+/g, "-")
          : `column-${index}`);

      // 🎯 컬럼별 맞춤 기본 너비 설정
      const getDefaultWidth = (columnId: string): number => {
        const widthMap: { [key: string]: number } = {
          // Pod 테이블 전용 설정
          name: 200, // Pod 이름 (길어질 수 있음)
          ready: 80, // Ready 상태
          status: 120, // Status
          restarts: 80, // Restart 횟수
          "cpu-usage": 100, // CPU 사용량
          "memory-usage": 100, // Memory 사용량
          age: 80, // Age
          ip: 120, // IP 주소
          node: 150, // Node 이름
          containers: 90, // Container 수
          warning: 60, // Warning 아이콘
          // 기본값
          default: 120,
        };

        return widthMap[columnId] || widthMap["default"];
      };

      return {
        id: columnId,
        defaultWidth: getDefaultWidth(columnId),
        minWidth: columnId === "warning" ? 60 : 80,
        maxWidth: 1000,
        resizable: true,
      };
    });

    // 🎯 ColumnWidthStore에 테이블 등록
    this.props.columnWidthStore.registerTable(tableId, columnConfigs);
  }

  /**
   * 🎯 목적: CSS 변수로 컬럼 너비를 전역 적용 (가상화 호환)
   */
  private applyStoredColumnWidths() {
    const { tableId, columnWidthStore } = this.props;

    if (!tableId) {
      return;
    }

    // 🎯 CSS 변수를 document.documentElement에 설정하여 전역 적용
    const allColumnConfigs = columnWidthStore.getTableColumnConfigs?.(tableId);
    if (allColumnConfigs) {
      allColumnConfigs.forEach((config) => {
        const width = columnWidthStore.getColumnWidth(tableId, config.id);

        // 🔧 CSS 변수로 너비 설정 (모든 가상화된 행에 자동 적용됨)
        document.documentElement.style.setProperty(`--column-${config.id}-width`, `${width}px`);
      });
    } else {
      // 🔄 fallback: 저장된 너비만 적용
      const columnWidths = columnWidthStore.getTableColumnWidths(tableId);
      columnWidths.forEach((width, columnId) => {
        document.documentElement.style.setProperty(`--column-${columnId}-width`, `${width}px`);
      });
    }
  }

  @computed get isSortable() {
    const { sortable, tableId } = this.props;

    return Boolean(sortable && tableId);
  }

  @computed get sortParams() {
    const modelParams = this.props.tableId ? this.props.model.getSortParams(this.props.tableId) : {};

    return Object.assign({}, this.props.sortByDefault, modelParams);
  }

  /**
   * 🎯 목적: 컬럼 리사이즈 완료 시 ColumnWidthStore에 저장 및 CSS 변수 업데이트
   * @param tableId 테이블 ID
   * @param columnId 컬럼 ID
   * @param width 새로운 너비 (픽셀)
   */
  onColumnResize = (tableId: string, columnId: string, width: number) => {
    // 🎯 ColumnWidthStore에 상태 저장
    this.props.columnWidthStore.setColumnWidth(tableId, columnId, width);

    // 🎨 CSS 변수로 즉시 전역 적용 (모든 가상화된 행에 자동 적용)
    this.updateColumnWidthVariable(columnId, width);
  };

  /**
   * 🎯 목적: CSS 변수로 컬럼 너비 즉시 업데이트 (가상화 호환)
   * @param columnId 컬럼 식별자
   * @param width 새로운 너비
   */
  private updateColumnWidthVariable(columnId: string, width: number) {
    const variableName = `--column-${columnId}-width`;
    document.documentElement.style.setProperty(variableName, `${width}px`);
  }

  renderHead() {
    const { children } = this.props;
    const content = React.Children.toArray(children) as (TableRowElem<Item> | TableHeadElem)[];
    const headElem = content.find((elem) => elem.type === TableHead);

    if (!headElem) {
      return null;
    }

    if (this.isSortable) {
      const columns = React.Children.toArray(headElem.props.children) as TableCellElem[];

      return React.cloneElement(headElem, {
        children: columns.map((elem) => {
          if (elem.props.checkbox) {
            return elem;
          }
          const title =
            elem.props.title ||
            // copy cell content to title if it's a string
            // usable if part of TableCell's content is hidden when there is not enough space
            (typeof elem.props.children === "string" ? elem.props.children : undefined);

          // 🎯 컬럼 ID 생성 로직 개선: 더 정확한 식별자 생성
          const columnId =
            elem.props.sortBy ||
            elem.props.id ||
            elem.props.className ||
            (typeof elem.props.children === "string"
              ? elem.props.children.toLowerCase().replace(/\s+/g, "-")
              : "unknown");

          return React.cloneElement(elem, {
            title,
            _sort: this.sort,
            _sorting: this.sortParams,
            _nowrap: headElem.props.nowrap,
            tableId: this.props.tableId,
            columnId,
            onColumnResize: this.onColumnResize,
            "data-column-id": columnId,
          } as ExtendedTableCellProps);
        }),
      });
    }

    return headElem;
  }

  getSorted(rawItems: Item[]) {
    const { sortBy, orderBy } = this.sortParams;

    if (!sortBy || !orderBy) {
      return rawItems;
    }

    return getSorted(rawItems, this.props.sortable?.[sortBy], orderBy);
  }

  protected onSort({ sortBy, orderBy }: TableSortParams) {
    assert(this.props.tableId);
    this.props.model.setSortParams(this.props.tableId, { sortBy, orderBy });
    const { sortSyncWithUrl, onSort } = this.props;

    if (sortSyncWithUrl) {
      this.props.sortByUrlParam.set(sortBy);
      this.props.orderByUrlParam.set(orderBy);
    }

    onSort?.({ sortBy, orderBy });
  }

  sort(colName: TableSortBy) {
    const { sortBy, orderBy } = this.sortParams;
    const sameColumn = sortBy == colName;
    const newSortBy: TableSortBy = colName;
    const newOrderBy: TableOrderBy = !orderBy || !sameColumn || orderBy === "desc" ? "asc" : "desc";

    this.onSort({
      sortBy: String(newSortBy),
      orderBy: newOrderBy,
    });
  }

  private getContent() {
    const { items = [], renderRow, children } = this.props;
    const content = React.Children.toArray(children) as (TableRowElem<Item> | TableHeadElem)[];

    if (renderRow) {
      content.push(...items.map(renderRow).filter(isDefined));
    }

    return content;
  }

  renderRows() {
    const {
      noItems,
      virtual,
      customRowHeights,
      rowLineHeight,
      rowPadding,
      items = [],
      getTableRow,
      selectedItemId,
      className,
      virtualHeight,
    } = this.props;
    const content = this.getContent();
    let rows: React.ReactElement<TableRowProps<Item>>[] = content.filter((elem) => elem.type === TableRow);
    let sortedItems = (rows.length ? rows.map((row) => row.props.sortItem) : items).filter(isDefined);

    if (this.isSortable) {
      sortedItems = this.getSorted(sortedItems);

      if (rows.length) {
        rows = sortedItems.map((item) => rows.find((row) => item == row.props.sortItem)).filter(isDefined);
      }
    }

    if (!rows.length && !items.length && noItems) {
      return noItems;
    }

    if (virtual) {
      assert(customRowHeights && rowLineHeight && rowPadding);
      const rowHeights = sortedItems.map((item) => customRowHeights(item, rowLineHeight, rowPadding * 2));

      return (
        <VirtualList
          ref={this.virtualListRef}
          items={sortedItems}
          rowHeights={rowHeights}
          getRow={getTableRow}
          selectedItemId={selectedItemId}
          className={className}
          fixedHeight={virtualHeight}
        />
      );
    }

    return rows;
  }

  render() {
    const { selectable, scrollable, autoSize, virtual, className } = this.props;
    const classNames = cssNames("Table flex column", className, {
      selectable,
      scrollable,
      sortable: this.isSortable,
      autoSize,
      virtual,
    });

    return (
      <div className={classNames} data-table-id={this.props.tableId}>
        {this.renderHead()}
        {this.renderRows()}
      </div>
    );
  }
}

export const Table = withInjectables<Dependencies, TableProps<ItemObject>>(NonInjectedTable, {
  getProps: (di, props) => ({
    ...props,
    model: di.inject(tableModelInjectable),
    columnWidthStore: di.inject(columnWidthStoreInjectable),
    orderByUrlParam: di.inject(orderByUrlParamInjectable),
    sortByUrlParam: di.inject(sortByUrlParamInjectable),
  }),
}) as <Item>(props: TableProps<Item>) => React.ReactElement;
