/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Observability 소개 페이지
 *
 * 주요 기능:
 * - URL 미등록 시 Observability 기능 소개 화면 표시
 * - header / body(scrollable) / footer 3영역 구조
 * - max-width 1280px, 가운데 정렬 (1024px 이상)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import React from "react";
import activeThemeTypeInjectable from "../../themes/active-type.injectable";
import { InfoBadges } from "./components/info-badges";
import { ObservabilityFeatures } from "./components/observability-features";
import { ObservabilityFooterSection } from "./components/observability-footer-section";
import { ObservabilityHeader } from "./components/observability-header";
import { ObservabilityHero } from "./components/observability-hero";

import type { IComputedValue } from "mobx";

import type { ThemeType } from "../../themes/lens-theme";

interface Dependencies {
  activeThemeType: IComputedValue<ThemeType>;
}

const NonInjectedObservabilityIntro = observer((props: Dependencies) => {
  const { activeThemeType } = props;
  const isDark = activeThemeType.get() === "dark";

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      {/* Header 고정 영역 */}
      <div className="w-full flex justify-center px-5 py-10 lg:px-5 lg:py-10 shrink-0">
        <div className="w-full max-w-[1280px]" style={{ minWidth: "768px" }}>
          <ObservabilityHeader isDark={isDark} />
        </div>
      </div>

      {/* 스크롤 가능한 콘텐츠 영역 */}
      <div
        className="flex-1 w-full overflow-y-auto flex justify-center"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div className="w-full max-w-[1280px] px-5 lg:px-5" style={{ minWidth: "768px" }}>
          {/* Body + Footer */}
          <div className="flex">
            {/* 왼쪽: 콘텐츠 */}
            <div className="flex-1 min-w-0 lg:px-5">
              <ObservabilityHero isDark={isDark} />
              <ObservabilityFeatures isDark={isDark} />
              <ObservabilityFooterSection isDark={isDark} />

              {/* Info badges (lg 미만에서만 최하단 표시) */}
              <section className="pb-10 lg:hidden">
                <InfoBadges className="flex flex-col gap-0" />
              </section>
            </div>

            {/* accent border (lg 이상) */}
            <div className="hidden lg:block w-px shrink-0 ml-6" style={{ backgroundColor: "var(--accent)" }} />

            {/* 오른쪽: InfoBadges (lg 이상) */}
            <div className="hidden lg:block shrink-0 w-80 pl-6 pt-6">
              <InfoBadges className="flex flex-col" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export const ObservabilityIntro = withInjectables<Dependencies>(NonInjectedObservabilityIntro, {
  getProps: (di) => ({
    activeThemeType: di.inject(activeThemeTypeInjectable),
  }),
});
