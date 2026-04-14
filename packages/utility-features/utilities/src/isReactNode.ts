/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import React from "react";
import { isObject } from "./type-narrowing";

// ref: https://changelog.com/posts/the-react-reactnode-type-is-a-black-hole

/** */

export type StrictReactFragment = Iterable<React.ReactNode>;

export type StrictReactNode =
  | React.ReactElement
  | number
  | string
  | StrictReactFragment
  | React.ReactPortal
  | Iterable<StrictReactNode>
  | boolean
  | null
  | undefined;

export function isReactNode(node: unknown): node is StrictReactNode {
  return (
    (isObject(node) && React.isValidElement(node)) ||
    (Array.isArray(node) && node.every(isReactNode)) ||
    node == null ||
    typeof node !== "object"
  );
}
