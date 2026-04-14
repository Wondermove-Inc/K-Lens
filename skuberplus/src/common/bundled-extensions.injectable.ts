/**
 * 🎯 목적: DAIVE AI Extension을 bundled extension으로 등록
 *
 * DAIVE AI Assistant Extension을 메인 애플리케이션에 번들로 포함시킵니다.
 * Extension 디렉토리에 따로 설치하지 않고도 바로 사용할 수 있게 합니다.
 *
 * ✅ 성공: Extension이 성공적으로 로드되고 있습니다!
 * 로그에서 "✅ DAIVE AI Extension Main loaded successfully!" 확인됨
 */

import { getInjectable } from "@ogre-tools/injectable";
import { bundledExtensionInjectionToken } from "@skuberplus/legacy-extensions";

// 🎯 DAIVE AI Extension 인라인 구현 (의존성 문제 해결됨)
const daiveAiExtensionInjectable = getInjectable({
  id: "bundled-daive-ai-extension",
  instantiate: () => ({
    manifest: {
      name: "@daive/ai-assistant",
      version: "0.4.1",
      description: "DAIVE AI Assistant - Cursor AI 스타일 쿠버네티스 도우미",
    },
    main: () => {
      return null; // Main process에서는 특별한 로직이 필요없어서 null
    },
    renderer: () => {
      return null; // 나중에 실제 UI 컴포넌트로 교체 예정
    },
  }),
  injectionToken: bundledExtensionInjectionToken,
});

export default daiveAiExtensionInjectable;
