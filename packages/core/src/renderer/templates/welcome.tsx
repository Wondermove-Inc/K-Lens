"use client";

import { ChevronLeft, ChevronRight, CircleHelp, FolderSync, Plus, X } from "lucide-react";
import React from "react";
import { Button } from "@/components/shadcn-ui/button";
import { Card, CardContent, CardHeader } from "@/components/shadcn-ui/card";
import { Separator } from "@/components/shadcn-ui/separator";

/**
 * 🎯 목적: Welcome 컴포넌트의 Props 타입 정의
 */
interface WelcomeProps {
  showTabs?: boolean;
  showHeader?: boolean;
  showCards?: boolean;
  showHelp?: boolean;
  /**
   * 전체 높이를 화면 기준으로 잡을지 여부
   * - true: h-screen (스토리북 템플릿용)
   * - false: h-full min-h-0 (컨테이너 높이에 맞춰서 렌더)
   */
  fullHeight?: boolean;
}

/**
 * 🎯 목적: Kubernetes IDE 환경의 웰컴 페이지 컴포넌트
 *
 * 주요 기능:
 * - 탭 네비게이션 시스템 (좌우 화살표, 활성/비활성 탭)
 * - 브랜드 헤더 (로고, 제목, 설명)
 * - 액션 카드 (kubeconfig 관련 작업)
 * - 도움말 정보 섹션
 *
 * 디자인 토큰:
 * - 표준 spacing, typography, color 토큰 사용
 * - 하드코딩된 크기나 색상 없이 shadcn/ui 시스템 활용
 */
export function Welcome({
  showTabs = true,
  showHeader = true,
  showCards = true,
  showHelp = true,
  fullHeight = true,
}: WelcomeProps) {
  return (
    <div className={`flex ${fullHeight ? "h-screen" : "h-full min-h-0"} w-full flex-col`}>
      {/* 🎯 목적: 탭 네비게이션 영역 */}
      {showTabs && (
        <div className="border-border bg-card flex items-center border-b">
          {/* 좌측 분리선 */}
          <div className="flex items-center px-2">
            <Separator orientation="vertical" className="h-5" />
          </div>

          {/* 네비게이션 버튼 그룹 */}
          <div className="border-border flex items-center border-b">
            <Button variant="ghost" size="sm" className="rounded-none border-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="rounded-none border-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* 활성 탭 */}
          <div className="border-primary bg-background border-b-2">
            <Button variant="ghost" size="sm" className="gap-2">
              <span className="text-sm font-medium">Welcome</span>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* 우측 분리선 */}
          <div className="flex items-center px-2">
            <Separator orientation="vertical" className="h-5" />
          </div>

          {/* 비활성 탭들 */}
          <div className="border-border flex flex-1 border-b">
            <Button variant="ghost" size="sm" className="text-muted-foreground rounded-none opacity-50">
              File Explorer
            </Button>
            <div className="flex items-center px-2">
              <Separator orientation="vertical" className="h-5" />
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground rounded-none opacity-50">
              Terminal
            </Button>
          </div>
        </div>
      )}

      {/* 🎯 목적: 메인 콘텐츠 영역 */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-12 p-8">
        {/* 브랜드 헤더 */}
        {showHeader && (
          <div className="flex flex-col items-center gap-4">
            {/* 로고 영역 */}
            <div className="flex h-12 w-12 items-center justify-center">
              <svg
                width="52"
                height="52"
                viewBox="0 0 52 52"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12"
              >
                <path
                  d="M26 52C40.3594 52 52 40.3594 52 26C52 11.6406 40.3594 0 26 0C11.6406 0 0 11.6406 0 26C0 40.3594 11.6406 52 26 52Z"
                  fill="#125AED"
                />
                <path
                  d="M26 52C40.3594 52 52 40.3594 52 26C52 11.6406 40.3594 0 26 0C11.6406 0 0 11.6406 0 26C0 40.3594 11.6406 52 26 52Z"
                  fill="white"
                  fillOpacity="0.05"
                />
                <path
                  d="M25.9891 4.95679C14.3607 4.95679 4.94272 14.3835 4.94272 26.0032C4.94272 37.6228 14.3695 47.0495 25.9891 47.0495C37.6087 47.0495 47.0355 37.6228 47.0355 26.0032C47.0355 14.3835 37.6174 4.95679 25.9891 4.95679ZM35.6255 23.3735L28.6188 16.3667L31.1524 13.8331C33.0832 11.9024 36.2196 11.9024 38.1591 13.8331C40.0899 15.7639 40.0899 18.9003 38.1591 20.8398L35.6255 23.3735ZM38.1591 31.1577C40.0899 33.0885 40.0899 36.2249 38.1591 38.1644C36.2283 40.0952 33.0919 40.0952 31.1524 38.1644L28.6188 35.6308L35.6255 28.6241L38.1591 31.1577ZM25.9891 33.0011L22.4945 29.5065H25.9891L18.9998 26.0119L18.9824 25.9944L25.9891 18.9877L29.4924 22.4911H25.9891L32.9871 25.9944L25.9804 33.0011H25.9891ZM13.8191 38.1732C11.8883 36.2424 11.8883 33.106 13.8191 31.1665L16.3614 28.6241L23.3681 35.6308L20.8258 38.1732C18.895 40.104 15.7586 40.104 13.8191 38.1732ZM13.8191 20.8311C11.8883 18.9003 11.8883 15.7639 13.8191 13.8244C15.7498 11.8936 18.8863 11.8936 20.8258 13.8244L23.3681 16.3667L16.3614 23.3735L13.8191 20.8311ZM31.1087 9.43864C30.1739 9.858 29.3002 10.4433 28.5314 11.2122L25.9978 13.7458L23.4642 11.2122C22.6954 10.4433 21.8217 9.858 20.8869 9.43864C22.5032 8.94066 24.2156 8.66982 25.9978 8.66982C27.7801 8.66982 29.4924 8.94066 31.1174 9.43864H31.1087ZM9.43331 20.8748C9.85266 21.8096 10.438 22.692 11.2068 23.4608L13.7404 25.9944L11.2068 28.528C10.438 29.2968 9.85266 30.1792 9.43331 31.1228C8.93533 29.5065 8.66449 27.7854 8.66449 26.0032C8.66449 24.2209 8.93533 22.4998 9.43331 20.8748ZM20.8782 42.5677C21.813 42.1483 22.6954 41.563 23.473 40.7941L26.0066 38.2605L28.5402 40.7941C29.309 41.563 30.1914 42.1483 31.1262 42.5677C29.5099 43.0657 27.7888 43.3365 25.9978 43.3365C24.2068 43.3365 22.4945 43.0657 20.8782 42.5677ZM42.5711 31.114C42.1517 30.1792 41.5664 29.3056 40.7976 28.5368L38.264 26.0032L40.7976 23.4696C41.5664 22.7007 42.1517 21.8271 42.5711 20.8923C43.0691 22.5085 43.3399 24.2296 43.3399 26.0119C43.3399 27.7941 43.0691 29.5065 42.5711 31.1228V31.114Z"
                  fill="white"
                />
              </svg>
            </div>

            {/* 제목 및 설명 */}
            <div className="flex flex-col items-center gap-3">
              <h1 className="text-foreground text-4xl leading-none font-medium">Skuber⁺ Client</h1>
              <p className="text-muted-foreground text-base leading-none">
                Kubernetes IDE · Simplified Cluster Management
              </p>
            </div>
          </div>
        )}

        {/* 액션 카드 그룹 */}
        {showCards && (
          <div className="flex items-center gap-4">
            {/* Add from kubeconfig 카드 */}
            <Card className="w-[420px]">
              <CardHeader>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-base leading-none font-semibold">Add from kubeconfig</h3>
                  <p className="text-muted-foreground text-sm leading-5">
                    Add clusters directly from your kubeconfig file
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add from kubeconfig
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Sync kubeconfig 카드 */}
            <Card className="w-[420px]">
              <CardHeader>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-base leading-none font-semibold">Sync kubeconfig</h3>
                  <p className="text-muted-foreground text-sm leading-5">
                    Automatically sync and manage your kubeconfig files
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  <Button className="gap-2">
                    <FolderSync className="h-4 w-4" />
                    Sync kubeconfig
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 도움말 섹션 */}
        {showHelp && (
          <div className="border-border flex w-[860px] items-start gap-4 rounded-lg border p-4">
            {/* 아이콘 영역 */}
            <div className="bg-muted border-border flex h-8 w-8 shrink-0 items-center justify-center rounded-md border">
              <CircleHelp className="h-4 w-4" />
            </div>

            {/* 콘텐츠 영역 */}
            <div className="flex flex-1 flex-col gap-1">
              <h4 className="text-sm font-medium">Need Help?</h4>
              <p className="text-muted-foreground text-sm leading-5">New login detected from unknown device.</p>
            </div>

            {/* 액션 영역 */}
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm">
                Get help
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
