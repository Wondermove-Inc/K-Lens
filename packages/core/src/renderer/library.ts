/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./components/app.scss";
/* 🎯 THEME-040: 테마 CSS 변수 - Tailwind 처리 외부에서 직접 import
 * 📝 이유: Tailwind v4 JIT가 html:where(.theme-*) 선택자를 tree-shake함
 * 🔄 해결: JavaScript에서 직접 import하여 PostCSS/Tailwind 처리 우회
 */
import "./theme-variables.css";

import React from "react";
import ReactDOM from "react-dom";
import setStatusBarStatusInjectable from "./components/status-bar/set-status-bar-status.injectable";

// @experimental
export { nodeEnvInjectionToken } from "../common/vars/node-env-injection-token";
export { registerLensCore } from "./register-lens-core";
export { React, ReactDOM, setStatusBarStatusInjectable };

export * as Mobx from "mobx";
export * as MobxReact from "mobx-react";
export * as ReactJsxRuntime from "react/jsx-runtime";
export * as ReactRouter from "react-router";
export * as ReactRouterDom from "react-router-dom";
export * as commonExtensionApi from "../extensions/common-api";
export * as rendererExtensionApi from "../extensions/renderer-api";
export { metricsFeature } from "../features/metrics/metrics-feature";
