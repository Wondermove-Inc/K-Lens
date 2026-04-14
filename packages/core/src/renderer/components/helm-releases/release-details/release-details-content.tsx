/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./release-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Button } from "@skuberplus/button";
import { Spinner } from "@skuberplus/spinner";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
// 🎯 shadcn UI 컴포넌트: DrawerItem/DrawerTitle 대체
import {
  DetailPanelField,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { stopPropagation } from "@skuberplus/utilities";
import { kebabCase } from "lodash/fp";
import { observer } from "mobx-react";
import React from "react";
import { Link } from "react-router-dom";
import { Checkbox } from "../../checkbox";
import { SubTitle } from "../../layout/sub-title";
import { MonacoEditor } from "../../monaco-editor";
import { Table, TableCell, TableHead, TableRow } from "../../table";
import releaseDetailsModelInjectable from "./release-details-model/release-details-model.injectable";

import type {
  ConfigurationInput,
  MinimalResourceGroup,
  OnlyUserSuppliedValuesAreShownToggle,
  ReleaseDetailsModel,
} from "./release-details-model/release-details-model.injectable";
import type { TargetHelmRelease } from "./target-helm-release.injectable";

interface ReleaseDetailsContentProps {
  targetRelease: TargetHelmRelease;
}

interface Dependencies {
  model: ReleaseDetailsModel;
}

// 🎯 shadcn DetailPanelField/DetailPanelSection으로 마이그레이션 완료
const NonInjectedReleaseDetailsContent = observer(({ model }: Dependencies & ReleaseDetailsContentProps) => {
  const loadingError = model.loadingError.get();

  if (loadingError) {
    return <div data-testid="helm-release-detail-error">Failed to load release: {loadingError}</div>;
  }

  return (
    <div>
      <DetailPanelField label="Chart" className="chart">
        <div className="flex gaps align-center">
          <span>{model.release.chart}</span>

          <Button
            primary
            label="Upgrade"
            className="box right upgrade"
            onClick={model.startUpgradeProcess}
            data-testid="helm-release-upgrade-button"
          />
        </div>
      </DetailPanelField>

      <DetailPanelField label="Updated">{`${model.release.getUpdated()} ago (${model.release.updated})`}</DetailPanelField>

      <DetailPanelField label="Namespace">{model.release.getNs()}</DetailPanelField>

      <DetailPanelField label="Version">
        <div className="version flex gaps align-center" onClick={stopPropagation}>
          <span>{model.release.getVersion()}</span>
        </div>
      </DetailPanelField>

      <DetailPanelField label="Status" className="status">
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className={kebabCase(model.release.getStatus())}>
            {model.release.getStatus()}
          </Badge>
        </div>
      </DetailPanelField>

      <ReleaseValues
        releaseId={model.id}
        configuration={model.configuration}
        onlyUserSuppliedValuesAreShown={model.onlyUserSuppliedValuesAreShown}
      />

      <DetailPanelSection title="Notes">{model.notes && <div className="notes">{model.notes}</div>}</DetailPanelSection>

      <DetailPanelSection title="Resources">
        {model.groupedResources.length > 0 && (
          <div className="resources">
            {model.groupedResources.map((group) => (
              <ResourceGroup key={group.kind} group={group} />
            ))}
          </div>
        )}
      </DetailPanelSection>
    </div>
  );
});

export const ReleaseDetailsContent = withInjectables<Dependencies, ReleaseDetailsContentProps>(
  NonInjectedReleaseDetailsContent,
  {
    getPlaceholder: () => <Spinner center data-testid="helm-release-detail-content-spinner" />,

    getProps: async (di, props) => ({
      model: await di.inject(releaseDetailsModelInjectable, props.targetRelease),
      ...props,
    }),
  },
);

const ResourceGroup = ({ group: { kind, isNamespaced, resources } }: { group: MinimalResourceGroup }) => (
  <>
    <SubTitle title={kind} />

    <Table scrollable={false}>
      <TableHead sticky={false}>
        <TableCell className="name">Name</TableCell>

        {isNamespaced && <TableCell className="namespace">Namespace</TableCell>}
      </TableHead>

      {resources.map(({ detailsUrl, name, namespace, uid }) => (
        <TableRow key={uid}>
          <TableCell className="name">{detailsUrl ? <Link to={detailsUrl}>{name}</Link> : name}</TableCell>

          {isNamespaced && <TableCell className="namespace">{namespace}</TableCell>}
        </TableRow>
      ))}
    </Table>
  </>
);

interface ReleaseValuesProps {
  releaseId: string;
  configuration: ConfigurationInput;
  onlyUserSuppliedValuesAreShown: OnlyUserSuppliedValuesAreShownToggle;
}

const ReleaseValues = observer(({ releaseId, configuration, onlyUserSuppliedValuesAreShown }: ReleaseValuesProps) => {
  const configurationIsLoading = configuration.isLoading.get();

  return (
    <div className="values">
      <DetailPanelSection title="Values">
        <div className="flex column gaps">
          <Checkbox
            label="User-supplied values only"
            value={onlyUserSuppliedValuesAreShown.value.get()}
            onChange={onlyUserSuppliedValuesAreShown.toggle}
            disabled={configurationIsLoading}
            data-testid="user-supplied-values-only-checkbox"
          />

          <MonacoEditor
            id={`helm-release-configuration-${releaseId}`}
            style={{ minHeight: 300 }}
            value={configuration.nonSavedValue.get()}
            onChange={configuration.onChange}
          />

          <Button
            primary
            label="Save"
            waiting={configuration.isSaving.get()}
            disabled={configurationIsLoading}
            onClick={configuration.save}
            data-testid="helm-release-configuration-save-button"
          />
        </div>
      </DetailPanelSection>
    </div>
  );
});
