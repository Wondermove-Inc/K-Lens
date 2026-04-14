/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { action, computed, makeObservable, observable } from "mobx";
import { SearchStore } from "../../search-store/search-store";
import { LogStore } from "../dock/logs/store";

import type { ResourceDescriptor } from "@skuberplus/kube-api";
import type { PodLogsQuery } from "@skuberplus/kube-object";

import type { IComputedValue } from "mobx";

import type { LogWindowInitData } from "../../../common/ipc/log-window-channel";
import type { CallForLogs } from "../dock/logs/call-for-logs.injectable";
import type { LogTabData } from "../dock/logs/tab-store";

/**
 * Namespace 내 Pod 목록 조회 (K8s API 직접 호출)
 * Owner 기반 Pod 전환을 위해 sibling Pod 정보를 가져온다
 */
async function fetchPodsInNamespace(
  apiBaseUrl: string,
  namespace: string,
): Promise<
  Array<{
    name: string;
    uid: string;
    containers: string[];
    initContainers: string[];
    ownerReferences?: Array<{ uid: string }>;
  }>
> {
  const url = new URL(`/api-kube/api/v1/namespaces/${namespace}/pods`, apiBaseUrl);
  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Failed to fetch pods: ${response.status}`);
  }

  const data = await response.json();

  return (data.items ?? []).map((item: any) => ({
    name: item.metadata.name,
    uid: item.metadata.uid,
    containers: (item.spec.containers ?? []).map((c: any) => c.name),
    initContainers: (item.spec.initContainers ?? []).map((c: any) => c.name),
    ownerReferences: item.metadata.ownerReferences,
  }));
}

/**
 * 직접 fetch로 K8s Pod 로그 API 호출
 * podApi 의존성 없이 LensProxy를 통해 직접 요청
 *
 * @param apiBaseUrl 클러스터 서브도메인 포함 URL (예: https://{clusterId}.renderer.skuberplus.app:{port})
 */
function createDirectCallForLogs(apiBaseUrl: string): CallForLogs {
  return async (params: ResourceDescriptor, query?: PodLogsQuery): Promise<string> => {
    // /api-kube 프리픽스 필수: LensProxy가 이 프리픽스로 K8s API 프록시 여부를 결정
    // apiBaseUrl에 클러스터 서브도메인 포함 → 프록시가 올바른 클러스터로 라우팅
    const url = new URL(`/api-kube/api/v1/namespaces/${params.namespace}/pods/${params.name}/log`, apiBaseUrl);

    if (query?.container) url.searchParams.set("container", query.container);
    if (query?.tailLines) url.searchParams.set("tailLines", String(query.tailLines));
    if (query?.sinceTime) url.searchParams.set("sinceTime", query.sinceTime);
    if (query?.timestamps) url.searchParams.set("timestamps", "true");
    if (query?.previous) url.searchParams.set("previous", "true");

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Failed to fetch logs: ${response.status} ${response.statusText}`);
    }

    return response.text();
  };
}

/**
 * Pod 정보를 위한 최소 인터페이스
 * 실제 Pod 객체 대신 필요한 메서드만 구현
 */
class SimplePod {
  constructor(
    private readonly name: string,
    private readonly namespace: string,
    private readonly containers: string[] = [],
    private readonly initContainerNames: string[] = [],
    private readonly id: string = "",
  ) {}

  getName(): string {
    return this.name;
  }

  getNs(): string {
    return this.namespace;
  }

  getId(): string {
    return this.id;
  }

  getContainers(): { name: string }[] {
    return this.containers.map((name) => ({ name }));
  }

  getInitContainers(): { name: string }[] {
    return this.initContainerNames.map((name) => ({ name }));
  }

  getAllContainers(): { name: string }[] {
    return [...this.getContainers(), ...this.getInitContainers()];
  }
}

/**
 * 🎯 목적: 독립 로그 창을 위한 ViewModel
 *
 * 📝 특징:
 * - podApi/callForLogs DI 의존성 없이 직접 fetch 사용
 * - ClusterFrame이 아닌 RootFrame에서도 동작
 * - LensProxy를 통해 K8s API에 직접 접근
 */
export class StandaloneLogViewModel {
  private readonly logStore: LogStore;
  private readonly callForLogs: CallForLogs;
  private readonly initData: LogWindowInitData;
  private readonly apiBaseUrl: string;

  readonly searchStore: SearchStore;
  readonly windowId: string;
  readonly podName: string;

  @observable logTabData: LogTabData;
  @observable podsList: SimplePod[] = [];

  constructor(windowId: string, initData: LogWindowInitData) {
    makeObservable(this);
    this.windowId = windowId;
    this.podName = initData.podName;
    this.initData = initData;

    // 클러스터 서브도메인 URL로 API 호출 (로그 창 자체는 서브도메인 없이 로드됨)
    this.apiBaseUrl = `https://${initData.clusterId}.renderer.skuberplus.app:${initData.proxyPort}`;

    this.callForLogs = createDirectCallForLogs(this.apiBaseUrl);
    this.logStore = new LogStore({ callForLogs: this.callForLogs });
    this.searchStore = new SearchStore();

    // 초기 LogTabData 설정
    this.logTabData = {
      selectedPodId: initData.podId,
      namespace: initData.namespace,
      selectedContainer: initData.container,
      showTimestamps: initData.showTimestamps,
      showPrevious: initData.showPrevious,
      timestampFormat: initData.timestampFormat,
      visibleLevels: initData.visibleLevels,
    };
  }

  // LogTabViewModel 인터페이스 구현
  readonly isLoading = computed(() => this.logStore.areLogsPresent(this.windowId));
  readonly logs = computed(() => this.logStore.getLogs(this.windowId));
  readonly logsWithoutTimestamps = computed(() => this.logStore.getLogsWithoutTimestamps(this.windowId));
  readonly timestampSplitLogs = computed(() => this.logStore.getTimestampSplitLogs(this.windowId));

  readonly logTabDataComputed: IComputedValue<LogTabData | undefined> = computed(() => this.logTabData);

  readonly pods = computed(() => this.podsList);

  /** selectedPodId로 podsList에서 현재 Pod를 찾는다 (Pod 전환 시 자동 동기화) */
  readonly podComputed: IComputedValue<SimplePod | undefined> = computed(() => {
    const podId = this.logTabData.selectedPodId;

    return this.podsList.find((p) => p.getId() === podId);
  });

  /** podComputed의 결과를 반환 (LogStore에서 사용) */
  get pod(): SimplePod | undefined {
    return this.podComputed.get();
  }

  @action
  setPodsList(pods: SimplePod[]) {
    this.podsList = pods;
  }

  @action
  updateLogTabData = (partialData: Partial<LogTabData>) => {
    this.logTabData = { ...this.logTabData, ...partialData };
  };

  /**
   * Pod 정보 설정 및 로그 로딩 시작
   * Owner가 있으면 K8s API로 sibling Pod 목록을 조회하여 Pod 전환 지원
   */
  async initialize() {
    try {
      const rawContainers = this.initData.allContainers?.filter((c) => !c.isInit).map((c) => c.name);
      const containers = rawContainers?.length ? rawContainers : [this.logTabData.selectedContainer];
      const initContainers = this.initData.allContainers?.filter((c) => c.isInit).map((c) => c.name) ?? [];

      // 현재 Pod 객체 생성 (initData.podName = 실제 Pod 이름, selectedPodId = UID)
      const currentPod = new SimplePod(
        this.podName,
        this.logTabData.namespace,
        containers,
        initContainers,
        this.logTabData.selectedPodId,
      );

      // Owner가 있으면 같은 owner의 sibling Pod 목록 조회
      if (this.initData.owner?.uid) {
        try {
          const allPods = await fetchPodsInNamespace(this.apiBaseUrl, this.initData.namespace);
          const ownerUid = this.initData.owner.uid;
          const siblingPods = allPods
            .filter((p) => p.ownerReferences?.some((ref) => ref.uid === ownerUid))
            .map((p) => new SimplePod(p.name, this.initData.namespace, p.containers, p.initContainers, p.uid));

          this.setPodsList(siblingPods.length > 0 ? siblingPods : [currentPod]);
        } catch (error) {
          // 실패 시 현재 Pod만 표시 (graceful degradation)
          console.warn("[StandaloneLogViewModel] Failed to fetch sibling pods:", error);
          this.setPodsList([currentPod]);
        }
      } else {
        this.setPodsList([currentPod]);
      }

      await this.loadLogs();
    } catch (error) {
      console.error("[StandaloneLogViewModel] Failed to initialize:", error);
    }
  }

  loadLogs = async () => {
    if (!this.pod) return;

    const computedPod = computed(() => this.pod) as IComputedValue<any>;
    const computedTabData = computed(() => this.logTabData);

    await this.logStore.load(this.windowId, computedPod, computedTabData);
  };

  reloadLogs = async () => {
    if (!this.pod) return;

    const computedPod = computed(() => this.pod) as IComputedValue<any>;
    const computedTabData = computed(() => this.logTabData);

    await this.logStore.reload(this.windowId, computedPod, computedTabData);
  };

  stopLoadingLogs = () => {
    this.logStore.stopLoadingLogs(this.windowId);
  };

  renameTab = (_title: string) => {
    // 독립 창에서는 불필요
  };

  downloadLogs = () => {
    if (!this.pod) return;

    const logs = this.logTabData.showTimestamps ? this.logs.get() : this.logsWithoutTimestamps.get();

    const filename = `${this.pod.getName()}-${this.logTabData.selectedContainer}.log`;
    const blob = new Blob([logs.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  downloadAllLogs = async () => {
    if (!this.pod) return;

    const params: ResourceDescriptor = {
      name: this.pod.getName(),
      namespace: this.pod.getNs(),
    };
    const query: PodLogsQuery = {
      timestamps: this.logTabData.showTimestamps,
      previous: this.logTabData.showPrevious,
      container: this.logTabData.selectedContainer,
    };

    try {
      const logs = await this.callForLogs(params, query);
      const filename = `${this.pod.getName()}-${this.logTabData.selectedContainer}-all.log`;
      const blob = new Blob([logs], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("[StandaloneLogViewModel] Failed to download all logs:", error);
    }
  };

  dispose() {
    this.stopLoadingLogs();
    this.logStore.clearLogs(this.windowId);
  }
}

export type CreateStandaloneLogViewModel = (windowId: string, initData: LogWindowInitData) => StandaloneLogViewModel;

const createStandaloneLogViewModelInjectable = getInjectable({
  id: "create-standalone-log-view-model",

  instantiate: (): CreateStandaloneLogViewModel => {
    // DI 의존성 없음 - 직접 fetch 사용
    return (windowId: string, initData: LogWindowInitData) => {
      return new StandaloneLogViewModel(windowId, initData);
    };
  },

  lifecycle: lifecycleEnum.singleton,
});

export default createStandaloneLogViewModelInjectable;
