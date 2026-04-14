/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AddClusterDialog의 상태 관리 injectable
 *
 * 이 injectable은 Dialog의 모든 상태를 MobX observable로 관리합니다.
 * state/open/close/view 4파일 패턴의 핵심 상태 저장소입니다.
 *
 * 📝 주의사항:
 * - MobX observable을 사용하여 반응형 상태 관리
 * - isOpen, customConfig, kubeContexts, isWaiting, errors 모두 observable
 * - view.tsx에서 이 상태를 구독하여 자동 리렌더링
 *
 * 🔄 변경이력:
 * - 2025-10-24: 초기 생성 (injectable 패턴 적용)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { observable } from "mobx";

import type { KubeConfig } from "@skuberplus/kubernetes-client-node";

import type { IObservableArray, IObservableValue } from "mobx";

/**
 * 🎯 목적: Kubeconfig 검증 결과 옵션
 */
export interface Option {
  config: KubeConfig;
  error?: string;
}

/**
 * 🎯 목적: AddClusterDialog의 상태 인터페이스
 *
 * 📝 주의사항:
 * - 모든 필드는 MobX observable (IObservableValue/Map/Array)
 * - isOpen으로 Dialog 열림/닫힘 제어
 * - customConfig는 Monaco Editor의 YAML 텍스트
 * - kubeContexts는 파싱된 kubeconfig 컨텍스트 맵
 * - isWaiting은 클러스터 추가 중 로딩 상태
 * - errors는 검증 오류 메시지 배열
 */
export interface AddClusterDialogState {
  isOpen: IObservableValue<boolean>;
  customConfig: IObservableValue<string>;
  kubeContexts: ReturnType<typeof observable.map<string, Option>>;
  isWaiting: IObservableValue<boolean>;
  errors: IObservableArray<string>;
}

/**
 * 🎯 목적: AddClusterDialog 상태 injectable 정의
 */
const addClusterDialogStateInjectable = getInjectable({
  id: "add-cluster-dialog-state",
  instantiate: (): AddClusterDialogState => ({
    isOpen: observable.box(false),
    customConfig: observable.box(""),
    kubeContexts: observable.map<string, Option>(),
    isWaiting: observable.box(false),
    errors: observable.array<string>([]),
  }),
});

export default addClusterDialogStateInjectable;
