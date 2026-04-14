/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { loggerInjectionToken } from "@skuberplus/logger";
import { cssNames, disposer } from "@skuberplus/utilities";
import autoBindReact from "auto-bind/react";
import { debounce, merge } from "lodash";
import { action, computed, makeObservable, observable, reaction } from "mobx";
import { observer } from "mobx-react";
import { editor, Uri } from "monaco-editor";
import React, { Component } from "react";
import userPreferencesStateInjectable from "../../../features/user-preferences/common/state.injectable";
import getEditorHeightFromLinesCountInjectable from "./get-editor-height-from-lines-number.injectable";
import styles from "./monaco-editor.module.scss";
import { type MonacoValidator, monacoValidators } from "./monaco-validators";

import type { Logger } from "@skuberplus/logger";

import type { UserPreferencesState } from "../../../features/user-preferences/common/state.injectable";
import type { MonacoTheme } from "./monaco-themes";

export type MonacoEditorId = string;

/**
 * 🎯 Monaco 에디터 지원 언어 목록
 * 📝 webpack.renderer.ts의 MonacoWebpackPlugin languages 배열과 동기화 필요
 */
export type MonacoLanguage =
  | "yaml"
  | "json"
  | "markdown"
  | "typescript"
  | "javascript"
  | "python"
  | "go"
  | "rust"
  | "shell"
  | "dockerfile"
  | "html"
  | "css"
  | "plaintext";

export interface MonacoEditorProps {
  id?: MonacoEditorId; // associating editor's ID with created model.uri
  className?: string;
  style?: React.CSSProperties;
  autoFocus?: boolean;
  readOnly?: boolean;
  theme?: MonacoTheme;
  language?: MonacoLanguage; // supported list of languages, configure in `webpack.renderer.ts`
  options?: Partial<editor.IStandaloneEditorConstructionOptions>; // customize editor's initialization options
  value: string;
  onChange?(value: string, evt: editor.IModelContentChangedEvent): void; // catch latest value updates
  onError?(error: unknown): void; // provide syntax validation error, etc.
  onDidLayoutChange?(info: editor.EditorLayoutInfo): void;
  onDidContentSizeChange?(evt: editor.IContentSizeChangedEvent): void;
  onModelChange?(model: editor.ITextModel, prev?: editor.ITextModel): void;
  innerRef?: React.ForwardedRef<MonacoEditorRef>;
  setInitialHeight?: boolean;
}

interface Dependencies {
  state: UserPreferencesState;
  getEditorHeightFromLinesCount: (linesCount: number) => number;
  logger: Logger;
}

export function createMonacoUri(id: MonacoEditorId): Uri {
  return Uri.file(`/monaco-editor/${id}`);
}

const monacoViewStates = new WeakMap<Uri, editor.ICodeEditorViewState>();

export interface MonacoEditorRef {
  focus(): void;
}

@observer
class NonInjectedMonacoEditor extends Component<MonacoEditorProps & Dependencies> {
  static defaultProps = {
    language: "yaml" as const,
  };

  private staticId = `editor-id#${Math.round(1e7 * Math.random())}`;
  private dispose = disposer();

  @observable.ref containerElem: HTMLDivElement | null = null;
  @observable.ref editor!: editor.IStandaloneCodeEditor;
  @observable readonly dimensions: { width?: number; height?: number } = {};
  @observable unmounting = false;

  // TODO: investigate how to replace with "common/logger"
  //  currently leads for stucking UI forever & infinite loop.
  //  e.g. happens on tab change/create, maybe some other cases too.
  private logger = console;

  constructor(props: MonacoEditorProps & Dependencies) {
    super(props);
    makeObservable(this);
    autoBindReact(this);
  }

  @computed get id(): MonacoEditorId {
    return this.props.id ?? this.staticId;
  }

  /**
   * 🎯 목적: Monaco Editor 테마 결정 (shadcn 테마 시스템 연동)
   * 📝 주의사항: shadcn 테마 ID에서 light/dark를 판별하여 적절한 Monaco 테마 선택
   * 🔄 변경이력: 2025-12-05 - shadcn 테마 연동 추가
   */
  @computed get theme() {
    // 1. props.theme이 있으면 우선 사용
    if (this.props.theme) {
      return this.props.theme;
    }

    // 2. shadcn 테마 ID에서 light/dark 판별
    const shadcnTheme = this.props.state.shadcnTheme;

    if (shadcnTheme) {
      // shadcn 테마 ID 형식: "default-light", "blue-dark" 등
      // Light 테마: daive-light (배경 #FFFFFF, 글자 #222222)
      // Dark 테마: clouds-midnight / VS Code Dark+ (배경 #1e1e1e, 글자 #D4D4D4)
      return shadcnTheme.endsWith("-dark") ? "clouds-midnight" : "daive-light";
    }

    // 3. fallback: 기본 라이트 테마 사용 (THEME-011: activeTheme 제거)
    return "vs";
  }

  @computed get model(): editor.ITextModel {
    const uri = createMonacoUri(this.id);
    const model = editor.getModel(uri);

    if (model) {
      return model; // already exists
    }

    const { language, value: rawValue } = this.props;
    const value = typeof rawValue === "string" ? rawValue : "";

    if (typeof rawValue !== "string") {
      this.props.logger.error(`[MONACO-EDITOR]: Passed a non-string default value`, { rawValue });
    }

    return editor.createModel(value, language, uri);
  }

  @computed get options(): editor.IStandaloneEditorConstructionOptions {
    const isDark = this.theme === "clouds-midnight";

    return merge(
      {},
      this.props.state.editorConfiguration,
      // 다크 모드에서 텍스트 가독성 개선
      // GeistMono-Medium(500) = 실제 폰트 파일 사용, faux bold 아님
      // fontFamily 강제: 저장된 사용자 설정(RobotoMono 등)이 기본값을 덮어쓰므로
      // 다크 모드에서는 Medium weight가 있는 GeistMono를 직접 지정
      ...(isDark ? [{ fontFamily: "GeistMono", fontWeight: "500" }] : []),
      this.props.options,
    );
  }

  @computed
  private get logMetadata() {
    return {
      editorId: this.id,
      model: this.model,
    };
  }

  /**
   * Monitor editor's dom container element box-size and sync with monaco's dimensions
   * @private
   */
  private bindResizeObserver() {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;

        this.setDimensions(width, height);
      }
    });

    const containerElem = this.editor.getContainerDomNode();

    resizeObserver.observe(containerElem);

    return () => resizeObserver.unobserve(containerElem);
  }

  protected onModelChange(model: editor.ITextModel, oldModel?: editor.ITextModel) {
    this.logger.info("[MONACO]: model change", { model, oldModel }, this.logMetadata);

    if (oldModel) {
      this.saveViewState(oldModel);
    }

    this.editor.setModel(model);
    this.restoreViewState(model);
    this.editor.layout();
    this.editor.focus(); // keep focus in editor, e.g. when clicking between dock-tabs
    this.props.onModelChange?.(model, oldModel);
    this.validateLazy();
  }

  /**
   * Save current view-model state in the editor.
   * This will allow restore cursor position, selected text, etc.
   */
  protected saveViewState(model: editor.ITextModel) {
    const viewState = this.editor?.saveViewState();

    if (viewState) {
      monacoViewStates.set(model.uri, viewState);
    }
  }

  protected restoreViewState(model: editor.ITextModel) {
    const viewState = monacoViewStates.get(model.uri);

    if (viewState) {
      this.editor?.restoreViewState(viewState);
    }
  }

  componentDidMount() {
    try {
      this.createEditor();
      this.logger.info(`[MONACO]: editor did mount`, this.logMetadata);
    } catch (error) {
      this.logger.error(`[MONACO]: mounting failed: ${error}`, this.logMetadata);
    }
  }

  componentWillUnmount() {
    this.unmounting = true;
    this.saveViewState(this.model);

    if (this.editor) {
      this.dispose();
      this.editor.dispose();
    }
  }

  protected createEditor() {
    if (!this.containerElem || this.editor || this.unmounting) {
      return;
    }
    const { language, readOnly, value: defaultValue } = this.props;
    const { theme } = this;

    this.editor = editor.create(this.containerElem, {
      model: this.model,
      detectIndentation: false, // allow `option.tabSize` to use custom number of spaces for [Tab]
      value: defaultValue,
      language,
      theme,
      readOnly,
      ...this.options,
    });

    this.logger.info(`[MONACO]: editor created for language=${language}, theme=${theme}`, this.logMetadata);
    this.validateLazy(); // validate initial value
    this.restoreViewState(this.model); // restore previous state if any

    if (this.props.autoFocus) {
      this.editor.focus();
    }

    const onDidLayoutChangeDisposer = this.editor.onDidLayoutChange((layoutInfo) => {
      this.props.onDidLayoutChange?.(layoutInfo);
    });

    const onValueChangeDisposer = this.editor.onDidChangeModelContent((event) => {
      const value = this.editor.getValue();

      this.props.onChange?.(value, event);
      this.validateLazy(value);
    });

    const onContentSizeChangeDisposer = this.editor.onDidContentSizeChange((params) => {
      this.props.onDidContentSizeChange?.(params);
    });

    this.dispose.push(
      reaction(() => this.model, this.onModelChange),
      reaction(() => this.theme, editor.setTheme),
      reaction(
        () => this.props.value,
        (value) => this.setValue(value),
        {
          fireImmediately: true,
        },
      ),
      reaction(
        () => this.options,
        (opts) => this.editor.updateOptions(opts),
      ),

      () => onDidLayoutChangeDisposer.dispose(),
      () => onValueChangeDisposer.dispose(),
      () => onContentSizeChangeDisposer.dispose(),
      this.bindResizeObserver(),
    );
  }

  @action
  setDimensions(width: number, height: number) {
    this.dimensions.width = width;
    this.dimensions.height = height;
    this.editor?.layout({ width, height });
  }

  setValue(value = ""): void {
    if (value == this.getValue()) return;

    this.editor.setValue(value);
    this.validate(value);
  }

  getValue(opts?: { preserveBOM: boolean; lineEnding: string }): string {
    return this.editor?.getValue(opts) ?? "";
  }

  focus() {
    this.editor?.focus();
  }

  @action
  validate(value = this.getValue()) {
    const validator = this.props.language ? monacoValidators[this.props.language] : undefined;
    const validators: MonacoValidator[] = [
      validator, // parsing syntax check
    ].filter((v): v is MonacoValidator => Boolean(v));

    for (const validate of validators) {
      try {
        validate(value);
      } catch (error) {
        this.props.onError?.(error); // emit error outside
      }
    }
  }

  // avoid excessive validations during typing
  validateLazy = debounce(this.validate, 250);

  get initialHeight() {
    return this.props.getEditorHeightFromLinesCount(this.model.getLineCount());
  }

  render() {
    const { className, style } = this.props;

    const css: React.CSSProperties = {
      ...style,
      height: style?.height ?? this.initialHeight,
    };

    return (
      <div
        data-test-id="monaco-editor"
        data-shadcn-skip-bg
        className={cssNames(styles.MonacoEditor, className)}
        style={css}
        ref={(elem) => (this.containerElem = elem)}
      />
    );
  }
}

const ForwardedRefMonacoEditor = React.forwardRef<MonacoEditorRef, MonacoEditorProps & Dependencies>((props, ref) => (
  <NonInjectedMonacoEditor innerRef={ref} {...props} />
));

export const MonacoEditor = withInjectables<Dependencies, MonacoEditorProps, MonacoEditorRef>(
  ForwardedRefMonacoEditor,
  {
    getProps: (di, props) => ({
      ...props,
      state: di.inject(userPreferencesStateInjectable),
      getEditorHeightFromLinesCount: di.inject(getEditorHeightFromLinesCountInjectable),
      logger: di.inject(loggerInjectionToken),
    }),
  },
);
