import { getInjectable, getInjectionToken } from "@ogre-tools/injectable";
import { reactRootLifecycleInjectionToken } from "./react-root-lifecycle-injection-token";

import type React from "react";

export type Render = (application: React.ReactElement) => void;

export const renderInjectionToken = getInjectionToken<Render>({
  id: "render-injection-token",
});

/**
 * 🎯 목적: React 18 createRoot API를 사용한 렌더링 injectable
 *
 * React 18의 reactRootLifecycleInjectionToken을 주입받아
 * 애플리케이션을 렌더링합니다.
 *
 * 🔄 변경이력: 2025-10-11 - React 18 createRoot API로 마이그레이션
 */
const renderInjectable = getInjectable({
  id: "render",

  /* c8 ignore next */
  instantiate: (di) => {
    // 🎯 React 18 Root 생명주기 관리자 주입
    const { render } = di.inject(reactRootLifecycleInjectionToken);

    return (application) => render(application);
  },

  causesSideEffects: true,

  injectionToken: renderInjectionToken,
});

export default renderInjectable;
