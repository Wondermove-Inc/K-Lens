/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { applicationInformationToken } from "@skuberplus/application";
import packageJson from "../../package.json";

const applicationInformationInjectable = getInjectable({
  id: "application-information",
  instantiate: () => {
    const {
      version,
      config: {
        bundledHelmVersion,
        bundledKubectlVersion,
        contentSecurityPolicy,
        k8sProxyVersion,
        welcomeRoute,
        observabilityUrl,
      },
      productName,
      displayProductName,
      copyright,
      description,
      name,
      dependencies,
    } = packageJson;

    return {
      version,
      productName,
      displayProductName,
      copyright,
      description,
      name,
      k8sProxyVersion,
      bundledKubectlVersion,
      bundledHelmVersion,
      contentSecurityPolicy,
      welcomeRoute,
      observabilityUrl,
      updatingIsEnabled: false,
      dependencies,
    };
  },
  causesSideEffects: true,
  injectionToken: applicationInformationToken,
});

export default applicationInformationInjectable;
