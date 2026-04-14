import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import { storesAndApisCanBeCreatedInjectionToken } from "@skuberplus/kube-api-specifics";
import namespaceStoreInjectable from "../components/namespaces/store.injectable";
import namespaceFavoritesStoreInjectable from "./namespace-favorites-store.injectable";

/**
 * `0` key — Switch to All Namespaces.
 * `1-9` keys — Switch to favorite namespace at that slot.
 * Mirrors k9s namespace number shortcuts.
 *
 * These shortcuts are only functional in Cluster Frame where namespaceStore is available.
 * In Root Frame, storesAndApisCanBeCreated is false and invoke is a no-op.
 */

// `0` — All Namespaces
const namespaceSwitch0Injectable = getInjectable({
  id: "k9s-namespace-switch-0",

  instantiate: (di) => {
    const canBeCreated = di.inject(storesAndApisCanBeCreatedInjectionToken);

    if (!canBeCreated) {
      return { binding: "Digit0", invoke: () => {} };
    }

    const namespaceStore = di.inject(namespaceStoreInjectable);

    return {
      binding: "Digit0",
      invoke: () => {
        namespaceStore.selectNamespaces([]);
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default namespaceSwitch0Injectable;

function createNamespaceDigitInjectable(digit: number) {
  return getInjectable({
    id: `k9s-namespace-switch-${digit}`,

    instantiate: (di) => {
      const canBeCreated = di.inject(storesAndApisCanBeCreatedInjectionToken);

      if (!canBeCreated) {
        return { binding: `Digit${digit}`, invoke: () => {} };
      }

      const namespaceStore = di.inject(namespaceStoreInjectable);
      const favoritesStore = di.inject(namespaceFavoritesStoreInjectable);

      return {
        binding: `Digit${digit}`,
        invoke: () => {
          const namespace = favoritesStore.getFavorite(digit);

          if (namespace) {
            namespaceStore.selectNamespaces(namespace);
          }
        },
      };
    },

    injectionToken: keyboardShortcutInjectionToken,
  });
}

export const namespaceSwitch1Injectable = createNamespaceDigitInjectable(1);
export const namespaceSwitch2Injectable = createNamespaceDigitInjectable(2);
export const namespaceSwitch3Injectable = createNamespaceDigitInjectable(3);
export const namespaceSwitch4Injectable = createNamespaceDigitInjectable(4);
export const namespaceSwitch5Injectable = createNamespaceDigitInjectable(5);
export const namespaceSwitch6Injectable = createNamespaceDigitInjectable(6);
export const namespaceSwitch7Injectable = createNamespaceDigitInjectable(7);
export const namespaceSwitch8Injectable = createNamespaceDigitInjectable(8);
export const namespaceSwitch9Injectable = createNamespaceDigitInjectable(9);
