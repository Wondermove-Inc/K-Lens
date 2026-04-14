/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import createTerminalApiInjectable from "../../../api/create-terminal-api.injectable";
import createTerminalInjectable from "./create-terminal.injectable";
import { TerminalStore } from "./store";

const terminalStoreInjectable = getInjectable({
  id: "terminal-store",

  instantiate: (di) =>
    new TerminalStore({
      createTerminal: di.inject(createTerminalInjectable),
      createTerminalApi: di.inject(createTerminalApiInjectable),
    }),

  lifecycle: lifecycleEnum.singleton, // 🎯 한 인스턴스만 생성하도록 singleton 명시
});

export default terminalStoreInjectable;
