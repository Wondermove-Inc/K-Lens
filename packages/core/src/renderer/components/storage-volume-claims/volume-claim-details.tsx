/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./volume-claim-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { storageClassApiInjectable } from "@skuberplus/kube-api-specifics";
import { PersistentVolumeClaim } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
// 🎯 shadcn UI 컴포넌트: DrawerItem/DrawerTitle/Badge 대체
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import {
  DetailPanelField,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { stopPropagation } from "@skuberplus/utilities";
import { observer } from "mobx-react";
import React, { Component, Fragment } from "react";
import { Link } from "react-router-dom";
import getDetailsUrlInjectable from "../kube-detail-params/get-details-url.injectable";
import podStoreInjectable from "../workloads-pods/store.injectable";

import type { StorageClassApi } from "@skuberplus/kube-api";
import type { Logger } from "@skuberplus/logger";

import type { GetDetailsUrl } from "../kube-detail-params/get-details-url.injectable";
import type { KubeObjectDetailsProps } from "../kube-object-details";
import type { PodStore } from "../workloads-pods/store";

export interface PersistentVolumeClaimDetailsProps extends KubeObjectDetailsProps<PersistentVolumeClaim> {}

interface Dependencies {
  getDetailsUrl: GetDetailsUrl;
  podStore: PodStore;
  storageClassApi: StorageClassApi;
  logger: Logger;
}

class NonInjectedPersistentVolumeClaimDetails extends Component<PersistentVolumeClaimDetailsProps & Dependencies> {
  render() {
    const { object: volumeClaim, podStore, getDetailsUrl, storageClassApi, logger } = this.props;

    if (!volumeClaim) {
      return null;
    }

    if (!(volumeClaim instanceof PersistentVolumeClaim)) {
      logger.error(
        "[PersistentVolumeClaimDetails]: passed object that is not an instanceof PersistentVolumeClaim",
        volumeClaim,
      );

      return null;
    }

    const { storageClassName, accessModes } = volumeClaim.spec;
    const pods = volumeClaim.getPods(podStore.items);

    const storageClassDetailsUrl = getDetailsUrl(
      storageClassApi.formatUrlForNotListing({
        name: storageClassName,
      }),
    );

    // 🎯 shadcn DetailPanelField/DetailPanelSection으로 마이그레이션 완료
    return (
      <div className="PersistentVolumeClaimDetails">
        <DetailPanelField label="Access Modes">{accessModes?.join(", ")}</DetailPanelField>
        <DetailPanelField label="Storage Class Name">
          <Link
            key="link"
            to={storageClassDetailsUrl}
            onClick={stopPropagation}
            className="text-primary hover:underline"
          >
            {storageClassName}
          </Link>
        </DetailPanelField>
        <DetailPanelField label="Storage">{volumeClaim.getStorage()}</DetailPanelField>
        <DetailPanelField label="Pods">
          <div className="flex flex-wrap gap-2">
            {pods.map((pod) => (
              <Link key={pod.getId()} to={getDetailsUrl(pod.selfLink)} className="text-primary hover:underline">
                {pod.getName()}
              </Link>
            ))}
          </div>
        </DetailPanelField>
        <DetailPanelField label="Status">{volumeClaim.getStatus()}</DetailPanelField>

        <DetailPanelSection title="Selector">
          <DetailPanelField label="Match Labels">
            <div className="flex flex-wrap gap-1">
              {volumeClaim.getMatchLabels().map((label) => (
                <Badge key={label} variant="outline" className="text-xs">
                  {label}
                </Badge>
              ))}
            </div>
          </DetailPanelField>

          <DetailPanelField label="Match Expressions">
            {volumeClaim.getMatchExpressions().map(({ key, operator, values }, i) => (
              <Fragment key={i}>
                <DetailPanelField label="Key">{key}</DetailPanelField>
                <DetailPanelField label="Operator">{operator}</DetailPanelField>
                <DetailPanelField label="Values">{values?.join(", ")}</DetailPanelField>
              </Fragment>
            ))}
          </DetailPanelField>
        </DetailPanelSection>
      </div>
    );
  }
}

export const PersistentVolumeClaimDetails = withInjectables<Dependencies, PersistentVolumeClaimDetailsProps>(
  observer(NonInjectedPersistentVolumeClaimDetails),
  {
    getProps: (di, props) => ({
      ...props,
      getDetailsUrl: di.inject(getDetailsUrlInjectable),
      podStore: di.inject(podStoreInjectable),
      storageClassApi: di.inject(storageClassApiInjectable),
      logger: di.inject(loggerInjectionToken),
    }),
  },
);
