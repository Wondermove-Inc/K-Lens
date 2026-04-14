import { getInjectable } from "@ogre-tools/injectable";
import { nodeEnvInjectionToken } from "@skuberplus/core/main";
import { app } from "electron";
/**
 * 🎯 목적: 현재 실행 환경이 프로덕션인지 개발 모드인지 감지
 *
 * Electron의 app.isPackaged를 사용하여 패키징 여부를 정확히 감지합니다.
 * - 패키징된 앱: "production"
 * - 개발 모드: process.env.NODE_ENV 또는 "development"
 *
 * @returns "production" 또는 "development"
 *
 * 📝 주의사항:
 * - process.env.NODE_ENV만으로는 패키징 여부를 정확히 감지할 수 없음
 * - app.isPackaged는 Electron이 제공하는 신뢰할 수 있는 패키징 여부 체크
 *
 * 🔄 변경이력: 2025-01-14 - app.isPackaged 기반 환경 감지로 변경
 */
export const nodeEnvInjectable = getInjectable({
  id: "node-env",
  instantiate: () => {
    // 🎯 패키징된 앱인 경우 무조건 프로덕션으로 간주
    if (app.isPackaged) {
      console.log("[NODE-ENV] 패키징된 앱 감지: production 모드");
      return "production";
    }
    // 🔧 개발 모드: 환경 변수 또는 기본값
    const nodeEnv = process.env.NODE_ENV || "development";
    console.log(`[NODE-ENV] 개발 모드 감지: ${nodeEnv}`);
    return nodeEnv;
  },
  injectionToken: nodeEnvInjectionToken,
});
//# sourceMappingURL=node-env.injectable.js.map
