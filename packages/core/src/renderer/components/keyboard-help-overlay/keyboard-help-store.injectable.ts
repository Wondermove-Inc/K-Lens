import { getInjectable } from "@ogre-tools/injectable";
import { action, observable } from "mobx";

export class KeyboardHelpStore {
  readonly isOpen = observable.box(false);

  open = action(() => {
    this.isOpen.set(true);
  });

  close = action(() => {
    this.isOpen.set(false);
  });

  toggle = action(() => {
    this.isOpen.set(!this.isOpen.get());
  });
}

const keyboardHelpStoreInjectable = getInjectable({
  id: "keyboard-help-store",
  instantiate: () => new KeyboardHelpStore(),
});

export default keyboardHelpStoreInjectable;
