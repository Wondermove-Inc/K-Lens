/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 이 파일은 더 이상 사용되지 않습니다.
 * standalone-log-view-model.injectable.ts에서 LogStore를 직접 생성합니다.
 * DI 스캔 오류 방지를 위해 빈 injectable로 유지합니다.
 */
import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";

const createStandaloneLogStoreInjectable = getInjectable({
  id: "create-standalone-log-store",
  instantiate: () => () => null,
  lifecycle: lifecycleEnum.singleton,
});

export default createStandaloneLogStoreInjectable;
