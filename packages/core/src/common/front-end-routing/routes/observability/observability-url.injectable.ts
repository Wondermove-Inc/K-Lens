/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Observability URL 설정을 주입하는 Injectable
 *
 * 📝 주의사항:
 * - package.json의 config.observabilityUrl에서 값을 가져옴
 * - 개발: http://localhost:8080
 * - 프로덕션: 실제 URL로 설정
 *
 * 🔄 변경이력:
 * - 2025-12-02: 초기 생성
 */

import { getInjectable } from "@ogre-tools/injectable";
import { applicationInformationToken } from "@skuberplus/application";

const observabilityUrlInjectable = getInjectable({
  id: "observability-url",

  instantiate: (di) => di.inject(applicationInformationToken).observabilityUrl,
});

export default observabilityUrlInjectable;
