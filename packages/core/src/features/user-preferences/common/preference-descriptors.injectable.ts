/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { merge } from "lodash";
import { observable } from "mobx";
import kubeDirectoryPathInjectable from "../../../common/os/kube-directory-path.injectable";
import { defaultThemeId } from "../../../common/vars";
import currentTimezoneInjectable from "../../../common/vars/current-timezone.injectable";
import { DEFAULT_SHADCN_THEME_ID } from "../../../renderer/themes/shadcn-theme-types";
import {
  defaultEditorConfig,
  defaultExtensionRegistryUrlLocation,
  defaultPackageMirror,
  defaultTerminalConfig,
  getPreferenceDescriptor,
  packageMirrors,
} from "./preferences-helpers";

import type { ObservableMap } from "mobx";

import type { ShadcnThemeId } from "../../../renderer/themes/shadcn-theme-types";
import type { MonitorUserPreferences } from "../../ai-assistant/common/monitor-types";
import type {
  EditorConfiguration,
  ExtensionRegistry,
  KubeconfigSyncEntry,
  KubeconfigSyncValue,
  TerminalConfig,
} from "./preferences-helpers";

export type PreferenceDescriptors = ReturnType<(typeof userPreferenceDescriptorsInjectable)["instantiate"]>;

const userPreferenceDescriptorsInjectable = getInjectable({
  id: "user-preference-descriptors",
  instantiate: (di) => {
    const currentTimezone = di.inject(currentTimezoneInjectable);
    const mainKubeFolderPath = di.inject(kubeDirectoryPathInjectable);

    return {
      httpsProxy: getPreferenceDescriptor<string | undefined>({
        fromStore: (val) => val,
        toStore: (val) => val || undefined,
      }),
      shell: getPreferenceDescriptor<string | undefined>({
        fromStore: (val) => val,
        toStore: (val) => val || undefined,
      }),
      colorTheme: getPreferenceDescriptor<string>({
        fromStore: (val) => val || defaultThemeId,
        toStore: (val) => (!val || val === defaultThemeId ? undefined : val),
      }),
      shadcnTheme: getPreferenceDescriptor<ShadcnThemeId>({
        fromStore: (val) => val || DEFAULT_SHADCN_THEME_ID,
        toStore: (val) => (!val || val === DEFAULT_SHADCN_THEME_ID ? undefined : val),
      }),
      terminalTheme: getPreferenceDescriptor<string>({
        fromStore: (val) => val || "",
        toStore: (val) => val || undefined,
      }),
      localeTimezone: getPreferenceDescriptor<string>({
        fromStore: (val) => val || currentTimezone,
        toStore: (val) => (!val || val === currentTimezone ? undefined : val),
      }),
      allowUntrustedCAs: getPreferenceDescriptor<boolean>({
        fromStore: (val) => val ?? false,
        toStore: (val) => (!val ? undefined : val),
      }),
      allowErrorReporting: getPreferenceDescriptor<boolean>({
        fromStore: (val) => val ?? true,
        toStore: (val) => (val ? undefined : val),
      }),
      downloadMirror: getPreferenceDescriptor<string>({
        fromStore: (val) => (!val || !packageMirrors.has(val) ? defaultPackageMirror : val),
        toStore: (val) => (val === defaultPackageMirror ? undefined : val),
      }),
      downloadKubectlBinaries: getPreferenceDescriptor<boolean>({
        fromStore: (val) => val ?? true,
        toStore: (val) => (val ? undefined : val),
      }),
      downloadBinariesPath: getPreferenceDescriptor<string | undefined>({
        fromStore: (val) => val,
        toStore: (val) => val || undefined,
      }),
      kubectlBinariesPath: getPreferenceDescriptor<string | undefined>({
        fromStore: (val) => val,
        toStore: (val) => val || undefined,
      }),
      openAtLogin: getPreferenceDescriptor<boolean>({
        fromStore: (val) => val ?? false,
        toStore: (val) => (!val ? undefined : val),
      }),
      terminalCopyOnSelect: getPreferenceDescriptor<boolean>({
        fromStore: (val) => val ?? false,
        toStore: (val) => (!val ? undefined : val),
      }),
      hiddenTableColumns: getPreferenceDescriptor<[string, string[]][], Map<string, Set<string>>>({
        fromStore: (val = []) => new Map(val.map(([tableId, columnIds]) => [tableId, new Set(columnIds)])),
        toStore: (val) => {
          const res: [string, string[]][] = [];

          for (const [table, columns] of val) {
            if (columns.size) {
              res.push([table, Array.from(columns)]);
            }
          }

          return res.length ? res : undefined;
        },
      }),
      syncKubeconfigEntries: getPreferenceDescriptor<KubeconfigSyncEntry[], ObservableMap<string, KubeconfigSyncValue>>(
        {
          fromStore: (val) =>
            observable.map(val?.map(({ filePath, ...rest }) => [filePath, rest]) ?? [[mainKubeFolderPath, {}]]),
          toStore: (val) =>
            val.size === 1 && val.has(mainKubeFolderPath)
              ? undefined
              : Array.from(val, ([filePath, rest]) => ({ filePath, ...rest })),
        },
      ),
      editorConfiguration: getPreferenceDescriptor<Partial<EditorConfiguration>, EditorConfiguration>({
        fromStore: (val) => merge(defaultEditorConfig, val),
        toStore: (val) => val,
      }),
      terminalConfig: getPreferenceDescriptor<Partial<TerminalConfig>, TerminalConfig>({
        fromStore: (val) => merge(defaultTerminalConfig, val),
        toStore: (val) => val,
      }),
      extensionRegistryUrl: getPreferenceDescriptor<ExtensionRegistry>({
        fromStore: (val) =>
          val ?? {
            location: defaultExtensionRegistryUrlLocation,
          },
        toStore: (val) => (val.location === defaultExtensionRegistryUrlLocation ? undefined : val),
      }),
      aiProvider: getPreferenceDescriptor<string>({
        fromStore: (val) => val || "openai",
        toStore: (val) => (!val || val === "openai" ? undefined : val),
      }),
      aiApiKeys: getPreferenceDescriptor<Partial<Record<string, string>>, Record<string, string | undefined>>({
        fromStore: (val) => val || {},
        toStore: (val) => {
          // 빈 객체이거나 모든 값이 undefined면 저장하지 않음
          const hasKeys = Object.values(val || {}).some((key) => key !== undefined && key !== "");

          return hasKeys ? val : undefined;
        },
      }),
      // 🎯 목적: LLM Provider별 활성화 상태 저장 (스위치 ON/OFF)
      // 기본값: 빈 객체 (모든 Provider OFF)
      aiProviderEnabled: getPreferenceDescriptor<Record<string, boolean>, Record<string, boolean>>({
        fromStore: (val) => val || {},
        toStore: (val) => {
          // 🎯 수정: 설정된 항목이 있으면 저장 (true든 false든)
          const hasValues = Object.keys(val || {}).length > 0;

          return hasValues ? val : undefined;
        },
      }),
      // 🎯 목적: 현재 선택된 AI 모델 저장
      // 기본값: 빈 문자열 (사용자가 직접 선택해야 함)
      aiModel: getPreferenceDescriptor<string>({
        fromStore: (val) => val || "",
        toStore: (val) => val || undefined,
      }),
      // 🎯 목적: Provider별 최근 사용 모델 기록
      // 형식: { "openai": "gpt-5.2", "anthropic": "claude-sonnet-4-5-20250929" }
      aiRecentModels: getPreferenceDescriptor<Record<string, string>, Record<string, string>>({
        fromStore: (val) => val || {},
        toStore: (val) => {
          const hasModels = Object.keys(val || {}).length > 0;

          return hasModels ? val : undefined;
        },
      }),
      // 🎯 목적: 개별 모델 활성화 상태 저장 (스위치 ON/OFF)
      // 형식: { "gpt-5.2": true, "gpt-4.1": false, ... }
      // 기본값: 빈 객체 (모든 모델 OFF)
      aiModelEnabled: getPreferenceDescriptor<Record<string, boolean>, Record<string, boolean>>({
        fromStore: (val) => val || {},
        toStore: (val) => {
          // 🎯 수정: 설정된 항목이 있으면 저장 (true든 false든)
          const hasValues = Object.keys(val || {}).length > 0;

          return hasValues ? val : undefined;
        },
      }),
      // ============================================
      // 🎯 Ollama 설정
      // ============================================
      // 🎯 목적: Ollama 서버 Base URL 저장
      // 기본값: http://localhost:11434
      ollamaBaseUrl: getPreferenceDescriptor<string>({
        fromStore: (val) => val || "http://localhost:11434",
        toStore: (val) => (!val || val === "http://localhost:11434" ? undefined : val),
      }),
      // 🎯 목적: 현재 선택된 Ollama 모델명 저장
      // 기본값: 빈 문자열 (placeholder로 gemma3:4b 표시)
      ollamaModel: getPreferenceDescriptor<string>({
        fromStore: (val) => val ?? "",
        toStore: (val) => val || undefined,
      }),
      // 🎯 목적: OpenRouter 커스텀 모델 ID (사용자 직접 입력)
      openrouterCustomModel: getPreferenceDescriptor<string | undefined>({
        fromStore: (val) => val || undefined,
        toStore: (val) => val || undefined,
      }),
      // ============================================
      // 🎯 Extension URL 설정
      // ============================================
      // 🎯 목적: Settings > Extension에서 추가한 URL 목록 저장
      // - Hotbar의 Observability 클릭 시 첫 번째 URL을 iframe으로 표시
      // - 기본값: 빈 배열 []
      extensionUrls: getPreferenceDescriptor<string[], string[]>({
        fromStore: (val) => val || [],
        toStore: (val) => (val && val.length > 0 ? val : undefined),
      }),
      // ============================================
      // 🎯 File Explorer 설정
      // 🔄 변경이력: 2026-01-26 - File Explorer Settings 탭 추가
      // ============================================
      // 🎯 목적: File Explorer 기본 폴더 경로
      // - 미설정 시 OS Home 디렉토리 사용
      // - 클러스터 연결 시 자동 열기 경로로 사용
      fileExplorerDefaultPath: getPreferenceDescriptor<string | undefined>({
        fromStore: (val) => val,
        toStore: (val) => val || undefined,
      }),
      // 🎯 목적: 숨김 파일 표시 여부
      // - 기본값: false (숨김 파일 숨김)
      fileExplorerShowHiddenFiles: getPreferenceDescriptor<boolean>({
        fromStore: (val) => val ?? false,
        toStore: (val) => (val ? val : undefined),
      }),
      // 🎯 목적: 클러스터 연결 시 기본 폴더 자동 열기
      // - 기본값: true (FIX-039: 사용자 요청에 따라 기본값 변경)
      fileExplorerAutoOpenOnConnect: getPreferenceDescriptor<boolean>({
        fromStore: (val) => val ?? true,
        toStore: (val) => (val === false ? false : undefined), // false일 때만 명시적으로 저장
      }),
      // ============================================
      // 🎯 WSL 설정 (Windows only)
      // 🔄 변경이력: 2026-02-03 - WSL UX 개선
      // ============================================
      // 🎯 목적: WSL을 터미널 쉘로 사용 여부
      // - 기본값: false (Windows에서만 의미 있음)
      wslEnabled: getPreferenceDescriptor<boolean>({
        fromStore: (val) => val ?? false,
        toStore: (val) => (val ? val : undefined),
      }),
      // 🎯 목적: 사용할 WSL 배포판 이름
      // - 빈 문자열: 기본 배포판 사용
      wslDistribution: getPreferenceDescriptor<string>({
        fromStore: (val) => val ?? "",
        toStore: (val) => (val ? val : undefined),
      }),
      // ============================================
      // 🎯 Cluster Monitor 설정
      // ============================================
      monitorConfig: getPreferenceDescriptor<MonitorUserPreferences>({
        fromStore: (val) =>
          val ?? {
            enabled: false,
            trayResident: false,
            intervalMs: 300_000,
            provider: "anthropic",
            modelId: "claude-sonnet-4-6",
            clusters: [],
          },
        toStore: (val) => val,
      }),
    } as const;
  },
});

export default userPreferenceDescriptorsInjectable;
