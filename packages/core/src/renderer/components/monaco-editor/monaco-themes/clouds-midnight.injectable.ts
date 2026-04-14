/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { customMonacoThemeInjectionToken } from "../monaco-themes";

const cloudsMidnightThemeInjectable = getInjectable({
  id: "clouds-midnight-theme",
  instantiate: () => ({
    name: "clouds-midnight",
    base: "vs-dark" as const,
    inherit: true,
    // VS Code Dark+ 기본 색상 (가독성 검증된 표준 테마)
    rules: [
      {
        background: "1e1e1e",
        token: "",
      },
      // --- 주석 (녹색) ---
      {
        foreground: "6A9955",
        token: "comment",
      },
      // --- K8s 커스텀 토큰 (유지) ---
      {
        foreground: "DCDCAA",
        token: "k8s.field",
      },
      {
        foreground: "DCDCAA",
        token: "k8s.field.yaml",
      },
      // --- YAML 네임스페이스/태그/연산자 ---
      {
        foreground: "4EC9B0",
        token: "namespace",
      },
      {
        foreground: "4EC9B0",
        token: "namespace.yaml",
      },
      {
        foreground: "569CD6",
        token: "tag",
      },
      {
        foreground: "569CD6",
        token: "tag.yaml",
      },
      {
        foreground: "D4D4D4",
        token: "operators",
      },
      {
        foreground: "D4D4D4",
        token: "operators.directivesEnd",
      },
      {
        foreground: "D4D4D4",
        token: "operators.yaml",
      },
      // --- 문자열 (오렌지) ---
      {
        foreground: "CE9178",
        token: "string",
      },
      // --- 숫자/상수 ---
      {
        foreground: "B5CEA8",
        token: "constant.numeric",
      },
      {
        foreground: "569CD6",
        token: "constant.language",
      },
      // --- 키워드 (보라/퍼플) ---
      {
        foreground: "C586C0",
        token: "keyword",
      },
      {
        foreground: "CE9178",
        token: "support.constant.property-value",
      },
      {
        foreground: "CE9178",
        token: "constant.other.color",
      },
      {
        foreground: "B5CEA8",
        token: "keyword.other.unit",
      },
      {
        foreground: "9CDCFE",
        token: "entity.other.attribute-name.html",
      },
      {
        foreground: "D4D4D4",
        token: "keyword.operator",
      },
      // --- 스토리지/타입 ---
      {
        foreground: "569CD6",
        token: "storage",
      },
      {
        foreground: "4EC9B0",
        token: "entity.other.inherited-class",
      },
      // --- 태그/속성 ---
      {
        foreground: "569CD6",
        token: "entity.name.tag",
      },
      {
        foreground: "C586C0",
        token: "constant.character.entity",
      },
      {
        foreground: "4EC9B0",
        token: "support.class.js",
      },
      {
        foreground: "9CDCFE",
        token: "entity.other.attribute-name",
      },
      // --- CSS ---
      {
        foreground: "D7BA7D",
        token: "meta.selector.css",
      },
      {
        foreground: "D7BA7D",
        token: "entity.name.tag.css",
      },
      {
        foreground: "D7BA7D",
        token: "entity.other.attribute-name.id.css",
      },
      {
        foreground: "D7BA7D",
        token: "entity.other.attribute-name.class.css",
      },
      {
        foreground: "9CDCFE",
        token: "meta.property-name.css",
      },
      {
        foreground: "DCDCAA",
        token: "support.function",
      },
      {
        foreground: "ffffff",
        background: "F44747",
        token: "invalid",
      },
      {
        foreground: "DCDCAA",
        token: "punctuation.section.embedded",
      },
      {
        foreground: "808080",
        token: "punctuation.definition.tag",
      },
      {
        foreground: "CE9178",
        token: "constant.other.color.rgb-value.css",
      },
      {
        foreground: "CE9178",
        token: "support.constant.property-value.css",
      },
    ],
    colors: {
      "editor.foreground": "#D4D4D4",
      "editor.background": "#1e1e1e",
      "editor.selectionBackground": "#264F78",
      "editor.lineHighlightBackground": "#2A2D2E",
      "editorCursor.foreground": "#AEAFAD",
      "editorWhitespace.foreground": "#3B3A32",
    },
  }),
  injectionToken: customMonacoThemeInjectionToken,
});

export default cloudsMidnightThemeInjectable;
