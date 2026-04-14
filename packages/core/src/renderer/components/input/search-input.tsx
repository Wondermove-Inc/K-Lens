/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./search-input.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Icon } from "@skuberplus/icon";
import { cssNames } from "@skuberplus/utilities";
import autoBindReact from "auto-bind/react";
import { observer } from "mobx-react";
import React, { Component, createRef } from "react";
import isMacInjectable from "../../../common/vars/is-mac.injectable";
import { Input } from "./input";

import type { InputProps } from "./input";

export interface SearchInputProps extends InputProps {
  compact?: boolean; // show only search-icon when not focused
  bindGlobalFocusHotkey?: boolean;
  showClearIcon?: boolean;
  onClear?(): void;
}

const defaultProps: Partial<SearchInputProps> = {
  autoFocus: true,
  bindGlobalFocusHotkey: true,
  showClearIcon: true,
  placeholder: "Search...",
};

interface Dependencies {
  isMac: boolean;
}

class NonInjectedSearchInput extends Component<SearchInputProps & Dependencies> {
  static defaultProps = defaultProps as object;

  private inputRef = createRef<Input>();

  constructor(props: SearchInputProps & Dependencies) {
    super(props);
    autoBindReact(this);
  }

  componentDidMount() {
    if (!this.props.bindGlobalFocusHotkey) return;
    window.addEventListener("keydown", this.onGlobalKey);
  }

  componentWillUnmount() {
    window.removeEventListener("keydown", this.onGlobalKey);
  }

  onGlobalKey(evt: KeyboardEvent) {
    if (evt.key === "f" && (this.props.isMac ? evt.metaKey : evt.ctrlKey)) {
      this.inputRef.current?.focus();
    }
  }

  onKeyDown(evt: React.KeyboardEvent<any>) {
    this.props.onKeyDown?.(evt);

    if (evt.nativeEvent.code === "Escape") {
      this.clear();
      // Restore focus to main contents panel
      const contentsPanel = document.querySelector("[data-panel-id='contents']") as HTMLElement;
      contentsPanel?.focus({ preventScroll: true });
      evt.stopPropagation();
    }

    if (evt.nativeEvent.code === "Enter") {
      // Restore focus to main contents panel on Enter
      const contentsPanel = document.querySelector("[data-panel-id='contents']") as HTMLElement;
      contentsPanel?.focus({ preventScroll: true });
    }
  }

  clear() {
    if (this.props.onClear) {
      this.props.onClear();
    } else {
      this.inputRef.current?.setValue("");
    }
  }

  render() {
    const { className, compact, onClear, showClearIcon, bindGlobalFocusHotkey, value, isMac, ...inputProps } =
      this.props;
    let rightIcon = <Icon small material="search" />;

    if (showClearIcon && value) {
      rightIcon = <Icon small material="close" onClick={this.clear} />;
    }

    return (
      <Input
        {...inputProps}
        className={cssNames("SearchInput", className, { compact })}
        value={value}
        onKeyDown={this.onKeyDown}
        iconRight={rightIcon}
        ref={this.inputRef}
        blurOnEnter={false}
      />
    );
  }
}

export const SearchInput = withInjectables<Dependencies, SearchInputProps>(observer(NonInjectedSearchInput), {
  getProps: (di, props) => ({
    ...props,
    isMac: di.inject(isMacInjectable),
  }),
});
