import { DiContextProvider } from "@ogre-tools/injectable-react";
import { render as testingLibraryRender } from "@testing-library/react";
import React from "react";

import type { DiContainer } from "@ogre-tools/injectable";
import type { RenderResult } from "@testing-library/react";

/**
 * 🎯 목적: DI 컨테이너를 주입한 React 컴포넌트 렌더링 함수 타입
 * 📝 변경: React.ReactElement → React.ReactNode (@testing-library/react v16 호환)
 */
export type DiRender = (ui: React.ReactNode) => RenderResult;

type DiRenderFor = (di: DiContainer) => DiRender;

/**
 * 🎯 목적: DI 컨테이너를 주입하여 테스트용 렌더 함수 생성
 * 📝 변경: React.ReactElement → React.ReactNode (@testing-library/react v16 호환)
 */
export const renderFor: DiRenderFor = (di) => (ui: React.ReactNode) => {
  const result = testingLibraryRender(<DiContextProvider value={{ di }}>{ui}</DiContextProvider>);

  return {
    ...result,

    /**
     * 🎯 목적: 컴포넌트 재렌더링 함수
     * 📝 변경: React.ReactElement → React.ReactNode (@testing-library/react v16 호환)
     */
    rerender: (nextUi: React.ReactNode) =>
      result.rerender(<DiContextProvider value={{ di }}>{nextUi}</DiContextProvider>),
  };
};
