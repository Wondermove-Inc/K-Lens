import { pipeline } from "@ogre-tools/fp";
import { getInjectable } from "@ogre-tools/injectable";
import { filter, isString } from "lodash/fp";
import keyboardLayerManagerInjectable from "./keyboard-layer-manager.injectable";
import { Binding, KeyboardShortcut, keyboardShortcutInjectionToken } from "./keyboard-shortcut-injection-token";
import platformInjectable from "./platform.injectable";

export type InvokeShortcut = (event: KeyboardEvent) => void;

const toShortcutsWithMatchingScope = (shortcut: KeyboardShortcut) => {
  const activeScopeElement = document.activeElement?.closest("[data-keyboard-shortcut-scope]");

  if (!activeScopeElement) {
    const shortcutIsRootLevel = !shortcut.scope;

    return shortcutIsRootLevel;
  }

  const castedActiveScopeElementHtml = activeScopeElement as HTMLDivElement;

  const activeScope = castedActiveScopeElementHtml.dataset.keyboardShortcutScope;

  return shortcut.scope === activeScope;
};

const toBindingWithDefaults = (binding: Binding) =>
  isString(binding)
    ? {
        code: binding,
        shift: false,
        ctrl: false,
        altOrOption: false,
        meta: false,
        ctrlOrCommand: false,
      }
    : {
        ctrl: false,
        shift: false,
        altOrOption: false,
        meta: false,
        ctrlOrCommand: false,
        ...binding,
      };

/**
 * Check if a binding has any modifier keys (ctrl, meta, alt, ctrlOrCommand).
 * Shift alone is NOT counted as a modifier for layer filtering purposes,
 * since Shift+letter produces uppercase which is a valid single-char shortcut (e.g., G = Shift+g).
 */
const bindingHasModifier = (binding: Binding): boolean => {
  if (isString(binding)) return false;
  return Boolean(binding.ctrl || binding.meta || binding.altOrOption || binding.ctrlOrCommand);
};

const toShortcutsWithMatchingBinding = (event: KeyboardEvent, platform: string) => (shortcut: KeyboardShortcut) => {
  const binding = toBindingWithDefaults(shortcut.binding);

  const shiftModifierMatches = binding.shift === event.shiftKey;
  const altModifierMatches = binding.altOrOption === event.altKey;

  const isMac = platform === "darwin";

  // ctrlOrCommand maps to Cmd on Mac, Ctrl on non-Mac
  const expectedCtrl = binding.ctrl || (!isMac && binding.ctrlOrCommand);
  const expectedMeta = binding.meta || (isMac && binding.ctrlOrCommand);

  const ctrlModifierMatches = expectedCtrl === event.ctrlKey;
  const metaModifierMatches = expectedMeta === event.metaKey;

  return (
    event.code === binding.code &&
    shiftModifierMatches &&
    ctrlModifierMatches &&
    altModifierMatches &&
    metaModifierMatches
  );
};

const invokeShortcutInjectable = getInjectable({
  id: "invoke-shortcut",

  instantiate: (di): InvokeShortcut => {
    const getShortcuts = () => di.injectMany(keyboardShortcutInjectionToken);
    const platform = di.inject(platformInjectable);
    const layerManager = di.inject(keyboardLayerManagerInjectable);

    return (event) => {
      const allShortcuts = getShortcuts();
      const bindingMatched = allShortcuts.filter(toShortcutsWithMatchingBinding(event, platform));
      const scopeMatched = bindingMatched.filter(toShortcutsWithMatchingScope);

      // Filter by keyboard layer - block single-char shortcuts during text input
      const shortcutsToInvoke = scopeMatched.filter((shortcut) => {
        const hasModifier = bindingHasModifier(shortcut.binding);
        return layerManager.shouldAllowShortcut(event, hasModifier);
      });

      if (shortcutsToInvoke.length) {
        event.preventDefault();
        shortcutsToInvoke.forEach((shortcut) => shortcut.invoke());
      }
    };
  },
});

export default invokeShortcutInjectable;
