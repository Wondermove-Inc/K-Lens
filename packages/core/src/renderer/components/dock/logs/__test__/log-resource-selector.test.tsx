/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import React from "react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import directoryForUserDataInjectable from "../../../../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import fsInjectable from "../../../../../common/fs/fs.injectable";
import { getDiForUnitTesting } from "../../../../getDiForUnitTesting";
import { SearchStore } from "../../../../search-store/search-store";
import { renderFor } from "../../../test-utils/renderFor";
import callForLogsInjectable from "../call-for-logs.injectable";
import { LogTabViewModel } from "../logs-view-model";
import { LogResourceSelector } from "../resource-selector";
import { deploymentPod1, deploymentPod2, dockerPod } from "./pod.mock";

import type { UserEvent } from "@testing-library/user-event";

import type { DiRender } from "../../../test-utils/renderFor";
import type { TabId } from "../../dock/store";
import type { LogTabViewModelDependencies } from "../logs-view-model";

function mockLogTabViewModel(tabId: TabId, deps: Partial<LogTabViewModelDependencies>): LogTabViewModel {
  return new LogTabViewModel(tabId, {
    getLogs: jest.fn(),
    getLogsWithoutTimestamps: jest.fn(),
    getTimestampSplitLogs: jest.fn(),
    getLogTabData: jest.fn(),
    setLogTabData: jest.fn(),
    loadLogs: jest.fn(),
    reloadLogs: jest.fn(),
    renameTab: jest.fn(),
    stopLoadingLogs: jest.fn(),
    getPodById: jest.fn(),
    getPodsByOwnerId: jest.fn(),
    searchStore: new SearchStore(),
    areLogsPresent: jest.fn(),
    downloadLogs: jest.fn(),
    downloadAllLogs: jest.fn(),
    ...deps,
  });
}

function getOnePodViewModel(tabId: TabId, deps: Partial<LogTabViewModelDependencies> = {}): LogTabViewModel {
  const selectedPod = dockerPod;

  return mockLogTabViewModel(tabId, {
    getLogTabData: () => ({
      selectedPodId: selectedPod.getId(),
      selectedContainer: selectedPod.getContainers()[0].name,
      namespace: selectedPod.getNs(),
      showPrevious: false,
      showTimestamps: false,
    }),
    getPodById: (id) => {
      if (id === selectedPod.getId()) {
        return selectedPod;
      }

      return undefined;
    },
    ...deps,
  });
}

const getFewPodsTabData = (tabId: TabId, deps: Partial<LogTabViewModelDependencies> = {}): LogTabViewModel => {
  const selectedPod = deploymentPod1;
  const anotherPod = deploymentPod2;

  return mockLogTabViewModel(tabId, {
    getLogTabData: () => ({
      owner: {
        uid: "uuid",
        kind: "Deployment",
        name: "super-deployment",
      },
      selectedPodId: selectedPod.getId(),
      selectedContainer: selectedPod.getContainers()[0].name,
      namespace: selectedPod.getNs(),
      showPrevious: false,
      showTimestamps: false,
    }),
    getPodById: (id) => {
      if (id === selectedPod.getId()) {
        return selectedPod;
      }

      if (id === anotherPod.getId()) {
        return anotherPod;
      }

      return undefined;
    },
    getPodsByOwnerId: (id) => {
      if (id === "uuid") {
        return [selectedPod, anotherPod];
      }

      return [];
    },
    ...deps,
  });
};

describe("<LogResourceSelector />", () => {
  let render: DiRender;
  let user: UserEvent;

  beforeEach(() => {
    const di = getDiForUnitTesting();

    const { ensureDirSync } = di.inject(fsInjectable);

    di.override(directoryForUserDataInjectable, () => "/some-directory-for-user-data");
    di.override(callForLogsInjectable, () => () => Promise.resolve("some-logs"));

    render = renderFor(di);

    ensureDirSync("/tmp");

    user = userEvent.setup();
  });

  describe("with one pod", () => {
    let model: LogTabViewModel;

    beforeEach(() => {
      model = getOnePodViewModel("foobar");
    });

    it("renders w/o errors", () => {
      const { container } = render(<LogResourceSelector model={model} />);

      expect(container).toBeInstanceOf(HTMLElement);
    });

    it("renders proper namespace", async () => {
      const { findByTestId } = render(<LogResourceSelector model={model} />);
      const ns = await findByTestId("namespace-badge");

      expect(ns).toHaveTextContent("default");
    });

    it("renders proper selected items within dropdowns", async () => {
      const { findAllByText } = render(<LogResourceSelector model={model} />);

      expect((await findAllByText("dockerExporter")).length).toBeGreaterThanOrEqual(1);
      expect((await findAllByText("docker-exporter")).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("with several pods", () => {
    let model: LogTabViewModel;
    let renameTab: jest.MockedFunction<LogTabViewModelDependencies["renameTab"]>;

    beforeEach(() => {
      renameTab = jest.fn();
      model = getFewPodsTabData("foobar", { renameTab });
    });

    it("renders sibling pods in dropdown", async () => {
      const { findAllByText, findByTestId } = render(<LogResourceSelector model={model} />);
      const selector = await findByTestId("pod-selector");

      await user.click(selector);
      expect((await findAllByText("deploymentPod2")).length).toBeGreaterThanOrEqual(1);
      expect((await findAllByText("deploymentPod1")).length).toBeGreaterThanOrEqual(1);
    });

    it("renders sibling containers in dropdown", async () => {
      const { findByText, findByTestId } = render(<LogResourceSelector model={model} />);
      const selector = await findByTestId("container-selector");

      await user.click(selector);

      expect(await findByText("node-exporter-1")).toBeInTheDocument();
      expect(await findByText("init-node-exporter")).toBeInTheDocument();
      expect(await findByText("init-node-exporter-1")).toBeInTheDocument();
    });

    it("renders pod owner as badge", async () => {
      const { findAllByText } = render(<LogResourceSelector model={model} />);

      expect((await findAllByText("super-deployment", { exact: false })).length).toBeGreaterThanOrEqual(1);
    });

    it("updates tab name if selected pod changes", async () => {
      const { findByText, findByTestId } = render(<LogResourceSelector model={model} />);
      const selector = await findByTestId("pod-selector");

      await user.click(selector);
      await user.click(await findByText("deploymentPod2"));
      expect(renameTab).toBeCalledWith("foobar", "Pod deploymentPod2");
    });
  });
});
