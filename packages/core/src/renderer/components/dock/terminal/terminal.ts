/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { disposer } from "@skuberplus/utilities";
import { CanvasAddon } from "@xterm/addon-canvas";
import { FitAddon } from "@xterm/addon-fit";
import { type ISearchOptions, SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal as XTerm } from "@xterm/xterm";
import assert from "assert";
import { clipboard } from "electron";
import { once } from "lodash";
import debounce from "lodash/debounce";
import { action, makeObservable, observable, reaction } from "mobx";
import { TerminalChannels } from "../../../../common/terminal/channels";
import { getXtermThemeFromCssVariables, watchThemeChange } from "./terminal-theme";

import type { Logger } from "@skuberplus/logger";

import type { IComputedValue } from "mobx";

import type { OpenLinkInBrowser } from "../../../../common/utils/open-link-in-browser.injectable";
import type { TerminalFont } from "../../../../features/terminal/renderer/fonts/token";
import type { TerminalConfig } from "../../../../features/user-preferences/common/preferences-helpers";
import type { TerminalApi } from "../../../api/terminal-api";
import type { TabId } from "../dock/store";

/**
 * 🎯 목적: WebGL2 지원 여부 확인
 *
 * @returns true면 WebGL2 사용 가능, false면 Canvas 사용
 *
 * 📝 주의사항:
 * - GPU 없는 환경, 헤드리스 환경, 드라이버 문제 등에서 false 반환
 * - xterm.js WebglAddon은 자동 fallback 없으므로 수동 체크 필수
 *
 * 🔄 변경이력: 2025-10-27 - 초기 생성
 */
function isWebGL2Supported(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    return gl !== null;
  } catch (e) {
    return false;
  }
}

/**
 * 🎯 목적: Terminal 클래스 의존성 정의
 * 📝 주의: xtermColorTheme 제거됨 (CSS 변수 기반으로 전환)
 * 🔄 변경이력: 2025-10-26 - xtermColorTheme 제거, CSS 변수 기반 시스템으로 전환
 */
export interface TerminalDependencies {
  readonly spawningPool: HTMLElement;
  readonly terminalConfig: IComputedValue<TerminalConfig>;
  readonly terminalCopyOnSelect: IComputedValue<boolean>;
  readonly terminalFonts: TerminalFont[];
  readonly isMac: boolean;
  readonly logger: Logger;
  openLinkInBrowser: OpenLinkInBrowser;
}

export interface TerminalArguments {
  tabId: TabId;
  api: TerminalApi;
}

type SearchDirection = "next" | "prev";

export class Terminal {
  private readonly xterm: XTerm;
  private readonly fitAddon = new FitAddon();
  private readonly searchAddon = new SearchAddon(); // 🎯 터미널 검색 기능 (Ctrl+F)
  private readonly webLinksAddon = new WebLinksAddon((event, link) => this.dependencies.openLinkInBrowser(link));
  private scrollPos = 0;
  private readonly disposer = disposer();
  private themeObserver?: MutationObserver; // 🎯 테마 변경 감시용 MutationObserver
  private lastKnownCols = 0;
  private lastKnownRows = 0;
  public readonly tabId: TabId;
  protected readonly api: TerminalApi;
  private lastEnterTs = 0;

  // 🎯 MobX observable: 검색 UI 열림/닫힘 상태
  @observable searchOpen = false;
  @observable searchTerm = "";
  @observable matchCase = false;
  @observable matchWholeWord = false;
  @observable useRegex = false;
  @observable matchCount = 0;
  @observable searchStatus = "No results";
  @observable searchError: string | undefined = undefined;
  private readonly searchHistory: string[] = [];
  private searchHistoryIndex = -1;

  // 🎯 렌더러 관련 필드 (WebGL/Canvas 성능 개선)
  private rendererAddon?: WebglAddon | CanvasAddon;
  private rendererType: "webgl" | "canvas" | "dom" = "dom";

  private get elem() {
    return this.xterm.element!;
  }

  private get viewport() {
    return this.elem.querySelector(".xterm-viewport")!;
  }

  attachTo(parentElem: HTMLElement) {
    assert(this.elem, "Terminal should always be mounted somewhere");
    parentElem.appendChild(this.elem);
    this.onActivate();
  }

  detach() {
    const { elem } = this;

    if (elem) {
      this.dependencies.spawningPool.appendChild(elem);
    }
  }

  get fontFamily() {
    const nameFromConfig = this.dependencies.terminalConfig.get().fontFamily;
    const nameFromAlias = this.dependencies.terminalFonts.find((font) => font.alias === nameFromConfig)?.name;

    return nameFromAlias || nameFromConfig;
  }

  get fontSize() {
    return this.dependencies.terminalConfig.get().fontSize;
  }

  /**
   * 🎯 목적: 현재 terminal의 열(column) 수 반환
   *
   * @returns xterm.js의 현재 열 수 (cols)
   *
   * 📝 주의사항:
   * - 탭 전환 시 크기 복사를 위해 public getter로 노출
   * - xterm.cols는 fit() 이후에만 올바른 값 가짐
   *
   * 🔄 변경이력: 2025-10-28 - 탭 전환 최적화를 위해 추가
   */
  get cols() {
    return this.lastKnownCols || this.xterm.cols;
  }

  /**
   * 🎯 목적: 현재 terminal의 행(row) 수 반환
   *
   * @returns xterm.js의 현재 행 수 (rows)
   *
   * 📝 주의사항:
   * - 탭 전환 시 크기 복사를 위해 public getter로 노출
   * - xterm.rows는 fit() 이후에만 올바른 값 가짐
   *
   * 🔄 변경이력: 2025-10-28 - 탭 전환 최적화를 위해 추가
   */
  get rows() {
    return this.lastKnownRows || this.xterm.rows;
  }

  getLastKnownSize() {
    return {
      cols: this.lastKnownCols,
      rows: this.lastKnownRows,
    };
  }

  hasValidSize() {
    return this.lastKnownCols > 0 && this.lastKnownRows > 0;
  }

  ensureSizeFallback(fallback?: { cols: number; rows: number }) {
    if (this.hasValidSize()) {
      return;
    }

    const target = fallback && fallback.cols > 0 && fallback.rows > 0 ? fallback : { cols: 120, rows: 40 };

    this.xterm.resize(target.cols, target.rows);
    this.updateLastKnownSize(target.cols, target.rows);
  }

  @action
  setSearchTerm = (value: string) => {
    this.searchTerm = value;
    this.searchHistoryIndex = -1;
    this.resetSearchFeedback();
  };

  @action
  toggleMatchCase = () => {
    this.matchCase = !this.matchCase;
    this.resetSearchFeedback();
  };

  @action
  toggleMatchWholeWord = () => {
    this.matchWholeWord = !this.matchWholeWord;
    this.resetSearchFeedback();
  };

  @action
  toggleUseRegex = () => {
    this.useRegex = !this.useRegex;
    this.resetSearchFeedback();
  };

  @action
  navigateSearchHistory = (direction: "prev" | "next") => {
    if (this.searchHistory.length === 0) {
      return;
    }

    if (direction === "prev") {
      if (this.searchHistoryIndex === -1) {
        this.searchHistoryIndex = this.searchHistory.length - 1;
      } else if (this.searchHistoryIndex > 0) {
        this.searchHistoryIndex -= 1;
      }
    } else {
      if (this.searchHistoryIndex === -1) {
        return;
      }

      if (this.searchHistoryIndex < this.searchHistory.length - 1) {
        this.searchHistoryIndex += 1;
      } else {
        this.searchHistoryIndex = -1;
        this.searchTerm = "";
        this.resetSearchFeedback();
        return;
      }
    }

    if (this.searchHistoryIndex >= 0 && this.searchHistoryIndex < this.searchHistory.length) {
      this.searchTerm = this.searchHistory[this.searchHistoryIndex];
      this.resetSearchFeedback();
    }
  };

  @action
  performSearch = (direction: SearchDirection) => {
    const rawTerm = this.searchTerm.trim();

    if (!rawTerm) {
      this.matchCount = 0;
      this.searchStatus = "Enter search term";
      this.searchError = undefined;
      return;
    }

    const { term, options } = this.buildSearchQuery(rawTerm);

    try {
      const result =
        direction === "next" ? this.searchAddon.findNext(term, options) : this.searchAddon.findPrevious(term, options);

      this.searchError = undefined;
      this.matchCount = result ? 1 : 0;
      this.searchStatus = result ? "Match found" : "No results";

      if (result) {
        this.pushSearchHistory(rawTerm);
      }
    } catch (error) {
      this.searchError = error instanceof Error ? error.message : "검색 중 오류가 발생했습니다.";
      this.searchStatus = "Error";
      this.matchCount = 0;
    }
  };

  private pushSearchHistory(term: string) {
    const normalized = term.trim();

    if (!normalized) {
      return;
    }

    const existingIdx = this.searchHistory.findIndex((entry) => entry === normalized);

    if (existingIdx >= 0) {
      this.searchHistory.splice(existingIdx, 1);
    }

    this.searchHistory.push(normalized);

    if (this.searchHistory.length > 50) {
      this.searchHistory.shift();
    }

    this.searchHistoryIndex = this.searchHistory.length;
  }

  private buildSearchQuery(term: string): { term: string; options: ISearchOptions } {
    return {
      term,
      options: {
        caseSensitive: this.matchCase,
        wholeWord: this.matchWholeWord,
        regex: this.useRegex,
      },
    };
  }

  private resetSearchFeedback() {
    this.searchError = undefined;
    this.matchCount = 0;
    this.searchStatus = this.searchTerm.trim().length > 0 ? "Press Enter" : "No results";
  }

  constructor(
    protected readonly dependencies: TerminalDependencies,
    { tabId, api }: TerminalArguments,
  ) {
    this.tabId = tabId;
    this.api = api;

    // 🎯 MobX observable 초기화
    makeObservable(this);

    this.xterm = new XTerm({
      cursorBlink: true,
      cursorStyle: "block", // 🎯 면적 있는 직사각형 커서
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      theme: getXtermThemeFromCssVariables(), // 🎯 생성 시 테마 설정 (CSS 변수에서 읽기)
    });
    // enable terminal addons
    this.xterm.loadAddon(this.fitAddon);
    this.xterm.loadAddon(this.searchAddon); // 🎯 검색 기능 활성화
    this.xterm.loadAddon(this.webLinksAddon);

    this.xterm.open(this.dependencies.spawningPool);
    this.updateLastKnownSize(this.xterm.cols, this.xterm.rows);

    // 🎯 렌더러 초기화 (WebGL 우선, Canvas fallback)
    this.initRenderer();

    // 🎯 open() 직후 theme 강제 적용 (3가지 방법 시도)
    // 📝 이유: xterm.js theme API가 일부 환경에서 제대로 작동하지 않는 문제 해결
    const theme = getXtermThemeFromCssVariables();

    // 방법 A: 공식 API (표준 방식)
    this.xterm.options.theme = theme;

    // 방법 B: 내부 API로 강제 적용 (fallback)
    try {
      (this.xterm as any)._core.options.theme = theme;
    } catch (e) {
      console.warn("[TERMINAL] Failed to apply theme via _core:", e);
    }

    // 방법 C: 화면 갱신 강제 (렌더링 트리거)
    setTimeout(() => {
      this.xterm.refresh(0, this.xterm.rows - 1);
    }, 100);

    this.xterm.attachCustomKeyEventHandler(this.keyHandler);
    this.xterm.onSelectionChange(this.onSelectionChange);

    // 🎯 테마 변경 감지 (MutationObserver로 html.theme-* 클래스 변경 감시)
    this.themeObserver = watchThemeChange(() => {
      const newTheme = getXtermThemeFromCssVariables();

      this.xterm.options.theme = newTheme;

      // 내부 API로도 적용
      try {
        (this.xterm as any)._core.options.theme = newTheme;
      } catch (e) {
        // silent fail
      }

      // 화면 갱신
      this.xterm.refresh(0, this.xterm.rows - 1);
    });

    // bind events
    const onDataHandler = this.xterm.onData(this.onData);
    const clearOnce = once(this.onClear);

    this.viewport.addEventListener("scroll", this.onScroll);
    this.elem.addEventListener("contextmenu", this.onContextMenu);
    this.api.once("ready", clearOnce);
    // 🎯 connected 이벤트: PTY 연결 완료 후 실제 터미널 UI 크기를 PTY에 동기화
    // WebSocket 연결 시 120x80 고정값으로 전송되므로, 연결 완료 후 fit()으로 실제 크기 반영
    this.api.once("connected", () => {
      clearOnce();
      this.fit();
    });
    this.api.on("data", this.onApiData);
    window.addEventListener("resize", this.onResize);

    this.disposer.push(
      // 🎯 MutationObserver 정리
      () => this.themeObserver?.disconnect(),
      reaction(() => this.fontSize, this.setFontSize, { fireImmediately: true }),
      reaction(() => this.fontFamily, this.setFontFamily, { fireImmediately: true }),
      () => onDataHandler.dispose(),
      () => this.fitAddon.dispose(),
      () => this.api.removeAllListeners(),
      () => window.removeEventListener("resize", this.onResize),
      () => this.elem.removeEventListener("contextmenu", this.onContextMenu),
      this.xterm.onResize(({ cols, rows }) => {
        this.updateLastKnownSize(cols, rows);
        this.api.sendTerminalSize(cols, rows);
      }),
    );
  }

  destroy() {
    this.disposer();
    this.xterm.dispose();
  }

  fit = () => this.fitAddon.fit();

  fitLazy = debounce(this.fit, 250);

  /**
   * 🎯 목적: terminal 크기를 명시적으로 설정
   *
   * @param cols - 열(column) 수
   * @param rows - 행(row) 수
   *
   * 📝 주의사항:
   * - 탭 전환 시 현재 활성 탭의 크기를 새 탭에 즉시 복사하기 위해 사용
   * - xterm.resize()는 즉시 크기를 적용하며 비동기 처리 없음
   *
   * 🔄 변경이력: 2025-10-28 - 탭 전환 최적화를 위해 추가
   */
  resize = (cols: number, rows: number) => {
    if (cols > 0 && rows > 0) {
      this.xterm.resize(cols, rows);
      this.updateLastKnownSize(cols, rows);
    }
  };

  focus = () => {
    this.xterm.focus();
  };

  onApiData = (data: string) => {
    this.xterm.write(data);
  };

  onData = (data: string) => {
    if (!this.api.isReady) return;
    this.api.sendMessage({
      type: TerminalChannels.STDIN,
      data,
    });
  };

  onScroll = () => {
    this.scrollPos = this.viewport.scrollTop;
  };

  onClear = () => {
    this.xterm.clear();
  };

  onResize = () => {
    this.fitLazy();
    this.focus();
  };

  /**
   * 🎯 목적: Dock 리사이저 이벤트에 맞춰 즉시 xterm 뷰포트 리사이즈
   *
   * 📝 주의사항: window resize처럼 디바운스를 적용하지 않고 바로 fit을 호출해
   * 터미널이 부모 컨테이너의 최신 높이를 따라가도록 한다.
   */
  forceFit = () => {
    this.fit();
    this.focus();
  };

  onActivate = () => {
    this.fit();
    setTimeout(() => this.focus(), 250); // delay used to prevent focus on active tab
    this.viewport.scrollTop = this.scrollPos; // restore last scroll position
  };

  onContextMenu = () => {
    if (
      // don't paste if user hasn't turned on the feature
      this.dependencies.terminalCopyOnSelect.get() &&
      // don't paste if the clipboard doesn't have text
      clipboard
        .availableFormats()
        .includes("text/plain")
    ) {
      this.xterm.paste(clipboard.readText());
    }
  };

  onSelectionChange = () => {
    const selection = this.xterm.getSelection().trim();

    if (this.dependencies.terminalCopyOnSelect.get() && selection) {
      clipboard.writeText(selection);
    }
  };

  setFontSize = (fontSize: number) => {
    this.dependencies.logger.info(`[TERMINAL]: set fontSize to ${fontSize}`);

    this.xterm.options.fontSize = fontSize;
    this.fit();
  };

  setFontFamily = (fontFamily: string) => {
    this.dependencies.logger.info(`[TERMINAL]: set fontFamily to ${fontFamily}`);

    this.xterm.options.fontFamily = fontFamily;
    this.fit();

    // provide css-variable within `:root {}`
    document.documentElement.style.setProperty("--font-terminal", fontFamily);
  };

  private updateLastKnownSize(cols: number, rows: number) {
    if (cols > 0 && rows > 0) {
      this.lastKnownCols = cols;
      this.lastKnownRows = rows;
    }
  }

  keyHandler = (evt: KeyboardEvent): boolean => {
    // 🎯 keydown 이벤트만 처리 (keyup, keypress는 무시)
    // 📝 이유: attachCustomKeyEventHandler는 keydown/keyup/keypress 모두 전달하므로
    //          중복 실행 방지를 위해 keydown만 처리
    if (evt.type !== "keydown") {
      return true;
    }

    const { code, ctrlKey, metaKey, shiftKey, altKey } = evt;

    // F6: panel focus cycling — don't let xterm process it
    if (code === "F6") return false;

    if (code === "Enter" && !ctrlKey && !metaKey && !shiftKey && !altKey) {
      const now = performance.now();

      // ⚠️ Enter 연타 시 빈 줄이 빠르게 누적되는 문제 방지 (사용자 피드백 기반)
      // - xterm은 textarea에서 발생한 모든 Enter를 즉시 PTY로 전달 => 쉘이 연속 빈 명령을 실행
      // - Dock Terminal에서는 120~150ms 내 반복 입력을 무시해도 실제 명령 UX에 영향이 적다는 결론
      if (now - this.lastEnterTs < 150) {
        return false; // 🎯 디바운스: 빠른 연타는 xterm에 전달하지 않음
      }

      this.lastEnterTs = now;
    }

    // Handle custom hotkey bindings
    if (ctrlKey || metaKey) {
      switch (code) {
        // Ctrl+C: prevent terminal exit on windows / linux (?)
        case "KeyC":
          if (this.xterm.hasSelection()) return false;
          break;
      }
    }

    // 🎯 macOS 전용 단축키 처리 (Cmd+K, Cmd+F, Cmd+W)
    if (this.dependencies.isMac && metaKey && !shiftKey && !altKey) {
      switch (code) {
        case "KeyK":
          this.onClear();
          return false; // 🎯 브라우저 기본 동작 차단

        case "KeyF":
          evt.preventDefault();
          evt.stopPropagation();
          this.openSearch();
          return false; // 🎯 브라우저 기본 동작 차단

        case "KeyW":
          return false; // 🎯 브라우저 기본 동작 차단 (아무것도 안 함)
      }
    }

    return true; // 🎯 다른 모든 키는 xterm.js에서 정상 처리
  };

  /**
   * 🎯 목적: 터미널에서 텍스트 검색 (다음 일치 항목으로 이동)
   *
   * @param searchText - 검색할 텍스트
   * @param caseSensitive - 대소문자 구분 여부 (기본값: false)
   * @returns 검색 결과 발견 여부
   *
   * 📝 주의사항:
   * - xterm.js SearchAddon API 사용
   * - 검색 결과가 없으면 false 반환
   *
   * 🔄 변경이력: 2025-10-27 - 초기 생성
   */
  findNext = (searchText: string, caseSensitive = false): boolean => {
    if (!searchText) return false;
    return this.searchAddon.findNext(searchText, { caseSensitive });
  };

  /**
   * 🎯 목적: 터미널에서 텍스트 검색 (이전 일치 항목으로 이동)
   *
   * @param searchText - 검색할 텍스트
   * @param caseSensitive - 대소문자 구분 여부 (기본값: false)
   * @returns 검색 결과 발견 여부
   *
   * 📝 주의사항:
   * - xterm.js SearchAddon API 사용
   * - 검색 결과가 없으면 false 반환
   *
   * 🔄 변경이력: 2025-10-27 - 초기 생성
   */
  findPrevious = (searchText: string, caseSensitive = false): boolean => {
    if (!searchText) return false;
    return this.searchAddon.findPrevious(searchText, { caseSensitive });
  };

  /**
   * 🎯 목적: 터미널 검색 강조 표시 제거
   *
   * 📝 주의사항:
   * - xterm.js SearchAddon API 사용
   * - 검색 UI 닫을 때 호출
   *
   * 🔄 변경이력: 2025-10-27 - 초기 생성
   */
  clearSearch = (): void => {
    this.searchAddon.clearDecorations();
    this.matchCount = 0;
    this.searchStatus = this.searchTerm.trim().length > 0 ? "Press Enter" : "No results";
    this.searchError = undefined;
  };

  /**
   * 🎯 목적: 검색 UI 열기 (Ctrl+F로 트리거)
   *
   * 📝 주의사항:
   * - MobX action으로 searchOpen observable 변경
   * - view.tsx의 TerminalSearchPopover와 연동
   *
   * 🔄 변경이력: 2025-10-27 - 초기 생성
   */
  @action
  openSearch = (): void => {
    this.searchOpen = true;
  };

  /**
   * 🎯 목적: 검색 UI 닫기
   *
   * 📝 주의사항:
   * - MobX action으로 searchOpen observable 변경
   * - 검색 강조 표시도 함께 제거
   *
   * 🔄 변경이력: 2025-10-27 - 초기 생성
   */
  @action
  closeSearch = (): void => {
    this.searchOpen = false;
    this.clearSearch();
    this.searchTerm = "";
    this.resetSearchFeedback();
  };

  /**
   * 🎯 목적: 렌더러 초기화 (WebGL 우선, Canvas fallback)
   *
   * 📝 주의사항:
   * - WebGL2 지원 확인 후 조건부 로딩
   * - WebGL 실패 시 자동으로 Canvas로 전환
   * - onContextLoss 핸들러로 런타임 fallback 지원
   *
   * 🔄 변경이력: 2025-10-27 - 초기 생성
   */
  private initRenderer(): void {
    // WebGL2 지원 확인
    if (isWebGL2Supported()) {
      try {
        const webglAddon = new WebglAddon();
        this.xterm.loadAddon(webglAddon);
        this.rendererAddon = webglAddon;
        this.rendererType = "webgl";
        this.dependencies.logger.info("[TERMINAL] WebGL renderer loaded");

        // WebGL context loss 감지 (GPU 문제 등)
        webglAddon.onContextLoss(() => {
          this.dependencies.logger.warn("[TERMINAL] WebGL context lost, switching to Canvas");
          this.switchToCanvas();
        });

        return;
      } catch (e) {
        this.dependencies.logger.warn("[TERMINAL] WebGL addon failed to load:", e);
      }
    } else {
      this.dependencies.logger.info("[TERMINAL] WebGL2 not supported, using Canvas renderer");
    }

    // WebGL 실패 또는 미지원 시 Canvas 사용
    this.switchToCanvas();
  }

  /**
   * 🎯 목적: Canvas 렌더러로 전환
   *
   * 📝 주의사항:
   * - 기존 WebGL addon이 있으면 먼저 dispose
   * - Canvas 실패 시 DOM 렌더러로 fallback (기본 렌더러)
   *
   * 🔄 변경이력: 2025-10-27 - 초기 생성
   */
  private switchToCanvas(): void {
    // 기존 WebGL addon 제거 (있다면)
    if (this.rendererAddon && this.rendererType === "webgl") {
      try {
        (this.rendererAddon as WebglAddon).dispose();
      } catch (e) {
        this.dependencies.logger.warn("[TERMINAL] Failed to dispose WebGL addon:", e);
      }
    }

    // Canvas addon 로드
    try {
      const canvasAddon = new CanvasAddon();
      this.xterm.loadAddon(canvasAddon);
      this.rendererAddon = canvasAddon;
      this.rendererType = "canvas";
      this.dependencies.logger.info("[TERMINAL] Canvas renderer loaded");
    } catch (e) {
      this.dependencies.logger.error("[TERMINAL] Canvas addon failed to load:", e);
      this.rendererType = "dom";
      this.dependencies.logger.info("[TERMINAL] Fallback to DOM renderer");
    }
  }
}
