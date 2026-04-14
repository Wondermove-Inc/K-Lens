/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AI Settings 탭 — 개인화 설정 단순화
 *
 * Settings > AI Settings 탭에서 언어, 자동 학습, 리셋 기능을 제공합니다.
 * 기존 Personalization 탭의 프로필 뷰어(techLevel, agentTone 등)를 제거하고
 * 실용적인 설정 3개로 단순화합니다.
 *
 * @packageDocumentation
 *
 * 🔄 변경이력:
 * - 2026-03-20: 초기 생성 (Phase 1 — Personalization → AI Settings 교체)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { type RequestFromChannel, requestFromChannelInjectionToken } from "@skuberplus/messaging";
import { AlertTriangle } from "lucide-react";
import * as React from "react";
import {
  type UserProfileRequest,
  type UserProfileResponse,
  userProfileChannel,
} from "../../../features/ai-assistant/common/user-profile-channels";
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
import { Button } from "../shadcn-ui/button";
import { Checkbox } from "../shadcn-ui/checkbox";
import { Label } from "../shadcn-ui/label";
import { Separator } from "../shadcn-ui/separator";
import { Switch } from "../shadcn-ui/switch";
import { ProfileViewer } from "./personalization-settings";

// ============================================
// 🎯 자동 승인 체크리스트 데이터
// ============================================

const AUTO_APPROVAL_STRUCTURED_TOOLS = [
  "getPods",
  "getDeployments",
  "getServices",
  "getLogs",
  "describeResource",
  "getNodes",
  "getNamespaces",
];

const AUTO_APPROVAL_KUBECTL_COMMANDS: Array<{ cmd: string; isWrite: boolean }> = [
  { cmd: "get", isWrite: false },
  { cmd: "describe", isWrite: false },
  { cmd: "logs", isWrite: false },
  { cmd: "top", isWrite: false },
  { cmd: "apply", isWrite: true },
  { cmd: "create", isWrite: true },
  { cmd: "delete", isWrite: true },
  { cmd: "patch", isWrite: true },
  { cmd: "replace", isWrite: true },
  { cmd: "scale", isWrite: true },
  { cmd: "edit", isWrite: true },
  { cmd: "rollout", isWrite: true },
  { cmd: "label", isWrite: true },
  { cmd: "annotate", isWrite: true },
  { cmd: "set", isWrite: true },
  { cmd: "taint", isWrite: true },
  { cmd: "cordon", isWrite: true },
  { cmd: "uncordon", isWrite: true },
  { cmd: "drain", isWrite: true },
];

const AUTO_APPROVAL_HELM_COMMANDS = ["install", "upgrade", "uninstall", "rollback", "test", "push"];

const AUTO_APPROVAL_OTHER_TOOLS: Array<{ name: string; isWrite: boolean }> = [
  { name: "shell", isWrite: true },
  { name: "save_to_cluster", isWrite: true },
  { name: "write_file", isWrite: true },
  { name: "delete_file", isWrite: true },
];

// ============================================
// 🎯 타입 정의
// ============================================

interface AiSettingsDeps {
  requestFromChannel: RequestFromChannel;
}

// ============================================
// 🎯 컴포넌트
// ============================================

const NonInjectedAiSettings: React.FC<AiSettingsDeps> = ({ requestFromChannel }) => {
  const [personalizationEnabled, setPersonalizationEnabled] = React.useState<boolean>(true);
  const [hasLearningData, setHasLearningData] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showResetDialog, setShowResetDialog] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);
  const [autoApprovalRules, setAutoApprovalRules] = React.useState<string[]>([]);

  // 🎯 프로필에서 현재 설정값 로드
  const loadSettings = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await requestFromChannel<UserProfileRequest, UserProfileResponse>(userProfileChannel, {
        type: "get-profile",
      });

      if (response.type === "profile") {
        // Personalization = autoLearn AND workspaceLearning 둘 다 ON일 때 ON
        const autoLearn = response.profile.autoLearnEnabled ?? true;
        const workspace = response.profile.workspaceLearningEnabled ?? true;

        setPersonalizationEnabled(autoLearn && workspace);

        // 학습 데이터 유무 확인 (대화, workspace context, 피드백 중 하나라도 있으면)
        const hasConversations = (response.profile.totalConversations ?? 0) > 0;
        const hasWorkspace =
          response.profile.workspaceContext &&
          (response.profile.workspaceContext.frequentNamespaces.length > 0 ||
            response.profile.workspaceContext.frequentResourceTypes.length > 0 ||
            response.profile.workspaceContext.recurringIssues.length > 0);
        const hasFeedback = (response.profile.feedbackHistory?.length ?? 0) > 0;

        setHasLearningData(hasConversations || !!hasWorkspace || hasFeedback);
        setAutoApprovalRules(response.profile.autoApprovalRules ?? []);
      }
    } catch (err) {
      console.error("[AiSettings] Failed to load settings:", err);
      setError("Failed to load AI settings.");
    } finally {
      setLoading(false);
    }
  }, [requestFromChannel]);

  React.useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // 🎯 Personalization 토글 핸들러 (auto-learn + workspace learning 동시 제어)
  const handlePersonalizationChange = React.useCallback(
    async (enabled: boolean) => {
      setPersonalizationEnabled(enabled);

      try {
        await requestFromChannel<UserProfileRequest, UserProfileResponse>(userProfileChannel, {
          type: "set-auto-learn",
          enabled,
        });
        await requestFromChannel<UserProfileRequest, UserProfileResponse>(userProfileChannel, {
          type: "set-workspace-learning",
          enabled,
        });
      } catch (err) {
        console.error("[AiSettings] Failed to update personalization:", err);
        setPersonalizationEnabled(!enabled);
      }
    },
    [requestFromChannel],
  );

  // 🎯 자동 승인 규칙 토글 핸들러
  const handleToggleRule = React.useCallback(
    async (key: string, checked: boolean) => {
      const newRules = checked ? [...autoApprovalRules, key] : autoApprovalRules.filter((r) => r !== key);

      setAutoApprovalRules(newRules);

      try {
        await requestFromChannel<UserProfileRequest, UserProfileResponse>(userProfileChannel, {
          type: "set-auto-approval-rules",
          rules: newRules,
        });
      } catch (err) {
        console.error("[AiSettings] Failed to update auto-approval rules:", err);
        setAutoApprovalRules(autoApprovalRules);
      }
    },
    [requestFromChannel, autoApprovalRules],
  );

  // 🎯 리셋 핸들러
  const handleReset = React.useCallback(async () => {
    try {
      setResetting(true);

      const response = await requestFromChannel<UserProfileRequest, UserProfileResponse>(userProfileChannel, {
        type: "reset-profile",
      });

      if (response.type === "profile-reset" && response.success) {
        await loadSettings();
      }
    } catch (err) {
      console.error("[AiSettings] Failed to reset:", err);
      setError("Failed to reset learning data.");
    } finally {
      setResetting(false);
      setShowResetDialog(false);
    }
  }, [requestFromChannel, loadSettings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">Loading AI settings...</div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-8 text-destructive text-sm">
        <AlertTriangle className="h-4 w-4" />
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold">AI Settings</h3>
        <p className="text-xs text-muted-foreground">Configure how the AI assistant responds to you</p>
      </div>

      <Separator />

      {/* Personalization */}
      <div className="flex items-start gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center gap-3">
            <Label htmlFor="ai-personalization" className="text-foreground flex-1 text-sm font-medium">
              Personalization
            </Label>
            <Switch
              id="ai-personalization"
              checked={personalizationEnabled}
              onCheckedChange={handlePersonalizationChange}
            />
          </div>
          <p className="text-muted-foreground text-sm">
            AI learns your preferences and work patterns to provide tailored responses.
          </p>
        </div>
      </div>

      {/* 🎯 Profile Viewer — 개인화 ON일 때만 표시 */}
      {personalizationEnabled && <ProfileViewer requestFromChannel={requestFromChannel} />}

      {/* Reset learning data */}
      {hasLearningData ? (
        <div className="flex items-start gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <Label className="text-foreground text-sm font-medium">Reset learning data</Label>
            <p className="text-muted-foreground text-sm">Remove all learned preferences and start fresh.</p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => setShowResetDialog(true)} disabled={resetting}>
            Reset
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label className="text-foreground text-sm font-medium">No learning data</Label>
          <p className="text-muted-foreground text-sm">AI will start learning from your next conversation.</p>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent className="gap-4 p-6 sm:max-w-[425px]">
          <AlertDialogHeader className="gap-2">
            <AlertDialogTitle>Reset learning data</AlertDialogTitle>
            <AlertDialogDescription>All learned data will be reset. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Separator />

      {/* Tool Auto-Approval */}
      <div className="flex flex-col gap-4">
        <div>
          <Label className="text-foreground text-sm font-medium">Tool Auto-Approval</Label>
          <p className="text-muted-foreground text-sm mt-1">
            Checked tools run without approval prompts. Applies when HITL is set to &quot;Always Approve&quot; or
            &quot;Read Only&quot;.
          </p>
        </div>

        {/* Structured Query */}
        <div className="flex flex-col gap-2">
          <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Structured Query</Label>
          <div className="grid grid-cols-2 gap-2">
            {AUTO_APPROVAL_STRUCTURED_TOOLS.map((tool) => (
              <label key={tool} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={autoApprovalRules.includes(tool)}
                  onCheckedChange={(checked) => handleToggleRule(tool, !!checked)}
                />
                {tool}
              </label>
            ))}
          </div>
        </div>

        {/* kubectl commands */}
        <div className="flex flex-col gap-2">
          <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">kubectl</Label>
          <div className="grid grid-cols-2 gap-2">
            {AUTO_APPROVAL_KUBECTL_COMMANDS.map(({ cmd }) => (
              <label key={cmd} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={autoApprovalRules.includes(`kubectl:${cmd}`)}
                  onCheckedChange={(checked) => handleToggleRule(`kubectl:${cmd}`, !!checked)}
                />
                kubectl {cmd}
              </label>
            ))}
          </div>
        </div>

        {/* helm commands */}
        <div className="flex flex-col gap-2">
          <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">helm</Label>
          <div className="grid grid-cols-2 gap-2">
            {AUTO_APPROVAL_HELM_COMMANDS.map((cmd) => (
              <label key={cmd} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={autoApprovalRules.includes(`helm:${cmd}`)}
                  onCheckedChange={(checked) => handleToggleRule(`helm:${cmd}`, !!checked)}
                />
                helm {cmd}
              </label>
            ))}
          </div>
        </div>

        {/* Other tools */}
        <div className="flex flex-col gap-2">
          <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Other Tools</Label>
          <div className="grid grid-cols-2 gap-2">
            {AUTO_APPROVAL_OTHER_TOOLS.map(({ name }) => (
              <label key={name} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={autoApprovalRules.includes(name)}
                  onCheckedChange={(checked) => handleToggleRule(name, !!checked)}
                />
                {name}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// 🎯 DI wrapper
// ============================================

export const AiSettings = withInjectables<AiSettingsDeps>(NonInjectedAiSettings, {
  getProps: (di) => ({
    requestFromChannel: di.inject(requestFromChannelInjectionToken),
  }),
});
