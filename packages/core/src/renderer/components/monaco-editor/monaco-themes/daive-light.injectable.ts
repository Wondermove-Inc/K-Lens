/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { customMonacoThemeInjectionToken } from "../monaco-themes";

const daiveLightThemeInjectable = getInjectable({
  id: "daive-light-theme",
  instantiate: () => ({
    name: "daive-light",
    base: "vs" as const,
    inherit: true,
    // VS Code Light+ 기본 색상 (가독성 검증된 표준 테마)
    rules: [
      {
        token: "",
        foreground: "000000",
        background: "FFFFFF",
      },
      // --- 주석 (녹색) ---
      {
        token: "comment",
        foreground: "008000",
      },
      // --- K8s 커스텀 토큰 (유지) ---
      {
        token: "k8s.field",
        foreground: "795E26",
      },
      {
        token: "k8s.field.yaml",
        foreground: "795E26",
      },
      // --- YAML 네임스페이스/태그/연산자 ---
      {
        token: "namespace",
        foreground: "267F99",
      },
      {
        token: "namespace.yaml",
        foreground: "267F99",
      },
      {
        token: "tag",
        foreground: "800000",
      },
      {
        token: "tag.yaml",
        foreground: "800000",
      },
      {
        token: "operators",
        foreground: "000000",
      },
      {
        token: "operators.directivesEnd",
        foreground: "000000",
      },
      {
        token: "operators.yaml",
        foreground: "000000",
      },
      // --- 문자열 (갈색) ---
      {
        token: "string",
        foreground: "A31515",
      },
      // --- 숫자/상수 ---
      {
        token: "constant.numeric",
        foreground: "098658",
      },
      {
        token: "constant.language",
        foreground: "0000FF",
      },
      // --- 키워드 (파랑) ---
      {
        token: "keyword",
        foreground: "AF00DB",
      },
      {
        token: "support.constant.property-value",
        foreground: "A31515",
      },
      {
        token: "constant.other.color",
        foreground: "A31515",
      },
      {
        token: "keyword.other.unit",
        foreground: "098658",
      },
      {
        token: "entity.other.attribute-name.html",
        foreground: "E50000",
      },
      {
        token: "keyword.operator",
        foreground: "000000",
      },
      // --- 스토리지/타입 ---
      {
        token: "storage",
        foreground: "0000FF",
      },
      {
        token: "entity.other.inherited-class",
        foreground: "267F99",
      },
      // --- 태그/속성 ---
      {
        token: "entity.name.tag",
        foreground: "800000",
      },
      {
        token: "constant.character.entity",
        foreground: "AF00DB",
      },
      {
        token: "support.class.js",
        foreground: "267F99",
      },
      {
        token: "entity.other.attribute-name",
        foreground: "E50000",
      },
      // --- CSS ---
      {
        token: "meta.selector.css",
        foreground: "800000",
      },
      {
        token: "entity.name.tag.css",
        foreground: "800000",
      },
      {
        token: "entity.other.attribute-name.id.css",
        foreground: "800000",
      },
      {
        token: "entity.other.attribute-name.class.css",
        foreground: "800000",
      },
      {
        token: "meta.property-name.css",
        foreground: "E50000",
      },
      // --- 함수 ---
      {
        token: "support.function",
        foreground: "795E26",
      },
      {
        token: "invalid",
        foreground: "ffffff",
        background: "cd3131",
      },
      {
        token: "punctuation.section.embedded",
        foreground: "795E26",
      },
      {
        token: "punctuation.definition.tag",
        foreground: "800000",
      },
      {
        token: "constant.other.color.rgb-value.css",
        foreground: "098658",
      },
      {
        token: "support.constant.property-value.css",
        foreground: "A31515",
      },
    ],
    colors: {
      "editor.foreground": "#000000",
      "editor.background": "#FFFFFF",
      "editor.selectionBackground": "#ADD6FF",
      "editor.lineHighlightBackground": "#F7F7F7",
      "editorCursor.foreground": "#000000",
      "editorWhitespace.foreground": "#CBCBCB",
    },
  }),
  injectionToken: customMonacoThemeInjectionToken,
});

export default daiveLightThemeInjectable;
