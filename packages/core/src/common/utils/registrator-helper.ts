/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { DiContainerForInjection, Injectable } from "@ogre-tools/injectable";

/**
 * 🎯 목적: 동적 injectable 등록/해제 관리
 *
 * @description
 * @ogre-tools/injectable의 di.deregister()는 **객체 동일성(identity)**으로
 * injectable을 찾습니다. 따라서 register 시 사용한 **동일한 인스턴스**를
 * deregister 시에도 사용해야 합니다.
 *
 * 문제: computed에서 매번 새로운 injectable 인스턴스를 생성하면,
 * deregister 시 다른 인스턴스를 전달하게 되어 실패합니다.
 *
 * 해결: 등록된 injectable을 내부 Map에 저장하고, deregister 시
 * id로 찾아서 원본 인스턴스를 사용합니다.
 *
 * 🔄 변경이력: 2025-01-26 - 객체 동일성 문제 해결
 */
export const injectableDifferencingRegistratorWith = (di: DiContainerForInjection) => {
  // 🔑 등록된 injectable을 id로 저장 (deregister 시 동일 인스턴스 사용)
  const registeredInjectables = new Map<string, Injectable<any, any, any>>();

  return (rawCurrent: Injectable<any, any, any>[], rawPrevious: Injectable<any, any, any>[] = []) => {
    const currentIds = new Set(rawCurrent.map((inj) => inj.id));
    const previousIds = new Set(rawPrevious.map((inj) => inj.id));

    // 추가할 항목: current에만 있는 것
    const toAddIds = [...currentIds].filter((id) => !previousIds.has(id));
    // 제거할 항목: previous에만 있는 것
    const toRemoveIds = [...previousIds].filter((id) => !currentIds.has(id));

    // 🗑️ Deregister: 저장된 원본 인스턴스 사용
    for (const id of toRemoveIds) {
      const registeredInjectable = registeredInjectables.get(id);

      if (!registeredInjectable) {
        continue;
      }

      try {
        di.deregister(registeredInjectable);
        registeredInjectables.delete(id);
      } catch {
        // Race condition으로 이미 deregister된 경우 무시
        // 실패해도 Map에서 제거 (재시도 방지)
        registeredInjectables.delete(id);
      }
    }

    // ➕ Register: 새 인스턴스 등록 및 저장
    if (toAddIds.length > 0) {
      const toAddInjectables = rawCurrent.filter((inj) => toAddIds.includes(inj.id));

      // 등록 전에 Map에 저장 (동일 인스턴스 보관)
      for (const injectable of toAddInjectables) {
        registeredInjectables.set(injectable.id, injectable);
      }

      di.register(...toAddInjectables);
    }
  };
};
