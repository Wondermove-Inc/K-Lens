/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { SettingLayout } from "./setting-layout";

/**
 * PageLayout is deprecated. See MainLayout & SettingLayout
 *
 * @deprecated
 *
 * 🎯 목적: SettingLayout의 alias로 제공 (이전 코드와의 호환성 유지)
 * 📝 주의사항: MobX @observer 데코레이터 HOC 문제 우회를 위해 클래스 상속 대신 alias 사용
 * 🔄 변경이력: 2025-10-18 - 클래스 상속 → alias 변경 (Webpack export 순서 문제 해결)
 */
export const PageLayout = SettingLayout as typeof SettingLayout;
