import { getInjectionToken } from "@ogre-tools/injectable";

import type { ReactElement } from "react";

/**
 * 🎯 목적: React 18 Root 생명주기 관리를 위한 인터페이스 정의
 *
 * React 18의 createRoot API를 사용하여 렌더링과 언마운트를 관리합니다.
 */
export interface ReactRootLifecycle {
  render: (element: ReactElement) => void;
  unmount: () => void;
}

export const reactRootLifecycleInjectionToken = getInjectionToken<ReactRootLifecycle>({
  id: "react-root-lifecycle",
});
