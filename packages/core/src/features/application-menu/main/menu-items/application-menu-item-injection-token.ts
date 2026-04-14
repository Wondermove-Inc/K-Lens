/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectionToken } from "@ogre-tools/injectable";

import type { Orderable } from "@skuberplus/utilities";

import type {
  BaseWindow,
  BrowserWindow,
  MenuItem as ElectronMenuItem,
  KeyboardEvent,
  MenuItemConstructorOptions,
} from "electron";
import type { IComputedValue } from "mobx";
import type { SetOptional } from "type-fest";

import type { Discriminable } from "../../../../common/utils/composable-responsibilities/discriminable/discriminable";
import type { MaybeShowable } from "../../../../common/utils/composable-responsibilities/showable/showable";
import type { ChildOfParentComposite, ParentOfChildComposite } from "../../../../common/utils/composite/interfaces";

export interface MayHaveKeyboardShortcut {
  keyboardShortcut?: string;
}

export interface ElectronClickable {
  // TODO: This leaky abstraction is exposed in Extension API, therefore cannot be updated
  onClick: (
    menuItem: ElectronMenuItem,
    browserWindow: (BrowserWindow | BaseWindow) | undefined,
    event: KeyboardEvent,
  ) => void;
}

export interface Labeled {
  label: string;
}

export interface MaybeLabeled extends SetOptional<Labeled, "label"> {}

type ApplicationMenuItemType<T extends string> =
  // Note: "kind" is being used for Discriminated unions of TypeScript to achieve type narrowing.
  // See: https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions
  Discriminable<T> & ParentOfChildComposite & ChildOfParentComposite & MaybeShowable & Orderable;

export type TopLevelMenu = ApplicationMenuItemType<"top-level-menu"> & { parentId: "root" } & Labeled &
  MayHaveElectronRole;

interface MayHaveElectronRole {
  role?: ElectronRoles;
}

type ElectronRoles = Exclude<MenuItemConstructorOptions["role"], undefined>;

export type SubMenu = ApplicationMenuItemType<"sub-menu"> & Labeled & ChildOfParentComposite;

export type ClickableMenuItem = ApplicationMenuItemType<"clickable-menu-item"> & MenuItem & Labeled & ElectronClickable;

export type OsActionMenuItem = ApplicationMenuItemType<"os-action-menu-item"> &
  MenuItem &
  MaybeLabeled &
  TriggersElectronAction &
  MaybeElectronVisible;

/** Electron의 visible 속성으로 변환됨 (메뉴만 숨기고 단축키는 작동) */
interface MaybeElectronVisible {
  electronVisible?: IComputedValue<boolean> | boolean;
}

type MenuItem = ChildOfParentComposite & MayHaveKeyboardShortcut;

interface TriggersElectronAction {
  actionName: ElectronRoles;
}

// Todo: SeparatorMenuItem
export type Separator = ApplicationMenuItemType<"separator"> & ChildOfParentComposite;

export type ApplicationMenuItemTypes = TopLevelMenu | SubMenu | OsActionMenuItem | ClickableMenuItem | Separator;

const applicationMenuItemInjectionToken = getInjectionToken<ApplicationMenuItemTypes>({
  id: "application-menu-item-injection-token",
});

export default applicationMenuItemInjectionToken;
