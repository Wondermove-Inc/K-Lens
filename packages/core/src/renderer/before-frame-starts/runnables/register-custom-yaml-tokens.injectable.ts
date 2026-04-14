/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { beforeFrameStartsSecondInjectionToken } from "../tokens";

import type { languages as MonacoLanguages } from "monaco-editor";

const kubernetesFieldNames = [
  "apiVersion",
  "kind",
  "metadata",
  "spec",
  "status",
  "data",
  "items",
  "type",
  "labels",
  "annotations",
  "namespace",
  "name",
  "containers",
  "initContainers",
  "volumes",
  "selector",
  "ports",
  "serviceAccountName",
  "env",
  "resources",
  "nodeSelector",
];

const registerCustomYamlTokensInjectable = getInjectable({
  id: "register-custom-yaml-tokens",

  instantiate: () => ({
    run: async () => {
      if (typeof process !== "undefined" && process.env.JEST_WORKER_ID) {
        return;
      }

      const [{ languages }, { language: baseLanguage }] = await Promise.all([
        import("monaco-editor"),
        import("monaco-editor/esm/vs/basic-languages/yaml/yaml"),
      ]);

      const joinedFieldNames = kubernetesFieldNames.join("|");
      const keyAlternatives = `(?:"(?:${joinedFieldNames})"|'(?:${joinedFieldNames})'|(?:${joinedFieldNames}))`;

      const rootKeyPattern = new RegExp(`(${keyAlternatives})([ \\t]*)(:)( |$)`);
      const flowKeyPattern = new RegExp(`(${keyAlternatives})(?=: )`);

      const rootRule: MonacoLanguages.IShortMonarchLanguageRule1 = [
        rootKeyPattern,
        ["k8s.field", "white", "operators", "white"] as MonacoLanguages.IMonarchLanguageAction,
      ];

      const objectRule: MonacoLanguages.IShortMonarchLanguageRule1 = [flowKeyPattern, "k8s.field"];

      const tokenizer: MonacoLanguages.IMonarchLanguage["tokenizer"] = {
        ...baseLanguage.tokenizer,
        root: [rootRule, ...(baseLanguage.tokenizer?.root ?? [])],
        object: [objectRule, ...(baseLanguage.tokenizer?.object ?? [])],
      };

      languages.setMonarchTokensProvider("yaml", {
        ...(baseLanguage as MonacoLanguages.IMonarchLanguage),
        tokenizer,
      });
    },
  }),

  injectionToken: beforeFrameStartsSecondInjectionToken,
});

export default registerCustomYamlTokensInjectable;
