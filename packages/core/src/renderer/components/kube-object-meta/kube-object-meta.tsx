/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { KubeObject } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
// 🎯 shadcn UI 컴포넌트: DrawerItem/DrawerItemLabels 대체
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { observer } from "mobx-react";
import React from "react";
import { Link } from "react-router-dom";
import apiManagerInjectable from "../../../common/k8s-api/api-manager/manager.injectable";
import { DurationAbsoluteTimestamp } from "../events";
import getDetailsUrlInjectable from "../kube-detail-params/get-details-url.injectable";
import { KubeObjectAge } from "../kube-object/age";
import { LinkToNamespace } from "../kube-object-link";
import { KubeObjectStatusIcon } from "../kube-object-status-icon";
import { LocaleDate } from "../locale-date";

import type { KubeMetaField } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { ApiManager } from "../../../common/k8s-api/api-manager";
import type { GetDetailsUrl } from "../kube-detail-params/get-details-url.injectable";

export interface KubeObjectMetaProps {
  object: KubeObject;
  hideFields?: KubeMetaField[];
}

interface Dependencies {
  getDetailsUrl: GetDetailsUrl;
  apiManager: ApiManager;
  logger: Logger;
}

const NonInjectedKubeObjectMeta = observer((props: Dependencies & KubeObjectMetaProps) => {
  const { apiManager, getDetailsUrl, object, hideFields = ["uid", "resourceVersion", "selfLink"], logger } = props;

  if (!object) {
    return null;
  }

  if (!(object instanceof KubeObject)) {
    logger.error("[KubeObjectMeta]: passed object that is not an instanceof KubeObject", object);

    return null;
  }

  const isHidden = (field: KubeMetaField) => hideFields.includes(field);

  const {
    selfLink,
    metadata: { creationTimestamp, deletionTimestamp },
  } = object;
  const ownerRefs = object.getOwnerRefs();
  const namespace = object.getNs();

  // 🎯 shadcn DetailPanelField로 마이그레이션 완료
  return (
    <>
      <DetailPanelField label="Created" hidden={isHidden("creationTimestamp") || !creationTimestamp}>
        <KubeObjectAge object={object} compact={false} withTooltip={false} />
        {" ago "}
        {creationTimestamp && (
          <>
            {"("}
            <LocaleDate date={creationTimestamp} />
            {")"}
          </>
        )}
      </DetailPanelField>
      <DetailPanelField label="Deleted" hidden={isHidden("deletionTimestamp") || !deletionTimestamp}>
        <DurationAbsoluteTimestamp timestamp={deletionTimestamp} />
      </DetailPanelField>
      <DetailPanelField label="Name" hidden={isHidden("name")}>
        <span className="flex items-center gap-2">
          {object.getName()}
          <KubeObjectStatusIcon key="icon" object={object} />
        </span>
      </DetailPanelField>
      <DetailPanelField label="Namespace" hidden={isHidden("namespace") || !namespace}>
        <LinkToNamespace namespace={namespace} />
      </DetailPanelField>
      <DetailPanelField label="UID" hidden={isHidden("uid")}>
        {object.getId()}
      </DetailPanelField>
      <DetailPanelField label="Link" hidden={isHidden("selfLink")}>
        <span className="break-all">{selfLink}</span>
      </DetailPanelField>
      <DetailPanelField label="Resource Version" hidden={isHidden("resourceVersion")}>
        {object.getResourceVersion()}
      </DetailPanelField>
      {/* 🎯 Labels/Annotations/Finalizers: Badge 컴포넌트로 시각적 개선 */}
      <DetailPanelField label="Labels" hidden={isHidden("labels") || object.getLabels().length === 0}>
        <div className="flex flex-wrap gap-1">
          {object.getLabels().map((label) => (
            <Badge key={label} variant="outline" className="text-xs">
              {label}
            </Badge>
          ))}
        </div>
      </DetailPanelField>
      <DetailPanelField label="Annotations" hidden={isHidden("annotations") || object.getAnnotations().length === 0}>
        <div className="flex flex-wrap gap-1">
          {object.getAnnotations().map((annotation) => (
            <Badge key={annotation} variant="outline" className="text-xs">
              {annotation}
            </Badge>
          ))}
        </div>
      </DetailPanelField>
      <DetailPanelField label="Finalizers" hidden={isHidden("finalizers") || object.getFinalizers().length === 0}>
        <div className="flex flex-wrap gap-1">
          {object.getFinalizers().map((finalizer) => (
            <Badge key={finalizer} variant="secondary" className="text-xs">
              {finalizer}
            </Badge>
          ))}
        </div>
      </DetailPanelField>
      {ownerRefs?.length > 0 && (
        <DetailPanelField label="Controlled By" hidden={isHidden("ownerReferences")}>
          {ownerRefs.map((ref) => (
            <p key={ref.name}>
              {`${ref.kind} `}
              <Link to={getDetailsUrl(apiManager.lookupApiLink(ref, object))} className="text-primary hover:underline">
                {ref.name}
              </Link>
            </p>
          ))}
        </DetailPanelField>
      )}
    </>
  );
});

export const KubeObjectMeta = withInjectables<Dependencies, KubeObjectMetaProps>(NonInjectedKubeObjectMeta, {
  getProps: (di, props) => ({
    ...props,
    getDetailsUrl: di.inject(getDetailsUrlInjectable),
    apiManager: di.inject(apiManagerInjectable),
    logger: di.inject(loggerInjectionToken),
  }),
});
