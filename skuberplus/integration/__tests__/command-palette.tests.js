/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import * as utils from "../helpers/utils";

describe("SkuberPlus command palette", () => {
  let window;
  let cleanup;
  let app;
  beforeEach(
    async () => {
      ({ window, cleanup, app } = await utils.start());
      await utils.clickWelcomeButton(window);
    },
    10 * 60 * 1000,
  );
  afterEach(
    async () => {
      await cleanup?.();
    },
    10 * 60 * 1000,
  );
  describe("menu", () => {
    it(
      "opens command dialog from menu",
      async () => {
        await app.evaluate(async ({ app }) => {
          await app.applicationMenu?.getMenuItemById("view")?.submenu?.getMenuItemById("open-command-palette")?.click();
        });
        await window.waitForSelector(".Select__option >> text=Hotbar: Switch");
      },
      10 * 60 * 1000,
    );
  });
});
//# sourceMappingURL=command-palette.tests.js.map
