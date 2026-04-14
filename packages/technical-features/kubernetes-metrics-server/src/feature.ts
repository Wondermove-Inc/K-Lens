import { autoRegister } from "@ogre-tools/injectable-extension-for-auto-registration";
import { applicationFeature } from "@skuberplus/application";
import { getFeature } from "@skuberplus/feature-core";

export const kubernetesMetricsServerFeature = getFeature({
  id: "kubernetes-metrics-server",

  register: (di) => {
    autoRegister({
      di,
      targetModule: module,
      getRequireContexts: () => [require.context("./", true, /\.injectable\.(ts|tsx)$/)],
    });
  },

  dependencies: [applicationFeature],
});
