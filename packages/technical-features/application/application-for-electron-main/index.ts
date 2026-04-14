import { overrideSideEffectsWithFakes } from "./src/test-utils/override-side-effects-with-fakes";

export { applicationFeatureForElectronMain } from "./src/feature";
export * from "./src/start-application/time-slots";
export { default as whenAppIsReadyInjectable } from "./src/start-application/when-app-is-ready.injectable";

export const testUtils = { overrideSideEffectsWithFakes };
