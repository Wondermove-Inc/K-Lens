/**
 * Internal helper to avoid importing the entire `@skuberplus/test-utils` bundle,
 * which pulls in React Testing Library side-effects during main-process unit tests.
 */

export { getGlobalOverride } from "@skuberplus/test-utils/src/get-global-override";

export type { GlobalOverride } from "@skuberplus/test-utils/src/get-global-override";
