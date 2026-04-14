import { getInjectable } from "@ogre-tools/injectable";
import { KeyboardLayerManager } from "./keyboard-layer-manager";

const keyboardLayerManagerInjectable = getInjectable({
  id: "keyboard-layer-manager",
  instantiate: () => new KeyboardLayerManager(),
});

export default keyboardLayerManagerInjectable;
