"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { LoadingOverlay } from "./loading-overlay";

interface LoadingContextType {
  /** 🎯 목적: 현재 로딩 상태 */
  isLoading: boolean;
  /** 🎯 목적: 로딩 메시지 */
  message?: string;
  /** 🎯 목적: 로딩 상태 시작 */
  showLoading: (message?: string) => void;
  /** 🎯 목적: 로딩 상태 종료 */
  hideLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

interface LoadingProviderProps {
  children: React.ReactNode;
}

/**
 * 🎯 목적: 글로벌 로딩 상태를 관리하는 Context Provider
 *
 * ✨ 특징:
 * - React Context API 기반 상태 관리
 * - LoadingOverlay 자동 렌더링
 * - 간단한 showLoading/hideLoading API
 * - 선택적 메시지 지원
 */
export function LoadingProvider({ children }: LoadingProviderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | undefined>();

  // 🎯 목적: 로딩 상태 시작
  const showLoading = useCallback((loadingMessage?: string) => {
    setMessage(loadingMessage);
    setIsLoading(true);
  }, []);

  // 🎯 목적: 로딩 상태 종료
  const hideLoading = useCallback(() => {
    setIsLoading(false);
    setMessage(undefined);
  }, []);

  const value: LoadingContextType = {
    isLoading,
    message,
    showLoading,
    hideLoading,
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
      {/* 🎯 목적: 로딩 오버레이 자동 렌더링 */}
      <LoadingOverlay isVisible={isLoading} message={message} />
    </LoadingContext.Provider>
  );
}

/**
 * 🎯 목적: LoadingContext를 사용하는 커스텀 훅
 *
 * @throws Context Provider 밖에서 사용 시 에러 발생
 */
export function useLoading(): LoadingContextType {
  const context = useContext(LoadingContext);

  if (context === undefined) {
    throw new Error("useLoading must be used within a LoadingProvider");
  }

  return context;
}
