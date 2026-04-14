/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { type KubeEvent, KubeObject } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
// 🎯 shadcn UI 컴포넌트: DrawerItem/DrawerTitle 대체
import {
  DetailPanelField,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { cssNames } from "@skuberplus/utilities";
import { disposeOnUnmount, observer } from "mobx-react";
import moment from "moment-timezone";
import React, { Component } from "react";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import { DurationAbsoluteTimestamp } from "./duration-absolute";
import styles from "./kube-event-details.module.scss";
import eventStoreInjectable from "./store.injectable";

import type { Logger } from "@skuberplus/logger";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { EventStore } from "./store";

export interface KubeEventDetailsProps {
  object: KubeObject;
}

interface Dependencies {
  subscribeStores: SubscribeStores;
  eventStore: EventStore;
  logger: Logger;
}

function timeToUnix(dateStr?: string): number {
  const m = moment(dateStr);
  return m.isValid() ? m.unix() : 0;
}

export function sortEvents(events: KubeEvent[]): KubeEvent[] | undefined {
  return events?.sort((a, b) => timeToUnix(b.lastTimestamp) - timeToUnix(a.lastTimestamp));
}

class NonInjectedKubeEventDetails extends Component<KubeEventDetailsProps & Dependencies> {
  componentDidMount() {
    disposeOnUnmount(this, [this.props.subscribeStores([this.props.eventStore])]);
  }

  render() {
    const { object, eventStore } = this.props;

    if (!object) {
      return null;
    }

    if (!(object instanceof KubeObject)) {
      this.props.logger.error("[KubeEventDetails]: passed object that is not an instanceof KubeObject", object);

      return null;
    }

    const events = eventStore.getEventsByObject(object);

    // 🎯 shadcn DetailPanelField/DetailPanelSection으로 마이그레이션 완료
    return (
      <div>
        <DetailPanelSection title="Events">
          {events.length > 0 && (
            <div className={styles.KubeEventDetails}>
              {sortEvents(events)?.map((event) => (
                <div className={styles.event} key={event.getId()}>
                  <div className={cssNames(styles.title, { [styles.warning]: event.isWarning() })}>{event.message}</div>
                  <DetailPanelField label="Source">{event.getSource()}</DetailPanelField>
                  <DetailPanelField label="Count">{event.count}</DetailPanelField>
                  <DetailPanelField label="Sub-object">{event.involvedObject.fieldPath}</DetailPanelField>
                  {event.lastTimestamp && (
                    <DetailPanelField label="Last seen">
                      <DurationAbsoluteTimestamp timestamp={event.lastTimestamp} />
                    </DetailPanelField>
                  )}
                </div>
              ))}
            </div>
          )}
          {events.length === 0 && <div className={styles.empty}>No events found</div>}
        </DetailPanelSection>
      </div>
    );
  }
}

export const KubeEventDetails = withInjectables<Dependencies, KubeEventDetailsProps>(
  observer(NonInjectedKubeEventDetails),
  {
    getProps: (di, props) => ({
      ...props,
      subscribeStores: di.inject(subscribeStoresInjectable),
      eventStore: di.inject(eventStoreInjectable),
      logger: di.inject(loggerInjectionToken),
    }),
  },
);
