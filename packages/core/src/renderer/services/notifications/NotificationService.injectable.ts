import { getInjectable } from "@ogre-tools/injectable";
import { NotificationMessage } from "./types";

import type { BaseMessengerAdapter } from "./BaseMessengerAdapter";

const STORAGE_KEY = "skuberplus-slack-webhook";

interface Settings {
  enabled: boolean;
  webhookUrl: string;
  alertMode: "all" | "critical" | "keywords";
  keywords: string;
}

class NotificationService {
  #settings: Settings = {
    enabled: false,
    webhookUrl: "",
    alertMode: "all",
    keywords: "",
  };

  #adapter: BaseMessengerAdapter | null = null;

  constructor() {
    this.#loadSettings();
  }

  async #loadSettings() {
    try {
      const { safeStorage } = await import('electron');
      const encrypted = localStorage.getItem(STORAGE_KEY);
      if (encrypted) {
        const webhookUrl = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
        if (webhookUrl) {
          this.#settings.webhookUrl = webhookUrl;
          this.#settings.enabled = true;
        }
      }
    } catch (error) {
      console.error("Failed to load notification settings:", error);
    }
  }

  async #saveSettings(webhookUrl: string) {
    try {
      const { safeStorage } = await import('electron');
      const encrypted = safeStorage.encryptString(webhookUrl);
      localStorage.setItem(STORAGE_KEY, encrypted.toString('base64'));
      this.#settings.webhookUrl = webhookUrl;
      this.#settings.enabled = true;
    } catch (error) {
      console.error("Failed to save notification settings:", error);
    }
  }

  async send(msg: NotificationMessage): Promise<void> {
    if (!this.#settings.enabled || !this.#settings.webhookUrl) {
      return;
    }

    if (!this.#shouldSend(msg)) {
      return;
    }

    if (!this.#adapter) {
      const { SlackAdapter } = await import("./SlackAdapter");
      this.#adapter = new SlackAdapter(this.#settings.webhookUrl);
    }

    await this.#adapter.send(msg);
  }

  #shouldSend(msg: NotificationMessage): boolean {
    const { alertMode, keywords } = this.#settings;

    if (alertMode === "all") return true;
    if (alertMode === "critical" && msg.level !== "info") return true;
    if (alertMode === "keywords") {
      const kwArray = keywords
        .toLowerCase()
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      return kwArray.some((kw) => msg.text.toLowerCase().includes(kw));
    }
    return false;
  }

  async setWebhookUrl(webhookUrl: string) {
    await this.#saveSettings(webhookUrl);
  }

  get settings() {
    return { ...this.#settings };
  }

  updateSettings(updates: Partial<Settings>) {
    Object.assign(this.#settings, updates);
  }
}

export const notificationServiceInjectable = getInjectable({
  id: "notification-service-renderer",
  instantiate: () => new NotificationService(),
});
