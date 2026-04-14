/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 메인 Hotbar 아이템 생성 Injectable
 *
 * 주요 기능:
 * - Explorer와 Skuber+ Observability 아이템 생성
 * - MobX computed로 자동 반응성 제공
 *
 * 🔄 변경이력:
 * - 2025-12-29: 초기 생성 (welcome.tsx, observability.tsx 중복 코드 제거)
 * - 2026-01-07: Observability URL 미등록 시 배지 제거
 */

import { getInjectable } from "@ogre-tools/injectable";
import { Files, Telescope } from "lucide-react";
import { computed } from "mobx";

import type { HotbarItem } from "./hotbar";

/**
 * 🎯 목적: 메인 Hotbar 아이템 생성 Injectable
 *
 * @returns MobX computed - Hotbar 아이템 배열 (자동 반응성)
 *
 * 📝 동작:
 * - Explorer와 Skuber+ Observability 기본 아이템 반환
 */
const hotbarItemsInjectable = getInjectable({
  id: "main-hotbar-items",

  instantiate: () => {
    return computed((): HotbarItem[] => {
      return [
        {
          id: "explorer",
          icon: Files,
          label: "Explorer",
        },
        {
          id: "skuber-observability",
          icon: Telescope,
          label: "Skuber⁺ Observability",
        },
      ];
    });
  },
});

export default hotbarItemsInjectable;
