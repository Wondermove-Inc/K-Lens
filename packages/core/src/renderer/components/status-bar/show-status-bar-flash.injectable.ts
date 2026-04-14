import { getInjectable } from "@ogre-tools/injectable";
import { action } from "mobx";
import statusBarFlashMessageInjectable from "./flash-message.injectable";

export type ShowStatusBarFlash = (message: string, durationMs?: number) => void;

const showStatusBarFlashInjectable = getInjectable({
  id: "show-status-bar-flash",

  instantiate: (di): ShowStatusBarFlash => {
    const flashMessage = di.inject(statusBarFlashMessageInjectable);
    let timer: ReturnType<typeof setTimeout> | undefined;

    return action((message: string, durationMs = 2000) => {
      if (timer) {
        clearTimeout(timer);
      }

      flashMessage.set(message);

      timer = setTimeout(
        action(() => {
          flashMessage.set("");
          timer = undefined;
        }),
        durationMs,
      );
    });
  },
});

export default showStatusBarFlashInjectable;
