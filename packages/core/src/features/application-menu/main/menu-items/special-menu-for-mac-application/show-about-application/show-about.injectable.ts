/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import applicationCopyrightInjectable from "../../../../../../common/vars/application-copyright.injectable";
import displayAppNameInjectable from "../../../../../../common/vars/display-app-name.injectable";
import displayProductNameInjectable from "../../../../../../common/vars/display-product-name.injectable";
import isWindowsInjectable from "../../../../../../common/vars/is-windows.injectable";
import showMessagePopupInjectable from "../../../../../../main/electron-app/features/show-message-popup.injectable";
import { buildVersionInitializable } from "../../../../../vars/build-version/common/token";

const showAboutInjectable = getInjectable({
  id: "show-about",

  instantiate: (di) => {
    const buildVersion = di.inject(buildVersionInitializable.stateToken);
    const showMessagePopup = di.inject(showMessagePopupInjectable);
    const isWindows = di.inject(isWindowsInjectable);
    const displayAppName = di.inject(displayAppNameInjectable);
    const displayProductName = di.inject(displayProductNameInjectable);
    const applicationCopyright = di.inject(applicationCopyrightInjectable);

    return async () => {
      // 🎯 버전 정보와 회사 정보만 표시 (2025-12-18 간소화)
      const appInfo = [`${displayAppName}: ${buildVersion}`, applicationCopyright];

      // 🎯 TODO: 버전 체크 엔드포인트 설정 후 활성화
      // const latestVersion = await getLatestVersion("@skuberplus/core");
      // if (latestVersion && semver.gt(latestVersion, buildVersion)) {
      //   appInfo.push("", `Latest version: ${latestVersion}`);
      // }

      await showMessagePopup(
        `${isWindows ? " ".repeat(2) : ""}${displayAppName}`,
        displayProductName,
        appInfo.join("\r\n"),
        {
          type: "info",
          buttons: ["Close"],
        },
      );
    };
  },
});

export default showAboutInjectable;
