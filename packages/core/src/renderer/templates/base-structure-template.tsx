"use client";

import React from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/shadcn-ui/sidebar";
import { AIAssistant } from "@/registry/templates/ai-assistant/ai-assistant";
import { Header } from "@/registry/templates/header/header";

/**
 * 🎯 목적: BaseStructure 템플릿의 Props 타입 정의
 */
interface BaseStructureTemplateProps {
  children?: React.ReactNode;
  showAIAssistant?: boolean;
}

/**
 * 🎯 목적: 모듈화된 베이스 구조 템플릿 컴포넌트
 * Header, Sidebar, AI Assistant 템플릿을 조합하여 완전한 3열 레이아웃 제공
 *
 * 특징:
 * - Header 템플릿을 사용한 상단 헤더 (전체 폭)
 * - Sidebar 템플릿을 사용한 왼쪽 사이드바
 * - children으로 중앙 메인 콘텐츠 영역 커스터마이징 가능
 * - AI Assistant 템플릿을 사용한 우측 사이드바 (선택적)
 * - UIDL 명세서에 따른 3열 레이아웃 구조 구현
 */
export function BaseStructureTemplate({ children, showAIAssistant = true }: BaseStructureTemplateProps) {
  // 🎯 목적: 검색 쿼리 상태 관리
  const [searchQuery, setSearchQuery] = React.useState("");

  // 🎯 목적: AI Assistant 표시 상태 관리
  const [isAIAssistantVisible, setIsAIAssistantVisible] = React.useState(showAIAssistant);

  // 🎯 목적: Header의 검색 변경 핸들러
  const handleSearchChange = React.useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  // 🎯 목적: 사이드바 표시 상태 관리
  const [isSidebarVisible, setIsSidebarVisible] = React.useState(true);

  // 🎯 목적: 사이드바 토글 핸들러 (Header에서 사용)
  const handlePanelLeftToggle = React.useCallback(() => {
    setIsSidebarVisible((prev) => !prev);
  }, []);

  // 🎯 목적: AI Assistant 토글 핸들러
  const handleAIAssistantToggle = React.useCallback(() => {
    setIsAIAssistantVisible((prev) => !prev);
  }, []);

  // 🎯 목적: AI Assistant 닫기 핸들러
  const handleAIAssistantClose = React.useCallback(() => {
    setIsAIAssistantVisible(false);
  }, []);

  // 🎯 목적: AI Assistant 시작 핸들러
  const handleAIAssistantStart = React.useCallback((provider: string, apiKey: string) => {
    console.log("AI Assistant started:", { provider, apiKey });
    // 실제 구현에서는 AI 서비스 초기화 로직 추가
  }, []);

  return (
    <div className="flex h-screen w-full flex-col">
      {/* 🎯 목적: 상단 Header 영역 - 전체 폭에 걸쳐 배치 */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onPanelLeftToggle={handlePanelLeftToggle}
        onAiAssistantToggle={handleAIAssistantToggle}
      />

      {/* 🎯 목적: SidebarProvider로 감싸진 3열 레이아웃 */}
      <SidebarProvider className="flex flex-1">
        {/* 🎯 목적: 왼쪽 사이드바 영역 - 조건부 렌더링 */}
        {isSidebarVisible && <AppSidebar className="border-r" />}

        {/* 🎯 목적: 중앙 메인 콘텐츠 영역 */}
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          {children || (
            <div className="flex h-full w-full flex-col items-center justify-center gap-4">
              <div className="bg-muted text-muted-foreground flex items-center justify-center gap-2 rounded-md px-3 py-2">
                <span className="font-mono text-sm">contents-area</span>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground text-sm">이 영역은 children prop으로 커스터마이징할 수 있습니다.</p>
              </div>
            </div>
          )}
        </main>

        {/* 🎯 목적: 우측 AI Assistant 영역 - 조건부 렌더링 */}
        {isAIAssistantVisible && (
          <AIAssistant
            onClose={handleAIAssistantClose}
            onStart={handleAIAssistantStart}
            className="w-[400px] shrink-0"
          />
        )}
      </SidebarProvider>
    </div>
  );
}
