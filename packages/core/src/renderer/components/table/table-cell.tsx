/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./table-cell.scss";

import { Icon } from "@skuberplus/icon";
import { cssNames } from "@skuberplus/utilities";
import autoBindReact from "auto-bind/react";
import React, { Component } from "react";
import { Checkbox } from "../checkbox";

import type { TableCellProps } from "@skuberplus/list-layout";

export interface ExtendedTableCellProps extends TableCellProps {
  tableId?: string;
  columnId?: string;
  onColumnResize?: (tableId: string, columnId: string, width: number) => void;
}

export type TableCellElem = React.ReactElement<TableCellProps>;

interface TableCellState {
  isResizing: boolean;
  startX: number;
  startWidth: number;
  currentWidth: number;
  isSaving: boolean;
}

export class TableCell extends Component<ExtendedTableCellProps, TableCellState> {
  private cellRef = React.createRef<HTMLDivElement>();
  private resizeAnimationFrame: number | null = null;

  // 🎯 상태 기반 시스템: UX 개선된 debounced 저장
  private debouncedSaveWidth = this.debounce((width: number) => {
    const { tableId, columnId, onColumnResize } = this.props;
    if (tableId && columnId && onColumnResize) {
      this.setState({ isSaving: true });
      onColumnResize(tableId, columnId, width);

      // 🎯 저장 완료 피드백 (짧은 시간 후 저장 상태 해제)
      setTimeout(() => {
        this.setState({ isSaving: false });
      }, 300);
    }
  }, 150); // 150ms 대기 후 상태 저장 (응답성 향상)

  constructor(props: ExtendedTableCellProps) {
    super(props);
    autoBindReact(this);
    this.state = {
      isResizing: false,
      startX: 0,
      startWidth: 0,
      currentWidth: 0,
      isSaving: false,
    };
  }

  /**
   * 🎯 목적: Debouncing 함수 구현 (최종 상태에서만 실행)
   * @param func 실행할 함수
   * @param wait 대기 시간 (ms)
   */
  private debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
    let timeout: NodeJS.Timeout | null = null;

    return ((...args: any[]) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        func.apply(this, args);
      }, wait);
    }) as T;
  }

  onClick(evt: React.MouseEvent<HTMLDivElement>) {
    const { _sort, sortBy, onClick } = this.props;

    // 🎯 목적: 리사이즈 핸들 클릭 시 정렬 이벤트 차단
    if (
      this.state.isResizing ||
      (evt.target instanceof HTMLElement && evt.target.classList.contains("resize-handle"))
    ) {
      evt.stopPropagation();
      return;
    }

    onClick?.(evt);

    if (_sort && typeof sortBy === "string") {
      _sort(sortBy);
    }
  }

  /**
   * 🎯 목적: 리사이즈 드래그 시작 처리 (최적화 버전)
   * @param evt 마우스 이벤트
   */
  onResizeStart(evt: React.MouseEvent<HTMLDivElement>) {
    evt.preventDefault();
    evt.stopPropagation();

    const startX = evt.clientX;
    const startWidth = this.cellRef.current?.getBoundingClientRect().width || 0;

    this.setState({
      isResizing: true,
      startX,
      startWidth,
      currentWidth: startWidth,
    });

    // 🎨 리사이즈 중 시각적 상태 추가
    if (this.cellRef.current) {
      this.cellRef.current.classList.add("resizing");
    }

    // 🔄 전역 마우스 이벤트 리스너 추가
    document.addEventListener("mousemove", this.onResizeMove);
    document.addEventListener("mouseup", this.onResizeEnd);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  /**
   * 🎯 목적: 리사이즈 드래그 중 처리 (상태 기반 버전)
   * @param evt 마우스 이벤트
   */
  onResizeMove(evt: MouseEvent) {
    if (!this.state.isResizing || !this.cellRef.current) return;

    // 🔄 이전 애니메이션 프레임 취소
    if (this.resizeAnimationFrame) {
      cancelAnimationFrame(this.resizeAnimationFrame);
    }

    // 🎯 requestAnimationFrame으로 부드러운 업데이트
    this.resizeAnimationFrame = requestAnimationFrame(() => {
      if (!this.cellRef.current) return;

      const deltaX = evt.clientX - this.state.startX;
      const newWidth = Math.max(50, this.state.startWidth + deltaX); // 🛡️ 최소 50px 제한

      // 🎯 실시간 너비 상태 업데이트 (UX 피드백)
      this.setState({ currentWidth: newWidth });

      // 🎯 상태 기반: debounced 저장으로 성능 최적화
      this.debouncedSaveWidth(newWidth);
    });
  }

  /**
   * 🎯 목적: 리사이즈 드래그 종료 처리 (상태 기반 버전)
   */
  onResizeEnd() {
    if (!this.state.isResizing || !this.cellRef.current) return;

    // 🔄 애니메이션 프레임 정리
    if (this.resizeAnimationFrame) {
      cancelAnimationFrame(this.resizeAnimationFrame);
      this.resizeAnimationFrame = null;
    }

    // 🎨 리사이즈 시각적 상태 제거
    this.cellRef.current.classList.remove("resizing");

    // 🎯 최종 너비를 상태에 즉시 저장 (상태 기반 동기화)
    const finalWidth = this.cellRef.current.getBoundingClientRect().width;
    const { tableId, columnId, onColumnResize } = this.props;
    if (tableId && columnId && onColumnResize) {
      onColumnResize(tableId, columnId, finalWidth);
    }

    this.setState({ isResizing: false });

    // 🔄 전역 이벤트 리스너 정리
    document.removeEventListener("mousemove", this.onResizeMove);
    document.removeEventListener("mouseup", this.onResizeEnd);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }

  componentWillUnmount() {
    // 🛡️ 컴포넌트 언마운트 시 정리 작업 (메모리 누수 방지)
    document.removeEventListener("mousemove", this.onResizeMove);
    document.removeEventListener("mouseup", this.onResizeEnd);

    // 🔄 애니메이션 프레임 정리
    if (this.resizeAnimationFrame) {
      cancelAnimationFrame(this.resizeAnimationFrame);
      this.resizeAnimationFrame = null;
    }
  }

  renderSortIcon() {
    const { sortBy, _sorting } = this.props;

    if (!_sorting || !sortBy) {
      return null;
    }

    const sortActive = _sorting.sortBy === sortBy;
    const sortIconName = !sortActive || _sorting.orderBy === "desc" ? "arrow_drop_down" : "arrow_drop_up";

    return <Icon className={cssNames("sortIcon", { enabled: sortActive })} material={sortIconName} />;
  }

  renderCheckbox() {
    const { checkbox, isChecked } = this.props;
    const showCheckbox = isChecked !== undefined;

    if (checkbox && showCheckbox) {
      return <Checkbox value={isChecked} />;
    }

    return null;
  }

  /**
   * 🎯 목적: 컬럼 리사이즈 핸들 렌더링 (UX 개선 버전)
   */
  renderResizeHandle() {
    const { _sort, className, columnId } = this.props;
    const { isResizing, currentWidth, isSaving } = this.state;

    // 🚫 리사이즈 불가능한 컬럼들은 핸들 표시 안 함 (className 또는 columnId 기반)
    const nonResizableColumns = ["warning", "ready", "status"];
    if (
      (className && nonResizableColumns.includes(className)) ||
      (columnId && nonResizableColumns.includes(columnId))
    ) {
      return null;
    }

    // 🎯 정렬 가능한 헤더 셀에서만 표시
    if (!_sort) return null;

    const columnName = columnId || className || "컬럼";
    const baseTitle = `${columnName} 너비 조정`;

    // 🎯 실시간 상태에 따른 툴팁 텍스트
    let title = baseTitle;
    if (isResizing) {
      title = `${baseTitle} (현재: ${Math.round(currentWidth)}px)`;
    } else if (isSaving) {
      title = `${columnName} 저장 중...`;
    }

    return (
      <div
        className={`resize-handle ${isResizing ? "resizing" : ""} ${isSaving ? "saving" : ""}`}
        onMouseDown={this.onResizeStart}
        title={title}
      >
        {/* 🎯 실시간 너비 표시 (리사이즈 중에만) */}
        {isResizing && <div className="resize-tooltip">{Math.round(currentWidth)}px</div>}

        {/* 💾 저장 상태 표시 */}
        {isSaving && <div className="save-indicator">✓</div>}
      </div>
    );
  }

  render() {
    const {
      className,
      checkbox,
      isChecked,
      scrollable,
      sortBy,
      _sort,
      _sorting,
      _nowrap,
      children,
      title,
      showWithColumn,
      ...cellProps
    } = this.props;

    const classNames = cssNames("TableCell", className, {
      checkbox,
      scrollable,
      nowrap: _nowrap,
      sorting: _sort && typeof sortBy === "string",
    });
    const content = title || children;

    return (
      <div {...cellProps} ref={this.cellRef} className={classNames} onClick={this.onClick}>
        {this.renderCheckbox()}
        {_nowrap ? <div className="content">{content}</div> : content}
        {this.renderSortIcon()}
        {this.renderResizeHandle()}
      </div>
    );
  }
}
