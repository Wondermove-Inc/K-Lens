import { AlertTriangle, Info } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Spinner } from "./spinner";

interface LoadingOverlayMessage {
  message: string;
  level: "info" | "warning" | "error";
}

interface LoadingOverlayProps {
  /** 🎯 목적: 로딩 오버레이 표시 여부 */
  isVisible: boolean;
  /** 🎯 목적: 단일 메시지 (선택) */
  message?: string;
  /** 🎯 목적: 스피너 크기 */
  size?: "sm" | "md" | "lg" | "xl";
  /** 🎯 목적: 커스텀 클래스 */
  className?: string;
  /** 🎯 목적: 헤더 타이틀 (예: "Connecting...") */
  title?: string;
  /** 🎯 목적: 오버레이 카드 너비 */
  width?: string;
  /** 🎯 목적: 진행 로그를 순차적으로 표시 */
  messages?: LoadingOverlayMessage[];
  /** 🎯 목적: 재연결 핸들러 */
  onReconnect?: () => void;
  /** 🎯 목적: 닫기 핸들러 */
  onClose?: () => void;
  /** 🎯 목적: 액션 버튼 표시 여부 */
  showActions?: boolean;
  /** 🎯 목적: 오버레이 앵커 (기본: 전체 화면, parent: 부모 영역만) */
  anchor?: "viewport" | "parent";
  /** 🎯 목적: 배경 딤드 적용 여부 (기본: true) */
  dimmed?: boolean;
}

const sizeClasses: Record<NonNullable<LoadingOverlayProps["size"]>, string> = {
  sm: "size-5",
  md: "size-7",
  lg: "size-10",
  xl: "size-12",
};

// 🎯 THEME-024: Semantic colors for message levels
const levelClasses: Record<LoadingOverlayMessage["level"], string> = {
  info: "text-foreground/80",
  warning: "text-status-warning",
  error: "text-destructive",
};

// 🎯 THEME-024: Semantic colors for message level dots
const dotClasses: Record<LoadingOverlayMessage["level"], string> = {
  info: "bg-primary/80",
  warning: "bg-status-warning",
  error: "bg-destructive",
};

/**
 * 🎯 목적: 스토리북 templates/LoadingOverlay 패턴을 따르는 전역 로딩 오버레이
 *
 * ✨ 특징:
 * - 기존 화면을 유지한 채 딤드 + 카드 형태로 로딩 상태 표시
 * - 메시지 로그와 액션 버튼(재연결/닫기) 지원
 * - 스피너 크기, 카드 너비, 타이틀 커스터마이징 가능
 *
 * 🔄 2026-01-15: 레이아웃 개선 - flex 기반으로 변경하여 정렬 문제 해결
 */
export function LoadingOverlay({
  isVisible,
  message,
  size = "md",
  className,
  title,
  width,
  messages,
  onReconnect,
  onClose,
  showActions,
  anchor = "viewport",
  dimmed = true,
}: LoadingOverlayProps) {
  if (!isVisible) {
    return null;
  }

  const hasMessages = Boolean(messages?.length);
  const hasActions = showActions && (onReconnect || onClose);
  const hasErrors = messages?.some((m) => m.level === "error");
  const hasWarnings = messages?.some((m) => m.level === "warning");

  return (
    <div
      className={cn(
        anchor === "viewport" ? "fixed inset-0" : "absolute inset-0",
        "z-[60] flex items-center justify-center",
        dimmed ? "bg-black/40 backdrop-blur-sm" : "bg-transparent",
        "animate-in fade-in-0 duration-150",
        className,
      )}
      role="dialog"
      aria-label={title ?? "Loading"}
      aria-live="polite"
    >
      {/* 🎯 목적: 로딩 카드 컨테이너 */}
      <div className={cn("w-full px-4", width ? "" : "max-w-[400px]")} style={width ? { maxWidth: width } : undefined}>
        <div data-slot="alert" role="alert" className="bg-card border rounded-xl shadow-lg overflow-hidden">
          {/* 메인 컨텐츠 영역 */}
          <div className="flex items-start gap-3 p-4">
            {/* 아이콘/스피너 영역 - 고정 너비 */}
            <div className="shrink-0 pt-0.5">
              {hasErrors ? (
                <AlertTriangle className="size-5 text-destructive" aria-hidden />
              ) : hasWarnings ? (
                <Info className="size-5 text-status-warning" aria-hidden />
              ) : (
                <Spinner className={cn(sizeClasses[size], "text-primary")} aria-label="Loading" role="status" />
              )}
            </div>

            {/* 텍스트 영역 */}
            <div className="flex-1 min-w-0">
              {/* 타이틀 */}
              <div
                data-slot="alert-title"
                className="font-medium text-sm text-foreground truncate"
                title={title ?? "Connecting cluster..."}
              >
                {title ?? "Connecting cluster..."}
              </div>

              {/* 설명/로그 */}
              {(hasMessages || message) && (
                <div data-slot="alert-description" className="mt-1 text-xs text-muted-foreground">
                  {hasMessages ? (
                    <div className="flex flex-col gap-1 max-h-[30vh] overflow-auto">
                      {messages?.map((log, index) => (
                        <div
                          key={`${log.message}-${index}`}
                          className={cn("flex items-start gap-2", levelClasses[log.level])}
                        >
                          <span
                            className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", dotClasses[log.level])}
                            aria-hidden
                          />
                          <span className="break-words">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span>{message}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 액션 버튼 영역 */}
          {hasActions && (
            <div className="flex justify-end gap-2 px-4 py-3 border-t bg-muted/30">
              {onReconnect && (
                <Button type="button" size="sm" onClick={onReconnect}>
                  Reconnect
                </Button>
              )}
              {onClose && (
                <Button type="button" size="sm" variant="ghost" onClick={onClose}>
                  Close
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
