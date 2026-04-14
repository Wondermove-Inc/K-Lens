import { getGlobalOverride } from "@skuberplus/test-utils";
import { pathNames } from "./app-path-names";
import appPathsStateInjectable from "./app-paths-state.injectable";

import type { AppPaths } from "./app-path-injection-token";

const defaultMockAppPaths: AppPaths = Object.fromEntries(pathNames.map((name) => [name, `/mock/${name}`])) as AppPaths;

export default getGlobalOverride(appPathsStateInjectable, () => {
  let state = defaultMockAppPaths;

  return {
    get: () => state,
    set: (newState: AppPaths) => {
      state = newState;
    },
  };
});
