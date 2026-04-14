/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { action, makeObservable, observable } from "mobx";

export class InlineCommandPaletteStore {
  @observable isDropdownOpen = false;
  @observable searchValue = "";

  private inputElement: HTMLInputElement | null = null;

  constructor() {
    makeObservable(this);
  }

  setInputElement(el: HTMLInputElement | null) {
    this.inputElement = el;
  }

  @action
  focus = (prefill = "") => {
    this.searchValue = prefill;
    this.isDropdownOpen = true;

    // defer focus to next tick so the input is rendered
    requestAnimationFrame(() => {
      this.inputElement?.focus();
    });
  };

  @action
  closeDropdown = () => {
    this.isDropdownOpen = false;
    this.searchValue = "";
    this.inputElement?.blur();

    // Transfer focus to the visible cluster frame iframe so keyboard shortcuts (j/k) work immediately
    requestAnimationFrame(() => {
      const visibleFrame = document.querySelector("#lens-views iframe:not(.hidden)") as HTMLIFrameElement | null;

      visibleFrame?.focus();
    });
  };

  @action
  setSearchValue = (value: string) => {
    this.searchValue = value;
  };

  @action
  openDropdown = () => {
    this.isDropdownOpen = true;
  };
}

const inlineCommandPaletteStoreInjectable = getInjectable({
  id: "inline-command-palette-store",
  instantiate: () => new InlineCommandPaletteStore(),
});

export default inlineCommandPaletteStoreInjectable;
