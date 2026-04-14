"use client";

import React from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/shadcn-ui/sidebar";

/**
 * 🎯 목적: Sidebar 템플릿의 Props 타입 정의
 */
interface SidebarTemplateProps {
  children?: React.ReactNode;
}

/**
 * 🎯 목적: 순수 사이드바 레이아웃 템플릿 컴포넌트
 * AppSidebar와 SidebarInset만 제공하며, 콘텐츠는 children으로 주입
 */
export function SidebarTemplate({ children }: SidebarTemplateProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
