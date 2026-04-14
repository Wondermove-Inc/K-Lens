import { getInjectable } from "@ogre-tools/injectable";
import { reactApplicationHigherOrderComponentInjectionToken } from "@skuberplus/react-application";
import { KeyboardShortcutListener } from "./keyboard-shortcut-listener";

export const keyboardShortcutListenerReactApplicationHocInjectable = getInjectable({
  id: "keyboard-shortcut-listener-react-application-hoc",
  instantiate: () => KeyboardShortcutListener,

  injectionToken: reactApplicationHigherOrderComponentInjectionToken,
});
