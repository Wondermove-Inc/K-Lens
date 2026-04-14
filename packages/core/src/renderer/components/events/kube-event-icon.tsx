/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./kube-event-icon.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Icon } from "@skuberplus/icon";
import { cssNames } from "@skuberplus/utilities";
import React, { Component } from "react";
import { KubeObjectAge } from "../kube-object/age";
import eventStoreInjectable from "./store.injectable";

import type { KubeEvent, KubeObject } from "@skuberplus/kube-object";

import type { EventStore } from "./store";

export interface KubeEventIconProps {
  object: KubeObject;
  showWarningsOnly?: boolean;
  filterEvents?: (events: KubeEvent[]) => KubeEvent[];
}

interface Dependencies {
  eventStore: EventStore;
}

class NonInjectedKubeEventIcon extends Component<KubeEventIconProps & Dependencies> {
  get showWarningsOnly() {
    return this.props.showWarningsOnly ?? true;
  }

  render() {
    const { object, filterEvents, eventStore } = this.props;
    const events = eventStore.getEventsByObject(object);
    let warnings = events.filter((evt) => evt.isWarning());

    if (filterEvents) warnings = filterEvents(warnings);

    if (!events.length || (this.showWarningsOnly && !warnings.length)) {
      return null;
    }
    const event = [...warnings, ...events][0]; // get latest event

    return (
      <Icon
        material="warning"
        className={cssNames("KubeEventIcon", { warning: event.isWarning() })}
        tooltip={{
          children: (
            <div className="KubeEventTooltip">
              <div className="msg">{event.message}</div>
              <div className="age">
                <Icon material="access_time" />
                <KubeObjectAge object={event} />
              </div>
            </div>
          ),
        }}
      />
    );
  }
}

export const KubeEventIcon = withInjectables<Dependencies, KubeEventIconProps>(NonInjectedKubeEventIcon, {
  getProps: (di, props) => ({
    ...props,
    eventStore: di.inject(eventStoreInjectable),
  }),
});
