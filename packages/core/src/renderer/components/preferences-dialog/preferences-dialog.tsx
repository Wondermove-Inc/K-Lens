/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Preferences Dialog 모달 컴포넌트
 *
 * shadcn Dialog + Sidebar를 사용하여 전역 설정을 모달 형식으로 표시합니다.
 *
 * 📝 주의사항:
 * - Dialog 크기: h-[85vh], max-w-[70%] (반응형)
 * - SidebarProvider + Sidebar + main 레이아웃
 * - shadcn 디자인 토큰 사용 (테마 일관성)
 * - Settings 템플릿 기반 UI
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { ipcRenderer } from "electron";
import {
  AppWindow,
  ArrowRight,
  Bot,
  BrainCircuit,
  Check,
  ChevronRight,
  ChevronUp,
  // Code, // 🎯 TODO: Editor 기능 구현 후 활성화
  Container,
  FileText,
  FolderOpen, // 🎯 2026-01-26: File Explorer 아이콘
  FolderSync,
  Link,
  Loader2,
  // Megaphone, // 🎯 TODO: Editor/Terminal 기능 구현 후 활성화
  Network,
  Package, // 🎯 2026-01-12: Helm Repo 아이콘
  Plug, // 🎯 2026-01-07: MCP Servers 아이콘
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles, // 🎯 Personalization 아이콘
  Telescope,
  Terminal,
  Trash2,
  Zap,
} from "lucide-react";
import { runInAction } from "mobx";
import { observer } from "mobx-react";
import * as React from "react";
import { isFeatureEnabled } from "../../../features/ai-assistant/common/feature-flags";
import agentIPCClientInjectable from "../../../features/ai-assistant/renderer/agent-ipc-client.injectable";
import { MonitorSettingsPanel } from "../../../features/ai-assistant/renderer/monitor-ui/monitor-settings-panel";
import {
  AI_MODELS,
  getAvailableModels,
  getCostTierLabel,
  getModelDisplayName,
  getProviderByModel,
} from "../../../features/ai-assistant/renderer/provider/ai-models";
import clustersInjectable from "../../../features/cluster/storage/common/clusters.injectable";
import { HelmCharts } from "../../../features/helm-charts/child-features/preferences/renderer/helm-charts";
import openPathPickingDialogInjectable from "../../../features/path-picking-dialog/renderer/pick-paths.injectable";
import activePreferenceTabInjectable from "../../../features/preferences/renderer/active-preference-tab.injectable";
import preferencesDialogStateInjectable from "../../../features/preferences/renderer/preferences-dialog-state.injectable";
import { defaultPackageMirror, packageMirrors } from "../../../features/user-preferences/common/preferences-helpers";
import encryptApiKeyInjectable from "../../../features/user-preferences/renderer/encrypt-api-key.injectable";
import validateOpenRouterModelInjectable from "../../../features/user-preferences/renderer/validate-openrouter-model.injectable";
import { MCPSettings } from "../ai-chat/mcp-settings"; // 🎯 2026-01-07: MCP Settings 페이지
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../shadcn-ui/alert-dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../shadcn-ui/breadcrumb";
import { Button } from "../shadcn-ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../shadcn-ui/dialog";
// 🎯 TODO: Editor/Terminal 기능 구현 후 활성화
// import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../shadcn-ui/empty";
import { Field, FieldContent, FieldError, FieldLabel } from "../shadcn-ui/field";
import { Input } from "../shadcn-ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "../shadcn-ui/input-group";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia } from "../shadcn-ui/item";
import { Label } from "../shadcn-ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../shadcn-ui/select";
import { Separator } from "../shadcn-ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "../shadcn-ui/sidebar";
import { Switch } from "../shadcn-ui/switch";
import { AgentSettings } from "./agent-settings";
import { AiSettings } from "./ai-settings";
import { OpenRouterModelBrowser } from "./openrouter-model-browser"; // 🎯 OpenRouter 모델 탐색 기능
import { SkillSettings } from "./skill-settings";

import type { OpenPathPickingDialog } from "../../../features/path-picking-dialog/renderer/pick-paths.injectable";
import type { ActivePreferenceTab } from "../../../features/preferences/renderer/active-preference-tab.injectable";

/**
 * 🎯 목적: PreferencesDialog Props 인터페이스
 */
export interface PreferencesDialogProps {
  /**
   * Dialog 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * Dialog 상태 변경 핸들러
   */
  onOpenChange: (open: boolean) => void;
}

/**
 * 🎯 목적: PreferencesDialog Dependencies 인터페이스
 */
interface Dependencies {
  /**
   * 활성 Preference 탭 관리
   */
  activePreferenceTab: ActivePreferenceTab;

  /**
   * shadcn 테마 적용 함수
   */
  applyShadcnTheme: (themeId: import("../../themes/shadcn-theme-types").ShadcnThemeId) => void;

  /**
   * User preferences state (MobX observable)
   */
  userPreferencesState: import("../../../features/user-preferences/common/state.injectable").UserPreferencesState;

  /**
   * API Key 암호화/복호화 서비스
   */
  encryptService: import("../../../features/user-preferences/renderer/encrypt-api-key.injectable").EncryptedApiKeyService;

  /**
   * Preferences Dialog 상태 (열림/닫힘 및 초기 메뉴)
   */
  preferencesDialogState: import("../../../features/preferences/renderer/preferences-dialog-state.injectable").PreferencesDialogState;

  /**
   * Ollama 서비스 (IPC 통신)
   */
  ollamaService: import("../../../features/ollama/renderer/ollama-service.injectable").OllamaService;

  /**
   * 경로 선택 대화상자
   */
  openPathPickingDialog: OpenPathPickingDialog;

  /**
   * 기본 바이너리 경로 (binaries)
   */
  defaultPathForGeneralBinaries: string;

  /**
   * 기본 kubectl 바이너리 경로
   */
  defaultPathForKubectlBinaries: string;

  /**
   * 기본 쉘 경로 (OS별 기본값)
   */
  defaultShell: string;

  /**
   * Windows 플랫폼 여부 (WSL 설정 표시용)
   */
  isWindows: boolean;
  connectedClusters: Array<{ id: string; name: string; kubeconfigPath: string }>;
  agentIPCClient: import("../../../features/ai-assistant/renderer/agent-ipc-client").AgentIPCClient;

  /**
   * OpenRouter Model Validation Service
   * Purpose: Validates custom model ID against OpenRouter's model catalog
   */
  validateOpenRouterModel: (
    modelId: string,
  ) => Promise<
    import("../../../common/features/user-preferences/validate-openrouter-model-channel").ValidateOpenRouterModelResponse
  >;
}

/**
 * 🎯 목적: 메뉴 네비게이션 데이터
 *
 * 📝 2026-01-07: MCP Servers 메뉴 추가
 * - LLM Models 바로 다음에 위치
 * - Plug 아이콘 사용
 */
function getNavData() {
  return {
    nav: [
      { name: "App", icon: AppWindow },
      { name: "File Explorer", icon: FolderOpen }, // 🎯 2026-01-26: File Explorer 설정 (App 다음 위치)
      { name: "Proxy", icon: Network },
      { name: "Kubernetes", icon: Container },
      { name: "Helm Repo", icon: Package }, // 🎯 2026-01-12: Helm Repository 관리 (Kubernetes에서 분리)
      // 🎯 TODO: Editor 기능 구현 후 활성화
      // { name: "Editor", icon: Code },
      { name: "Terminal", icon: Terminal },
      { name: "LLM Models", icon: Bot },
      { name: "AI Settings", icon: Sparkles },
      { name: "Skills", icon: Zap },
      ...(isFeatureEnabled("SKILL_EXPERT") ? [{ name: "Agents", icon: BrainCircuit }] : []),
      ...(isFeatureEnabled("CLUSTER_MONITOR") ? [{ name: "Cluster Monitor", icon: Shield }] : []),
      { name: "MCP Servers", icon: Plug }, // 🎯 2026-01-07: MCP Servers
      { name: "Observability", icon: Telescope },
    ],
  };
}

/**
 * 🎯 목적: App 메뉴의 콘텐츠 영역 - 앱 관련 설정
 */
const AppContent = observer(
  ({
    applyShadcnTheme,
    userPreferencesState,
  }: {
    applyShadcnTheme: (themeId: import("../../themes/shadcn-theme-types").ShadcnThemeId) => void;
    userPreferencesState: import("../../../features/user-preferences/common/state.injectable").UserPreferencesState;
  }) => {
    // 🎯 목적: 테마 변경 핸들러 (applyShadcnTheme이 자동으로 state 업데이트)
    const handleThemeChange = React.useCallback(
      (themeId: string) => {
        const typedThemeId = themeId as import("../../themes/shadcn-theme-types").ShadcnThemeId;

        applyShadcnTheme(typedThemeId);
      },
      [applyShadcnTheme],
    );

    return (
      <>
        {/* Theme */}
        <div className="flex w-full flex-col gap-3">
          <Label htmlFor="app-theme" className="text-foreground text-sm font-medium">
            Theme
          </Label>
          <Select value={userPreferencesState.shadcnTheme} onValueChange={handleThemeChange}>
            <SelectTrigger className="bg-input/30 border-border w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default-light">Default Light</SelectItem>
              <SelectItem value="default-dark">Default Dark</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Extension install registry */}
        {/* <div className="flex w-full flex-col gap-3">
          <Label htmlFor="extension-registry" className="text-foreground text-sm font-medium">
            Extension install registry
          </Label>
          <p className="text-muted-foreground text-sm">
            This setting is to change the registry URL for installing extensions by name. If you are unable to access
            the default registry (https://registry.npmjs.org) you can change it in your .npmrc file or in the input
            below.
          </p>
          <Select defaultValue="default">
            <SelectTrigger className="bg-input/30 border-border w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default (npmjs.org)</SelectItem>
              <SelectItem value="custom">Custom URL</SelectItem>
            </SelectContent>
          </Select>
          <Input
            id="custom-registry-url"
            type="text"
            placeholder="Custom extension registry URL..."
            className="bg-input/30 border-border"
          />
        </div> */}

        {/* Start-up */}
        <div className="flex items-start gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-center gap-3">
              <Label htmlFor="app-startup" className="text-foreground flex-1 text-sm font-medium">
                Start-up
              </Label>
              <Switch
                id="app-startup"
                checked={userPreferencesState.openAtLogin}
                onCheckedChange={(checked) => {
                  userPreferencesState.openAtLogin = checked;
                }}
              />
            </div>
            <p className="text-muted-foreground text-sm">Automatically start Skuber⁺ Client on login</p>
          </div>
        </div>

        {/* Locate timezone */}
        {/* <div className="flex w-full flex-col gap-3">
          <Label htmlFor="locate-timezone" className="text-foreground text-sm font-medium">
            Locate timezone
          </Label>
          <Select
            value={userPreferencesState.localeTimezone}
            onValueChange={(value) => {
              userPreferencesState.localeTimezone = value;
            }}
          >
            <SelectTrigger className="bg-input/30 border-border w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
            </SelectContent>
          </Select>
        </div> */}
      </>
    );
  },
);

/**
 * 🎯 목적: File Explorer 메뉴의 콘텐츠 영역 - 파일 탐색기 관련 설정
 * 🔄 변경이력: 2026-01-26 - File Explorer Settings 탭 추가
 */
const FileExplorerContent = observer(function FileExplorerContent({
  userPreferencesState,
  openPathPickingDialog,
}: {
  userPreferencesState: import("../../../features/user-preferences/common/state.injectable").UserPreferencesState;
  openPathPickingDialog: OpenPathPickingDialog;
}) {
  return (
    <>
      {/* Default Folder Path */}
      <div className="flex w-full flex-col gap-3">
        <Label htmlFor="file-explorer-default-path" className="text-foreground text-sm font-medium">
          Default folder path
        </Label>
        <p className="text-muted-foreground text-sm">
          Set the default folder to open in File Explorer. If not set, the system home directory will be used.
        </p>
        <div className="flex gap-2">
          <Input
            id="file-explorer-default-path"
            type="text"
            placeholder="e.g., /home/user/projects or ~/projects"
            className="bg-input/30 border-border flex-1"
            value={userPreferencesState.fileExplorerDefaultPath ?? ""}
            onChange={(event) => {
              userPreferencesState.fileExplorerDefaultPath = event.target.value || undefined;
            }}
          />
          <Button
            variant="outline"
            onClick={() => {
              openPathPickingDialog({
                message: "Select default folder",
                buttonLabel: "Select",
                properties: ["openDirectory"],
                onPick: (paths) => {
                  if (paths?.length) {
                    userPreferencesState.fileExplorerDefaultPath = paths[0];
                  }
                },
              });
            }}
          >
            <FolderOpen className="h-4 w-4" />
            Browse
          </Button>
        </div>
      </div>

      {/* Show Hidden Files */}
      <div className="flex items-start gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center gap-3">
            <Label htmlFor="file-explorer-show-hidden" className="text-foreground flex-1 text-sm font-medium">
              Show hidden files
            </Label>
            <Switch
              id="file-explorer-show-hidden"
              checked={userPreferencesState.fileExplorerShowHiddenFiles ?? false}
              onCheckedChange={(checked) => {
                userPreferencesState.fileExplorerShowHiddenFiles = checked;
              }}
            />
          </div>
          <p className="text-muted-foreground text-sm">
            Show files and folders that start with a dot (.) in File Explorer
          </p>
        </div>
      </div>

      {/* Auto Open on Cluster Connect */}
      <div className="flex items-start gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center gap-3">
            <Label htmlFor="file-explorer-auto-open" className="text-foreground flex-1 text-sm font-medium">
              Auto open on cluster connect
            </Label>
            <Switch
              id="file-explorer-auto-open"
              checked={userPreferencesState.fileExplorerAutoOpenOnConnect ?? true}
              onCheckedChange={(checked) => {
                userPreferencesState.fileExplorerAutoOpenOnConnect = checked;
              }}
            />
          </div>
          <p className="text-muted-foreground text-sm">
            Automatically open the default folder in File Explorer when connecting to a cluster
          </p>
        </div>
      </div>
    </>
  );
});

/**
 * 🎯 목적: Proxy 메뉴의 콘텐츠 영역 - 프록시 관련 설정
 */
const ProxyContent = observer(function ProxyContent({
  userPreferencesState,
}: {
  userPreferencesState: import("../../../features/user-preferences/common/state.injectable").UserPreferencesState;
}) {
  return (
    <>
      {/* HTTP Proxy */}
      <div className="flex w-full flex-col gap-3">
        <Label htmlFor="http-proxy" className="text-foreground text-sm font-medium">
          HTTP proxy
        </Label>
        <Input
          id="http-proxy"
          type="text"
          placeholder="Type HTTP proxy url (example: http://proxy.acme.org:8080)"
          className="bg-input/30 border-border"
          value={userPreferencesState.httpsProxy ?? ""}
          onChange={(event) => {
            userPreferencesState.httpsProxy = event.target.value || undefined;
          }}
        />
        <p className="text-muted-foreground text-sm">Proxy is used only for non-cluster communication.</p>
      </div>

      {/* Certificate Trust */}
      <div className="flex items-start gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center gap-3">
            <Label htmlFor="certificate-trust" className="text-foreground flex-1 text-sm font-medium">
              Certificate trust - Allow untrusted certificate authorities
            </Label>
            <Switch
              id="certificate-trust"
              checked={userPreferencesState.allowUntrustedCAs}
              onCheckedChange={(checked) => {
                userPreferencesState.allowUntrustedCAs = checked;
              }}
            />
          </div>
          <p className="text-muted-foreground text-sm">
            This Will Make Skuber⁺ Client Trust Any Certificate Authority Without Any Validations. Needed With Some
            Corporate Proxies That Do Certificate Re-Writing. Does Not Affect Cluster Communications!
          </p>
        </div>
      </div>
    </>
  );
});

/* 🎯 TODO: Editor 기능 구현 후 활성화
function EditorContent() {
  return (
    <Empty className="bg-muted/30 border-border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Megaphone className="h-5 w-5" />
        </EmptyMedia>
        <EmptyTitle>Updated Soon</EmptyTitle>
        <EmptyDescription>Ability to custom editor style will be updated soon.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
*/

/**
 * 🎯 목적: Terminal 메뉴의 콘텐츠 영역 - 터미널 쉘 경로 및 copy & paste 설정
 * 📝 2026-02-03: WSL 설정 UI 추가
 */
const TerminalContent = observer(function TerminalContent({
  userPreferencesState,
  defaultShell,
  isWindows,
}: {
  userPreferencesState: import("../../../features/user-preferences/common/state.injectable").UserPreferencesState;
  defaultShell: string;
  isWindows: boolean;
}) {
  // 🎯 WSL 상태 관리
  const [wslInstalled, setWslInstalled] = React.useState<boolean | null>(null);
  const [distros, setDistros] = React.useState<string[]>([]);
  const [defaultDistro, setDefaultDistro] = React.useState<string | undefined>(undefined);
  const [wslLoading, setWslLoading] = React.useState(true);

  React.useEffect(() => {
    if (!isWindows) {
      setWslLoading(false);
      return;
    }

    const checkWslStatus = async () => {
      try {
        setWslLoading(true);

        // WSL 설치 상태 확인
        const statusResult = await ipcRenderer.invoke("wsl:getStatus");
        setWslInstalled(statusResult.installed);

        if (statusResult.installed) {
          // WSL 배포판 목록 조회
          const distrosResult = await ipcRenderer.invoke("wsl:getDistros");
          if (distrosResult.success) {
            setDistros(distrosResult.distros);
            setDefaultDistro(distrosResult.defaultDistro);

            // 사용자가 아직 배포판을 선택하지 않았다면 기본값 설정
            if (!userPreferencesState.wslDistribution && distrosResult.defaultDistro) {
              userPreferencesState.wslDistribution = distrosResult.defaultDistro;
            }
          }
        }
      } catch (error) {
        console.error("[WSL] Failed to check WSL status:", error);
        setWslInstalled(false);
      } finally {
        setWslLoading(false);
      }
    };

    checkWslStatus();
  }, [isWindows, userPreferencesState]);

  return (
    <>
      {/* Terminal Shell Path - WSL 활성화 시 숨김 */}
      {!(isWindows && userPreferencesState.wslEnabled) && (
        <div className="flex w-full flex-col gap-3">
          <Label htmlFor="terminal-shell-path" className="text-foreground text-sm font-medium">
            Terminal shell path
          </Label>
          <Input
            id="terminal-shell-path"
            type="text"
            placeholder={defaultShell}
            className="bg-input/30 border-border"
            value={userPreferencesState.shell ?? ""}
            onChange={(event) => {
              userPreferencesState.shell = event.target.value || undefined;
            }}
          />
          <p className="text-muted-foreground text-sm">
            Path to the shell (e.g., /bin/zsh, /bin/bash, powershell.exe). Leave empty to use system default.
          </p>
        </div>
      )}

      {/* 🎯 WSL 설정 섹션 (Windows only) */}
      {isWindows && (
        <div className="flex w-full flex-col gap-3">
          <Label className="text-foreground text-sm font-medium">WSL (Windows Subsystem for Linux)</Label>

          {wslLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Checking WSL status...</span>
            </div>
          ) : !wslInstalled ? (
            <div className="bg-warning/10 border-warning/20 text-warning-foreground rounded-md border p-3 text-sm">
              <p className="font-medium">WSL is not installed</p>
              <p className="text-muted-foreground mt-1">
                Install WSL to use Linux distributions in terminal.{" "}
                <a
                  href="https://learn.microsoft.com/en-us/windows/wsl/install"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Learn more
                </a>
              </p>
            </div>
          ) : (
            <>
              {/* WSL 활성화 스위치 */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-sm">Use WSL as terminal shell</span>
                  <span className="text-muted-foreground text-xs">Run terminal commands in Linux environment</span>
                </div>
                <Switch
                  id="wsl-enabled"
                  checked={userPreferencesState.wslEnabled ?? false}
                  onCheckedChange={(checked) => {
                    userPreferencesState.wslEnabled = checked;
                  }}
                />
              </div>

              {/* WSL 배포판 선택 (활성화 시에만 표시) */}
              {userPreferencesState.wslEnabled && distros.length > 0 && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="wsl-distro" className="text-muted-foreground text-xs">
                    WSL Distribution
                  </Label>
                  <Select
                    value={userPreferencesState.wslDistribution ?? defaultDistro ?? distros[0]}
                    onValueChange={(value) => {
                      userPreferencesState.wslDistribution = value;
                    }}
                  >
                    <SelectTrigger id="wsl-distro" className="bg-input/30 border-border">
                      <SelectValue placeholder="Select distribution" />
                    </SelectTrigger>
                    <SelectContent>
                      {distros.map((distro) => (
                        <SelectItem key={distro} value={distro}>
                          {distro}
                          {distro === defaultDistro && (
                            <span className="text-muted-foreground ml-2 text-xs">(default)</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 🎯 TODO: Terminal copy & paste 기능 구현 후 활성화
      <div className="flex items-start gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center gap-3">
            <Label htmlFor="terminal-copy-paste" className="text-foreground flex-1 text-sm font-medium">
              Terminal copy & paste
            </Label>
            <Switch
              id="terminal-copy-paste"
              checked={userPreferencesState.terminalCopyOnSelect ?? false}
              onCheckedChange={(checked) => {
                userPreferencesState.terminalCopyOnSelect = checked;
              }}
            />
          </div>
          <p className="text-muted-foreground text-sm">Copy on select and paste on right-click</p>
        </div>
      </div>
      */}
    </>
  );
});

/**
 * 🎯 목적: LLM Models 메뉴의 콘텐츠 영역 - LLM 모델 관련 설정
 */
/**
 * 🎯 목적: LLMModelsContent Props 인터페이스
 */
interface LLMModelsContentProps {
  userPreferencesState: any; // TODO: 정확한 타입으로 교체
  encryptService: any; // TODO: 정확한 타입으로 교체
  ollamaService: import("../../../features/ollama/renderer/ollama-service.injectable").OllamaService;
  validateOpenRouterModel: (
    modelId: string,
  ) => Promise<
    import("../../../common/features/user-preferences/validate-openrouter-model-channel").ValidateOpenRouterModelResponse
  >;
}

// 🎯 목적: observer로 감싸서 MobX observable 변경 시 즉시 리렌더링
const LLMModelsContent = observer(function LLMModelsContent({
  userPreferencesState,
  encryptService,
  ollamaService,
  validateOpenRouterModel,
}: LLMModelsContentProps) {
  // 🎯 목적: 모델 검색어
  const [searchQuery, setSearchQuery] = React.useState("");
  // 🎯 목적: 더보기 토글 (기본 5개만 표시)
  const [showAllModels, setShowAllModels] = React.useState(false);

  // 🎯 목적: Ollama 연결 테스트 결과 다이얼로그 상태
  const [ollamaTestResult, setOllamaTestResult] = React.useState<{
    open: boolean;
    success: boolean;
    message: string;
    details?: string;
  }>({ open: false, success: false, message: "" });

  // 🎯 목적: Ollama 설치된 모델 목록 상태 (/api/tags에서 가져옴)
  const [ollamaModels, setOllamaModels] = React.useState<string[]>([]);
  // 🎯 목적: Ollama 모델 목록 로딩 상태
  const [loadingOllamaModels, setLoadingOllamaModels] = React.useState(false);

  // 🎯 목적: Ollama 설치된 모델 목록 로드 (/api/tags 사용)
  const loadOllamaModels = React.useCallback(async () => {
    const baseUrl = userPreferencesState.ollamaBaseUrl || "http://localhost:11434";

    setLoadingOllamaModels(true);

    try {
      // 🎯 testConnection이 /api/tags에서 설치된 모델 목록을 반환함
      const result = await ollamaService.testConnection(baseUrl);

      if (result.success && result.models) {
        setOllamaModels(result.models);
        console.log("[Ollama] Installed models:", result.models.length);
      } else {
        console.error("[Ollama] Failed to load model list:", result.error);
        setOllamaModels([]);
      }
    } catch (error) {
      console.error("[Ollama] Error loading model list:", error);
      setOllamaModels([]);
    } finally {
      setLoadingOllamaModels(false);
    }
  }, [ollamaService, userPreferencesState.ollamaBaseUrl]);

  // 🎯 목적: Ollama가 활성화되어 있으면 모델 목록 자동 로드
  React.useEffect(() => {
    const ollamaEnabled = userPreferencesState.aiProviderEnabled?.["ollama"] === true;

    if (ollamaEnabled && ollamaModels.length === 0) {
      loadOllamaModels();
    }
  }, [userPreferencesState.aiProviderEnabled, ollamaModels.length, loadOllamaModels]);

  // 🎯 목적: 모델 활성화 상태 확인 (기본값: false - 명시적으로 true인 경우만 활성화)
  const isModelEnabled = (modelId: string) => userPreferencesState.aiModelEnabled?.[modelId] === true;

  // 🎯 목적: 모델 활성화 상태 토글
  const toggleModelEnabled = (modelId: string) => {
    const currentEnabled = isModelEnabled(modelId);
    const newEnabled = !currentEnabled;

    runInAction(() => {
      userPreferencesState.aiModelEnabled = {
        ...userPreferencesState.aiModelEnabled,
        [modelId]: newEnabled,
      };

      // 🎯 모델 OFF 시 해당 모델이 디폴트 모델이면 초기화
      if (!newEnabled && userPreferencesState.aiModel === modelId) {
        userPreferencesState.aiModel = "";
      }
    });
  };

  // 🎯 목적: 검색어로 필터링된 모델 목록
  // 🚫 Google Gemini 할루시네이션 문제로 UI에서 제거 (2026-01-08)
  // - Google 모델은 K8s 리소스에 대해 허위 정보를 생성하는 문제 발견
  // - 백엔드 코드는 유지하고 프론트엔드 UI에서만 제거
  // - 향후 Google 모델 품질 개선 시 다시 활성화 가능
  const filteredModels = React.useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    // 🚫 Google 모델 제외, OpenRouter는 별도 섹션에서 관리
    const nonGoogleModels = AI_MODELS.filter((model) => model.provider !== "google" && model.provider !== "openrouter");
    if (!query) return nonGoogleModels;
    return nonGoogleModels.filter(
      (model) =>
        model.id.toLowerCase().includes(query) ||
        model.displayName.toLowerCase().includes(query) ||
        model.provider.toLowerCase().includes(query),
    );
  }, [searchQuery]);

  // 🎯 목적: 표시할 모델 목록 (showAllModels 토글)
  const visibleModels = showAllModels ? filteredModels : filteredModels.slice(0, 5);

  // 🎯 목적: API Key 활성화 상태 관리 (영속화된 상태에서 읽기)
  // userPreferencesState.aiProviderEnabled에서 읽고, 기본값은 false (명시적으로 true인 경우만 활성화)
  const isProviderEnabled = (providerId: string) => userPreferencesState.aiProviderEnabled?.[providerId] === true;

  // 🎯 목적: 암호화된 API Key 존재 여부 확인
  const [hasOpenaiKey, setHasOpenaiKey] = React.useState(() => {
    const encrypted = userPreferencesState.aiApiKeys["openai"];
    return !!encrypted && encrypted.length > 0;
  });

  const [hasAnthropicKey, setHasAnthropicKey] = React.useState(() => {
    const encrypted = userPreferencesState.aiApiKeys["anthropic"];
    return !!encrypted && encrypted.length > 0;
  });

  const [hasOpenrouterKey, setHasOpenrouterKey] = React.useState(() => {
    const encrypted = userPreferencesState.aiApiKeys["openrouter"];
    return !!encrypted && encrypted.length > 0;
  });

  // 🎯 목적: API Key 입력 상태 관리 (빈 문자열로 초기화 - 항상 입력 가능)
  const [anthropicApiKey, setAnthropicApiKey] = React.useState("");
  const [openaiApiKey, setOpenaiApiKey] = React.useState("");
  const [openrouterApiKey, setOpenrouterApiKey] = React.useState("");

  // 🎯 목적: API Key 입력 필드 포커스 상태 (마스킹 표시용)
  const [openaiInputFocused, setOpenaiInputFocused] = React.useState(false);
  const [anthropicInputFocused, setAnthropicInputFocused] = React.useState(false);
  const [openrouterInputFocused, setOpenrouterInputFocused] = React.useState(false);
  // 🚫 Google 관련 상태 - UI 제거로 주석 처리 (2026-01-08)
  // const [googleInputFocused, setGoogleInputFocused] = React.useState(false);

  // 🎯 목적: API Key 마스킹 값 (키가 저장되어 있음을 시각적으로 표시)
  const MASKED_API_KEY = "••••••••••••••••";

  // 🎯 목적: API Key 표시값 계산 (저장된 키가 있으면 마스킹, 없으면 빈 값)
  const getApiKeyDisplayValue = (hasKey: boolean, inputValue: string, isFocused: boolean) => {
    if (inputValue) return inputValue; // 사용자가 입력 중이면 그대로 표시
    if (hasKey && !isFocused) return MASKED_API_KEY; // 키 있고 포커스 아니면 마스킹
    return ""; // 그 외에는 빈 값
  };

  // 🎯 목적: API Key 에러 메시지
  const [openaiKeyError, setOpenaiKeyError] = React.useState("");
  const [isVerifyingOpenaiKey, setIsVerifyingOpenaiKey] = React.useState(false);
  const [anthropicKeyError, setAnthropicKeyError] = React.useState("");
  const [isVerifyingAnthropicKey, setIsVerifyingAnthropicKey] = React.useState(false);
  const [openrouterKeyError, setOpenrouterKeyError] = React.useState("");
  const [isVerifyingOpenrouterKey, setIsVerifyingOpenrouterKey] = React.useState(false);
  // 🚫 Google 관련 상태 - UI 제거로 주석 처리 (2026-01-08)
  // const [googleKeyError, setGoogleKeyError] = React.useState("");

  // 🎯 OpenRouter Custom Model Validation State
  const [customModelValidationState, setCustomModelValidationState] = React.useState<
    "idle" | "validating" | "valid" | "invalid"
  >("idle");
  const [customModelError, setCustomModelError] = React.useState("");

  // 🎯 OpenRouter Model Browser 상태
  const [isModelBrowserOpen, setIsModelBrowserOpen] = React.useState(false);

  // 🎯 목적: API Key 밸리데이션 함수 (회사별 형식 검증)
  const validateApiKey = (provider: string, value: string) => {
    if (!value || value.trim().length === 0) return false;

    const trimmed = value.trim();

    switch (provider) {
      case "openai":
        // OpenAI: sk-proj-xxx 또는 sk-xxx 형식 (하이픈, 언더스코어 허용)
        return /^sk-[a-zA-Z0-9-_]+$/.test(trimmed);
      case "anthropic":
        // Anthropic: sk-ant-api03-xxx 형식
        return /^sk-ant-api03-[a-zA-Z0-9-_]+$/.test(trimmed);
      case "google":
        // Google: 일반 문자열 (하이픈, 언더스코어 허용, 최소 10자)
        return /^[a-zA-Z0-9-_]+$/.test(trimmed) && trimmed.length > 10;
      case "openrouter":
        // OpenRouter: 특정 prefix 없음, 최소 10자
        return trimmed.length > 10;
      default:
        return false;
    }
  };

  // 🎯 목적: Alert Dialog 상태 관리
  const [showOpenaiAlert, setShowOpenaiAlert] = React.useState(false);
  const [showAnthropicAlert, setShowAnthropicAlert] = React.useState(false);
  const [showOpenrouterAlert, setShowOpenrouterAlert] = React.useState(false);
  // 🚫 Google 관련 상태 - UI 제거로 주석 처리 (2026-01-08)
  // const [showGoogleAlert, setShowGoogleAlert] = React.useState(false);
  const [pendingProvider, setPendingProvider] = React.useState<string>("");

  // 🎯 목적: API Key toggle 변경 시 영속화 상태 업데이트 + alert dialog 표시 로직
  // 🚫 Google 타입 제외 (UI 제거)
  const handleApiToggle = (provider: "openai" | "anthropic" | "openrouter", newValue: boolean) => {
    if (newValue) {
      setPendingProvider(provider);
      if (provider === "openai") setShowOpenaiAlert(true);
      else if (provider === "anthropic") setShowAnthropicAlert(true);
      else if (provider === "openrouter") setShowOpenrouterAlert(true);
      // 🚫 Google UI 제거로 주석 처리
      // else if (provider === "google") setShowGoogleAlert(true);
    } else {
      // 스위치 OFF → 영속화된 상태 업데이트
      userPreferencesState.aiProviderEnabled = {
        ...userPreferencesState.aiProviderEnabled,
        [provider]: false,
      };
      // 🎯 Provider 스위치 OFF 시 해당 Provider의 개별 모델도 OFF
      const providerModels = AI_MODELS.filter((m) => m.provider === provider).map((m) => m.id);
      const newModelEnabled = { ...userPreferencesState.aiModelEnabled };
      providerModels.forEach((id) => {
        newModelEnabled[id] = false;
      });
      userPreferencesState.aiModelEnabled = newModelEnabled;
      // 🎯 Provider 스위치 OFF 시 해당 Provider 모델이 디폴트면 초기화
      if (getProviderByModel(userPreferencesState.aiModel) === provider) {
        userPreferencesState.aiModel = "";
      }
    }
  };

  // 🎯 목적: Alert Dialog에서 "Use API Key" 버튼 클릭 시 처리 (영속화 상태 업데이트)
  const handleConfirmApiKey = () => {
    if (pendingProvider) {
      runInAction(() => {
        // 스위치 ON → 영속화된 상태 업데이트
        userPreferencesState.aiProviderEnabled = {
          ...userPreferencesState.aiProviderEnabled,
          [pendingProvider]: true,
        };

        // 🎯 Provider 스위치 ON 시 해당 Provider의 모든 모델도 활성화
        const providerModels = AI_MODELS.filter((m) => m.provider === pendingProvider).map((m) => m.id);
        const newModelEnabled = { ...userPreferencesState.aiModelEnabled };
        providerModels.forEach((id) => {
          newModelEnabled[id] = true;
        });
        userPreferencesState.aiModelEnabled = newModelEnabled;
      });
    }
    // Alert Dialog 닫기
    setShowOpenaiAlert(false);
    setShowAnthropicAlert(false);
    setShowOpenrouterAlert(false);
    // 🚫 Google UI 제거로 주석 처리
    // setShowGoogleAlert(false);
    setPendingProvider("");
  };

  // 🎯 목적: Alert Dialog에서 "Cancel" 버튼 클릭 시 처리
  const handleCancelApiKey = () => {
    setShowOpenaiAlert(false);
    setShowAnthropicAlert(false);
    setShowOpenrouterAlert(false);
    // 🚫 Google UI 제거로 주석 처리
    // setShowGoogleAlert(false);
    setPendingProvider("");
  };

  /**
   * OpenRouter Custom Model ID Validation with Debounce
   *
   * Purpose: Validates custom model ID against OpenRouter's /api/v1/models
   * Debounce: 500ms delay to avoid excessive API calls
   */
  const validateCustomModelDebounced = React.useCallback(
    (modelId: string) => {
      if (!modelId || modelId.trim() === "") {
        setCustomModelValidationState("idle");
        setCustomModelError("");
        return;
      }

      setCustomModelValidationState("validating");
      setCustomModelError("");

      // Debounce timer
      const timer = setTimeout(async () => {
        try {
          const result = await validateOpenRouterModel(modelId);

          if (result.valid) {
            setCustomModelValidationState("valid");
            setCustomModelError("");
          } else {
            setCustomModelValidationState("invalid");
            setCustomModelError(result.error || "Model not found");
          }
        } catch (error) {
          setCustomModelValidationState("invalid");
          setCustomModelError("Validation failed");
        }
      }, 500);

      return () => clearTimeout(timer);
    },
    [validateOpenRouterModel],
  );

  // 🎯 목적: 사용 가능한 모델 목록 계산 (API 키 + Provider 활성화 + 개별 모델 활성화 + Ollama 설정)
  const availableModels = getAvailableModels(
    userPreferencesState.aiProviderEnabled || {},
    userPreferencesState.aiApiKeys || {},
    userPreferencesState.aiModelEnabled || {},
    // 🎯 Ollama는 API Key가 필요 없으므로 별도 설정 전달
    {
      baseUrl: userPreferencesState.ollamaBaseUrl,
      model: userPreferencesState.ollamaModel,
    },
    // OpenRouter 커스텀 모델 ID
    userPreferencesState.openrouterCustomModel,
  );

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* 🎯 기본 모델 선택 */}
        <div className="flex w-full flex-col gap-3">
          <Label htmlFor="default-model" className="text-sm font-medium">
            Default Model
          </Label>
          <Select
            value={userPreferencesState.aiModel || ""}
            onValueChange={(value) => {
              userPreferencesState.aiModel = value;
              // 🎯 모델 선택 시 provider도 함께 업데이트 (input-group.tsx와 동일 패턴)
              const provider = getProviderByModel(value);
              if (provider) {
                userPreferencesState.aiProvider = provider;
              } else {
                // AI_MODELS에 없는 모델 = Ollama 동적 모델
                userPreferencesState.aiProvider = "ollama";
              }
            }}
          >
            <SelectTrigger className="bg-input/30 border-border">
              <SelectValue placeholder="Select a model">
                {userPreferencesState.aiModel ? getModelDisplayName(userPreferencesState.aiModel) : "Select a model"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {availableModels.length > 0 ? (
                availableModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.displayName}
                  </SelectItem>
                ))
              ) : (
                // 🎯 빈 문자열 value는 shadcn SelectItem에서 허용되지 않음
                // 빈 상태일 때는 일반 div로 안내 메시지 표시
                <div className="text-muted-foreground px-2 py-1.5 text-center text-sm">Set API key below first</div>
              )}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Search Field */}
        <div className="flex w-full flex-col gap-3">
          <Label htmlFor="llm-search" className="text-sm font-medium">
            Control model usage
          </Label>
          <div className="relative flex items-center">
            <Search className="text-muted-foreground absolute left-3 h-4 w-4" />
            <Input
              id="llm-search"
              type="text"
              placeholder="Search model..."
              className="bg-input/30 border-border pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Model List - 동적 렌더링 */}
        <div className="flex flex-col gap-5">
          {visibleModels.map((model) => {
            // 🎯 Provider 스위치가 OFF면 개별 모델 스위치 비활성화
            // 🚫 Google 제외 (할루시네이션 문제로 UI에서 제거)
            const isProviderOn =
              (model.provider === "openai" && isProviderEnabled("openai")) ||
              (model.provider === "anthropic" && isProviderEnabled("anthropic")) ||
              // (model.provider === "google" && isProviderEnabled("google")) || // 🚫 Google 제외
              (model.provider === "ollama" && isProviderEnabled("ollama")) ||
              (model.provider === "openrouter" && isProviderEnabled("openrouter"));

            return (
              <div key={model.id} className="flex items-center gap-3">
                <div className="flex-1">
                  <Label className={`text-sm font-medium ${!isProviderOn ? "text-muted-foreground" : ""}`}>
                    {model.displayName}
                  </Label>
                  <span className="text-muted-foreground ml-2 text-xs">
                    ({model.provider}, {getCostTierLabel(model.costTier)}){!isProviderOn && " - Enable provider first"}
                  </span>
                </div>
                <Switch
                  checked={isModelEnabled(model.id)}
                  onCheckedChange={() => toggleModelEnabled(model.id)}
                  disabled={!isProviderOn}
                />
              </div>
            );
          })}

          {/* View All Models / Collapse Models Button */}
          {filteredModels.length > 5 && (
            <Button variant="secondary" size="sm" className="w-fit" onClick={() => setShowAllModels(!showAllModels)}>
              {showAllModels ? <ChevronUp className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {showAllModels ? "Collapse Models" : `View All Models (${filteredModels.length})`}
            </Button>
          )}

          {/* 검색 결과 없음 */}
          {filteredModels.length === 0 && searchQuery && (
            <p className="text-muted-foreground text-sm">No models found for "{searchQuery}"</p>
          )}
        </div>

        {/* Separator */}
        <Separator className="bg-border" />

        {/* OpenAI API Key */}
        <Field>
          <div className="flex items-start gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <FieldLabel className="text-sm font-medium">OpenAI API Key</FieldLabel>
              <p className="text-muted-foreground text-sm">
                You can put in your OpenAI key to use OpenAI models at cost.
              </p>
            </div>
            <Switch
              checked={isProviderEnabled("openai")}
              onCheckedChange={(value) => handleApiToggle("openai", value)}
              disabled={!hasOpenaiKey}
            />
          </div>
          <FieldContent>
            <InputGroup>
              <InputGroupInput
                type="password"
                placeholder={hasOpenaiKey ? "Enter new API Key to update" : "Enter your OpenAI API Key"}
                value={getApiKeyDisplayValue(hasOpenaiKey, openaiApiKey, openaiInputFocused)}
                onFocus={() => setOpenaiInputFocused(true)}
                onBlur={() => setOpenaiInputFocused(false)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setOpenaiApiKey(e.target.value);
                  setOpenaiKeyError("");
                }}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  variant="default"
                  size="xs"
                  disabled={!openaiApiKey.trim() || isVerifyingOpenaiKey}
                  onClick={async () => {
                    if (openaiApiKey.trim()) {
                      const trimmedKey = openaiApiKey.trim();

                      // 1. 형식 검증
                      if (!validateApiKey("openai", trimmedKey)) {
                        setOpenaiKeyError("Invalid OpenAI API Key format (should start with sk-)");
                        return;
                      }

                      try {
                        // 2. API 호출로 키 유효성 검증
                        setIsVerifyingOpenaiKey(true);
                        setOpenaiKeyError("");
                        const verifyResult = await encryptService.verifyApiKey("openai", trimmedKey);

                        if (!verifyResult.valid) {
                          setOpenaiKeyError(verifyResult.error || "Invalid API key");
                          setIsVerifyingOpenaiKey(false);
                          return;
                        }

                        // 3. API Key 암호화
                        const encryptedKey = await encryptService.encryptApiKey("openai", trimmedKey);

                        // 4. User Preferences 저장
                        userPreferencesState.aiApiKeys = {
                          ...userPreferencesState.aiApiKeys,
                          openai: encryptedKey,
                        };

                        // 5. UI 상태 업데이트
                        setHasOpenaiKey(true);
                        setOpenaiApiKey(""); // 보안: 입력 필드 초기화
                        setOpenaiKeyError("");
                        setIsVerifyingOpenaiKey(false);

                        // 🎯 API 키 저장 시 Provider 스위치 자동 활성화 + 모든 모델 ON
                        runInAction(() => {
                          userPreferencesState.aiProviderEnabled = {
                            ...userPreferencesState.aiProviderEnabled,
                            openai: true,
                          };
                          // 해당 Provider의 모든 모델 활성화
                          const openaiModels = AI_MODELS.filter((m) => m.provider === "openai").map((m) => m.id);
                          const newModelEnabled = { ...userPreferencesState.aiModelEnabled };
                          openaiModels.forEach((id) => {
                            newModelEnabled[id] = true;
                          });
                          userPreferencesState.aiModelEnabled = newModelEnabled;

                          // 🎯 HOTFIX: aiProvider가 기본값("openai")이지만 최초 키 등록 시 명시적으로 설정
                          userPreferencesState.aiProvider = "openai";

                          // 🎯 Default Model 자동 설정 (GPT-5.2)
                          if (
                            !userPreferencesState.aiModel ||
                            getProviderByModel(userPreferencesState.aiModel) !== "openai"
                          ) {
                            userPreferencesState.aiModel = userPreferencesState.aiRecentModels?.openai || "gpt-5.2";
                          }
                        });
                      } catch (error) {
                        setOpenaiKeyError("Failed to save API Key");
                        setIsVerifyingOpenaiKey(false);
                      }
                    }
                  }}
                >
                  {isVerifyingOpenaiKey ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Verifying...
                    </>
                  ) : openaiApiKey.trim() ? (
                    <>
                      {hasOpenaiKey ? "Update & Verify" : "Verify"}
                      <ArrowRight className="h-3 w-3" />
                    </>
                  ) : hasOpenaiKey ? (
                    <>
                      <Check className="h-3 w-3" />
                      Verified
                    </>
                  ) : (
                    <>Enter API Key</>
                  )}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            {hasOpenaiKey && (
              <div className="mt-2 flex justify-end">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    // API Key 삭제
                    userPreferencesState.aiApiKeys = {
                      ...userPreferencesState.aiApiKeys,
                      openai: undefined,
                    };
                    // 🎯 API 키 삭제 시 Provider 스위치 자동 OFF
                    userPreferencesState.aiProviderEnabled = {
                      ...userPreferencesState.aiProviderEnabled,
                      openai: false,
                    };
                    // 🎯 API 키 삭제 시 개별 모델 스위치도 자동 OFF
                    const openaiModels = AI_MODELS.filter((m) => m.provider === "openai").map((m) => m.id);
                    const newModelEnabled = { ...userPreferencesState.aiModelEnabled };
                    openaiModels.forEach((id) => {
                      newModelEnabled[id] = false;
                    });
                    userPreferencesState.aiModelEnabled = newModelEnabled;
                    // 🎯 현재 선택된 디폴트 모델이 OpenAI 모델이면 초기화
                    if (getProviderByModel(userPreferencesState.aiModel) === "openai") {
                      userPreferencesState.aiModel = "";
                    }
                    // 🎯 HOTFIX: 현재 aiProvider가 "openai"이면 키가 있는 다른 provider로 전환
                    if (userPreferencesState.aiProvider === "openai") {
                      const hasAnthropicApiKey = !!userPreferencesState.aiApiKeys?.anthropic;
                      const hasGoogleApiKey = !!userPreferencesState.aiApiKeys?.google;

                      if (hasAnthropicApiKey) {
                        userPreferencesState.aiProvider = "anthropic";
                        userPreferencesState.aiModel =
                          userPreferencesState.aiRecentModels?.anthropic || "claude-sonnet-4-5-20250929";
                      } else if (hasGoogleApiKey) {
                        userPreferencesState.aiProvider = "google";
                      }
                    }
                    setHasOpenaiKey(false);
                    setOpenaiApiKey("");
                    setOpenaiKeyError("");
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete API Key
                </Button>
              </div>
            )}
          </FieldContent>
          {openaiKeyError && <FieldError>{openaiKeyError}</FieldError>}
        </Field>

        {/* Separator */}
        <Separator className="bg-border" />

        {/* Anthropic API Key */}
        <Field>
          <div className="flex items-start gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <FieldLabel className="text-sm font-medium">Anthropic API Key / Setup Token (Beta)</FieldLabel>
              <p className="text-muted-foreground text-sm">
                Enter your API Key (sk-ant-api03-) or Setup Token (sk-ant-oat01-, beta).
              </p>
            </div>
            <Switch
              checked={isProviderEnabled("anthropic")}
              onCheckedChange={(value) => handleApiToggle("anthropic", value)}
              disabled={!hasAnthropicKey}
            />
          </div>
          <FieldContent>
            <InputGroup>
              <InputGroupInput
                type="password"
                placeholder={hasAnthropicKey ? "Enter new key to update" : "Enter API Key"}
                value={getApiKeyDisplayValue(hasAnthropicKey, anthropicApiKey, anthropicInputFocused)}
                onFocus={() => setAnthropicInputFocused(true)}
                onBlur={() => setAnthropicInputFocused(false)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setAnthropicApiKey(e.target.value);
                  setAnthropicKeyError("");
                }}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  variant="default"
                  size="xs"
                  disabled={!anthropicApiKey.trim() || isVerifyingAnthropicKey}
                  onClick={async () => {
                    if (anthropicApiKey.trim()) {
                      const trimmedKey = anthropicApiKey.trim();

                      // 1. 형식 검증
                      if (!validateApiKey("anthropic", trimmedKey)) {
                        setAnthropicKeyError(
                          "Invalid Anthropic key format (should start with sk-ant-api03- or sk-ant-oat01-)",
                        );
                        return;
                      }

                      try {
                        // 2. API 호출로 키 유효성 검증
                        setIsVerifyingAnthropicKey(true);
                        setAnthropicKeyError("");
                        const verifyResult = await encryptService.verifyApiKey("anthropic", trimmedKey);

                        if (!verifyResult.valid) {
                          setAnthropicKeyError(verifyResult.error || "Invalid API key");
                          setIsVerifyingAnthropicKey(false);
                          return;
                        }

                        // 3. API Key 암호화
                        const encryptedKey = await encryptService.encryptApiKey("anthropic", trimmedKey);

                        // 4. User Preferences 저장
                        userPreferencesState.aiApiKeys = {
                          ...userPreferencesState.aiApiKeys,
                          anthropic: encryptedKey,
                        };

                        // 5. UI 상태 업데이트
                        setHasAnthropicKey(true);
                        setAnthropicApiKey(""); // 보안: 입력 필드 초기화
                        setAnthropicKeyError("");
                        setIsVerifyingAnthropicKey(false);

                        // 🎯 API 키 저장 시 Provider 스위치 자동 활성화 + 모든 모델 ON
                        runInAction(() => {
                          userPreferencesState.aiProviderEnabled = {
                            ...userPreferencesState.aiProviderEnabled,
                            anthropic: true,
                          };
                          // 해당 Provider의 모든 모델 활성화
                          const anthropicModels = AI_MODELS.filter((m) => m.provider === "anthropic").map((m) => m.id);
                          const newModelEnabled = { ...userPreferencesState.aiModelEnabled };
                          anthropicModels.forEach((id) => {
                            newModelEnabled[id] = true;
                          });
                          userPreferencesState.aiModelEnabled = newModelEnabled;

                          // 🎯 HOTFIX: Anthropic 키 저장 시 aiProvider를 명시적으로 설정
                          userPreferencesState.aiProvider = "anthropic";

                          // 🎯 Default Model 자동 설정 (Claude 4.5 Sonnet)
                          if (
                            !userPreferencesState.aiModel ||
                            getProviderByModel(userPreferencesState.aiModel) !== "anthropic"
                          ) {
                            userPreferencesState.aiModel =
                              userPreferencesState.aiRecentModels?.anthropic || "claude-sonnet-4-5-20250929";
                          }
                        });
                      } catch (error) {
                        setAnthropicKeyError("Failed to save API Key");
                        setIsVerifyingAnthropicKey(false);
                      }
                    }
                  }}
                >
                  {isVerifyingAnthropicKey ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Verifying...
                    </>
                  ) : anthropicApiKey.trim() ? (
                    <>
                      {hasAnthropicKey ? "Update & Verify" : "Verify"}
                      <ArrowRight className="h-3 w-3" />
                    </>
                  ) : hasAnthropicKey ? (
                    <>
                      <Check className="h-3 w-3" />
                      Verified
                    </>
                  ) : (
                    <>Enter API Key</>
                  )}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            {hasAnthropicKey && (
              <div className="mt-2 flex justify-end">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    // API Key 삭제
                    userPreferencesState.aiApiKeys = {
                      ...userPreferencesState.aiApiKeys,
                      anthropic: undefined,
                    };
                    // 🎯 API 키 삭제 시 Provider 스위치 자동 OFF
                    userPreferencesState.aiProviderEnabled = {
                      ...userPreferencesState.aiProviderEnabled,
                      anthropic: false,
                    };
                    // 🎯 API 키 삭제 시 개별 모델 스위치도 자동 OFF
                    const anthropicModels = AI_MODELS.filter((m) => m.provider === "anthropic").map((m) => m.id);
                    const newModelEnabled = { ...userPreferencesState.aiModelEnabled };
                    anthropicModels.forEach((id) => {
                      newModelEnabled[id] = false;
                    });
                    userPreferencesState.aiModelEnabled = newModelEnabled;
                    // 🎯 현재 선택된 디폴트 모델이 Anthropic 모델이면 초기화
                    if (getProviderByModel(userPreferencesState.aiModel) === "anthropic") {
                      userPreferencesState.aiModel = "";
                    }
                    // 🎯 HOTFIX: 현재 aiProvider가 "anthropic"이면 키가 있는 다른 provider로 전환
                    if (userPreferencesState.aiProvider === "anthropic") {
                      const hasOpenaiApiKey = !!userPreferencesState.aiApiKeys?.openai;
                      const hasGoogleApiKey = !!userPreferencesState.aiApiKeys?.google;

                      if (hasOpenaiApiKey) {
                        userPreferencesState.aiProvider = "openai";
                        userPreferencesState.aiModel = userPreferencesState.aiRecentModels?.openai || "gpt-5.2";
                      } else if (hasGoogleApiKey) {
                        userPreferencesState.aiProvider = "google";
                      }
                    }
                    setHasAnthropicKey(false);
                    setAnthropicApiKey("");
                    setAnthropicKeyError("");
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete API Key
                </Button>
              </div>
            )}
          </FieldContent>
          {anthropicKeyError && <FieldError>{anthropicKeyError}</FieldError>}
        </Field>

        {/* Separator */}
        <Separator className="bg-border" />

        {/* OpenRouter API Key */}
        <Field>
          <div className="flex items-start gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <FieldLabel className="text-sm font-medium">OpenRouter API Key</FieldLabel>
              <p className="text-muted-foreground text-sm">
                Enter your OpenRouter API Key. Access 100+ models including free ones.
              </p>
            </div>
            <Switch
              checked={isProviderEnabled("openrouter")}
              onCheckedChange={(value) => handleApiToggle("openrouter", value)}
              disabled={!hasOpenrouterKey}
            />
          </div>
          <FieldContent>
            <InputGroup>
              <InputGroupInput
                type="password"
                placeholder={hasOpenrouterKey ? "Enter new key to update" : "Enter API Key"}
                value={getApiKeyDisplayValue(hasOpenrouterKey, openrouterApiKey, openrouterInputFocused)}
                onFocus={() => setOpenrouterInputFocused(true)}
                onBlur={() => setOpenrouterInputFocused(false)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setOpenrouterApiKey(e.target.value);
                  setOpenrouterKeyError("");
                }}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  variant="default"
                  size="xs"
                  disabled={!openrouterApiKey.trim() || isVerifyingOpenrouterKey}
                  onClick={async () => {
                    if (openrouterApiKey.trim()) {
                      const trimmedKey = openrouterApiKey.trim();

                      if (!validateApiKey("openrouter", trimmedKey)) {
                        setOpenrouterKeyError("Invalid OpenRouter key format");
                        return;
                      }

                      try {
                        setIsVerifyingOpenrouterKey(true);
                        setOpenrouterKeyError("");
                        const verifyResult = await encryptService.verifyApiKey("openrouter", trimmedKey);

                        if (!verifyResult.valid) {
                          setOpenrouterKeyError(verifyResult.error || "Invalid API key");
                          setIsVerifyingOpenrouterKey(false);
                          return;
                        }

                        const encryptedKey = await encryptService.encryptApiKey("openrouter", trimmedKey);

                        userPreferencesState.aiApiKeys = {
                          ...userPreferencesState.aiApiKeys,
                          openrouter: encryptedKey,
                        };

                        setHasOpenrouterKey(true);
                        setOpenrouterApiKey("");
                        setOpenrouterKeyError("");
                        setIsVerifyingOpenrouterKey(false);

                        runInAction(() => {
                          userPreferencesState.aiProviderEnabled = {
                            ...userPreferencesState.aiProviderEnabled,
                            openrouter: true,
                          };
                          const openrouterModels = AI_MODELS.filter((m) => m.provider === "openrouter").map(
                            (m) => m.id,
                          );
                          const newModelEnabled = { ...userPreferencesState.aiModelEnabled };
                          openrouterModels.forEach((id) => {
                            newModelEnabled[id] = true;
                          });
                          userPreferencesState.aiModelEnabled = newModelEnabled;

                          userPreferencesState.aiProvider = "openrouter";

                          if (
                            !userPreferencesState.aiModel ||
                            getProviderByModel(userPreferencesState.aiModel) !== "openrouter"
                          ) {
                            // Free 모델은 수시로 변경되므로 유료 모델 사용
                            userPreferencesState.aiModel = "xiaomi/mimo-v2-pro";
                          }
                        });
                      } catch (error) {
                        setOpenrouterKeyError("Failed to save API Key");
                        setIsVerifyingOpenrouterKey(false);
                      }
                    }
                  }}
                >
                  {isVerifyingOpenrouterKey ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Verifying...
                    </>
                  ) : openrouterApiKey.trim() ? (
                    <>
                      {hasOpenrouterKey ? "Update & Verify" : "Verify"}
                      <ArrowRight className="h-3 w-3" />
                    </>
                  ) : hasOpenrouterKey ? (
                    <>
                      <Check className="h-3 w-3" />
                      Verified
                    </>
                  ) : (
                    <>Enter API Key</>
                  )}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>

            {/* Browse Models + Delete API Key 버튼 */}
            <div className="mt-2 flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => setIsModelBrowserOpen(true)}
              >
                <Telescope className="h-3 w-3 mr-1" />
                Browse Models
              </Button>
              {hasOpenrouterKey && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => {
                    userPreferencesState.aiApiKeys = {
                      ...userPreferencesState.aiApiKeys,
                      openrouter: undefined,
                    };
                    userPreferencesState.aiProviderEnabled = {
                      ...userPreferencesState.aiProviderEnabled,
                      openrouter: false,
                    };
                    const openrouterModels = AI_MODELS.filter((m) => m.provider === "openrouter").map((m) => m.id);
                    const newModelEnabled = { ...userPreferencesState.aiModelEnabled };
                    openrouterModels.forEach((id) => {
                      newModelEnabled[id] = false;
                    });
                    userPreferencesState.aiModelEnabled = newModelEnabled;
                    if (getProviderByModel(userPreferencesState.aiModel) === "openrouter") {
                      userPreferencesState.aiModel = "";
                    }
                    if (userPreferencesState.aiProvider === "openrouter") {
                      const hasOpenaiApiKey = !!userPreferencesState.aiApiKeys?.openai;
                      const hasAnthropicApiKey = !!userPreferencesState.aiApiKeys?.anthropic;

                      if (hasAnthropicApiKey) {
                        userPreferencesState.aiProvider = "anthropic";
                        userPreferencesState.aiModel =
                          userPreferencesState.aiRecentModels?.anthropic || "claude-sonnet-4-5-20250929";
                      } else if (hasOpenaiApiKey) {
                        userPreferencesState.aiProvider = "openai";
                        userPreferencesState.aiModel = userPreferencesState.aiRecentModels?.openai || "gpt-5.2";
                      }
                    }
                    userPreferencesState.openrouterCustomModel = undefined;
                    setHasOpenrouterKey(false);
                    setOpenrouterApiKey("");
                    setOpenrouterKeyError("");
                  }}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete API Key
                </Button>
              )}
            </div>

            {hasOpenrouterKey && (
              <>
                {/* Custom Model ID Input with Validation */}
                <div className="mt-3">
                  <label className="text-muted-foreground block text-xs mb-1">
                    Custom Model ID (optional){" "}
                    <span className="text-muted-foreground/60">
                      — Some models may have limited tool calling support
                    </span>
                  </label>
                  <InputGroup>
                    <InputGroupInput
                      type="text"
                      placeholder="e.g., mistralai/mistral-large"
                      value={userPreferencesState.openrouterCustomModel || ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const value = e.target.value.trim() || undefined;

                        userPreferencesState.openrouterCustomModel = value;

                        // Validate model ID with debounce
                        if (value) {
                          validateCustomModelDebounced(value);

                          // Auto-select custom model
                          userPreferencesState.aiProvider = "openrouter";
                          userPreferencesState.aiModel = value;
                        } else {
                          setCustomModelValidationState("idle");
                          setCustomModelError("");
                        }
                      }}
                    />
                    {/* Validation State Indicator */}
                    <InputGroupAddon>
                      {customModelValidationState === "validating" && (
                        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                      )}
                      {customModelValidationState === "valid" && (
                        <Check className="text-green-600 dark:text-green-400 h-4 w-4" />
                      )}
                      {customModelValidationState === "invalid" && (
                        <span className="text-destructive text-xs font-medium">✗</span>
                      )}
                    </InputGroupAddon>
                  </InputGroup>
                  {/* Error Message */}
                  {customModelValidationState === "invalid" && customModelError && (
                    <p className="text-destructive mt-1 text-xs">{customModelError}</p>
                  )}
                </div>

                {/* OpenRouter Models */}
                <div className="mt-3 flex flex-col gap-5">
                  <label className="text-muted-foreground text-xs font-medium">OpenRouter Models</label>
                  {AI_MODELS.filter((m) => m.provider === "openrouter").map((model) => (
                    <div key={model.id} className="flex items-center gap-3">
                      <div className="flex-1">
                        <Label className="text-sm font-medium">{model.displayName}</Label>
                        <span className="text-muted-foreground ml-2 text-xs">({getCostTierLabel(model.costTier)})</span>
                      </div>
                      <Switch checked={isModelEnabled(model.id)} onCheckedChange={() => toggleModelEnabled(model.id)} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </FieldContent>
          {openrouterKeyError && <FieldError>{openrouterKeyError}</FieldError>}
        </Field>

        {/* 🚫 Google API Key 섹션 - 할루시네이션 문제로 UI에서 제거 (2026-01-08)
         * Google Gemini 모델이 K8s 리소스에 대해 허위 정보를 생성하는 문제로 인해
         * Settings > LLM Models에서 Google 관련 UI를 숨김 처리
         * 백엔드 코드는 유지되어 있으므로 향후 품질 개선 시 주석 해제로 복원 가능
         *
        {/* Separator *}
        <Separator className="bg-border" />

        {/* Google API Key *}
        <Field>
          <div className="flex items-start gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <FieldLabel className="text-sm font-medium">Google API Key</FieldLabel>
              <p className="text-muted-foreground text-sm">
                You can put in your Google AI Studio key to use Google models at-cost.
              </p>
            </div>
            <Switch
              checked={isProviderEnabled("google")}
              onCheckedChange={(value) => handleApiToggle("google", value)}
              disabled={!hasGoogleKey}
            />
          </div>
          <FieldContent>
            <InputGroup>
              <InputGroupInput
                type="password"
                placeholder={hasGoogleKey ? "Enter new API Key to update" : "Enter your Google AI Studio API Key"}
                value={getApiKeyDisplayValue(hasGoogleKey, googleApiKey, googleInputFocused)}
                onFocus={() => setGoogleInputFocused(true)}
                onBlur={() => setGoogleInputFocused(false)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setGoogleApiKey(e.target.value);
                  setGoogleKeyError("");
                }}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  variant="default"
                  size="xs"
                  disabled={!googleApiKey.trim()}
                  onClick={async () => {
                    if (googleApiKey.trim()) {
                      const trimmedKey = googleApiKey.trim();

                      // 1. 형식 검증
                      if (!validateApiKey("google", trimmedKey)) {
                        setGoogleKeyError("Invalid Google API Key format (minimum 10 characters)");
                        return;
                      }

                      try {
                        // 2. API Key 암호화
                        const encryptedKey = await encryptService.encryptApiKey("google", trimmedKey);

                        // 3. User Preferences 저장
                        userPreferencesState.aiApiKeys = {
                          ...userPreferencesState.aiApiKeys,
                          google: encryptedKey,
                        };

                        // 4. UI 상태 업데이트
                        setHasGoogleKey(true);
                        setGoogleApiKey(""); // 보안: 입력 필드 초기화
                        setGoogleKeyError("");

                        // 🎯 API 키 저장 시 Provider 스위치 자동 활성화 + 모든 모델 ON
                        runInAction(() => {
                          userPreferencesState.aiProviderEnabled = {
                            ...userPreferencesState.aiProviderEnabled,
                            google: true,
                          };
                          // 해당 Provider의 모든 모델 활성화
                          const googleModels = AI_MODELS.filter((m) => m.provider === "google").map((m) => m.id);
                          const newModelEnabled = { ...userPreferencesState.aiModelEnabled };
                          googleModels.forEach((id) => {
                            newModelEnabled[id] = true;
                          });
                          userPreferencesState.aiModelEnabled = newModelEnabled;
                        });
                      } catch (error) {
                        setGoogleKeyError("Failed to save API Key");
                      }
                    }
                  }}
                >
                  {googleApiKey.trim() ? (
                    <>
                      {hasGoogleKey ? "Update & Verify" : "Verify"}
                      <ArrowRight className="h-3 w-3" />
                    </>
                  ) : hasGoogleKey ? (
                    <>
                      <Check className="h-3 w-3" />
                      Verified
                    </>
                  ) : (
                    <>Enter API Key</>
                  )}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            {hasGoogleKey && (
              <div className="mt-2 flex justify-end">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    // API Key 삭제
                    userPreferencesState.aiApiKeys = {
                      ...userPreferencesState.aiApiKeys,
                      google: undefined,
                    };
                    // 🎯 API 키 삭제 시 Provider 스위치 자동 OFF
                    userPreferencesState.aiProviderEnabled = {
                      ...userPreferencesState.aiProviderEnabled,
                      google: false,
                    };
                    // 🎯 API 키 삭제 시 개별 모델 스위치도 자동 OFF
                    const googleModels = AI_MODELS.filter((m) => m.provider === "google").map((m) => m.id);
                    const newModelEnabled = { ...userPreferencesState.aiModelEnabled };
                    googleModels.forEach((id) => {
                      newModelEnabled[id] = false;
                    });
                    userPreferencesState.aiModelEnabled = newModelEnabled;
                    // 🎯 현재 선택된 디폴트 모델이 Google 모델이면 초기화
                    if (getProviderByModel(userPreferencesState.aiModel) === "google") {
                      userPreferencesState.aiModel = "";
                    }
                    setHasGoogleKey(false);
                    setGoogleApiKey("");
                    setGoogleKeyError("");
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete API Key
                </Button>
              </div>
            )}
          </FieldContent>
          {googleKeyError && <FieldError>{googleKeyError}</FieldError>}
        </Field>
        */}

        {/* Separator */}
        <Separator className="bg-border" />

        {/* Ollama (Local LLM) */}
        <Field>
          <div className="flex items-start gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <FieldLabel className="text-sm font-medium">Ollama (Local LLM)</FieldLabel>
              <p className="text-muted-foreground text-sm">
                Connect to a local or remote Ollama server to use open-source LLMs.
              </p>
            </div>
            <Switch
              checked={isProviderEnabled("ollama")}
              onCheckedChange={(value) => {
                // 🎯 MobX runInAction으로 상태 변경 보장
                runInAction(() => {
                  userPreferencesState.aiProviderEnabled = {
                    ...userPreferencesState.aiProviderEnabled,
                    ollama: value,
                  };

                  // 🎯 스위치 끄면 선택된 모델과 모델 목록 초기화
                  if (!value) {
                    const currentOllamaModel = userPreferencesState.ollamaModel;

                    userPreferencesState.ollamaModel = "";

                    // 🎯 Default Model이 Ollama 모델이면 초기화
                    // (AI_MODELS에 없는 모델 = Ollama 모델, 또는 ollamaModel과 같으면)
                    const currentAiModel = userPreferencesState.aiModel;
                    const isOllamaModel =
                      currentAiModel === currentOllamaModel || getProviderByModel(currentAiModel) === undefined;

                    if (currentAiModel && isOllamaModel) {
                      userPreferencesState.aiModel = "";
                    }

                    // 🎯 aiProvider가 ollama로 남아있으면 다른 provider로 fallback
                    if (userPreferencesState.aiProvider === "ollama") {
                      const hasAnthropicKey = !!userPreferencesState.aiApiKeys?.anthropic;
                      const hasOpenaiKey = !!userPreferencesState.aiApiKeys?.openai;
                      const hasGoogleKey = !!userPreferencesState.aiApiKeys?.google;

                      if (hasAnthropicKey) {
                        userPreferencesState.aiProvider = "anthropic";
                        userPreferencesState.aiModel =
                          userPreferencesState.aiRecentModels?.anthropic || "claude-sonnet-4-5-20250929";
                      } else if (hasOpenaiKey) {
                        userPreferencesState.aiProvider = "openai";
                        userPreferencesState.aiModel = userPreferencesState.aiRecentModels?.openai || "gpt-5.2";
                      } else if (hasGoogleKey) {
                        userPreferencesState.aiProvider = "google";
                      } else {
                        userPreferencesState.aiProvider = "";
                      }
                    }
                  }
                });

                // 🎯 React 상태도 초기화
                if (!value) {
                  setOllamaModels([]);
                }
              }}
            />
          </div>
          <FieldContent className="flex flex-col gap-4">
            {/* Server URL */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Server URL</Label>
              <Input
                type="text"
                placeholder="http://localhost:11434"
                value={userPreferencesState.ollamaBaseUrl || "http://localhost:11434"}
                onChange={(e) => {
                  userPreferencesState.ollamaBaseUrl = e.target.value;
                }}
                className="bg-input/30 border-border"
              />
              <p className="text-muted-foreground text-xs">Ollama server URL (default: http://localhost:11434)</p>
            </div>

            {/* Model Name - Select 드롭다운 */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Model Name</Label>
              <div className="flex gap-2">
                {/* 설치된 모델 Select */}
                <Select
                  value={userPreferencesState.ollamaModel || ""}
                  onValueChange={(value) => {
                    // 🎯 MobX runInAction으로 상태 변경 보장
                    runInAction(() => {
                      userPreferencesState.ollamaModel = value;
                    });
                  }}
                  disabled={ollamaModels.length === 0}
                >
                  <SelectTrigger className="bg-input/30 border-border flex-1">
                    <SelectValue
                      placeholder={ollamaModels.length > 0 ? "Select a model..." : "Click refresh to load models"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {ollamaModels.map((modelName) => (
                      <SelectItem key={modelName} value={modelName}>
                        {modelName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* 새로고침 버튼 */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={loadOllamaModels}
                  disabled={loadingOllamaModels}
                  title="Refresh installed model list"
                >
                  {loadingOllamaModels ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                {ollamaModels.length > 0
                  ? `${ollamaModels.length} installed model(s). Select a model to use.`
                  : "Click refresh to load installed models."}
              </p>
            </div>

            {/* Connection Test Button */}
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={async () => {
                const baseUrl = userPreferencesState.ollamaBaseUrl || "http://localhost:11434";

                try {
                  // 🎯 IPC를 통해 Main Process에서 연결 테스트
                  const result = await ollamaService.testConnection(baseUrl);

                  if (result.success) {
                    console.log("[Ollama] Connection successful, installed models:", result.modelCount);

                    // 🎯 연결 성공 시 실행 중인 모델 목록 로드 (디폴트 자동선택 없음)
                    await loadOllamaModels();

                    setOllamaTestResult({
                      open: true,
                      success: true,
                      message: "Connected to Ollama server!",
                      details: `Installed models: ${result.modelCount}\nRunning model list has been updated.`,
                    });
                  } else {
                    console.error("[Ollama] Connection failed:", result.error);
                    setOllamaTestResult({
                      open: true,
                      success: false,
                      message: "Ollama connection failed",
                      details: result.error,
                    });
                  }
                } catch (error) {
                  console.error("[Ollama] Connection failed:", error);
                  setOllamaTestResult({
                    open: true,
                    success: false,
                    message: "Cannot connect to Ollama server",
                    details:
                      "Please check:\n• Is ollama serve or ollama run running?\n• Is the server URL correct? (default: http://localhost:11434)",
                  });
                }
              }}
            >
              Test Connection
            </Button>
          </FieldContent>
        </Field>

        {/* OpenAI API Key Alert Dialog */}
        <AlertDialog open={showOpenaiAlert} onOpenChange={setShowOpenaiAlert}>
          <AlertDialogContent className="gap-4 p-6 sm:max-w-[425px]">
            <AlertDialogHeader className="gap-2">
              <AlertDialogTitle>Use OpenAI API Key</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to use your own OpenAI API key?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel onClick={handleCancelApiKey}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmApiKey}>Use API Key</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Anthropic API Key Alert Dialog */}
        <AlertDialog open={showAnthropicAlert} onOpenChange={setShowAnthropicAlert}>
          <AlertDialogContent className="gap-4 p-6 sm:max-w-[425px]">
            <AlertDialogHeader className="gap-2">
              <AlertDialogTitle>Use Anthropic API Key</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to use your own Anthropic API key?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel onClick={handleCancelApiKey}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmApiKey}>Use API Key</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* OpenRouter API Key Alert Dialog */}
        <AlertDialog open={showOpenrouterAlert} onOpenChange={setShowOpenrouterAlert}>
          <AlertDialogContent className="gap-4 p-6 sm:max-w-[425px]">
            <AlertDialogHeader className="gap-2">
              <AlertDialogTitle>Use OpenRouter API Key</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to use your own OpenRouter API key?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel onClick={handleCancelApiKey}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmApiKey}>Use API Key</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 🚫 Google API Key Alert Dialog - 할루시네이션 문제로 UI에서 제거 (2026-01-08)
        <AlertDialog open={showGoogleAlert} onOpenChange={setShowGoogleAlert}>
          <AlertDialogContent className="gap-4 p-6 sm:max-w-[425px]">
            <AlertDialogHeader className="gap-2">
              <AlertDialogTitle>Use Google API Key</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to use your own Google API key?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel onClick={handleCancelApiKey}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmApiKey}>Use API Key</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        */}

        {/* Ollama Connection Test Result Dialog */}
        <AlertDialog
          open={ollamaTestResult.open}
          onOpenChange={(open) => setOllamaTestResult((prev) => ({ ...prev, open }))}
        >
          <AlertDialogContent className="gap-4 p-6 sm:max-w-[425px]">
            <AlertDialogHeader className="gap-2">
              {/* 🎯 THEME-024: Semantic color for Ollama test result */}
              <AlertDialogTitle className={ollamaTestResult.success ? "text-status-success" : "text-destructive"}>
                {ollamaTestResult.success ? "✓ Connection Successful" : "✕ Connection Failed"}
              </AlertDialogTitle>
              <AlertDialogDescription className="flex flex-col gap-2">
                <span>{ollamaTestResult.message}</span>
                {ollamaTestResult.details && (
                  <span className="text-muted-foreground whitespace-pre-line text-sm">{ollamaTestResult.details}</span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setOllamaTestResult((prev) => ({ ...prev, open: false }))}>
                OK
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* 🎯 OpenRouter Model Browser */}
      <OpenRouterModelBrowser
        isOpen={isModelBrowserOpen}
        onOpenChange={setIsModelBrowserOpen}
        onSelectModel={(modelId) => {
          // Auto-fill custom model input
          userPreferencesState.openrouterCustomModel = modelId;
          // Auto-select provider and model
          userPreferencesState.aiProvider = "openrouter";
          userPreferencesState.aiModel = modelId;
          // Validate the selected model
          validateCustomModelDebounced(modelId);
        }}
      />
    </>
  );
});

/**
 * 🎯 목적: Extension 메뉴의 콘텐츠 영역 - Extension 앱 추가 및 관리
 */
const ExtensionContent = observer(
  ({
    userPreferencesState,
  }: {
    userPreferencesState: import("../../../features/user-preferences/common/state.injectable").UserPreferencesState;
  }) => {
    const [extensionUrl, setExtensionUrl] = React.useState("");
    const [urlError, setUrlError] = React.useState("");

    // 🎯 목적: URL 유효성 검사 함수 (정규 표현식 사용)
    const validateUrl = (url: string) => {
      // URL 정규 표현식: http(s):// + (도메인 또는 IP 주소) + 선택적 포트 및 경로
      // 도메인: example.com, sub.example.com
      // IP 주소: 192.168.1.1, 10.0.0.1
      const urlPattern =
        /^(https?:\/\/)(([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}|(\d{1,3}\.){3}\d{1,3}|localhost)(:[0-9]+)?(\/.*)?$/;
      return urlPattern.test(url);
    };

    // 🎯 목적: Extension 추가 버튼 클릭 핸들러
    const handleAddExtension = () => {
      if (!validateUrl(extensionUrl)) {
        setUrlError("Please enter a valid URL");
        return;
      }
      // MobX state에 URL 추가
      const currentUrls = userPreferencesState.extensionUrls || [];
      userPreferencesState.extensionUrls = [...currentUrls, extensionUrl];
      setExtensionUrl("");
      setUrlError("");
    };

    // 🎯 목적: Extension 삭제 버튼 클릭 핸들러
    const handleDeleteExtension = (urlToDelete: string) => {
      // MobX state에서 해당 URL 제거
      userPreferencesState.extensionUrls = (userPreferencesState.extensionUrls || []).filter(
        (url) => url !== urlToDelete,
      );
    };

    // 🎯 목적: URL 입력 시 에러 메시지 제거
    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setExtensionUrl(e.target.value);
      if (urlError) {
        setUrlError("");
      }
    };

    // 🎯 목적: 앱이 이미 등록되어 있는지 확인 (최대 1개만 허용)
    const hasConnectedApp = (userPreferencesState.extensionUrls || []).length > 0;

    return (
      <div className="flex flex-col gap-6">
        {/* Add app 입력 섹션 */}
        <Field>
          <FieldLabel className="text-sm font-medium">Connect Skuber⁺ Observability</FieldLabel>
          <p className="text-muted-foreground text-sm">
            Enter the Observability server URL to enable monitoring and diagnostics.
          </p>
          <FieldContent>
            <InputGroup>
              <InputGroupInput
                type="text"
                placeholder={
                  hasConnectedApp
                    ? "Remove the connected server to connect a new one"
                    : "Enter Observability server URL..."
                }
                value={extensionUrl}
                onChange={handleUrlChange}
                aria-invalid={!!urlError}
                readOnly={hasConnectedApp}
                disabled={hasConnectedApp}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  variant="default"
                  size="xs"
                  disabled={!extensionUrl.trim() || hasConnectedApp}
                  onClick={handleAddExtension}
                >
                  <Plus className="h-4 w-4" />
                  Connect
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </FieldContent>
          {urlError && <FieldError className="text-status-error">{urlError}</FieldError>}
        </Field>

        {/* 추가된 Extension URL 리스트 */}
        {userPreferencesState.extensionUrls && userPreferencesState.extensionUrls.length > 0 && (
          <>
            <div className="flex flex-col gap-3">
              {userPreferencesState.extensionUrls.map((url, index) => (
                <div key={url} className="flex flex-col gap-2">
                  <Item variant="outline" size="sm">
                    <ItemMedia>
                      <Link className="h-5 w-5" />
                    </ItemMedia>
                    <ItemContent>
                      <ItemDescription>{url}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Button variant="outline" size="icon-sm" onClick={() => handleDeleteExtension(url)}>
                        <Trash2 className="text-destructive h-4 w-4" />
                      </Button>
                    </ItemActions>
                  </Item>
                  <p className="text-muted-foreground text-xs leading-normal">
                    To change the server, remove it and connect a new one.
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  },
);

/**
 * 🎯 목적: Kubernetes 메뉴의 콘텐츠 영역 - 쿠버네티스 관련 설정
 */
const KubernetesContent = observer(function KubernetesContent({
  userPreferencesState,
  openPathPickingDialog,
  defaultPathForGeneralBinaries,
  defaultPathForKubectlBinaries,
}: {
  userPreferencesState: import("../../../features/user-preferences/common/state.injectable").UserPreferencesState;
  openPathPickingDialog: OpenPathPickingDialog;
  defaultPathForGeneralBinaries: string;
  defaultPathForKubectlBinaries: string;
}) {
  const downloadMirrorOptions = Array.from(packageMirrors, ([key, mirror]) => ({
    value: key,
    label: mirror.label,
  }));

  const downloadKubectlBinaries = userPreferencesState.downloadKubectlBinaries;
  const syncedEntries = Array.from(userPreferencesState.syncKubeconfigEntries.keys()).sort();

  return (
    <>
      {/* Kubectl binary download */}
      <div className="flex items-start gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center gap-3">
            <Label htmlFor="kubectl-binary-download" className="text-foreground flex-1 text-sm font-medium">
              Kubectl binary download
            </Label>
            <Switch
              id="kubectl-binary-download"
              checked={downloadKubectlBinaries}
              onCheckedChange={(checked) => {
                userPreferencesState.downloadKubectlBinaries = checked;
              }}
            />
          </div>
          <p className="text-muted-foreground text-sm">
            Download kubectl binaries matching the kubernetes cluster version
          </p>
        </div>
      </div>

      {/* Download mirror */}
      <div className="flex w-full flex-col gap-3">
        <Label htmlFor="download-mirror" className="text-foreground text-sm font-medium">
          Download mirror
        </Label>
        <Select
          value={userPreferencesState.downloadMirror}
          onValueChange={(value) => {
            userPreferencesState.downloadMirror = value || defaultPackageMirror;
          }}
        >
          <SelectTrigger className="bg-input/30 border-border w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {downloadMirrorOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Directory for binaries */}
      <div className="flex w-full flex-col gap-3">
        <Label htmlFor="directory-binaries" className="text-foreground text-sm font-medium">
          Directory for binaries
        </Label>
        <Input
          id="directory-binaries"
          type="text"
          placeholder={defaultPathForGeneralBinaries}
          className="bg-input/30 border-border"
          disabled={!downloadKubectlBinaries}
          value={userPreferencesState.downloadBinariesPath ?? ""}
          onChange={(event) => {
            userPreferencesState.downloadBinariesPath = event.target.value || undefined;
          }}
        />
        <p className="text-muted-foreground text-sm">The directory to download binaries into.</p>
      </div>

      {/* Path to kubectl binary */}
      <div className="flex w-full flex-col gap-3">
        <Label htmlFor="kubectl-binary-path" className="text-foreground text-sm font-medium">
          Path to kubectl binary
        </Label>
        <Input
          id="kubectl-binary-path"
          type="text"
          placeholder={defaultPathForKubectlBinaries}
          className="bg-input/30 border-border"
          disabled={downloadKubectlBinaries}
          value={userPreferencesState.kubectlBinariesPath ?? ""}
          onChange={(event) => {
            userPreferencesState.kubectlBinariesPath = event.target.value || undefined;
          }}
        />
      </div>

      {/* Separator */}
      <Separator className="bg-border" />

      {/* Synced items */}
      <div className="flex flex-col gap-3">
        <Label className="text-foreground text-sm font-medium">Synced items</Label>

        <div className="flex flex-col gap-2">
          {syncedEntries.map((entry) => (
            <div key={entry} className="hover:bg-accent/50 flex items-center gap-3 rounded-lg p-3">
              <FileText className="text-muted-foreground h-5 w-5" />
              <div className="flex-1">
                <p className="text-muted-foreground text-sm">{entry}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  userPreferencesState.syncKubeconfigEntries.delete(entry);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Sync kubeconfig button */}
        <div className="flex justify-end">
          <Button
            className="w-fit"
            onClick={() => {
              openPathPickingDialog({
                message: "Sync Files and Folders",
                buttonLabel: "Sync",
                properties: ["showHiddenFiles", "multiSelections", "openFile", "openDirectory"],
                onPick: (paths) => {
                  if (!paths?.length) {
                    return;
                  }

                  for (const path of paths) {
                    userPreferencesState.syncKubeconfigEntries.set(path, {});
                  }
                },
              });
            }}
          >
            <FolderSync className="h-4 w-4" />
            Sync kubeconfig
          </Button>
        </div>
      </div>
    </>
  );
});

/**
 * 🎯 목적: Helm Repo 메뉴의 콘텐츠 영역 - Helm Repository 관리
 *
 * 📝 2026-01-12: Kubernetes 설정에서 분리하여 독립 메뉴로 이동
 */
function HelmRepoContent() {
  return <HelmCharts />;
}

/**
 * 🎯 목적: PreferencesDialog 메인 컴포넌트
 *
 * shadcn Dialog + Sidebar를 사용하여 전역 설정 모달을 렌더링합니다.
 */
const NonInjectedPreferencesDialog = observer((props: PreferencesDialogProps & Dependencies) => {
  const { isOpen, onOpenChange, applyShadcnTheme, userPreferencesState, preferencesDialogState } = props;
  const [activeMenu, setActiveMenu] = React.useState("App");

  // 🎯 목적: Dialog 열릴 때 initialMenu 확인 및 적용
  React.useEffect(() => {
    if (isOpen && preferencesDialogState.initialMenu) {
      setActiveMenu(preferencesDialogState.initialMenu);
      // initialMenu 사용 후 초기화 (다음 열기에서 재사용 방지)
      preferencesDialogState.initialMenu = undefined;
    }
  }, [isOpen, preferencesDialogState]);

  // 🎯 목적: Dialog가 닫힌 후 activeMenu 리셋 (다음 열 때 초기 상태 보장)
  React.useEffect(() => {
    if (!isOpen) {
      // Dialog가 완전히 닫힌 후 activeMenu를 App으로 리셋
      // 다음에 Dialog를 열 때 항상 App 메뉴부터 시작하도록 보장
      const timer = setTimeout(() => {
        setActiveMenu("App");
      }, 200); // 애니메이션 완료 후 리셋

      return () => clearTimeout(timer);
    }

    return undefined;
  }, [isOpen]);

  // 🎯 목적: Dialog 닫을 때 Portal과 pointer-events 강제 정리
  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        // Dialog를 닫기 전에 먼저 정리 작업 수행
        // 약간의 delay 후 Portal 및 overlay 강제 제거
        setTimeout(() => {
          // 모든 Radix Portal 제거
          document.querySelectorAll("[data-radix-portal]").forEach((portal) => {
            portal.remove();
          });

          // body의 pointer-events 강제 복원
          document.body.style.pointerEvents = "";
          document.body.style.overflow = "";

          // 혹시 모를 overlay div들 제거
          document.querySelectorAll(".fixed.inset-0").forEach((overlay) => {
            if (overlay.classList.contains("bg-black")) {
              overlay.remove();
            }
          });
        }, 300);
      }

      onOpenChange(open);
    },
    [onOpenChange],
  );

  // 🎯 "Generate with AI" 버튼에서 다이얼로그 닫기 이벤트 수신
  React.useEffect(() => {
    const handler = () => handleOpenChange(false);

    window.addEventListener("daive:close-preferences", handler);

    return () => window.removeEventListener("daive:close-preferences", handler);
  }, [handleOpenChange]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[85vh] max-h-[900px] max-w-[70%] flex-col overflow-hidden p-0 sm:h-[90vh] sm:max-w-[65%] lg:max-w-[60%] xl:max-w-[55%] !top-0 !left-0 !translate-x-0 !translate-y-0 !inset-0 !m-auto">
        {/* DialogTitle과 DialogDescription은 접근성을 위해 필수이지만 화면에 표시하지 않음 */}
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">Customize your settings here</DialogDescription>

        <SidebarProvider className="items-start">
          <Sidebar collapsible="none" className="flex">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {getNavData().nav.map((item) => (
                      <React.Fragment key={item.name}>
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            isActive={item.name === activeMenu}
                            onClick={() => setActiveMenu(item.name)}
                          >
                            <item.icon />
                            <span>{item.name}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                        {/* 🎯 2026-01-07: MCP Servers 다음에 Extension 섹션 구분선 */}
                        {item.name === "MCP Servers" && <Separator className="my-2" />}
                        {item.name === "MCP Servers" && (
                          <div className="px-3 pb-1">
                            <span className="text-muted-foreground text-xs font-medium">Extension</span>
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
              <div className="flex items-center gap-2 px-4">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">Settings</BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{activeMenu}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
              <div className="flex flex-col gap-6 p-4 pt-0">
                {activeMenu === "App" && (
                  <AppContent applyShadcnTheme={applyShadcnTheme} userPreferencesState={userPreferencesState} />
                )}
                {/* 🎯 2026-01-26: File Explorer 설정 페이지 추가 */}
                {activeMenu === "File Explorer" && (
                  <FileExplorerContent
                    userPreferencesState={userPreferencesState}
                    openPathPickingDialog={props.openPathPickingDialog}
                  />
                )}
                {activeMenu === "Proxy" && <ProxyContent userPreferencesState={userPreferencesState} />}
                {activeMenu === "Kubernetes" && (
                  <KubernetesContent
                    userPreferencesState={userPreferencesState}
                    openPathPickingDialog={props.openPathPickingDialog}
                    defaultPathForGeneralBinaries={props.defaultPathForGeneralBinaries}
                    defaultPathForKubectlBinaries={props.defaultPathForKubectlBinaries}
                  />
                )}
                {/* 🎯 2026-01-12: Helm Repo 설정 페이지 (Kubernetes에서 분리) */}
                {activeMenu === "Helm Repo" && <HelmRepoContent />}
                {/* 🎯 TODO: Editor 기능 구현 후 활성화
                {activeMenu === "Editor" && <EditorContent />}
                */}
                {activeMenu === "Terminal" && (
                  <TerminalContent
                    userPreferencesState={props.userPreferencesState}
                    defaultShell={props.defaultShell}
                    isWindows={props.isWindows}
                  />
                )}
                {activeMenu === "LLM Models" && (
                  <LLMModelsContent
                    userPreferencesState={props.userPreferencesState}
                    encryptService={props.encryptService}
                    ollamaService={props.ollamaService}
                    validateOpenRouterModel={props.validateOpenRouterModel}
                  />
                )}
                {activeMenu === "AI Settings" && <AiSettings />}
                {activeMenu === "Skills" && <SkillSettings />}
                {isFeatureEnabled("SKILL_EXPERT") && activeMenu === "Agents" && <AgentSettings />}
                {isFeatureEnabled("CLUSTER_MONITOR") && activeMenu === "Cluster Monitor" && (
                  <MonitorSettingsPanel
                    userPreferencesState={props.userPreferencesState}
                    clusters={props.connectedClusters}
                    agentIPCClient={props.agentIPCClient}
                  />
                )}
                {/* 🎯 2026-01-07: MCP Servers 설정 페이지 추가 */}
                {activeMenu === "MCP Servers" && <MCPSettings />}
                {activeMenu === "Observability" && (
                  <ExtensionContent userPreferencesState={props.userPreferencesState} />
                )}
              </div>
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
});

/**
 * 🎯 목적: DI 패턴 적용된 PreferencesDialog export
 */
export const PreferencesDialog = withInjectables<Dependencies, PreferencesDialogProps>(NonInjectedPreferencesDialog, {
  getProps: (di, props) => {
    // shadcn 테마 Injectable import
    const applyShadcnThemeInjectable = require("../../themes/apply-shadcn-theme.injectable").default;
    const userPreferencesStateInjectable =
      require("../../../features/user-preferences/common/state.injectable").default;
    const ollamaServiceInjectable = require("../../../features/ollama/renderer/ollama-service.injectable").default;
    const directoryForBinariesInjectable =
      require("../../../common/app-paths/directory-for-binaries/directory-for-binaries.injectable").default;
    const directoryForKubectlBinariesInjectable =
      require("../../../common/app-paths/directory-for-kubectl-binaries/directory-for-kubectl-binaries.injectable").default;
    const defaultShellInjectable = require("../../../common/vars/default-shell.injectable").default;
    const isWindowsInjectable = require("../../../common/vars/is-windows.injectable").default;
    const clusters = di.inject(clustersInjectable);

    return {
      ...props,
      activePreferenceTab: di.inject(activePreferenceTabInjectable),
      applyShadcnTheme: di.inject(applyShadcnThemeInjectable),
      userPreferencesState: di.inject(userPreferencesStateInjectable),
      encryptService: di.inject(encryptApiKeyInjectable),
      validateOpenRouterModel: di.inject(validateOpenRouterModelInjectable),
      preferencesDialogState: di.inject(preferencesDialogStateInjectable),
      ollamaService: di.inject(ollamaServiceInjectable),
      openPathPickingDialog: di.inject(openPathPickingDialogInjectable),
      defaultPathForGeneralBinaries: di.inject(directoryForBinariesInjectable),
      defaultPathForKubectlBinaries: di.inject(directoryForKubectlBinariesInjectable),
      defaultShell: di.inject(defaultShellInjectable),
      isWindows: di.inject(isWindowsInjectable),
      connectedClusters: (() => {
        const seen = new Set<string>();

        return clusters
          .get()
          .filter((cluster: any) => cluster.accessible?.get?.() && !cluster.disconnected?.get?.())
          .filter((cluster: any) => {
            if (seen.has(cluster.id)) {
              return false;
            }

            seen.add(cluster.id);
            return true;
          })
          .map((cluster: any) => ({
            id: cluster.id,
            name: cluster.name.get(),
            kubeconfigPath: cluster.kubeConfigPath.get(),
          }));
      })(),
      agentIPCClient: di.inject(agentIPCClientInjectable),
    };
  },
});
