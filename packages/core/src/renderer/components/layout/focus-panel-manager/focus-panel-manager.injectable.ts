import { getInjectable } from "@ogre-tools/injectable";
import { FocusPanelManager } from "./focus-panel-manager";

const focusPanelManagerInjectable = getInjectable({
  id: "focus-panel-manager",
  instantiate: () => new FocusPanelManager(),
});

export default focusPanelManagerInjectable;
