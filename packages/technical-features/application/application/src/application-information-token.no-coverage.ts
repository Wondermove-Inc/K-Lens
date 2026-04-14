/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectionToken } from "@ogre-tools/injectable";

export type ApplicationInformation = {
  name: string;
  version: string;
  productName: string;
  displayProductName?: string;
  copyright: string;
  description: string;
  k8sProxyVersion: string;
  bundledKubectlVersion: string;
  bundledHelmVersion: string;
  contentSecurityPolicy: string;
  welcomeRoute: string;
  observabilityUrl: string;
  updatingIsEnabled: boolean;
  dependencies: Partial<Record<string, string>>;
};

export const applicationInformationToken = getInjectionToken<ApplicationInformation>({
  id: "application-information-token",
});
