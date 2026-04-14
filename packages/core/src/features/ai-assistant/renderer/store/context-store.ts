/**
 * 🎯 목적: ContextStore - AI Assistant 컨텍스트 상태 관리 (MobX)
 * 01: attachedContexts 상태 및 액션 추가
 * @packageDocumentation
 */

import { action, computed, makeAutoObservable } from "mobx";

import type { ContextItem, ContextTypeValue } from "../../common/context-types";

/** ContextStore 인터페이스 */
export interface ContextStore {
  readonly attachedContexts: ContextItem[];
  readonly isLoading: boolean;
  readonly maxContexts: number;
  readonly hasContexts: boolean;
  readonly contextCount: number;
  readonly isMaxReached: boolean;
  addContext(item: ContextItem): void;
  addContexts(items: ContextItem[]): void;
  removeContext(id: string): void;
  clearContexts(): void;
  updateContext(id: string, updates: Partial<ContextItem>): void;
  moveContext(id: string, newIndex: number): void;
  replaceContexts(items: ContextItem[]): void;
  setMaxContexts(max: number): void;
  getContextById(id: string): ContextItem | undefined;
  getContextsByType(type: ContextTypeValue): ContextItem[];
}

const DEFAULT_MAX_CONTEXTS = 10;

/** ContextStore 구현 (MobX) */
class ContextStoreImpl implements ContextStore {
  private _attachedContexts: ContextItem[] = [];
  private _isLoading = false;
  private _maxContexts: number = DEFAULT_MAX_CONTEXTS;

  constructor() {
    makeAutoObservable(this, {
      addContext: action,
      addContexts: action,
      removeContext: action,
      clearContexts: action,
      updateContext: action,
      moveContext: action,
      replaceContexts: action,
      setMaxContexts: action,
      hasContexts: computed,
      contextCount: computed,
      isMaxReached: computed,
    });
  }

  get attachedContexts(): ContextItem[] {
    return this._attachedContexts;
  }
  get isLoading(): boolean {
    return this._isLoading;
  }
  get maxContexts(): number {
    return this._maxContexts;
  }
  get hasContexts(): boolean {
    return this._attachedContexts.length > 0;
  }
  get contextCount(): number {
    return this._attachedContexts.length;
  }
  get isMaxReached(): boolean {
    return this._attachedContexts.length >= this._maxContexts;
  }

  /** 컨텍스트 추가 (중복 무시, 초과 시 오래된 항목 제거) */
  addContext(item: ContextItem): void {
    if (this._attachedContexts.some((c) => c.id === item.id)) return;
    if (this._attachedContexts.length >= this._maxContexts) this._attachedContexts.shift();
    this._attachedContexts.push(item);
  }

  /** 여러 컨텍스트 일괄 추가 */
  addContexts(items: ContextItem[]): void {
    items.forEach((item) => this.addContext(item));
  }

  /** 컨텍스트 삭제 */
  removeContext(id: string): void {
    const index = this._attachedContexts.findIndex((c) => c.id === id);
    if (index !== -1) this._attachedContexts.splice(index, 1);
  }

  /** 모든 컨텍스트 삭제 */
  clearContexts(): void {
    this._attachedContexts = [];
  }

  /** 컨텍스트 업데이트 */
  updateContext(id: string, updates: Partial<ContextItem>): void {
    const index = this._attachedContexts.findIndex((c) => c.id === id);
    if (index !== -1) {
      this._attachedContexts[index] = { ...this._attachedContexts[index], ...updates, id };
    }
  }

  /** 컨텍스트 순서 변경 */
  moveContext(id: string, newIndex: number): void {
    if (newIndex < 0 || newIndex >= this._attachedContexts.length) return;
    const currentIndex = this._attachedContexts.findIndex((c) => c.id === id);
    if (currentIndex === -1) return;
    const [item] = this._attachedContexts.splice(currentIndex, 1);
    this._attachedContexts.splice(newIndex, 0, item);
  }

  /** 컨텍스트 목록 교체 */
  replaceContexts(items: ContextItem[]): void {
    this._attachedContexts = [...items];
    if (this._attachedContexts.length > this._maxContexts) {
      this._attachedContexts = this._attachedContexts.slice(-this._maxContexts);
    }
  }

  /** 최대 컨텍스트 개수 설정 (최소 1) */
  setMaxContexts(max: number): void {
    this._maxContexts = Math.max(1, max);
    if (this._attachedContexts.length > this._maxContexts) {
      const excess = this._attachedContexts.length - this._maxContexts;
      this._attachedContexts.splice(0, excess);
    }
  }

  /** ID로 컨텍스트 조회 */
  getContextById(id: string): ContextItem | undefined {
    return this._attachedContexts.find((c) => c.id === id);
  }

  /** 타입별 컨텍스트 조회 */
  getContextsByType(type: ContextTypeValue): ContextItem[] {
    return this._attachedContexts.filter((c) => c.type === type);
  }
}

/** ContextStore 인스턴스 생성 */
export function createContextStore(): ContextStore {
  return new ContextStoreImpl();
}

let defaultStore: ContextStore | null = null;

/** 기본 ContextStore 인스턴스 반환 (싱글톤) */
export function getContextStore(): ContextStore {
  if (!defaultStore) defaultStore = createContextStore();
  return defaultStore;
}

/** 기본 ContextStore 초기화 (테스트용) */
export function resetContextStore(): void {
  defaultStore = null;
}
