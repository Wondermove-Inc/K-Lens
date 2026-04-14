/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AI 개인화 프로필 뷰어 + 편집 컴포넌트
 *
 * ProfileViewer: MD 프로필을 마크다운으로 렌더링하고 편집 모드를 지원하는 컴포넌트.
 * ai-settings.tsx에서 Personalization 토글 아래에 임베드됩니다.
 *
 * @packageDocumentation
 *
 * 🔄 변경이력:
 * - 2026-03-19: 초기 생성
 * - 2026-03-24: 마크다운 렌더링 + 편집 모드 추가, ProfileViewer 분리
 */

import { ipcRenderer } from "electron";
import { AlertTriangle, Edit3, FileText, Loader2, Save, X } from "lucide-react";
import * as React from "react";
import {
  type UserProfileRequest,
  type UserProfileResponse,
  userProfileChannel,
} from "../../../features/ai-assistant/common/user-profile-channels";
import { MarkdownViewer } from "../markdown-viewer/markdown-viewer";
import { Button } from "../shadcn-ui/button";
import { Textarea } from "../shadcn-ui/textarea";

import type { RequestFromChannel } from "@skuberplus/messaging";

// ============================================
// 🎯 ProfileViewer 컴포넌트
// ============================================

interface ProfileViewerProps {
  requestFromChannel: RequestFromChannel;
}

/**
 * 🎯 목적: MD 프로필 뷰어 + 편집기
 *
 * - View Profile 버튼 클릭 → 마크다운 렌더링으로 프로필 표시
 * - Edit 버튼 → textarea 편집 모드
 * - Save → update-profile-md IPC 호출
 */
export const ProfileViewer: React.FC<ProfileViewerProps> = ({ requestFromChannel }) => {
  const [mdContent, setMdContent] = React.useState<string>("");
  const [showMd, setShowMd] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editContent, setEditContent] = React.useState<string>("");
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // 🎯 MD 내용 로드
  const loadMdContent = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const mdResponse = await requestFromChannel<UserProfileRequest, UserProfileResponse>(userProfileChannel, {
        type: "get-profile-md",
      });

      if (mdResponse.type === "profile-md") {
        setMdContent(mdResponse.content);
      }
    } catch (err) {
      console.error("[ProfileViewer] MD 로드 실패:", err);
      setError("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, [requestFromChannel]);

  React.useEffect(() => {
    loadMdContent();
  }, [loadMdContent]);

  // 🎯 실시간 업데이트: IPC 이벤트 구독 (main에서 save 시 알림)
  React.useEffect(() => {
    if (!showMd || isEditing) return;

    const handler = () => {
      loadMdContent();
    };
    ipcRenderer.on("ai-assistant:profile-updated", handler);

    return () => {
      ipcRenderer.removeListener("ai-assistant:profile-updated", handler);
    };
  }, [showMd, isEditing, loadMdContent]);

  // 🎯 편집 모드 진입
  const handleStartEdit = React.useCallback(() => {
    setEditContent(mdContent);
    setIsEditing(true);
  }, [mdContent]);

  // 🎯 편집 취소
  const handleCancelEdit = React.useCallback(() => {
    setIsEditing(false);
    setEditContent("");
  }, []);

  // 🎯 편집 저장
  const handleSaveEdit = React.useCallback(async () => {
    try {
      setSaving(true);

      const response = await requestFromChannel<UserProfileRequest, UserProfileResponse>(userProfileChannel, {
        type: "update-profile-md",
        content: editContent,
      });

      if (response.type === "profile-md-updated" && response.success) {
        setMdContent(editContent);
        setIsEditing(false);
        setEditContent("");
      }
    } catch (err) {
      console.error("[ProfileViewer] 저장 실패:", err);
      setError("Failed to save profile changes.");
    } finally {
      setSaving(false);
    }
  }, [editContent, requestFromChannel]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading profile...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-4 text-destructive text-sm">
        <AlertTriangle className="h-4 w-4" />
        {error}
      </div>
    );
  }

  if (!mdContent) {
    return (
      <p className="text-muted-foreground text-sm py-4">No profile data yet. Start chatting to build your profile.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* View Profile 토글 + 편집 버튼 */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (isEditing) {
              handleCancelEdit();
            }
            setShowMd(!showMd);
          }}
        >
          {showMd ? (
            <>
              <X className="h-3.5 w-3.5 mr-1.5" />
              Hide Profile
            </>
          ) : (
            <>
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              View Profile
            </>
          )}
        </Button>

        {showMd && (
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="ghost" size="sm" onClick={handleCancelEdit} disabled={saving}>
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={saving || editContent === mdContent}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {saving ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={handleStartEdit}>
                <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
            )}
          </div>
        )}
      </div>

      {/* MD 내용: 마크다운 렌더링 또는 편집 textarea */}
      {showMd &&
        (isEditing ? (
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="bg-background border-border min-h-[400px] font-mono text-sm text-foreground"
            placeholder="Edit your profile markdown..."
          />
        ) : (
          <div className="rounded-md border border-border bg-background p-4 max-h-[400px] overflow-y-auto">
            <MarkdownViewer markdown={mdContent} />
          </div>
        ))}
    </div>
  );
};
