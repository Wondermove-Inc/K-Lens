import { getInjectable } from "@ogre-tools/injectable";
import { observable } from "mobx";

/** Temporary flash message displayed in the status bar (auto-clears). */
const statusBarFlashMessageInjectable = getInjectable({
  id: "status-bar-flash-message",
  instantiate: () => observable.box<string>(""),
});

export default statusBarFlashMessageInjectable;
