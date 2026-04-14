/**
 * 🎯 목적: MCP Servers Preference 탭/페이지 테스트
 * 02: Preferences에 MCP Settings 탭 추가
 *
 * @packageDocumentation
 */

import { createContainer } from "@ogre-tools/injectable";
import mcpServersPreferencePageInjectable from "../mcp-servers-preference-page.injectable";
import mcpServersPreferenceTabInjectable from "../mcp-servers-preference-tab.injectable";

describe("MCP Servers Preference", () => {
  describe("탭 정의", () => {
    it("올바른 kind를 가져야 함", () => {
      const di = createContainer("test");
      di.register(mcpServersPreferenceTabInjectable);
      const tab = di.inject(mcpServersPreferenceTabInjectable);

      expect(tab.kind).toBe("tab");
    });

    it("올바른 id를 가져야 함", () => {
      const di = createContainer("test");
      di.register(mcpServersPreferenceTabInjectable);
      const tab = di.inject(mcpServersPreferenceTabInjectable);

      expect(tab.id).toBe("mcp-servers-tab");
    });

    it("general-tab-group의 자식이어야 함", () => {
      const di = createContainer("test");
      di.register(mcpServersPreferenceTabInjectable);
      const tab = di.inject(mcpServersPreferenceTabInjectable);

      expect(tab.parentId).toBe("general-tab-group");
    });

    it("pathId가 mcp-servers이어야 함", () => {
      const di = createContainer("test");
      di.register(mcpServersPreferenceTabInjectable);
      const tab = di.inject(mcpServersPreferenceTabInjectable);

      expect(tab.pathId).toBe("mcp-servers");
    });

    it("라벨이 MCP Servers이어야 함", () => {
      const di = createContainer("test");
      di.register(mcpServersPreferenceTabInjectable);
      const tab = di.inject(mcpServersPreferenceTabInjectable);

      expect(tab.label).toBe("MCP Servers");
    });

    it("아이콘이 plug이어야 함", () => {
      const di = createContainer("test");
      di.register(mcpServersPreferenceTabInjectable);
      const tab = di.inject(mcpServersPreferenceTabInjectable);

      expect(tab.iconName).toBe("plug");
    });

    it("순서가 45이어야 함 (Kubernetes 다음)", () => {
      const di = createContainer("test");
      di.register(mcpServersPreferenceTabInjectable);
      const tab = di.inject(mcpServersPreferenceTabInjectable);

      expect(tab.orderNumber).toBe(45);
    });
  });

  describe("페이지 정의", () => {
    it("올바른 kind를 가져야 함", () => {
      const di = createContainer("test");
      di.register(mcpServersPreferencePageInjectable);
      const page = di.inject(mcpServersPreferencePageInjectable);

      expect(page.kind).toBe("page");
    });

    it("올바른 id를 가져야 함", () => {
      const di = createContainer("test");
      di.register(mcpServersPreferencePageInjectable);
      const page = di.inject(mcpServersPreferencePageInjectable);

      expect(page.id).toBe("mcp-servers-page");
    });

    it("mcp-servers-tab의 자식이어야 함", () => {
      const di = createContainer("test");
      di.register(mcpServersPreferencePageInjectable);
      const page = di.inject(mcpServersPreferencePageInjectable);

      expect(page.parentId).toBe("mcp-servers-tab");
    });

    it("Component가 정의되어야 함", () => {
      const di = createContainer("test");
      di.register(mcpServersPreferencePageInjectable);
      const page = di.inject(mcpServersPreferencePageInjectable);

      expect(page.Component).toBeDefined();
    });
  });
});
