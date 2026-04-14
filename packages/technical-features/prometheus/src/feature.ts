import { autoRegister } from "@ogre-tools/injectable-extension-for-auto-registration";
import { applicationFeature } from "@skuberplus/application";
import { getFeature } from "@skuberplus/feature-core";

export const prometheusFeature = getFeature({
  id: "prometheus",

  register: (di) => {
    // 🎯 Prometheus Provider들 자동 등록 (showInUI: false로 UI에 숨김)
    autoRegister({
      di,
      targetModule: module,
      getRequireContexts: () => [require.context("./", true, /\.injectable\.(ts|tsx)$/)],
    });
  },

  dependencies: [applicationFeature],
});
