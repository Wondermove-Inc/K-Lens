/**
 * DAIVE Assistant Settings
 *
 * Storybook Template Source:
 * - File: packages/storybook-shadcn/vendor/shadcn/src/registry/templates/ai-assistant/ai-assistant.tsx
 * - Story: Start
 * - Commit: b7e3c9f
 * - Last Updated: 2025-10-31
 */

import { ArrowUpRight, BotMessageSquare, ListChecks, MessagesSquare, Shield, X } from "lucide-react";
import React from "react";
import { Button } from "../shadcn-ui/button";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "../shadcn-ui/item";

/**
 * 목적: AI Assistant Settings Props 타입 정의
 */
interface AiAssistantSettingsProps {
  onClose: () => void;
  onSetupClick?: () => void; // 🔄 추가: Setup Now 버튼 클릭 핸들러 (Preferences Dialog 열기)
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 목적: AI Assistant 초기 설정 화면 컴포넌트
 *
 * 특징:
 * - Storybook Template "Start" 디자인 적용
 * - Bot 아이콘 및 히어로 텍스트
 * - 3개 feature showcase cards
 * - "Setup Now" 버튼으로 Preferences Dialog 열기
 * - 다크 테마 최적화 디자인
 * - shadcn/ui 디자인 토큰 준수
 */
export function AiAssistantSettings({ onClose, onSetupClick, className, style }: AiAssistantSettingsProps) {
  return (
    <aside
      className={`border-border bg-sidebar flex h-auto shrink-0 flex-col gap-10 border-l p-4 ${className || ""} `.trim()}
      style={style}
    >
      {/* 목적: 헤더 섹션 */}
      <div className="relative flex flex-col gap-0.5">
        <div className="flex items-center justify-between">
          <h3 className="text-foreground text-lg leading-7 font-semibold">DAIVE Assistant</h3>

          {/* 목적: 닫기 버튼 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 shrink-0 p-0 opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close AI Assistant</span>
          </Button>
        </div>
      </div>

      {/* 목적: UIDL 기반 메인 콘텐츠 */}
      <div className="flex w-full flex-col items-center gap-10">
        {/* 목적: 상단 섹션 - 봇 아이콘과 안내 텍스트 */}
        <div className="flex flex-col items-center gap-3.5">
          <BotMessageSquare className="text-foreground h-11 w-11" size={44} strokeWidth={1.5} />
          <p className="text-foreground text-center text-sm leading-5 font-normal">
            Setup API Key for LLM
            <br />
            to activate DAIVE Assistant
            <br />
            for your extreme productivity.
          </p>
        </div>

        {/* 목적: Feature showcase 섹션 */}
        <div className="flex w-full flex-col items-center gap-2">
          <div className="flex w-full flex-col items-start gap-2">
            <Item variant="outline" className="w-full">
              <ItemMedia variant="icon" className="bg-muted border-border">
                <ListChecks className="text-foreground h-4 w-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>See Through Complexity</ItemTitle>
                <ItemDescription>AI reads context, shows the fix.</ItemDescription>
              </ItemContent>
            </Item>

            <Item variant="outline" className="w-full">
              <ItemMedia variant="icon" className="bg-muted border-border">
                <MessagesSquare className="text-foreground h-4 w-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Control Without Commands</ItemTitle>
                <ItemDescription>Manage clusters in plain language.</ItemDescription>
              </ItemContent>
            </Item>

            <Item variant="outline" className="w-full">
              <ItemMedia variant="icon" className="bg-muted border-border">
                <Shield className="text-foreground h-4 w-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Secure by Design</ItemTitle>
                <ItemDescription>AI spots risks before they hit.</ItemDescription>
              </ItemContent>
            </Item>
          </div>

          {/* 목적: Setup Now 버튼 - Preferences Dialog의 LLM Models 섹션 열기 */}
          <Button
            variant="link"
            size="default"
            onClick={onSetupClick}
            className="text-foreground hover:text-foreground h-9 gap-2 p-2"
          >
            <span className="text-sm leading-5 font-medium">Setup Now</span>
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
