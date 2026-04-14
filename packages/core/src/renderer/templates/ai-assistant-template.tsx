"use client";

import { X } from "lucide-react";
import React from "react";
import { Button } from "@/components/shadcn-ui/button";
import { Input } from "@/components/shadcn-ui/input";
import { Label } from "@/components/shadcn-ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn-ui/select";

/**
 * 🎯 목적: AI Assistant 템플릿의 Props 타입 정의
 */
interface AIAssistantProps {
  onClose?: () => void;
  onStart?: (provider: string, apiKey: string) => void;
  className?: string;
}

/**
 * 🎯 목적: AI Assistant 설정 패널 템플릿 컴포넌트
 *
 * 특징:
 * - AI Provider 선택 (Select 컴포넌트)
 * - API Key 입력 (Input 컴포넌트)
 * - 시작 버튼과 닫기 기능
 * - 다크 테마 최적화 디자인
 * - shadcn/ui 디자인 토큰 준수
 */
export function AIAssistant({ onClose, onStart, className }: AIAssistantProps) {
  // 🎯 목적: AI Provider 상태 관리
  const [provider, setProvider] = React.useState("openai");

  // 🎯 목적: API Key 상태 관리
  const [apiKey, setApiKey] = React.useState("");

  // 🎯 목적: AI Assistant 시작 핸들러
  const handleStart = React.useCallback(() => {
    if (apiKey.trim()) {
      onStart?.(provider, apiKey);
    }
  }, [provider, apiKey, onStart]);

  return (
    <aside
      className={`border-border bg-sidebar flex h-auto shrink-0 flex-col gap-9 border-l p-4 ${className || ""} `.trim()}
    >
      {/* 🎯 목적: 헤더 섹션 */}
      <div className="relative flex flex-col gap-0.5">
        <div className="flex items-center justify-between">
          <h3 className="text-foreground text-lg leading-7 font-semibold">Skuber+ AI Assistant</h3>

          {/* 🎯 목적: 닫기 버튼 */}
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
        <p className="text-muted-foreground text-sm leading-5">Please set up the API key to use the AI Assistant.</p>
      </div>

      {/* 🎯 목적: 폼 영역 */}
      <div className="flex flex-col gap-6">
        {/* 🎯 목적: AI Provider 선택 필드 */}
        <div className="flex flex-col gap-3">
          <Label className="text-foreground text-sm font-medium">AI Provider</Label>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger className="text-muted-foreground w-full">
              <SelectValue placeholder="Select AI Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI (GPT-4)</SelectItem>
              <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
              <SelectItem value="google">Google (Gemini)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 🎯 목적: API Key 입력 필드 */}
        <div className="flex flex-col gap-3">
          <Label className="text-foreground text-sm font-medium">API Key</Label>
          <Input
            type="password"
            placeholder="Please enter the API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="text-muted-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* 🎯 목적: 시작 버튼 */}
        <div className="flex justify-end">
          <Button onClick={handleStart} disabled={!apiKey.trim()} className="h-9 px-4 font-medium">
            Start AI Assistant
          </Button>
        </div>
      </div>
    </aside>
  );
}
