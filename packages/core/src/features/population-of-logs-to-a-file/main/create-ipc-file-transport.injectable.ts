/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { transports } from "winston";
import directoryForLogsInjectable from "../../../common/app-paths/directory-for-logs.injectable";

// 🎯 App paths 초기화 순서 해결
// skuberplus/src/main/index.ts에서 registerLensCore() 직후 setupAppPaths를 명시적으로 실행하므로,
// 이 injectable이 인스턴스화될 때는 app paths가 이미 설정되어 있습니다.
const createIpcFileLoggerTransportInjectable = getInjectable({
  id: "create-ipc-file-logger-transport",
  instantiate: (di) => {
    const dirname = di.inject(directoryForLogsInjectable);

    return (fileId: string) =>
      new transports.File({
        dirname,
        maxsize: 1024 * 1024,
        maxFiles: 2,
        tailable: true,
        filename: `lens-${fileId}.log`,
      });
  },
  causesSideEffects: true,
});

export default createIpcFileLoggerTransportInjectable;
