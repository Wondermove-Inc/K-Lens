/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 *  목적: Security Page 전용 Agent 스트림 채널 리스너
 *
 * Cluster Frame DI에 별도 리스너를 등록하여 Security Page에서
 * Agent 스트림 이벤트를 수신할 수 있도록 합니다.
 *
 * 기존 agent-stream-listener는 Root Frame 전용 가드로 인해
 * Cluster Frame에서 이벤트가 차단되므로, Security 전용 리스너를 별도 생성합니다.
 *
 */

import { getMessageChannelListenerInjectable } from "@skuberplus/messaging";
import { type AgentStreamEvent, agentStreamChannel } from "../../../features/ai-assistant/common/agent-ipc-channels";
import agentStreamEventBusInjectable from "../../../features/ai-assistant/renderer/agent-stream-event-bus.injectable";

const securityAgentStreamListenerInjectable = getMessageChannelListenerInjectable({
  channel: agentStreamChannel,
  id: "security-agent-stream-listener",
  getHandler: (di) => {
    const eventBus = di.inject(agentStreamEventBusInjectable);
    let lastEmitTime = 0;
    const THROTTLE_MS = 16; // ~60fps

    return (event: AgentStreamEvent) => {
      // message-chunk 이벤트만 throttle, 나머지는 즉시 emit
      if (event.type === "message-chunk") {
        const now = Date.now();
        if (now - lastEmitTime < THROTTLE_MS) return;
        lastEmitTime = now;
      }
      eventBus.emit(event);
    };
  },
});

export default securityAgentStreamListenerInjectable;
