/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Observability URL 등록 페이지
 *
 * 주요 기능:
 * - URL 입력 및 유효성 검사 (http/https만 허용)
 * - Connect 버튼 클릭 시 extensionUrls에 저장
 *
 * 📝 주의사항:
 * - URL 저장 후 부모(observability.tsx)에서 MobX 관찰로 자동 재렌더 → webview 전환
 */

import { Link, Loader2, Plus } from "lucide-react";
import React from "react";
import { Button } from "../shadcn-ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../shadcn-ui/empty";
import { Input } from "../shadcn-ui/input";

import type { UserPreferencesState } from "../../../features/user-preferences/common/state.injectable";

interface ObservabilityConnectProps {
  userPreferencesState: UserPreferencesState;
}

export const ObservabilityConnect = ({ userPreferencesState }: ObservabilityConnectProps) => {
  const [url, setUrl] = React.useState("");
  const [hasError, setHasError] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const isValidUrl = (urlString: string): boolean => {
    try {
      const parsedUrl = new URL(urlString);
      return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
    } catch {
      return false;
    }
  };

  const isButtonDisabled = url.trim().length === 0 || isLoading;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    if (hasError) {
      setHasError(false);
    }
  };

  const handleConnect = () => {
    if (!isValidUrl(url)) {
      setHasError(true);
      return;
    }

    setIsLoading(true);
    userPreferencesState.extensionUrls = [url];
    setIsLoading(false);
    setUrl("");
  };

  return (
    <div className="bg-background flex h-full flex-col items-center justify-center px-5 py-8">
      <div className="flex flex-col items-center gap-7">
        <div className="flex w-[480px] flex-col items-center gap-6">
          <EmptyMedia className="mb-0">
            <Link className="text-foreground h-10 w-10" strokeWidth={1.5} />
          </EmptyMedia>

          <Empty className="w-[480px] gap-6 border-0 p-0 md:p-0">
            <EmptyHeader className="max-w-none gap-4">
              <div className="flex flex-col items-center gap-2">
                <EmptyTitle className="text-foreground text-lg leading-7">Connect Skuber⁺ Observability</EmptyTitle>

                <EmptyDescription className="text-muted-foreground text-center text-sm leading-[162.5%]">
                  Enter the Observability server URL to enable monitoring and diagnostics.
                </EmptyDescription>
              </div>
            </EmptyHeader>

            <EmptyContent className="w-[480px] max-w-none">
              <div className="flex w-full flex-col items-start gap-2">
                <Input
                  placeholder="Enter Observability server URL..."
                  value={url}
                  onChange={handleInputChange}
                  aria-invalid={hasError}
                  style={{ width: "480px", minWidth: "480px" }}
                />
                {hasError && <p className="text-destructive text-left text-sm">Please enter a valid URL</p>}
              </div>
            </EmptyContent>
          </Empty>
        </div>

        <Button disabled={isButtonDisabled} className="h-9 gap-2 px-4 py-2" onClick={handleConnect}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Connect</span>
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              <span>Connect</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
