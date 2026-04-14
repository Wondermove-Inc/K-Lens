/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import {
  DetailPanelField,
  DetailPanelFieldGroup,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { displayMode } from "@skuberplus/utilities";
import React from "react";

import type { VolumeVariantComponent } from "../variant-helpers";

export const Projected: VolumeVariantComponent<"projected"> = ({ variant: { sources, defaultMode } }) => (
  <DetailPanelFieldGroup>
    {typeof defaultMode === "number" && (
      <DetailPanelField label="Default Mount Mode">{displayMode(defaultMode)}</DetailPanelField>
    )}
    <DetailPanelField label="Sources">
      {sources?.map(({ secret, downwardAPI, configMap, serviceAccountToken }, index) => (
        <React.Fragment key={index}>
          {secret && (
            <DetailPanelSection title="Secret">
              <DetailPanelFieldGroup>
                <DetailPanelField label="Name">{secret.name}</DetailPanelField>
                <DetailPanelField label="Items">
                  <ul>
                    {secret.items?.map(({ key, path, mode }) => (
                      <li key={key}>
                        {`${key}⇢${path}`}
                        {typeof mode === "number" && ` (${displayMode(mode)})`}
                      </li>
                    ))}
                  </ul>
                </DetailPanelField>
              </DetailPanelFieldGroup>
            </DetailPanelSection>
          )}
          {downwardAPI && (
            <DetailPanelSection title="Downward API">
              <DetailPanelField label="Items">
                <ul>
                  {downwardAPI.items?.map(({ path }) => (
                    <li key={path}>{path}</li>
                  ))}
                </ul>
              </DetailPanelField>
            </DetailPanelSection>
          )}
          {configMap && (
            <DetailPanelSection title="Config Map">
              <DetailPanelFieldGroup>
                <DetailPanelField label="Name">{configMap.name}</DetailPanelField>
                <DetailPanelField label="Items">
                  <ul>
                    {configMap.items?.map(({ key, path }) => (
                      <li key={key}>{`${key}⇢${path}`}</li>
                    ))}
                  </ul>
                </DetailPanelField>
              </DetailPanelFieldGroup>
            </DetailPanelSection>
          )}
          {serviceAccountToken && (
            <DetailPanelSection title="Service Account Token">
              <DetailPanelFieldGroup>
                <DetailPanelField label="Audience" hidden={!serviceAccountToken.audience}>
                  {serviceAccountToken.audience}
                </DetailPanelField>
                <DetailPanelField label="Expiration">
                  {`${serviceAccountToken.expirationSeconds ?? 60 * 60 /* an hour */}s`}
                </DetailPanelField>
                <DetailPanelField label="Path">{serviceAccountToken.path}</DetailPanelField>
              </DetailPanelFieldGroup>
            </DetailPanelSection>
          )}
        </React.Fragment>
      ))}
    </DetailPanelField>
  </DetailPanelFieldGroup>
);
