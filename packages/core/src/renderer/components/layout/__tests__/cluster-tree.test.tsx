import { render, screen } from "@testing-library/react";
import React from "react";
import { LensKubernetesClusterStatus } from "../../../../common/catalog-entities/kubernetes-cluster";
import { ClusterTree, type ClusterTreeProps } from "../sidebar";

const createCluster = (phase: LensKubernetesClusterStatus) => ({
  getId: () => "cluster-1",
  metadata: {},
  status: { phase },
  getName: () => "Mock Cluster",
});

const baseProps: Omit<ClusterTreeProps, "cluster" | "isExpanded"> = {
  isActive: false,
  onClusterClick: jest.fn(),
  onToggleExpand: jest.fn(),
  sidebarItems: [],
  allClusterIds: [],
  onOpenClusterSettings: jest.fn(),
  ensureClusterActive: jest.fn(),
};

describe("ClusterTree connectivity gating", () => {
  it("hides resources when cluster is disconnected even if expanded", () => {
    render(
      <ClusterTree
        {...baseProps}
        cluster={createCluster(LensKubernetesClusterStatus.DISCONNECTED)}
        isExpanded={true}
      />,
    );

    expect(screen.queryByTestId("cluster-resources-cluster-1")).toBeNull();
  });

  it("shows resources when cluster is connected and expanded", () => {
    render(
      <ClusterTree {...baseProps} cluster={createCluster(LensKubernetesClusterStatus.CONNECTED)} isExpanded={true} />,
    );

    expect(screen.getByTestId("cluster-resources-cluster-1")).toBeInTheDocument();
  });
});
