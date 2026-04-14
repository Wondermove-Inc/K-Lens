/**
 * 🎯 목적: shadcn UpdateBanner 템플릿을 Sidebar 하단에서도 그대로 재사용할 수 있는 컴포넌트
 * 🔄 변경이력:
 *   - 2025-10-22 - 최초 작성, Sidebar 푸터 노출 전용 Props 구성
 *   - 2025-12-02 - electron-updater 통합: 동적 버전 정보, 상태별 UI 추가
 */

import { ArrowUpRight, Download, RefreshCw, RotateCcw, X } from "lucide-react";
import React from "react";
import notificationBellIcon from "../../../../../../skuberplus/static/images/apps/notification-bell.png";
import { cn } from "../../lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "../shadcn-ui/avatar";
import { Button } from "../shadcn-ui/button";
import { Card } from "../shadcn-ui/card";
import { Progress } from "../shadcn-ui/progress";
import styles from "./update-banner.module.scss";

import type { UpdateStatus } from "../../../common/ipc/update-banner";

export interface UpdateBannerProps extends React.ComponentProps<"div"> {
  /**
   * 🎯 목적: 렌더 조건 제어 (세션 단위 표시/숨김)
   */
  readonly isVisible: boolean;

  /**
   * 🎯 목적: 닫기 버튼 클릭 시 상위에서 상태를 제어하기 위한 콜백
   */
  readonly onClose: () => void;

  /**
   * 🎯 목적: 업데이트 가능한 버전 (예: "1.6.0")
   */
  readonly version?: string;

  /**
   * 🎯 목적: 현재 업데이트 상태
   */
  readonly status?: UpdateStatus;

  /**
   * 🎯 목적: 다운로드 진행률 (0-100)
   */
  readonly downloadProgress?: number;

  /**
   * 🎯 목적: Update 버튼 클릭 핸들러
   */
  readonly onUpdateClick?: () => void;
}

export const UpdateBanner = ({
  isVisible,
  onClose,
  version,
  status = "idle",
  downloadProgress = 0,
  onUpdateClick,
  className,
  ...props
}: UpdateBannerProps) => {
  if (!isVisible) {
    return null;
  }

  /**
   * 🎯 상태별 타이틀 텍스트
   */
  const getTitle = () => {
    switch (status) {
      case "checking":
        return "Checking...";
      case "downloading":
        return "Downloading...";
      case "ready":
        return "Ready to Install";
      case "error":
        return "Update Error";
      default:
        return "Update Ready";
    }
  };

  /**
   * 🎯 상태별 설명 텍스트
   */
  const getDescription = () => {
    switch (status) {
      case "checking":
        return "Checking for updates...";
      case "downloading":
        return `Downloading ${downloadProgress.toFixed(0)}%`;
      case "ready":
        return `Version ${version || "unknown"} is ready.`;
      case "error":
        return "Failed to check for updates.";
      default:
        return `Version ${version || "unknown"} is now available.`;
    }
  };

  /**
   * 🎯 상태별 버튼 렌더링
   */
  const renderButton = () => {
    const buttonBaseClass =
      "mt-auto gap-2 self-end border border-white/20 bg-white/10 !text-slate-50 hover:bg-white/20";
    const buttonStyle = { color: "rgb(248 250 252)" };

    switch (status) {
      case "checking":
        return (
          <Button variant="secondary" size="sm" className={buttonBaseClass} style={buttonStyle} disabled>
            <RefreshCw className="h-4 w-4 animate-spin" />
            Checking
          </Button>
        );
      case "downloading":
        return (
          <Button
            variant="secondary"
            size="sm"
            className={cn(buttonBaseClass, "min-w-[76px]")}
            style={buttonStyle}
            disabled
          >
            <Download className="h-4 w-4 animate-pulse" />
            {downloadProgress.toFixed(0)}%
          </Button>
        );
      case "ready":
        return (
          <Button variant="secondary" size="sm" className={buttonBaseClass} style={buttonStyle} onClick={onUpdateClick}>
            <RotateCcw className="h-4 w-4" />
            Restart
          </Button>
        );
      case "error":
        return (
          <Button variant="secondary" size="sm" className={buttonBaseClass} style={buttonStyle} onClick={onUpdateClick}>
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        );
      default:
        return (
          <Button variant="secondary" size="sm" className={buttonBaseClass} style={buttonStyle} onClick={onUpdateClick}>
            Update
            <ArrowUpRight className="h-4 w-4 text-current" />
          </Button>
        );
    }
  };

  return (
    <Card
      className={cn(
        // 🎯 고정 높이: Progress 바가 항상 렌더링되어 레이아웃 일정 유지
        "border-border relative flex h-[150px] w-full min-w-[284px] flex-col overflow-hidden rounded-[10px] border p-3 shadow-none",
        className,
      )}
      data-shadcn-skip-bg
      {...props}
    >
      {/* 🎨 배경 이미지는 Card 전체를 덮어 shadcn 템플릿의 그라디언트 질감을 복제 */}
      <div className={cn("absolute inset-0 z-0", styles.background)} aria-hidden="true" />

      {/* ⚙️ 세션 단위 닫힘을 위한 Close 버튼 */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 right-3 z-40 rounded-full p-1 opacity-70 transition-opacity hover:opacity-100 cursor-pointer"
        aria-label="닫기"
      >
        <X className="h-5 w-5 text-slate-200" />
      </button>

      <div className="relative z-10 flex h-full flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={notificationBellIcon} alt="Update notification icon" />
            <AvatarFallback className="bg-white/20 text-xs text-white">U</AvatarFallback>
          </Avatar>

          <div className="space-y-1.5">
            <h3 className="text-sm leading-none font-medium text-slate-50">{getTitle()}</h3>
            <p className="text-xs leading-none font-light text-slate-100">{getDescription()}</p>
          </div>
        </div>

        {/* 🎯 다운로드 진행률 바 - 항상 렌더링하여 레이아웃 일정 유지 */}
        <Progress
          value={status === "downloading" ? downloadProgress : 0}
          className={cn(
            "h-1 w-full bg-white/20 transition-opacity duration-300",
            status === "downloading" ? "opacity-100" : "opacity-0",
          )}
        />

        {/* 🚀 상태별 버튼 렌더링 */}
        {renderButton()}
      </div>
    </Card>
  );
};

UpdateBanner.displayName = "UpdateBanner";
