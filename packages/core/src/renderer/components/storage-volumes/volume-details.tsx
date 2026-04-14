/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import startCase from "lodash/startCase";
import "./volume-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { persistentVolumeClaimApiInjectable, storageClassApiInjectable } from "@skuberplus/kube-api-specifics";
import { PersistentVolume } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
// 🎯 shadcn UI 컴포넌트: DrawerItem/DrawerTitle/Badge 대체
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import {
  DetailPanelField,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { stopPropagation } from "@skuberplus/utilities";
import { observer } from "mobx-react";
import React, { Component } from "react";
import { Link } from "react-router-dom";
import getDetailsUrlInjectable from "../kube-detail-params/get-details-url.injectable";

import type { PersistentVolumeClaimApi, StorageClassApi } from "@skuberplus/kube-api";
import type { Logger } from "@skuberplus/logger";

import type { GetDetailsUrl } from "../kube-detail-params/get-details-url.injectable";
import type { KubeObjectDetailsProps } from "../kube-object-details";

export interface PersistentVolumeDetailsProps extends KubeObjectDetailsProps<PersistentVolume> {}

interface Dependencies {
  logger: Logger;
  getDetailsUrl: GetDetailsUrl;
  storageClassApi: StorageClassApi;
  persistentVolumeClaimApi: PersistentVolumeClaimApi;
}

class NonInjectedPersistentVolumeDetails extends Component<PersistentVolumeDetailsProps & Dependencies> {
  render() {
    const { object: volume, storageClassApi, getDetailsUrl, logger, persistentVolumeClaimApi } = this.props;

    if (!volume) {
      return null;
    }

    if (!(volume instanceof PersistentVolume)) {
      logger.error("[PersistentVolumeDetails]: passed object that is not an instanceof PersistentVolume", volume);

      return null;
    }

    const {
      accessModes,
      capacity,
      persistentVolumeReclaimPolicy,
      storageClassName,
      claimRef,
      flexVolume,
      mountOptions,
      nfs,
    } = volume.spec;

    const storageClassDetailsUrl = getDetailsUrl(
      storageClassApi.formatUrlForNotListing({
        name: storageClassName,
      }),
    );

    // 🎯 shadcn DetailPanelField/DetailPanelSection으로 마이그레이션 완료
    return (
      <div className="PersistentVolumeDetails">
        <DetailPanelField label="Capacity">{capacity?.storage}</DetailPanelField>

        {mountOptions && <DetailPanelField label="Mount Options">{mountOptions.join(", ")}</DetailPanelField>}

        <DetailPanelField label="Access Modes">{accessModes?.join(", ")}</DetailPanelField>
        <DetailPanelField label="Reclaim Policy">{persistentVolumeReclaimPolicy}</DetailPanelField>
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
        <DetailPanelField label="Status">
          <Badge variant="outline">{volume.getStatus()}</Badge>
        </DetailPanelField>

        {nfs && (
          <DetailPanelSection title="Network File System">
            {Object.entries(nfs).map(([name, value]) => (
              <DetailPanelField key={name} label={startCase(name)}>
                {value}
              </DetailPanelField>
            ))}
          </DetailPanelSection>
        )}

        {flexVolume && (
          <DetailPanelSection title="FlexVolume">
            <DetailPanelField label="Driver">{flexVolume.driver}</DetailPanelField>
            {Object.entries(flexVolume.options ?? {}).map(([name, value]) => (
              <DetailPanelField key={name} label={startCase(name)}>
                {value}
              </DetailPanelField>
            ))}
          </DetailPanelSection>
        )}

        {claimRef && (
          <DetailPanelSection title="Claim">
            <DetailPanelField label="Type">{claimRef.kind}</DetailPanelField>
            <DetailPanelField label="Name">
              <Link
                to={getDetailsUrl(persistentVolumeClaimApi.formatUrlForNotListing(claimRef))}
                className="text-primary hover:underline"
              >
                {claimRef.name}
              </Link>
            </DetailPanelField>
            <DetailPanelField label="Namespace">{claimRef.namespace}</DetailPanelField>
          </DetailPanelSection>
        )}
      </div>
    );
  }
}

export const PersistentVolumeDetails = withInjectables<Dependencies, PersistentVolumeDetailsProps>(
  observer(NonInjectedPersistentVolumeDetails),
  {
    getProps: (di, props) => ({
      ...props,
      logger: di.inject(loggerInjectionToken),
      getDetailsUrl: di.inject(getDetailsUrlInjectable),
      persistentVolumeClaimApi: di.inject(persistentVolumeClaimApiInjectable),
      storageClassApi: di.inject(storageClassApiInjectable),
    }),
  },
);
