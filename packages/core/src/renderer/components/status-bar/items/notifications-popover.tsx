/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 Purpose: Unified Notifications Popover component
 *
 * Displayed when clicking the notification icon, shows all notifications grouped by category.
 *
 * Features:
 * - Category-based notification grouping (FIX-037)
 * - App update notification section
 * - Collapsible sections
 * - Diff viewer for Compare notifications (FIX-036)
 *
 * 🔄 Change History:
 * - 2025-12-11 - Initial creation (update notification section)
 * - 2026-01-25: FIX-032 - Added kubectl operations section
 * - 2026-01-26: FIX-037 - Unified notification system with categories
 */

import { ipcRenderer } from "electron";
import {
  AlertTriangle,
  ArrowDownToLine,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Info,
  RefreshCw,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useCallback, useEffect, useState } from "react";
import { generateRequestId, type OpenFileRequest, postMessageChannels } from "../../../../common/ipc/post-message";
import {
  type DownloadProgress as DownloadProgressType,
  type UpdateInfo,
  type UpdateStatus,
  updateBannerChannels,
} from "../../../../common/ipc/update-banner";
import { cn } from "../../../lib/utils";
import { Button } from "../../shadcn-ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../shadcn-ui/popover";
import { Progress } from "../../shadcn-ui/progress";
import { Separator } from "../../shadcn-ui/separator";
import { Spinner } from "../../shadcn-ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../shadcn-ui/tooltip";
import {
  CATEGORY_CONFIGS,
  type NotificationCategory,
  type NotificationItem,
  notificationPanelStore,
} from "./notification-panel.store";

// 🆕 FIX-037: Category icons removed per user request

/**
 * 🎯 목적: Unified Notifications Popover 컴포넌트
 * 📝 FIX-037: All notifications now go through NotificationPanel
 */
export const NotificationsPopover: React.FC = observer(() => {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [version, setVersion] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [checking, setChecking] = useState(false);

  // 🆕 FIX-037: Collapsed sections state (local, not persisted)
  const [collapsedSections, setCollapsedSections] = useState<Set<NotificationCategory>>(new Set());

  /**
   * 🎯 목적: 업데이트 체크 요청
   */
  const checkForUpdates = useCallback(async () => {
    setChecking(true);
    setStatus("checking");

    try {
      await ipcRenderer.invoke(updateBannerChannels.checkForUpdate);
    } catch (err) {
      console.error("[NotificationsPopover] Failed to check for updates:", err);
      setStatus("error");
    } finally {
      setChecking(false);
    }
  }, []);

  /**
   * 🎯 목적: 다운로드 시작
   */
  const handleDownload = useCallback(async () => {
    try {
      setStatus("downloading");
      await ipcRenderer.invoke(updateBannerChannels.downloadUpdate);
    } catch (err) {
      console.error("[NotificationsPopover] Failed to download update:", err);
      setStatus("error");
    }
  }, []);

  /**
   * 🎯 목적: 설치 (재시작)
   */
  const handleInstall = useCallback(() => {
    ipcRenderer.send(updateBannerChannels.installUpdate);
  }, []);

  /**
   * 🎯 목적: IPC 이벤트 리스너 등록
   */
  useEffect(() => {
    const handleUpdateAvailable = (_event: Electron.IpcRendererEvent, info: UpdateInfo) => {
      setVersion(info.version);
      setStatus("idle");
      setChecking(false);
    };

    const handleUpdateNotAvailable = () => {
      setVersion(null);
      setStatus("idle");
      setChecking(false);
    };

    const handleDownloadProgress = (_event: Electron.IpcRendererEvent, progress: DownloadProgressType) => {
      setDownloadProgress(progress.percent);
      setStatus("downloading");
    };

    const handleUpdateDownloaded = () => {
      setStatus("ready");
      setDownloadProgress(100);
    };

    const handleUpdateError = (_event: Electron.IpcRendererEvent, error: string) => {
      console.error("[NotificationsPopover] Update error:", error);
      setStatus("error");
      setChecking(false);
    };

    ipcRenderer.on(updateBannerChannels.updateAvailable, handleUpdateAvailable);
    ipcRenderer.on(updateBannerChannels.updateNotAvailable, handleUpdateNotAvailable);
    ipcRenderer.on(updateBannerChannels.downloadProgress, handleDownloadProgress);
    ipcRenderer.on(updateBannerChannels.updateDownloaded, handleUpdateDownloaded);
    ipcRenderer.on(updateBannerChannels.updateError, handleUpdateError);

    // 컴포넌트 마운트 시 초기 업데이트 체크
    const initialCheck = setTimeout(() => {
      checkForUpdates();
    }, 3000);

    return () => {
      clearTimeout(initialCheck);
      ipcRenderer.removeListener(updateBannerChannels.updateAvailable, handleUpdateAvailable);
      ipcRenderer.removeListener(updateBannerChannels.updateNotAvailable, handleUpdateNotAvailable);
      ipcRenderer.removeListener(updateBannerChannels.downloadProgress, handleDownloadProgress);
      ipcRenderer.removeListener(updateBannerChannels.updateDownloaded, handleUpdateDownloaded);
      ipcRenderer.removeListener(updateBannerChannels.updateError, handleUpdateError);
    };
  }, [checkForUpdates]);

  /**
   * 🎯 목적: 외부 클릭 시 Popover 닫기 (iframe 포함)
   */
  useEffect(() => {
    if (!open) return;

    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const popoverContent = document.querySelector('[data-slot="popover-content"]');
      const popoverTrigger = document.querySelector('[data-slot="popover-trigger"]');

      if (popoverContent?.contains(target) || popoverTrigger?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const handleIframeClick = () => {
      setOpen(false);
    };

    document.addEventListener("mousedown", handleGlobalClick);

    const iframes = document.querySelectorAll("iframe");
    iframes.forEach((iframe) => {
      try {
        iframe.contentWindow?.addEventListener("mousedown", handleIframeClick);
      } catch {
        // cross-origin iframe은 무시
      }
    });

    return () => {
      document.removeEventListener("mousedown", handleGlobalClick);
      iframes.forEach((iframe) => {
        try {
          iframe.contentWindow?.removeEventListener("mousedown", handleIframeClick);
        } catch {
          // cross-origin iframe은 무시
        }
      });
    };
  }, [open]);

  // 🎯 Update status calculation
  const hasUpdate = version !== null && status !== "ready";
  const isReady = status === "ready";
  const isDownloading = status === "downloading";

  // 🆕 FIX-037: Get active categories with notifications
  const activeCategories = notificationPanelStore.activeCategories;
  const unreadCount = notificationPanelStore.unreadCount;
  const hasUnreadNotifications = unreadCount > 0;
  const hasNotification = hasUpdate || isReady || hasUnreadNotifications;

  /**
   * 🎯 FIX-035: Mark all notifications as read when popover opens
   */
  useEffect(() => {
    if (!open || unreadCount === 0) {
      return;
    }
    const timer = setTimeout(() => {
      notificationPanelStore.markAllAsRead();
    }, 500);
    return () => clearTimeout(timer);
  }, [open, unreadCount]);

  /**
   * 🆕 FIX-037: Toggle section collapsed state
   */
  const toggleSection = useCallback((category: NotificationCategory) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  /**
   * 🎯 Purpose: Clear notifications by category
   */
  const handleClearCategory = useCallback((category: NotificationCategory) => {
    notificationPanelStore.clearByCategory(category);
  }, []);

  /**
   * 🎯 Purpose: Remove single notification
   */
  const handleRemoveNotification = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    notificationPanelStore.removeNotification(id);
  }, []);

  /**
   * 🆕 FIX-036: Open diff directly in editor tab via postMessage (no modal)
   */
  const openDiffInTab = useCallback((content: string, filePath: string) => {
    if (!content) {
      console.warn("[NotificationsPopover] Cannot open diff in tab: content missing");
      return;
    }

    const fileName = filePath.split("/").pop() || "diff";
    const timestamp = Date.now();
    const virtualPath = `/tmp/skuberplus-diff/${fileName}-${timestamp}.diff`;

    const clusterFrames = document.querySelectorAll<HTMLIFrameElement>('iframe[id^="cluster-frame-"]');
    let activeFrame: HTMLIFrameElement | null = null;

    for (const frame of clusterFrames) {
      const style = window.getComputedStyle(frame);
      const isVisible = style.display !== "none" && style.visibility !== "hidden";
      if (isVisible) {
        activeFrame = frame;
        break;
      }
    }

    if (!activeFrame || !activeFrame.contentWindow) {
      console.warn("[NotificationsPopover] No active cluster frame found");
      return;
    }

    const request: OpenFileRequest = {
      channel: postMessageChannels.openFile,
      requestId: generateRequestId(),
      filePath: virtualPath,
      content: content,
      size: content.length,
      readOnly: true,
    };

    activeFrame.contentWindow.postMessage(request, "*");
    setOpen(false); // Close popover after opening tab
  }, []);

  /**
   * 🆕 FIX-036: Handle notification click - open diff directly in tab (no modal)
   */
  const handleNotificationClick = useCallback(
    (item: NotificationItem) => {
      if (item.metadata?.actionType === "diff" && item.metadata?.diffContent) {
        // Open directly in tab instead of showing modal
        openDiffInTab(item.metadata.diffContent, item.metadata.filePath || "");
      }
      notificationPanelStore.markAsRead(item.id);
    },
    [openDiffInTab],
  );

  /**
   * 🎯 Purpose: Format timestamp for display
   */
  const formatTime = useCallback((date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, []);

  /**
   * 🎯 Purpose: Get icon for notification type
   */
  const getTypeIcon = useCallback((type: NotificationItem["type"]) => {
    // 🎯 THEME-024: Semantic colors for notification types
    switch (type) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-status-success mt-0.5 shrink-0" />;
      case "error":
        return <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-status-warning mt-0.5 shrink-0" />;
      case "info":
      default:
        return <Info className="h-4 w-4 text-status-info mt-0.5 shrink-0" />;
    }
  }, []);

  /**
   * 🎯 Purpose: Render single notification item
   */
  const renderNotificationItem = useCallback(
    (item: NotificationItem) => {
      const isRead = item.read;
      const hasDiffContent = item.metadata?.actionType === "diff" && item.metadata?.diffContent;

      return (
        <div
          key={item.id}
          className={cn(
            "flex items-start gap-2 p-2 hover:bg-accent/50 rounded-sm group",
            isRead && "opacity-60",
            hasDiffContent && "cursor-pointer",
          )}
          onClick={hasDiffContent ? () => handleNotificationClick(item) : undefined}
        >
          {getTypeIcon(item.type)}

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={cn("text-xs truncate", isRead ? "font-normal" : "font-medium")}>{item.title}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(item.timestamp)}</span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 whitespace-pre-wrap cursor-help">
                  {item.message}
                </p>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                className="max-w-[400px] max-h-[300px] overflow-y-auto whitespace-pre-wrap text-xs"
              >
                {item.message}
              </TooltipContent>
            </Tooltip>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={(e) => handleRemoveNotification(item.id, e)}
            aria-label="Dismiss notification"
          >
            <XCircle className="h-3 w-3" />
          </Button>
        </div>
      );
    },
    [formatTime, handleRemoveNotification, handleNotificationClick, getTypeIcon],
  );

  /**
   * 🆕 FIX-037: Render category section
   */
  const renderCategorySection = useCallback(
    (category: NotificationCategory) => {
      const config = CATEGORY_CONFIGS.find((c) => c.id === category);
      if (!config) return null;

      const notifications = notificationPanelStore.getNotificationsByCategory(category);
      const isCollapsed = collapsedSections.has(category);
      const unreadInCategory = notificationPanelStore.getUnreadCountByCategory(category);

      return (
        <div key={category}>
          <div
            className="flex items-center justify-between px-3 py-1.5 bg-muted/50 cursor-pointer hover:bg-muted/70"
            onClick={() => toggleSection(category)}
          >
            <div className="flex items-center gap-2">
              {isCollapsed ? (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              )}
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{config.label}</span>
              {unreadInCategory > 0 && (
                <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                  {unreadInCategory}
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearCategory(category);
                }}
                aria-label={`Clear all ${config.label}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          {!isCollapsed && (
            <div className="max-h-[150px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex items-center gap-3 p-3 text-muted-foreground">
                  <Check className="h-4 w-4 text-status-success" />
                  <span className="text-xs">No {config.label.toLowerCase()} notifications</span>
                </div>
              ) : (
                notifications.slice(0, 10).map(renderNotificationItem)
              )}
            </div>
          )}
        </div>
      );
    },
    [collapsedSections, toggleSection, handleClearCategory, renderNotificationItem],
  );

  /**
   * 🎯 목적: 업데이트 섹션 렌더링
   */
  const renderUpdateSection = () => {
    if (checking || status === "checking") {
      return (
        <div className="flex items-center gap-3 p-3">
          <Spinner className="h-5 w-5" />
          <div className="flex-1">
            <span className="text-sm">Checking for updates...</span>
          </div>
        </div>
      );
    }

    if (status === "error") {
      return (
        <div className="flex items-center gap-3 p-3">
          <RefreshCw className="h-5 w-5 text-destructive" />
          <div className="flex-1">
            <span className="text-sm">Failed to check for updates</span>
          </div>
          <Button variant="outline" size="sm" onClick={checkForUpdates}>
            Retry
          </Button>
        </div>
      );
    }

    if (isDownloading) {
      return (
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-3">
            <Download className="h-5 w-5 text-primary animate-pulse" />
            <div className="flex-1">
              <span className="text-sm font-medium">Downloading v{version}</span>
            </div>
            <span className="text-xs text-muted-foreground">{downloadProgress.toFixed(0)}%</span>
          </div>
          <Progress value={downloadProgress} className="h-1.5" />
        </div>
      );
    }

    if (isReady) {
      return (
        <div className="flex items-center gap-3 p-3">
          <Check className="h-5 w-5 text-status-success" />
          <div className="flex-1">
            <span className="text-sm font-medium">Ready to install v{version}</span>
          </div>
          <Button size="sm" onClick={handleInstall} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Restart
          </Button>
        </div>
      );
    }

    if (hasUpdate) {
      return (
        <div className="flex items-center gap-3 p-3">
          <ArrowDownToLine className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <span className="text-sm font-medium">Update available: v{version}</span>
          </div>
          <Button size="sm" onClick={handleDownload} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Update
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3 p-3 text-muted-foreground">
        <Check className="h-5 w-5 text-status-success" />
        <span className="text-sm">You're up to date</span>
      </div>
    );
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        {/* 🎯 트리거 버튼 */}
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-sm transition-colors cursor-pointer",
              "hover:bg-accent/50 focus:outline-none focus:ring-1 focus:ring-ring",
              hasNotification ? "text-foreground font-semibold" : "text-muted-foreground",
            )}
            aria-label={hasNotification ? "You have notifications" : "No notifications"}
          >
            <Bell className="h-4 w-4" />
            <span className="text-xs">Notifications</span>
            {hasNotification && <span className="h-2 w-2 rounded-full bg-primary" />}
            {unreadCount > 0 && (
              <span className="text-[10px] bg-primary text-primary-foreground px-1 rounded-full min-w-[16px] text-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </PopoverTrigger>

        {/* 🎯 Popover 내용 */}
        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-[380px] p-0 max-h-[70vh] overflow-hidden flex flex-col"
          onInteractOutside={() => setOpen(false)}
          onEscapeKeyDown={() => setOpen(false)}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {notificationPanelStore.hasNotifications && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => notificationPanelStore.clearAll()}
              >
                Clear all
              </Button>
            )}
          </div>

          {/* 🆕 FIX-037: Scrollable content area */}
          <div className="flex-1 overflow-y-auto">
            {/* Render active category sections */}
            {activeCategories
              .filter((cat) => cat !== "updates")
              .map((category, index) => (
                <React.Fragment key={category}>
                  {index > 0 && <Separator />}
                  {renderCategorySection(category)}
                </React.Fragment>
              ))}

            {/* Updates Section (always shown) */}
            <Separator />
            <div>
              <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Updates</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={checkForUpdates}
                  disabled={checking || isDownloading}
                  aria-label="Check for updates"
                >
                  <RefreshCw className={cn("h-3 w-3", checking && "animate-spin")} />
                </Button>
              </div>
              {renderUpdateSection()}
            </div>
          </div>

          {/* Footer (when no notifications) */}
          {!hasNotification && activeCategories.length === 0 && (
            <>
              <Separator />
              <div className="px-3 py-2 text-xs text-muted-foreground text-center shrink-0">No new notifications</div>
            </>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
});

NotificationsPopover.displayName = "NotificationsPopover";
