/**
 * 클러스터별 네임스페이스 즐겨찾기(1-3 퀵 스위치) 저장소.
 * Main Process IPC + JSON 파일로 영속화하여 앱 재시작 후에도 유지.
 *
 * 📝 배경: Cluster Frame은 Origin 격리(`//clusterId.localhost`)로 인해
 * localStorage가 앱 재시작 시 유실됨. IPC를 통해 Main Process에서 디스크 저장.
 *
 * 🔄 변경이력:
 * - 2026-04-13 - localStorage → IPC + JSON 파일 영속화로 전환
 */

import { getInjectable } from "@ogre-tools/injectable";
import { action, computed, makeObservable, observable, runInAction, toJS } from "mobx";
import { panelSyncChannels } from "../../common/ipc/panel-sync";
import hostedClusterIdInjectable from "../cluster-frame-context/hosted-cluster-id.injectable";
import ipcRendererInjectable from "../utils/channel/ipc-renderer.injectable";

import type { IpcRenderer } from "electron";

export class NamespaceFavoritesStore {
  static readonly MAX_FAVORITES = 3;

  /** digit(1-9) → namespace 이름 매핑 */
  @observable favorites = new Map<number, string>();

  constructor(
    private readonly ipcRenderer: IpcRenderer,
    private readonly clusterId: string,
  ) {
    makeObservable(this);
  }

  @computed
  get canAddFavorite(): boolean {
    return this.favorites.size < NamespaceFavoritesStore.MAX_FAVORITES;
  }

  @action
  setFavorite(digit: number, namespace: string) {
    if (digit < 1 || digit > 9) return;
    this.favorites.set(digit, namespace);
    this.save();
  }

  @action
  removeFavorite(digit: number) {
    this.favorites.delete(digit);
    this.save();
  }

  getFavorite(digit: number): string | undefined {
    return this.favorites.get(digit);
  }

  /** 즐겨찾기 토글: 빈 슬롯(1-3)에 추가하거나 제거 + compact */
  @action
  toggleFavorite(namespace: string) {
    const existingDigit = this.getDigitForNamespace(namespace);

    if (existingDigit !== undefined) {
      this.favorites.delete(existingDigit);
      this.compact();
      this.save();
      return;
    }

    if (!this.canAddFavorite) return;

    for (let d = 1; d <= NamespaceFavoritesStore.MAX_FAVORITES; d++) {
      if (!this.favorites.has(d)) {
        this.favorites.set(d, namespace);
        break;
      }
    }
    this.save();
  }

  isFavorite(namespace: string): boolean {
    return this.getDigitForNamespace(namespace) !== undefined;
  }

  /** namespace → digit(1-based) 역참조 */
  getDigitForNamespace(namespace: string): number | undefined {
    for (const [digit, ns] of this.favorites) {
      if (ns === namespace) return digit;
    }
    return undefined;
  }

  /** digit 순서로 정렬된 즐겨찾기 배열 반환 */
  getFavoritesOrdered(): Array<{ digit: number; namespace: string }> {
    return Array.from(this.favorites.entries())
      .filter(([d]) => d >= 1 && d <= NamespaceFavoritesStore.MAX_FAVORITES)
      .sort(([a], [b]) => a - b)
      .map(([digit, namespace]) => ({ digit, namespace }));
  }

  /** 삭제 후 갭 제거: {1: "a", 3: "c"} → {1: "a", 2: "c"} */
  @action
  private compact() {
    const ordered = this.getFavoritesOrdered().map((f) => f.namespace);

    for (let d = 1; d <= NamespaceFavoritesStore.MAX_FAVORITES; d++) {
      this.favorites.delete(d);
    }
    ordered.forEach((ns, i) => {
      this.favorites.set(i + 1, ns);
    });
  }

  /** Main Process에서 클러스터별 즐겨찾기를 IPC로 로드 (비동기) */
  async load() {
    try {
      const stored = (await this.ipcRenderer.invoke(panelSyncChannels.getNamespaceFavorites, this.clusterId)) as Record<
        string,
        string
      >;

      if (stored) {
        runInAction(() => {
          for (const [key, value] of Object.entries(stored)) {
            this.favorites.set(Number(key), value);
          }
        });
      }
    } catch {
      // IPC 오류 무시
    }
  }

  /** Main Process로 즐겨찾기 저장 요청 (fire-and-forget) */
  private save() {
    try {
      const obj: Record<string, string> = {};

      for (const [key, value] of toJS(this.favorites)) {
        obj[String(key)] = value;
      }
      this.ipcRenderer.send(panelSyncChannels.setNamespaceFavorites, {
        clusterId: this.clusterId,
        favorites: obj,
      });
    } catch {
      // IPC 전송 오류 무시
    }
  }
}

const namespaceFavoritesStoreInjectable = getInjectable({
  id: "namespace-favorites-store",
  instantiate: (di) => {
    const ipcRenderer = di.inject(ipcRendererInjectable);
    const clusterId = di.inject(hostedClusterIdInjectable);

    // Cluster frame에서만 사용되므로 clusterId는 항상 존재
    const store = new NamespaceFavoritesStore(ipcRenderer, clusterId ?? "");

    if (clusterId) {
      // 비동기 로드 — MobX observable이므로 데이터 도착 시 UI 자동 갱신
      store.load();
    }

    return store;
  },
});

export default namespaceFavoritesStoreInjectable;
