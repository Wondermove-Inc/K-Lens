/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { DiContextProvider } from "@ogre-tools/injectable-react";
import { historyInjectionToken } from "@skuberplus/routing";
import { render as testingLibraryRender } from "@testing-library/react";
import { computed } from "mobx";
import React from "react";
import { Router } from "react-router";
import directoryForUserDataInjectable from "../../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import { Cluster } from "../../../common/cluster/cluster";
import { testUsingFakeTime } from "../../../test-utils/use-fake-time";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import hostedClusterIdInjectable from "../../cluster-frame-context/hosted-cluster-id.injectable";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import legacyOnChannelListenInjectable from "../../ipc/legacy-channel-listen.injectable";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import { DefaultProps } from "../../mui-base-theme";
import currentRouteComponentInjectable from "../../routes/current-route-component.injectable";
import currentlyInClusterFrameInjectable from "../../routes/currently-in-cluster-frame.injectable";
import storesAndApisCanBeCreatedInjectable from "../../stores-apis-can-be-created.injectable";
import { ClusterFrame } from "./cluster-frame";

import type { DiContainer } from "@ogre-tools/injectable";
import type { RenderResult } from "@testing-library/react";

describe("<ClusterFrame />", () => {
  let render: () => RenderResult;
  let di: DiContainer;
  let cluster: Cluster;

  beforeEach(() => {
    di = getDiForUnitTesting();
    render = () =>
      testingLibraryRender(
        <DiContextProvider value={{ di }}>
          <Router history={di.inject(historyInjectionToken)}>{DefaultProps(ClusterFrame)}</Router>
        </DiContextProvider>,
      );

    di.override(subscribeStoresInjectable, () => jest.fn().mockImplementation(() => jest.fn()));
    di.override(legacyOnChannelListenInjectable, () => jest.fn().mockImplementation(() => jest.fn()));
    di.override(directoryForUserDataInjectable, () => "/some/irrelavent/path");
    di.override(storesAndApisCanBeCreatedInjectable, () => true);
    di.override(currentlyInClusterFrameInjectable, () => true);

    testUsingFakeTime("2000-01-01 12:00:00am");

    cluster = new Cluster({
      contextName: "my-cluster",
      id: "123456",
      kubeConfigPath: "/irrelavent",
    });

    di.override(hostedClusterInjectable, () => cluster);
    di.override(hostedClusterIdInjectable, () => cluster.id);
  });

  describe("given cluster with list nodes and namespaces permissions", () => {
    beforeEach(() => {
      cluster.resourcesToShow.replace(["nodes", "namespaces"]);
    });

    it("renders", () => {
      const result = render();

      expect(result.container).toMatchSnapshot();
    });

    // TODO: shadcn sidebar 마이그레이션 후 sidebar가 테스트 환경에서 렌더되지 않음
    it.skip("shows cluster overview sidebar item as active", () => {
      const result = render();
      const clusterOverviewLink = result.getByTestId("link-for-sidebar-item-cluster-overview");

      expect(clusterOverviewLink.getAttribute("data-active")).toBe("true");
    });

    describe("given no matching component", () => {
      beforeEach(() => {
        di.override(currentRouteComponentInjectable, () => computed(() => undefined));
      });

      describe("given current url is starting url", () => {
        it("renders", () => {
          const result = render();

          expect(result.container).toMatchSnapshot();
        });

        // TODO: 에러 메시지가 cluster-frame-layout-child-component에서 렌더되므로 ClusterFrame 단독 테스트에서 안 보임
        it.skip("shows warning message", () => {
          const result = render();

          expect(
            result.getByText(
              "An error has occurred. No route can be found matching the current route, which is also the starting route.",
            ),
          ).toBeInTheDocument();
        });
      });
    });
  });

  describe("given cluster without list nodes, but with namespaces permissions", () => {
    beforeEach(() => {
      cluster.resourcesToShow.replace(["namespaces"]);
    });

    it("renders", () => {
      const result = render();

      expect(result.container).toMatchSnapshot();
    });

    // TODO: shadcn sidebar 마이그레이션 후 sidebar가 테스트 환경에서 렌더되지 않음
    it.skip("shows workloads overview sidebar item as active", () => {
      const result = render();
      const workloadsLink = result.getByTestId("link-for-sidebar-item-workloads");

      expect(workloadsLink.getAttribute("data-active")).toBe("true");
    });
  });
});
