/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Purpose: SecurityScanStore DI registration + 3 Push channel listeners
 * Renderer MobX store injectable
 *
 * @packageDocumentation
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { messageChannelListenerInjectionToken, requestFromChannelInjectionToken } from "@skuberplus/messaging";
import {
  securityScanCompleteChannel,
  securityScanErrorChannel,
  securityScanProgressChannel,
} from "../common/security-ipc-channels";
import { SecurityScanStore } from "./security-scan-store";

import type { MessageChannelListener } from "@skuberplus/messaging";

import type { ScanCompletePayload, ScanErrorPayload, ScanProgressPayload } from "../common/security-ipc-channels";

// ============================================
// SecurityScanStore injectable (keyedSingleton by clusterId)
// Each cluster gets its own store instance — scanState is fully isolated per cluster.
// ============================================

const securityScanStoreInjectable = getInjectable({
  id: "security-scan-store",
  instantiate: (di, _clusterId: string) => {
    const requestFromChannel = di.inject(requestFromChannelInjectionToken);
    return new SecurityScanStore(requestFromChannel);
  },
  lifecycle: lifecycleEnum.keyedSingleton({
    getInstanceKey: (_di, clusterId: string) => clusterId,
  }),
});

export default securityScanStoreInjectable;

// ============================================
// Push channel listeners — route by payload.clusterId to the correct store instance
// ============================================

const securityScanProgressListenerInjectable = getInjectable({
  id: "security-scan-progress-listener",
  instantiate: (di): MessageChannelListener<typeof securityScanProgressChannel> => ({
    id: "security-scan-progress-listener",
    channel: securityScanProgressChannel,
    handler: (payload: ScanProgressPayload) => {
      if (!payload.clusterId) return;
      di.inject(securityScanStoreInjectable, payload.clusterId).handleProgress(payload);
    },
  }),
  injectionToken: messageChannelListenerInjectionToken,
});

const securityScanCompleteListenerInjectable = getInjectable({
  id: "security-scan-complete-listener",
  instantiate: (di): MessageChannelListener<typeof securityScanCompleteChannel> => ({
    id: "security-scan-complete-listener",
    channel: securityScanCompleteChannel,
    handler: (payload: ScanCompletePayload) => {
      if (!payload.clusterId) return;
      di.inject(securityScanStoreInjectable, payload.clusterId).handleComplete(payload);
    },
  }),
  injectionToken: messageChannelListenerInjectionToken,
});

const securityScanErrorListenerInjectable = getInjectable({
  id: "security-scan-error-listener",
  instantiate: (di): MessageChannelListener<typeof securityScanErrorChannel> => ({
    id: "security-scan-error-listener",
    channel: securityScanErrorChannel,
    handler: (payload: ScanErrorPayload) => {
      if (!payload.clusterId) return;
      di.inject(securityScanStoreInjectable, payload.clusterId).handleError(payload);
    },
  }),
  injectionToken: messageChannelListenerInjectionToken,
});

export {
  securityScanProgressListenerInjectable,
  securityScanCompleteListenerInjectable,
  securityScanErrorListenerInjectable,
};
