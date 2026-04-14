/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import openSaveFileDialogInjectable from "../../../utils/save-file.injectable";
import { notificationPanelStore } from "../../status-bar/items/notification-panel.store";
import callForLogsInjectable from "./call-for-logs.injectable";

import type { ResourceDescriptor } from "@skuberplus/kube-api";
import type { PodLogsQuery } from "@skuberplus/kube-object";

const downloadAllLogsInjectable = getInjectable({
  id: "download-all-logs",

  instantiate: (di) => {
    const callForLogs = di.inject(callForLogsInjectable);
    const openSaveFileDialog = di.inject(openSaveFileDialogInjectable);
    const logger = di.inject(loggerInjectionToken);

    return async (params: ResourceDescriptor, query: PodLogsQuery) => {
      const logs = await callForLogs(params, query).catch((error) => {
        logger.error("Can't download logs: ", error);
      });

      if (logs) {
        openSaveFileDialog(`${query.container}.log`, logs, "text/plain");
      } else {
        notificationPanelStore.addError("file", "Download Failed", "No logs to download");
      }
    };
  },
});

export default downloadAllLogsInjectable;
