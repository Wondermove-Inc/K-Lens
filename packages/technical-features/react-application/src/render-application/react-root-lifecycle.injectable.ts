import { getInjectable } from "@ogre-tools/injectable";
import { createRoot, type Root } from "react-dom/client";
import { type ReactRootLifecycle, reactRootLifecycleInjectionToken } from "./react-root-lifecycle-injection-token";

import type { ReactElement } from "react";

/**
 * 🎯 목적: React 18의 createRoot API를 사용한 Root 생명주기 관리
 *
 * React 18에서는 ReactDOM.render() 대신 createRoot()를 사용합니다.
 * 이 injectable은 root 인스턴스를 관리하고 render/unmount 메서드를 제공합니다.
 *
 * 📝 주요 기능:
 * - createRoot()를 사용한 React 18 렌더링
 * - root 인스턴스 재사용 및 관리
 * - 컨테이너 변경 시 자동 unmount/remount
 *
 * 🔄 변경이력: 2025-10-11 - React 18 createRoot API 적용
 */
const reactRootLifecycleInjectable = getInjectable({
  id: "react-root-lifecycle",

  instantiate: (): ReactRootLifecycle => {
    let root: Root | undefined;
    let rootContainer: HTMLElement | null = null;

    // 🎯 컨테이너 확인 및 root 인스턴스 생성/재사용
    const ensureContainer = () => {
      const container = document.getElementById("app");

      if (!container) {
        throw new Error('Could not find React root container with id "app".');
      }

      // ⚠️ 컨테이너가 변경된 경우 기존 root unmount
      if (root && rootContainer && container !== rootContainer) {
        root.unmount();
        root = undefined;
        rootContainer = null;
      }

      // 🔄 root가 없으면 새로 생성
      if (!root) {
        root = createRoot(container);
        rootContainer = container;
      }

      return root;
    };

    return {
      render: (element: ReactElement) => {
        ensureContainer().render(element);
      },

      unmount: () => {
        if (root) {
          root.unmount();
          root = undefined;
          rootContainer = null;
        }
      },
    };
  },

  causesSideEffects: false,

  injectionToken: reactRootLifecycleInjectionToken,
});

export default reactRootLifecycleInjectable;
