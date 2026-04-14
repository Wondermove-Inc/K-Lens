import { getInjectable } from "@ogre-tools/injectable";
import { TableFocusManager } from "./table-focus-manager";

const tableFocusManagerInjectable = getInjectable({
  id: "table-focus-manager",
  instantiate: () => new TableFocusManager(),
});

export default tableFocusManagerInjectable;
