/**
 * Manages keyboard focus state for tables.
 * Tracks the focused row index independently of mouse selection.
 * Also holds a reference to sorted items for action shortcuts (Enter/Space/d/e/etc).
 */

import { action, computed, makeObservable, observable } from "mobx";

import type { ItemObject } from "@skuberplus/list-layout";

export class TableFocusManager {
  @observable focusedIndex: number | null = null;
  @observable private _itemCount = 0;
  @observable.ref private _items: ItemObject[] = [];
  @observable pageSize = 0;

  constructor() {
    makeObservable(this);
  }

  @computed get hasFocus(): boolean {
    return this.focusedIndex !== null;
  }

  /** Get the currently focused item, or null if none. */
  @computed get focusedItem(): ItemObject | null {
    if (this.focusedIndex === null || this.focusedIndex < 0 || this.focusedIndex >= this._items.length) {
      return null;
    }
    return this._items[this.focusedIndex];
  }

  @action
  setItems(items: ItemObject[]) {
    this._items = items;
    this._itemCount = items.length;
    // Clamp focused index if items were removed
    if (this.focusedIndex !== null && this.focusedIndex >= items.length) {
      this.focusedIndex = items.length > 0 ? items.length - 1 : null;
    }
  }

  @action
  setItemCount(count: number) {
    this._itemCount = count;
    if (this.focusedIndex !== null && this.focusedIndex >= count) {
      this.focusedIndex = count > 0 ? count - 1 : null;
    }
  }

  @action
  moveDown() {
    if (this._itemCount === 0) return;

    if (this.focusedIndex === null) {
      this.focusedIndex = 0;
    } else if (this.focusedIndex < this._itemCount - 1) {
      this.focusedIndex++;
    }
  }

  @action
  moveUp() {
    if (this._itemCount === 0) return;

    if (this.focusedIndex === null) {
      this.focusedIndex = 0;
    } else if (this.focusedIndex > 0) {
      this.focusedIndex--;
    }
  }

  @action
  goToFirst() {
    if (this._itemCount === 0) return;
    this.focusedIndex = 0;
  }

  @action
  goToLast() {
    if (this._itemCount === 0) return;
    this.focusedIndex = this._itemCount - 1;
  }

  @action
  pageForward() {
    if (this._itemCount === 0) return;
    if (this.focusedIndex === null) {
      this.focusedIndex = 0;
      return;
    }
    this.focusedIndex = Math.min(this.focusedIndex + this.pageSize, this._itemCount - 1);
  }

  @action
  pageBackward() {
    if (this._itemCount === 0) return;
    if (this.focusedIndex === null) {
      this.focusedIndex = 0;
      return;
    }
    this.focusedIndex = Math.max(this.focusedIndex - this.pageSize, 0);
  }

  @action
  setFocusedIndex(index: number) {
    if (index >= 0 && index < this._itemCount) {
      this.focusedIndex = index;
    }
  }

  @action
  reset() {
    this.focusedIndex = null;
    this._items = [];
    this._itemCount = 0;
    this.pageSize = 0;
  }
}
