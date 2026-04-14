/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { ipcRenderer } from "electron";
import Url from "url-parse";
import * as proto from "../../../common/protocol-handler";
import { foldAttemptResults, ProtocolHandlerInvalid, RouteAttempt } from "../../../common/protocol-handler";
import { notificationPanelStore } from "../../components/status-bar/items/notification-panel.store";

import type { LensProtocolRouterDependencies } from "../../../common/protocol-handler";

export class LensProtocolRouterRenderer extends proto.LensProtocolRouter {
  constructor(protected readonly dependencies: LensProtocolRouterDependencies) {
    super(dependencies);
  }

  /**
   * This function is needed to be called early on in the renderers lifetime.
   */
  public init(): void {
    ipcRenderer.on(proto.ProtocolHandlerInternal, (event, rawUrl: string, mainAttemptResult: RouteAttempt) => {
      const rendererAttempt = this._routeToInternal(new Url(rawUrl, true));

      if (foldAttemptResults(mainAttemptResult, rendererAttempt) === RouteAttempt.MISSING) {
        notificationPanelStore.addInfo(
          "system",
          "Unknown Action",
          `Unknown action "${rawUrl}". Are you on the latest version?`,
        );
      }
    });
    ipcRenderer.on(proto.ProtocolHandlerExtension, async (event, rawUrl: string, mainAttemptResult: RouteAttempt) => {
      const rendererAttempt = await this._routeToExtension(new Url(rawUrl, true));

      switch (foldAttemptResults(mainAttemptResult, rendererAttempt)) {
        case RouteAttempt.MISSING:
          notificationPanelStore.addInfo(
            "system",
            "Unknown Action",
            `Unknown action "${rawUrl}". Are you on the latest version of the extension?`,
          );
          break;
        case RouteAttempt.MISSING_EXTENSION:
          notificationPanelStore.addInfo(
            "system",
            "Missing Extension",
            `Missing extension for action "${rawUrl}". Not able to find extension in our known list. Try installing it manually.`,
          );
          break;
      }
    });
    ipcRenderer.on(ProtocolHandlerInvalid, (event, error: string, rawUrl: string) => {
      notificationPanelStore.addError("system", "Protocol Error", `Failed to route "${rawUrl}". Error: ${error}`);
    });
  }
}
