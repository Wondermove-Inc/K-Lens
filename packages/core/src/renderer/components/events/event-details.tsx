/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./event-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { KubeEvent } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
// 🎯 shadcn UI 컴포넌트: DrawerItem/DrawerTitle 대체
import {
  DetailPanelField,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { cssNames } from "@skuberplus/utilities";
import kebabCase from "lodash/kebabCase";
import { observer } from "mobx-react";
import React from "react";
import { Link } from "react-router-dom";
import apiManagerInjectable from "../../../common/k8s-api/api-manager/manager.injectable";
import getDetailsUrlInjectable from "../kube-detail-params/get-details-url.injectable";
import { Table, TableCell, TableHead, TableRow } from "../table";
import { DurationAbsoluteTimestamp } from "./duration-absolute";

import type { Logger } from "@skuberplus/logger";

import type { ApiManager } from "../../../common/k8s-api/api-manager";
import type { GetDetailsUrl } from "../kube-detail-params/get-details-url.injectable";
import type { KubeObjectDetailsProps } from "../kube-object-details";

export interface EventDetailsProps extends KubeObjectDetailsProps<KubeEvent> {}

interface Dependencies {
  getDetailsUrl: GetDetailsUrl;
  apiManager: ApiManager;
  logger: Logger;
}

const NonInjectedEventDetails = observer(
  ({ apiManager, getDetailsUrl, object: event, className, logger }: Dependencies & EventDetailsProps) => {
    if (!event) {
      return null;
    }

    if (!(event instanceof KubeEvent)) {
      logger.error("[EventDetails]: passed object that is not an instanceof KubeEvent", event);

      return null;
    }

    const { message, reason, count, type, involvedObject } = event;
    const { kind, name, namespace, fieldPath } = involvedObject;

    // 🎯 shadcn DetailPanelField/DetailPanelSection으로 마이그레이션 완료
    return (
      <div className={cssNames("EventDetails", className)}>
        <DetailPanelField label="Message">{message}</DetailPanelField>
        <DetailPanelField label="Reason">{reason}</DetailPanelField>
        <DetailPanelField label="Source">{event.getSource()}</DetailPanelField>
        <DetailPanelField label="First seen">
          <DurationAbsoluteTimestamp timestamp={event.firstTimestamp} />
        </DetailPanelField>
        <DetailPanelField label="Last seen">
          <DurationAbsoluteTimestamp timestamp={event.lastTimestamp} />
        </DetailPanelField>
        <DetailPanelField label="Count">{count}</DetailPanelField>
        <DetailPanelField label="Type">
          <span className={kebabCase(type)}>{type}</span>
        </DetailPanelField>

        <DetailPanelSection title="Involved object">
          <Table>
            <TableHead flat>
              <TableCell>Name</TableCell>
              <TableCell>Namespace</TableCell>
              <TableCell>Kind</TableCell>
              <TableCell>Field Path</TableCell>
            </TableHead>
            <TableRow>
              <TableCell>
                <Link
                  to={getDetailsUrl(apiManager.lookupApiLink(involvedObject, event))}
                  className="text-primary hover:underline"
                >
                  {name}
                </Link>
              </TableCell>
              <TableCell>{namespace}</TableCell>
              <TableCell>{kind}</TableCell>
              <TableCell>{fieldPath}</TableCell>
            </TableRow>
          </Table>
        </DetailPanelSection>
      </div>
    );
  },
);

export const EventDetails = withInjectables<Dependencies, EventDetailsProps>(NonInjectedEventDetails, {
  getProps: (di, props) => ({
    ...props,
    apiManager: di.inject(apiManagerInjectable),
    getDetailsUrl: di.inject(getDetailsUrlInjectable),
    logger: di.inject(loggerInjectionToken),
  }),
});
