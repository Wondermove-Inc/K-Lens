import {
  type KubernetesCluster,
  LensKubernetesClusterStatus,
} from "../../../../common/catalog-entities/kubernetes-cluster";
import { getClusterOrderingIds, promoteClusterToConnectionGroup } from "../cluster-ordering";

const createCluster = ({
  id,
  name,
  lastSeen,
  phase,
}: {
  id: string;
  name: string;
  lastSeen?: number | string;
  phase: LensKubernetesClusterStatus;
}): KubernetesCluster =>
  ({
    getId: () => id,
    getName: () => name,
    metadata: lastSeen === undefined ? {} : { lastSeen },
    status: { phase },
  }) as unknown as KubernetesCluster;

describe("cluster ordering helpers", () => {
  it("sorts clusters by connection state then last seen at cold start", () => {
    const clusters = [
      createCluster({
        id: "cluster-a",
        name: "Cluster A",
        lastSeen: "2025-10-22T18:00:00.000Z",
        phase: LensKubernetesClusterStatus.CONNECTED,
      }),
      createCluster({
        id: "cluster-b",
        name: "Cluster B",
        lastSeen: "2025-10-22T19:00:00.000Z",
        phase: LensKubernetesClusterStatus.CONNECTED,
      }),
      createCluster({
        id: "cluster-c",
        name: "Cluster C",
        phase: LensKubernetesClusterStatus.DISCONNECTED,
      }),
    ];

    expect(getClusterOrderingIds(clusters)).toEqual(["cluster-a", "cluster-b", "cluster-c"]);
  });

  it("promotes the first successful connection to the end of the connected group only", () => {
    const clusters = [
      createCluster({
        id: "cluster-a",
        name: "Cluster A",
        lastSeen: "2025-10-22T18:00:00.000Z",
        phase: LensKubernetesClusterStatus.CONNECTED,
      }),
      createCluster({
        id: "cluster-b",
        name: "Cluster B",
        lastSeen: "2025-10-22T19:00:00.000Z",
        phase: LensKubernetesClusterStatus.CONNECTED,
      }),
      createCluster({
        id: "cluster-c",
        name: "Cluster C",
        phase: LensKubernetesClusterStatus.DISCONNECTED,
      }),
      createCluster({
        id: "cluster-d",
        name: "Cluster D",
        lastSeen: "2025-10-22T19:02:00.000Z",
        phase: LensKubernetesClusterStatus.CONNECTED,
      }),
    ];

    const orderBefore = ["cluster-a", "cluster-b", "cluster-c", "cluster-d"];

    expect(promoteClusterToConnectionGroup(clusters, orderBefore, "cluster-d")).toEqual([
      "cluster-a",
      "cluster-b",
      "cluster-d",
      "cluster-c",
    ]);
  });
});
