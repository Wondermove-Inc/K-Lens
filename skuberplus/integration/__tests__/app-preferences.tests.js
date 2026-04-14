/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import * as utils from "../helpers/utils";

describe("preferences page tests", () => {
  let window;
  let cleanup;
  beforeEach(
    async () => {
      let app;
      ({ window, cleanup, app } = await utils.start());
      await utils.clickWelcomeButton(window);
      await app.evaluate(async ({ app }) => {
        await app.applicationMenu
          ?.getMenuItemById(process.platform === "darwin" ? "mac" : "file")
          ?.submenu?.getMenuItemById("navigate-to-preferences")
          ?.click();
      });
    },
    10 * 60 * 1000,
  );
  afterEach(
    async () => {
      await cleanup?.();
    },
    10 * 60 * 1000,
  );
  it(
    'shows "preferences" and can navigate through the tabs',
    async () => {
      const pages = [
        {
          id: "app",
          header: "Application",
        },
        {
          id: "proxy",
          header: "Proxy",
        },
        {
          id: "kubernetes",
          header: "Kubernetes",
        },
      ];
      for (const { id, header } of pages) {
        await window.click(`[data-preference-tab-link-test=${id}]`);
        await window.waitForSelector(`[data-preference-page-title-test] >> text=${header}`);
      }
    },
    10 * 60 * 1000,
  );
  // Skipping, but will turn it on again in the follow up PR
  it.skip(
    "ensures helm repos",
    async () => {
      await window.click("[data-testid=kubernetes-tab]");
      await window.waitForSelector("[data-testid=repository-name]");
      await window.click("#HelmRepoSelect");
      await window.waitForSelector("div.Select__option");
    },
    10 * 60 * 1000,
  );
});
//# sourceMappingURL=app-preferences.tests.js.map
