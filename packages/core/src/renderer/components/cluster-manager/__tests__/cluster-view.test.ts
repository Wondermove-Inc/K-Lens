/**
 * 🎯 목적: ClusterView 비정상 경로(엔티티 로딩 실패, 연결 실패) 시 사용자 피드백 동작 검증
 */

import { CatalogEntityRegistry } from "../../../api/catalog/entity/registry";
import { NonInjectedClusterView } from "../cluster-view";

import type { IComputedValue } from "mobx";

import type { CatalogEntity } from "../../../../common/catalog";
import type { ClusterFrameHandler } from "../cluster-frame-handler";

type ClusterViewProps = ConstructorParameters<typeof NonInjectedClusterView>[0];

const createClusterFrameHandler = (): ClusterFrameHandler =>
  ({
    clearVisibleCluster: jest.fn(),
    initView: jest.fn(),
    setVisibleCluster: jest.fn(),
    hasVisibleView: () => false,
    hasAnyLoadedView: () => false,
    hasLoadedView: () => true,
  }) as unknown as ClusterFrameHandler;

const createMockEntityRegistry = () => {
  const registry = new CatalogEntityRegistry({
    navigate: jest.fn(),
    categoryRegistry: {
      getEntityForData: jest.fn(),
    } as any,
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any,
  });

  jest.spyOn(registry, "getById").mockReturnValue({
    getName: () => "Prod Cluster",
  } as unknown as CatalogEntity);

  registry.activeEntity = undefined;

  return registry;
};

const createClusterViewProps = (overrides: Partial<ClusterViewProps> = {}): ClusterViewProps => {
  const entityRegistry = overrides.entityRegistry ?? createMockEntityRegistry();

  return {
    clusterId: overrides.clusterId ?? ({ get: () => "cluster-1" } as IComputedValue<string>),
    clusterFrames: overrides.clusterFrames ?? createClusterFrameHandler(),
    navigateToCatalog: overrides.navigateToCatalog ?? jest.fn(),
    entityRegistry,
    getClusterById:
      overrides.getClusterById ??
      jest.fn().mockReturnValue({
        name: { get: () => "Prod Cluster" },
        ready: { get: () => true },
        available: { get: () => true },
      }),
    requestClusterActivation: overrides.requestClusterActivation ?? jest.fn().mockResolvedValue(undefined),
  };
};

describe("ClusterView activation failure handling", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("calls requestClusterActivation when entity is ready", async () => {
    const requestClusterActivation = jest.fn().mockResolvedValue(undefined);
    const props = createClusterViewProps({
      requestClusterActivation,
    });
    const view = new NonInjectedClusterView(props);

    jest.spyOn(view as any, "waitForCatalogEntity").mockResolvedValue(true);

    await (view as any).handleClusterChange("cluster-1");

    expect(requestClusterActivation).toHaveBeenCalledWith({ clusterId: "cluster-1" });
  });

  it("notifies user when catalog entity never becomes available", async () => {
    const requestClusterActivation = jest.fn();
    const props = createClusterViewProps({
      requestClusterActivation,
    });
    const view = new NonInjectedClusterView(props);

    jest.spyOn(view as any, "waitForCatalogEntity").mockResolvedValue(false);

    await (view as any).handleClusterChange("cluster-1");

    expect(requestClusterActivation).not.toHaveBeenCalled();
  });
});
