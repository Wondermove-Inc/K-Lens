/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./service-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Icon } from "@skuberplus/icon";
import { type PortStatus, Service } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
// 🎯 shadcn UI 컴포넌트: DrawerItem/DrawerTitle/Badge 대체
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import {
  DetailPanelField,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { formatDuration } from "@skuberplus/utilities/dist";
import { disposeOnUnmount, observer } from "mobx-react";
import React, { Component } from "react";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import portForwardStoreInjectable from "../../port-forward/port-forward-store/port-forward-store.injectable";
import { BadgeBoolean } from "../badge";
import endpointSliceStoreInjectable from "../network-endpoint-slices/store.injectable";
import { Table, TableCell, TableHead, TableRow } from "../table";
import { WithTooltip } from "../with-tooltip";
import { ServiceDetailsEndpointSlices } from "./service-details-endpoint-slices";
import { ServicePortComponent } from "./service-port-component";

import type { Logger } from "@skuberplus/logger";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { PortForwardStore } from "../../port-forward";
import type { KubeObjectDetailsProps } from "../kube-object-details";
import type { EndpointSliceStore } from "../network-endpoint-slices/store";

export interface ServiceDetailsProps extends KubeObjectDetailsProps<Service> {}

interface Dependencies {
  subscribeStores: SubscribeStores;
  portForwardStore: PortForwardStore;
  endpointSliceStore: EndpointSliceStore;
  logger: Logger;
}

function getExternalProtocol(service: Service): string | undefined {
  if (service.getPorts().find((s) => s.port === 443)) {
    return "https";
  }
  if (service.getPorts().find((s) => s.port === 80)) {
    return "http";
  }
  return;
}

class NonInjectedServiceDetails extends Component<ServiceDetailsProps & Dependencies> {
  componentDidMount() {
    const { subscribeStores, endpointSliceStore, portForwardStore } = this.props;

    disposeOnUnmount(this, [subscribeStores([endpointSliceStore], {}), portForwardStore.watch()]);
  }

  render() {
    const { object: service, endpointSliceStore } = this.props;

    if (!service) {
      return null;
    }

    if (!(service instanceof Service)) {
      this.props.logger.error("[ServiceDetails]: passed object that is not an instanceof Service", service);

      return null;
    }

    const { spec } = service;
    const endpointSlices = endpointSliceStore.getByOwnerReference(
      service.apiVersion,
      service.kind,
      service.getName(),
      service.getNs(),
    );
    const externalIps = service.getExternalIps();
    const selector = service.getSelector();
    const externalProtocol = getExternalProtocol(service);
    const ports = service.getPorts();
    const loadBalancerStatus = service.getLoadBalancer();

    if (externalIps.length === 0 && spec?.externalName) {
      externalIps.push(spec.externalName);
    }

    // 🎯 shadcn DetailPanelField/DetailPanelSection으로 마이그레이션 완료
    return (
      <div className="ServicesDetails">
        {selector && (
          <DetailPanelField label="Selector">
            <div className="flex flex-wrap gap-1">
              {selector.map((selector) => (
                <Badge key={selector} variant="outline" className="text-xs">
                  {selector}
                </Badge>
              ))}
            </div>
          </DetailPanelField>
        )}

        <DetailPanelField label="Type">{spec.type}</DetailPanelField>
        <DetailPanelField label="Session Affinity">{spec.sessionAffinity}</DetailPanelField>
        {spec.internalTrafficPolicy && (
          <DetailPanelField label="Internal Traffic Policy">{spec.internalTrafficPolicy}</DetailPanelField>
        )}
        {spec.trafficDistribution && (
          <DetailPanelField label="Traffic Distribution">{spec.trafficDistribution}</DetailPanelField>
        )}
        {spec.topologyKeys && (
          <DetailPanelField label="Topology Keys">
            <div className="flex flex-wrap gap-1">
              {spec.topologyKeys.map((key) => (
                <Badge key={key} variant="outline" className="text-xs">
                  {key}
                </Badge>
              ))}
            </div>
          </DetailPanelField>
        )}
        {spec.publishNotReadyAddresses !== undefined && (
          <DetailPanelField label="Publish Not Ready Address">
            <BadgeBoolean value={spec.publishNotReadyAddresses} />
          </DetailPanelField>
        )}

        {spec.sessionAffinityConfig && (
          <DetailPanelSection title="Session Affinity Config">
            {spec.sessionAffinityConfig.clientIP && (
              <DetailPanelField label="Client IP Timeout">
                {formatDuration((spec.sessionAffinityConfig.clientIP?.timeoutSeconds ?? 0) * 1000, false)}
              </DetailPanelField>
            )}
          </DetailPanelSection>
        )}

        {spec.type === "LoadBalancer" && (
          <DetailPanelSection title="Load Balancer">
            {spec.allocateLoadBalancerNodePorts !== undefined && (
              <DetailPanelField label="Allocate Load Balancer Node Ports">
                <BadgeBoolean value={spec.allocateLoadBalancerNodePorts} />
              </DetailPanelField>
            )}
            {spec.loadBalancerIP && <DetailPanelField label="Load Balancer IP">{spec.loadBalancerIP}</DetailPanelField>}
            {spec.loadBalancerClass && (
              <DetailPanelField label="Load Balancer Class">{spec.loadBalancerClass}</DetailPanelField>
            )}
            {spec.externalTrafficPolicy && (
              <DetailPanelField label="External Traffic Policy">{spec.externalTrafficPolicy}</DetailPanelField>
            )}
            {spec.healthCheckNodePort && (
              <DetailPanelField label="Health Check Node Port">{spec.healthCheckNodePort}</DetailPanelField>
            )}

            {loadBalancerStatus &&
              loadBalancerStatus.ingress?.map((lb, lbIndex) => (
                <div key={lbIndex}>
                  <div className="title flex gaps">
                    <Icon small material="list" />
                  </div>
                  {lb.hostname && <DetailPanelField label="Hostname">{lb.hostname}</DetailPanelField>}
                  {lb.ip && <DetailPanelField label="IP">{lb.ip}</DetailPanelField>}
                  {lb.ipMode && <DetailPanelField label="IP Mode">{lb.ipMode}</DetailPanelField>}
                  {lb.ports && (
                    <DetailPanelField label="Ports">
                      <Table
                        selectable
                        tableId="loadBalancerStatusPorts"
                        scrollable={false}
                        sortable={{
                          port: (portStatus: PortStatus) => portStatus.port,
                          protocol: (portStatus: PortStatus) => portStatus.protocol,
                        }}
                        sortByDefault={{ sortBy: "port", orderBy: "asc" }}
                        sortSyncWithUrl={false}
                        className="box grow LoadBalancerStatusPorts"
                      >
                        <TableHead flat sticky={false}>
                          <TableCell className="port" sortBy="port">
                            Port
                          </TableCell>
                          <TableCell className="protocol" sortBy="protocol">
                            Protocol
                          </TableCell>
                          <TableCell className="errorStatus">Error</TableCell>
                        </TableHead>
                        {lb.ports?.map((portStatus) => (
                          <TableRow key={`${portStatus.port}-${portStatus.protocol}`} sortItem={portStatus} nowrap>
                            <TableCell className="port">{portStatus.port}</TableCell>
                            <TableCell className="protocol">{portStatus.protocol ?? "TCP"}</TableCell>
                            <TableCell className="errorStatus">
                              <WithTooltip>{portStatus.error}</WithTooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </Table>
                    </DetailPanelField>
                  )}
                </div>
              ))}
          </DetailPanelSection>
        )}

        <DetailPanelSection title="Connection">
          {spec.clusterIP && <DetailPanelField label="Cluster IP">{spec.clusterIP}</DetailPanelField>}

          {service.getClusterIps().length > 0 && (
            <DetailPanelField label="Cluster IPs">
              <div className="flex flex-wrap gap-1">
                {service.getClusterIps().map((label) => (
                  <Badge key={label} variant="outline" className="text-xs">
                    {label}
                  </Badge>
                ))}
              </div>
            </DetailPanelField>
          )}

          {service.getIpFamilyPolicy() && (
            <DetailPanelField label="IP family policy">{service.getIpFamilyPolicy()}</DetailPanelField>
          )}

          {service.getIpFamilies().length > 0 && (
            <DetailPanelField label="IP families">{service.getIpFamilies().join(", ")}</DetailPanelField>
          )}

          {externalIps.length > 0 && (
            <DetailPanelField label="External IPs">
              {externalIps.map((ip) => (
                <div key={ip}>
                  {externalProtocol ? (
                    <a
                      href={`${externalProtocol}://${ip}`}
                      rel="noreferrer"
                      target="_blank"
                      className="text-primary hover:underline"
                    >
                      {ip}
                    </a>
                  ) : (
                    ip
                  )}
                </div>
              ))}
            </DetailPanelField>
          )}

          {ports && ports.length > 0 && (
            <DetailPanelField label="Ports">
              <div>
                {service.getPorts().map((port) => (
                  <ServicePortComponent service={service} port={port} key={port.toString()} />
                ))}
              </div>
            </DetailPanelField>
          )}
        </DetailPanelSection>

        {endpointSlices.length > 0 && (
          <DetailPanelSection title="Endpoint Slices">
            <ServiceDetailsEndpointSlices endpointSlices={endpointSlices} />
          </DetailPanelSection>
        )}

        {loadBalancerStatus?.conditions && (
          <div className="ServiceConditions">
            <DetailPanelSection title="Conditions">
              {loadBalancerStatus?.conditions?.map((condition, idx) => (
                <div className="condition" key={idx}>
                  <div className="title flex gaps">
                    <Icon small material="list" />
                  </div>
                  <DetailPanelField label="Last Transition Time">{condition.lastTransitionTime}</DetailPanelField>
                  <DetailPanelField label="Reason">{condition.reason}</DetailPanelField>
                  <DetailPanelField label="Status">{condition.status}</DetailPanelField>
                  {condition.type && <DetailPanelField label="Type">{condition.type}</DetailPanelField>}
                  <DetailPanelField label="Message">{condition.message}</DetailPanelField>
                </div>
              ))}
            </DetailPanelSection>
          </div>
        )}
      </div>
    );
  }
}

export const ServiceDetails = withInjectables<Dependencies, ServiceDetailsProps>(observer(NonInjectedServiceDetails), {
  getProps: (di, props) => ({
    ...props,
    subscribeStores: di.inject(subscribeStoresInjectable),
    portForwardStore: di.inject(portForwardStoreInjectable),
    endpointSliceStore: di.inject(endpointSliceStoreInjectable),
    logger: di.inject(loggerInjectionToken),
  }),
});
