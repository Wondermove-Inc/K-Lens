/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./list.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Spinner } from "@skuberplus/spinner";
import { array, cssNames } from "@skuberplus/utilities";
import AnsiUp from "ansi_up";
import autoBindReact from "auto-bind/react";
import DOMPurify from "dompurify";
import debounce from "lodash/debounce";
import { action, computed, makeObservable, observable, reaction } from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";
import moment from "moment-timezone";
import React, { Component } from "react";
import userPreferencesStateInjectable from "../../../../features/user-preferences/common/state.injectable";
import { SearchStore } from "../../../search-store/search-store";
import { VirtualList } from "../../virtual-list";
import { detectLogLevel, formatTimestamp, getLogLevelClassName } from "./log-utils";
import { ALL_CONTAINERS } from "./tab-store";
import { ToBottom } from "./to-bottom";

import type { ForwardedRef } from "react";
import type { Align, ListOnScrollProps } from "react-window";

import type { UserPreferencesState } from "../../../../features/user-preferences/common/state.injectable";
import type { VirtualListRef } from "../../virtual-list";
import type { LogTabViewModel } from "../logs/logs-view-model";

export interface LogListProps {
  model: LogTabViewModel;
  tabId: string;
  isVisible: boolean;
}

/**
 * 탭별 스크롤 상태 저장소
 * 탭 전환 시 스크롤 위치와 isLastLineVisible 상태를 유지하기 위해 사용
 */
const scrollStateByTabId = new Map<
  string,
  {
    scrollOffset: number;
    isLastLineVisible: boolean;
  }
>();

/**
 * 탭 닫힘 시 저장된 스크롤 상태 정리
 */
export function clearScrollStateForTab(tabId: string): void {
  scrollStateByTabId.delete(tabId);
}

const colorConverter = new AnsiUp();

// 🎯 ANSI 색상을 inline style 대신 CSS 클래스로 변환
// 이렇게 해야 로그 레벨별 CSS 색상이 적용됨 (inline style이 CSS를 덮어쓰는 문제 방지)
colorConverter.use_classes = true;

export interface LogListRef {
  scrollToItem: (index: number, align: Align) => void;
}

interface Dependencies {
  state: UserPreferencesState;
}

@observer
class NonForwardedLogList extends Component<Dependencies & LogListProps & { innerRef: ForwardedRef<LogListRef> }> {
  @observable isJumpButtonVisible = false;
  @observable isLastLineVisible = true;

  private virtualListDiv = React.createRef<HTMLDivElement>(); // A reference for outer container in VirtualList
  private virtualListRef = React.createRef<VirtualListRef>(); // A reference for VirtualList component
  private lineHeight = 18; // Height of a log line. Should correlate with styles in pod-log-list.scss

  /**
   * 스크롤 복원 중 플래그 - 복원 완료 전까지 자동 스크롤 방지
   */
  private isRestoringScroll = false;

  constructor(props: any) {
    super(props);
    makeObservable(this);
    autoBindReact(this);
  }

  componentDidMount() {
    disposeOnUnmount(this, [
      reaction(
        () => this.props.model.logs.get(),
        (logs, prevLogs) => {
          this.onLogsInitialLoad(logs, prevLogs);
          this.onLogsUpdate();
          this.onUserScrolledUp(logs, prevLogs);
        },
      ),
    ]);
    this.bindInnerRef({
      scrollToItem: this.scrollToItem,
    });
  }

  /**
   * DOM 업데이트 전에 스크롤 위치 캡처
   * display: none이 적용되면 scrollTop이 0이 되므로, 그 전에 저장해야 함
   */
  getSnapshotBeforeUpdate(prevProps: Dependencies & LogListProps & { innerRef: ForwardedRef<LogListRef> }) {
    // 탭이 비활성화되기 직전에 스크롤 위치 캡처
    if (prevProps.isVisible && !this.props.isVisible) {
      const scrollOffset = this.virtualListDiv.current?.scrollTop ?? 0;

      console.log(
        `[LogList:${this.props.tabId}] getSnapshotBeforeUpdate: capturing offset=${scrollOffset}, isLastLineVisible=${this.isLastLineVisible}`,
      );

      return {
        scrollOffset,
        isLastLineVisible: this.isLastLineVisible,
      };
    }

    return null;
  }

  componentDidUpdate(
    prevProps: Dependencies & LogListProps & { innerRef: ForwardedRef<LogListRef> },
    _prevState: unknown,
    snapshot: { scrollOffset: number; isLastLineVisible: boolean } | null,
  ) {
    this.bindInnerRef({
      scrollToItem: this.scrollToItem,
    });

    // 🔍 DEBUG: visibility 변경 추적
    if (prevProps.isVisible !== this.props.isVisible) {
      console.log(`[LogList:${this.props.tabId}] visibility changed: ${prevProps.isVisible} → ${this.props.isVisible}`);
    }

    // 탭이 비활성화될 때 스크롤 위치 저장 (snapshot에서 가져옴)
    if (snapshot) {
      console.log(`[LogList:${this.props.tabId}] SAVING scroll state from snapshot: offset=${snapshot.scrollOffset}`);
      scrollStateByTabId.set(this.props.tabId, snapshot);
    }

    // 탭이 활성화될 때 스크롤 위치 복원
    if (!prevProps.isVisible && this.props.isVisible) {
      console.log(`[LogList:${this.props.tabId}] RESTORING scroll state`);
      this.restoreScrollState();
    }
  }

  componentWillUnmount() {
    this.bindInnerRef(null);
  }

  private bindInnerRef(value: LogListRef | null) {
    if (typeof this.props.innerRef === "function") {
      this.props.innerRef(value);
    } else if (this.props.innerRef && typeof this.props.innerRef === "object") {
      this.props.innerRef.current = value;
    }
  }

  onLogsInitialLoad(logs: string[], prevLogs: string[]) {
    if (!prevLogs.length && logs.length) {
      // 복원 중이거나 저장된 상태가 있으면 초기 로드 시 isLastLineVisible을 true로 강제하지 않음
      if (!this.isRestoringScroll && !scrollStateByTabId.has(this.props.tabId)) {
        console.log(`[LogList:${this.props.tabId}] onLogsInitialLoad: setting isLastLineVisible = true`);
        this.isLastLineVisible = true;
      } else {
        console.log(
          `[LogList:${this.props.tabId}] onLogsInitialLoad: SKIPPED (isRestoringScroll=${this.isRestoringScroll}, hasSavedState=${scrollStateByTabId.has(this.props.tabId)})`,
        );
      }
    }
  }

  onLogsUpdate() {
    // 탭이 비활성 상태면 스크롤하지 않음
    if (!this.props.isVisible) {
      console.log(`[LogList:${this.props.tabId}] onLogsUpdate: SKIPPED (not visible)`);

      return;
    }

    // 스크롤 복원 중이면 자동 스크롤 스킵
    if (this.isRestoringScroll) {
      console.log(`[LogList:${this.props.tabId}] onLogsUpdate: SKIPPED (isRestoringScroll=true)`);

      return;
    }

    if (this.isLastLineVisible) {
      console.log(`[LogList:${this.props.tabId}] onLogsUpdate: scheduling scrollToBottom (isLastLineVisible=true)`);
      setTimeout(() => {
        // 복원 중이면 scrollToBottom 스킵
        // setTimeout 예약 후 restoreScrollState()가 호출되어 isRestoringScroll=true가 될 수 있음
        if (this.isRestoringScroll) {
          console.log(`[LogList:${this.props.tabId}] onLogsUpdate: scrollToBottom SKIPPED (restoring)`);

          return;
        }
        console.log(`[LogList:${this.props.tabId}] onLogsUpdate: executing scrollToBottom`);
        this.scrollToBottom();
      }, 500); // Giving some time to VirtualList to prepare its outerRef (this.virtualListDiv) element
    } else {
      console.log(`[LogList:${this.props.tabId}] onLogsUpdate: no scroll (isLastLineVisible=false)`);
    }
  }

  /**
   * 탭 활성화 시 저장된 스크롤 상태 복원
   * Double requestAnimationFrame 패턴을 사용하여 VirtualList 렌더링 완료 보장
   */
  restoreScrollState() {
    const state = scrollStateByTabId.get(this.props.tabId);

    console.log(`[LogList:${this.props.tabId}] restoreScrollState: state=`, state);

    if (!state) {
      console.log(`[LogList:${this.props.tabId}] restoreScrollState: NO SAVED STATE!`);

      return;
    }

    // 복원 시작 - 자동 스크롤 방지
    this.isRestoringScroll = true;

    // Double requestAnimationFrame: VirtualList 렌더링 완료 보장
    // 1차 rAF: 브라우저가 레이아웃 계산 예약
    // 2차 rAF: 레이아웃 완료 후 실행 - 이 시점에 scrollHeight가 정확함
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!this.virtualListDiv.current) {
          this.isRestoringScroll = false;
          scrollStateByTabId.delete(this.props.tabId);

          return;
        }

        const maxScroll = this.virtualListDiv.current.scrollHeight - this.virtualListDiv.current.clientHeight;
        // 저장된 위치가 현재 스크롤 범위를 초과하면 최대값으로 제한
        const safeOffset = Math.min(state.scrollOffset, Math.max(0, maxScroll));

        console.log(
          `[LogList:${this.props.tabId}] restoreScrollState: scrollHeight=${this.virtualListDiv.current.scrollHeight}, clientHeight=${this.virtualListDiv.current.clientHeight}, maxScroll=${maxScroll}, safeOffset=${safeOffset}`,
        );

        this.virtualListDiv.current.scrollTop = safeOffset;
        this.isLastLineVisible = state.isLastLineVisible;

        // 복원 완료 후 상태 삭제
        scrollStateByTabId.delete(this.props.tabId);

        // CRITICAL: 플래그 해제를 지연
        // onLogsUpdate의 setTimeout(500ms)보다 늦게 해제해야
        // scrollToBottom()이 복원된 스크롤을 덮어쓰지 않음
        setTimeout(() => {
          this.isRestoringScroll = false;
          console.log(`[LogList:${this.props.tabId}] restoreScrollState: flag released`);
        }, 600);
      });
    });
  }

  onUserScrolledUp(logs: string[], prevLogs: string[]) {
    if (!this.virtualListDiv.current) return;

    const newLogsAdded = prevLogs.length < logs.length;
    const scrolledToBeginning = this.virtualListDiv.current.scrollTop === 0;

    if (newLogsAdded && scrolledToBeginning) {
      const firstLineContents = prevLogs[0];
      const lineToScroll = logs.findIndex((value) => value == firstLineContents);

      if (lineToScroll !== -1) {
        this.scrollToItem(lineToScroll, "start");
      }
    }
  }

  /**
   * Returns logs with or without timestamps regarding to showTimestamps prop
   * Also filters by visibleLevels if specified
   */
  @computed
  get logs(): string[] {
    const { showTimestamps, timestampFormat = "iso", visibleLevels } = this.props.model.logTabData.get() ?? {};

    let logs: string[];

    if (!showTimestamps) {
      logs = this.props.model.logsWithoutTimestamps.get();
    } else {
      logs = this.props.model.timestampSplitLogs.get().map(([logTimestamp, log]) => {
        if (!logTimestamp) {
          return log;
        }

        const momentInstance = moment.tz(logTimestamp, this.props.state.localeTimezone);
        const formattedTimestamp = formatTimestamp(momentInstance, timestampFormat);

        return `${formattedTimestamp} ${log}`;
      });
    }

    // Apply log level filter if visibleLevels is specified
    if (visibleLevels && visibleLevels.length > 0) {
      logs = logs.filter((log) => {
        const level = detectLogLevel(log);

        // Show 'unknown' level logs only if no specific levels are filtered
        // or if the log's level matches one of the visible levels
        return level === "unknown" || visibleLevels.includes(level);
      });
    }

    return logs;
  }

  /**
   * Checks if JumpToBottom button should be visible and sets its observable
   * @param props Scrolling props from virtual list core
   */
  setButtonVisibility = action(({ scrollOffset }: ListOnScrollProps, { scrollHeight }: HTMLDivElement) => {
    const offset = 100 * this.lineHeight;

    if (scrollHeight - scrollOffset < offset) {
      this.isJumpButtonVisible = false;
    } else {
      this.isJumpButtonVisible = true;
    }
  });

  /**
   * Checks if last log line considered visible to user, setting its observable
   * @param props Scrolling props from virtual list core
   */
  setLastLineVisibility = action(
    ({ scrollOffset }: ListOnScrollProps, { scrollHeight, clientHeight }: HTMLDivElement) => {
      this.isLastLineVisible = clientHeight + scrollOffset === scrollHeight;
    },
  );

  /**
   * Check if user scrolled to top and new logs should be loaded
   * @param props Scrolling props from virtual list core
   */
  checkLoadIntent = (props: ListOnScrollProps) => {
    const { scrollOffset } = props;

    if (scrollOffset === 0) {
      this.props.model.loadLogs();
    }
  };

  scrollToBottom = () => {
    if (!this.virtualListDiv.current) return;
    this.virtualListDiv.current.scrollTop = this.virtualListDiv.current.scrollHeight;
  };

  scrollToItem = (index: number, align: Align) => {
    this.virtualListRef.current?.scrollToItem(index, align);
  };

  onScroll = (props: ListOnScrollProps) => {
    this.isLastLineVisible = false;
    this.onScrollDebounced(props);
  };

  onScrollDebounced = debounce((props: ListOnScrollProps) => {
    const virtualList = this.virtualListDiv.current;

    if (virtualList) {
      this.setButtonVisibility(props, virtualList);
      this.setLastLineVisibility(props, virtualList);
      this.checkLoadIntent(props);
    }
  }, 700); // Increasing performance and giving some time for virtual list to settle down

  /**
   * A function is called by VirtualList for rendering each of the row
   * @param rowIndex index of the log element in logs array
   * @returns A react element with a row itself
   */
  getLogRow = (rowIndex: number) => {
    const { searchQuery, isActiveOverlay } = this.props.model.searchStore;
    const item = this.logs[rowIndex];
    const contents: React.ReactElement[] = [];
    const ansiToHtml = (ansi: string) => DOMPurify.sanitize(colorConverter.ansi_to_html(ansi));

    // Detect log level and get corresponding CSS class
    const logLevel = detectLogLevel(item);
    const logLevelClass = getLogLevelClassName(logLevel);

    // Extract container prefix for dim rendering in ALL_CONTAINERS mode
    const isAllContainersMode = this.props.model.logTabData.get()?.selectedContainer === ALL_CONTAINERS;
    const containerPrefixMatch = isAllContainersMode ? item.match(/(\[[^\]]+\])/) : null;

    if (searchQuery) {
      // If search is enabled, replace keyword with backgrounded <span>
      // Case-insensitive search (lowercasing query and keywords in line)
      const regex = new RegExp(SearchStore.escapeRegex(searchQuery), "gi");
      const matches = item.matchAll(regex);
      const modified = item.replace(regex, (match) => match.toLowerCase());
      // Splitting text line by keyword
      const pieces = modified.split(searchQuery.toLowerCase());

      pieces.forEach((piece, index) => {
        const active = isActiveOverlay(rowIndex, index);
        const lastItem = index === pieces.length - 1;
        const overlayValueString = matches.next().value?.[0] ?? "";
        const overlay = !lastItem ? (
          <span
            className={cssNames("overlay", { active })}
            dangerouslySetInnerHTML={{ __html: ansiToHtml(overlayValueString) }}
          />
        ) : null;

        contents.push(
          <React.Fragment key={piece + index}>
            <span dangerouslySetInnerHTML={{ __html: ansiToHtml(piece) }} />
            {overlay}
          </React.Fragment>,
        );
      });
    }

    // Non-search mode with container prefix: render [containerName] dimmed
    if (containerPrefixMatch && contents.length === 0) {
      const prefixIndex = item.indexOf(containerPrefixMatch[1]);
      const before = item.substring(0, prefixIndex);
      const prefix = containerPrefixMatch[1];
      const after = item.substring(prefixIndex + prefix.length);

      return (
        <div className={cssNames("LogRow", logLevelClass)} data-shadcn-skip-bg>
          {before && <span dangerouslySetInnerHTML={{ __html: ansiToHtml(before) }} />}
          <span className="container-prefix" dangerouslySetInnerHTML={{ __html: ansiToHtml(prefix) }} />
          <span dangerouslySetInnerHTML={{ __html: ansiToHtml(after) }} />
          <br />
        </div>
      );
    }

    return (
      <div className={cssNames("LogRow", logLevelClass)} data-shadcn-skip-bg>
        {contents.length > 1 ? contents : <span dangerouslySetInnerHTML={{ __html: ansiToHtml(item) }} />}
        {/* For preserving copy-paste experience and keeping line breaks */}
        <br />
      </div>
    );
  };

  render() {
    if (this.props.model.isLoading.get()) {
      return (
        <div className="LogList flex box grow align-center justify-center">
          <Spinner />
        </div>
      );
    }

    if (!this.logs.length) {
      const selectedContainer = this.props.model.logTabData.get()?.selectedContainer;
      const emptyMessage =
        selectedContainer === ALL_CONTAINERS
          ? "There are no logs available for any container in this pod"
          : `There are no logs available for container ${selectedContainer}`;

      return <div className="LogList flex box grow align-center justify-center">{emptyMessage}</div>;
    }

    return (
      <div className={cssNames("LogList flex")}>
        <VirtualList
          items={this.logs}
          rowHeights={array.filled(this.logs.length, this.lineHeight)}
          getRow={this.getLogRow}
          onScroll={this.onScroll}
          outerRef={this.virtualListDiv}
          ref={this.virtualListRef}
          className="box grow"
        />
        {this.isJumpButtonVisible && <ToBottom onClick={this.scrollToBottom} />}
      </div>
    );
  }
}

const InjectedNonForwardedLogList = withInjectables<
  Dependencies,
  LogListProps & { innerRef: ForwardedRef<LogListRef> }
>(NonForwardedLogList, {
  getProps: (di, props) => ({
    ...props,
    state: di.inject(userPreferencesStateInjectable),
  }),
});

export const LogList = React.forwardRef<LogListRef, LogListProps>((props, ref) => (
  <InjectedNonForwardedLogList {...props} innerRef={ref} />
));
