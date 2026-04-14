/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./endpoint-slice-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { EndpointSlice } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
// 🎯 shadcn UI 컴포넌트: DrawerTitle/Badge 대체
import { DetailPanelSection } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { observer } from "mobx-react";
import React, { Component } from "react";
import { Link } from "react-router-dom";
import { ApiManager } from "../../../common/k8s-api/api-manager";
import apiManagerInjectable from "../../../common/k8s-api/api-manager/manager.injectable";
import getDetailsUrlInjectable from "../kube-detail-params/get-details-url.injectable";
import { Table, TableCell, TableHead, TableRow } from "../table";
import { WithTooltip } from "../with-tooltip";

import type { Logger } from "@skuberplus/logger";

import type { GetDetailsUrl } from "../kube-detail-params/get-details-url.injectable";
import type { KubeObjectDetailsProps } from "../kube-object-details";

export interface EndpointSliceDetailsProps extends KubeObjectDetailsProps<EndpointSlice> {}

interface Dependencies {
  logger: Logger;
  apiManager: ApiManager;
  getDetailsUrl: GetDetailsUrl;
}

class NonInjectedEndpointSliceDetails extends Component<EndpointSliceDetailsProps & Dependencies> {
  render() {
    const { object: endpointSlice, getDetailsUrl, apiManager } = this.props;

    if (!endpointSlice) {
      return null;
    }

    if (!(endpointSlice instanceof EndpointSlice)) {
      this.props.logger.error(
        "[EndpointSliceDetails]: passed object that is not an instanceof EndpointSlice",
        endpointSlice,
      );

      return null;
    }

    // 🎯 shadcn DetailPanelSection/Badge으로 마이그레이션 완료
    return (
      endpointSlice.endpoints &&
      endpointSlice.ports && (
        <div className="EndpointSliceDetails">
          <DetailPanelSection title="Endpoints">
            {endpointSlice.endpoints && endpointSlice.endpoints.length > 0 && (
              <>
                <div className="title flex gaps">Addresses</div>
                <Table items={endpointSlice.endpoints} selectable={false} scrollable={false} className="box grow">
                  <TableHead>
                    <TableCell className="ip">IP</TableCell>
                    <TableCell className="host">Hostname</TableCell>
                    <TableCell className="node">Node</TableCell>
                    <TableCell className="zone">Zone</TableCell>
                    <TableCell className="target">Target</TableCell>
                    <TableCell className="conditions">Conditions</TableCell>
                  </TableHead>
                  {endpointSlice.endpoints.map((endpoint) =>
                    endpoint.addresses.map((address) => (
                      <TableRow key={address} nowrap>
                        <TableCell className="ip">
                          <WithTooltip>{address}</WithTooltip>
                        </TableCell>
                        <TableCell className="name">
                          <WithTooltip>{endpoint.hostname}</WithTooltip>
                        </TableCell>
                        <TableCell className="node">
                          {endpoint.nodeName && (
                            <Link
                              to={getDetailsUrl(apiManager.lookupApiLink({ kind: "Node", name: endpoint.nodeName }))}
                            >
                              <WithTooltip>{endpoint.nodeName}</WithTooltip>
                            </Link>
                          )}
                        </TableCell>
                        <TableCell className="zone">
                          <WithTooltip>{endpoint.zone}</WithTooltip>
                        </TableCell>
                        <TableCell className="target">
                          {endpoint.targetRef && (
                            <Link to={getDetailsUrl(apiManager.lookupApiLink(endpoint.targetRef, endpointSlice))}>
                              <WithTooltip>{endpoint.targetRef.name}</WithTooltip>
                            </Link>
                          )}
                        </TableCell>
                        <TableCell className="conditions">
                          {endpoint.conditions?.ready && (
                            <Badge key="ready" variant="outline" className="ready text-xs">
                              Ready
                            </Badge>
                          )}
                          {endpoint.conditions?.serving && (
                            <Badge key="serving" variant="outline" className="serving text-xs">
                              Serving
                            </Badge>
                          )}
                          {endpoint.conditions?.terminating && (
                            <Badge key="terminating" variant="outline" className="terminating text-xs">
                              Terminating
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )),
                  )}
                </Table>
              </>
            )}
          </DetailPanelSection>

          {endpointSlice.ports && endpointSlice.ports.length > 0 && (
            <DetailPanelSection title="Ports">
              <Table selectable={false} virtual={false} scrollable={false} className="box grow">
                <TableHead>
                  <TableCell className="port">Port</TableCell>
                  <TableCell className="name">Name</TableCell>
                  <TableCell className="protocol">Protocol</TableCell>
                </TableHead>
                {endpointSlice.ports?.map((port) => (
                  <TableRow key={port.port} nowrap>
                    <TableCell className="name">{port.port}</TableCell>
                    <TableCell className="name">{port.name}</TableCell>
                    <TableCell className="node">{port.protocol}</TableCell>
                  </TableRow>
                ))}
              </Table>
            </DetailPanelSection>
          )}
        </div>
      )
    );
  }
}

export const EndpointSliceDetails = withInjectables<Dependencies, EndpointSliceDetailsProps>(
  observer(NonInjectedEndpointSliceDetails),
  {
    getProps: (di, props) => ({
      ...props,
      logger: di.inject(loggerInjectionToken),
      apiManager: di.inject(apiManagerInjectable),
      getDetailsUrl: di.inject(getDetailsUrlInjectable),
    }),
  },
);
