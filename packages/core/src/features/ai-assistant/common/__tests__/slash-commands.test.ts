/**
 * 🎯 목적: SlashCommand 타입 및 유틸리티 함수 테스트
 * 01: SlashCommand 타입 및 기본 명령어 정의
 * @packageDocumentation
 */

import {
  formatSlashCommandUsage,
  getAllSlashCommands,
  getSlashCommandById,
  getSlashCommandLabel,
  getSlashCommandsByCategory,
  isSlashCommandEnabled,
  parseSlashCommandInput,
  type SlashCommand,
  SlashCommandCategory,
  SlashCommandId,
  searchSlashCommands,
} from "../slash-commands";

describe("SlashCommand 타입 및 유틸리티", () => {
  describe("SlashCommandCategory 상수", () => {
    it("AC1: 필수 카테고리가 정의되어 있어야 한다", () => {
      expect(SlashCommandCategory.GENERAL).toBe("general");
      expect(SlashCommandCategory.KUBERNETES).toBe("kubernetes");
      expect(SlashCommandCategory.DIAGNOSTICS).toBe("diagnostics");
      expect(SlashCommandCategory.NAVIGATION).toBe("navigation");
    });
  });

  describe("SlashCommandId 상수", () => {
    it("AC2: 기본 명령어 ID가 정의되어 있어야 한다", () => {
      // General 명령어
      expect(SlashCommandId.CLEAR).toBe("clear");
      expect(SlashCommandId.NEW).toBe("new");

      // Kubernetes 명령어
      expect(SlashCommandId.PODS).toBe("pods");
      expect(SlashCommandId.DEPLOYMENTS).toBe("deployments");
      expect(SlashCommandId.SERVICES).toBe("services");
      expect(SlashCommandId.LOGS).toBe("logs");

      // Diagnostics 명령어
      expect(SlashCommandId.DIAGNOSE).toBe("diagnose");
      expect(SlashCommandId.METRICS).toBe("metrics");
      expect(SlashCommandId.EVENTS).toBe("events");

      // Infrastructure 명령어
      expect(SlashCommandId.DEVOPS).toBe("devops");
      expect(SlashCommandId.FINOPS).toBe("finops");
    });
  });

  describe("getSlashCommandById", () => {
    it("AC3: ID로 명령어를 조회할 수 있어야 한다", () => {
      const clearCmd = getSlashCommandById(SlashCommandId.CLEAR);
      expect(clearCmd).toBeDefined();
      expect(clearCmd?.id).toBe(SlashCommandId.CLEAR);
      expect(clearCmd?.name).toBe("/clear");
    });

    it("존재하지 않는 ID는 undefined를 반환해야 한다", () => {
      const notFound = getSlashCommandById("not-exist" as any);
      expect(notFound).toBeUndefined();
    });
  });

  describe("getSlashCommandsByCategory", () => {
    it("AC4: 카테고리별로 명령어를 조회할 수 있어야 한다", () => {
      const generalCmds = getSlashCommandsByCategory(SlashCommandCategory.GENERAL);
      expect(generalCmds.length).toBeGreaterThan(0);
      expect(generalCmds.every((cmd) => cmd.category === SlashCommandCategory.GENERAL)).toBe(true);
    });

    it("Kubernetes 카테고리 명령어가 있어야 한다", () => {
      const k8sCmds = getSlashCommandsByCategory(SlashCommandCategory.KUBERNETES);
      expect(k8sCmds.length).toBeGreaterThan(0);
      expect(k8sCmds.some((cmd) => cmd.id === SlashCommandId.PODS)).toBe(true);
    });
  });

  describe("getAllSlashCommands", () => {
    it("AC5: 모든 명령어 목록을 가져올 수 있어야 한다", () => {
      const allCmds = getAllSlashCommands();
      expect(allCmds.length).toBeGreaterThanOrEqual(10);
    });

    it("활성화된 명령어만 필터링할 수 있어야 한다", () => {
      const enabledCmds = getAllSlashCommands({ enabledOnly: true });
      expect(enabledCmds.every((cmd) => cmd.enabled !== false)).toBe(true);
    });
  });

  describe("getSlashCommandLabel", () => {
    it("명령어의 영문 라벨을 반환해야 한다", () => {
      expect(getSlashCommandLabel(SlashCommandId.CLEAR)).toBe("Clear Chat");
      expect(getSlashCommandLabel(SlashCommandId.PODS)).toBe("Pod List");
      expect(getSlashCommandLabel(SlashCommandId.NEW)).toBe("New Chat");
    });
  });

  describe("searchSlashCommands", () => {
    it("AC6: 검색어로 명령어를 필터링할 수 있어야 한다", () => {
      const results = searchSlashCommands("pod");
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((cmd) => cmd.id === SlashCommandId.PODS)).toBe(true);
    });

    it("대소문자 구분 없이 검색해야 한다", () => {
      const results = searchSlashCommands("POD");
      expect(results.length).toBeGreaterThan(0);
    });

    it("설명에서도 검색해야 한다", () => {
      const results = searchSlashCommands("diagnose");
      expect(results.some((cmd) => cmd.id === SlashCommandId.DIAGNOSE)).toBe(true);
    });

    it("빈 검색어는 모든 명령어를 반환해야 한다", () => {
      const all = getAllSlashCommands();
      const results = searchSlashCommands("");
      expect(results.length).toBe(all.length);
    });
  });

  describe("isSlashCommandEnabled", () => {
    it("활성화된 명령어는 true를 반환해야 한다", () => {
      expect(isSlashCommandEnabled(SlashCommandId.CLEAR)).toBe(true);
    });
  });

  describe("parseSlashCommandInput", () => {
    it("AC7: 슬래시 명령어 입력을 파싱할 수 있어야 한다", () => {
      const result = parseSlashCommandInput("/clear");
      expect(result).toEqual({
        command: "clear",
        args: [],
        raw: "/clear",
      });
    });

    it("인자가 있는 명령어를 파싱할 수 있어야 한다", () => {
      const result = parseSlashCommandInput("/logs nginx-pod --tail 100");
      expect(result).toEqual({
        command: "logs",
        args: ["nginx-pod", "--tail", "100"],
        raw: "/logs nginx-pod --tail 100",
      });
    });

    it("슬래시로 시작하지 않으면 null을 반환해야 한다", () => {
      const result = parseSlashCommandInput("help");
      expect(result).toBeNull();
    });

    it("공백만 있으면 null을 반환해야 한다", () => {
      const result = parseSlashCommandInput("  ");
      expect(result).toBeNull();
    });

    it("슬래시만 있으면 빈 command를 반환해야 한다", () => {
      const result = parseSlashCommandInput("/");
      expect(result).toEqual({
        command: "",
        args: [],
        raw: "/",
      });
    });
  });

  describe("formatSlashCommandUsage", () => {
    it("명령어 사용법을 포맷해야 한다", () => {
      const usage = formatSlashCommandUsage(SlashCommandId.CLEAR);
      expect(usage).toContain("/clear");
    });

    it("인자가 있는 명령어의 사용법을 포맷해야 한다", () => {
      const usage = formatSlashCommandUsage(SlashCommandId.LOGS);
      expect(usage).toContain("<pod-name>");
    });
  });

  describe("SlashCommand 타입", () => {
    it("SlashCommand 객체가 필수 필드를 가져야 한다", () => {
      const cmd = getSlashCommandById(SlashCommandId.CLEAR);
      expect(cmd).toMatchObject({
        id: expect.any(String),
        name: expect.stringMatching(/^\//),
        description: expect.any(String),
        category: expect.any(String),
      });
    });

    it("명령어에 아이콘이 있어야 한다", () => {
      const cmd = getSlashCommandById(SlashCommandId.CLEAR);
      expect(cmd?.icon).toBeDefined();
    });

    it("명령어에 키워드가 있어야 한다", () => {
      const cmd = getSlashCommandById(SlashCommandId.PODS);
      expect(cmd?.keywords).toBeDefined();
      expect(cmd?.keywords?.length).toBeGreaterThan(0);
    });
  });

  describe("명령어 정의 검증", () => {
    it("모든 명령어가 고유한 ID를 가져야 한다", () => {
      const allCmds = getAllSlashCommands();
      const ids = allCmds.map((cmd) => cmd.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("모든 명령어가 고유한 name을 가져야 한다", () => {
      const allCmds = getAllSlashCommands();
      const names = allCmds.map((cmd) => cmd.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it("모든 명령어 name이 슬래시로 시작해야 한다", () => {
      const allCmds = getAllSlashCommands();
      expect(allCmds.every((cmd) => cmd.name.startsWith("/"))).toBe(true);
    });
  });

  // /finops 커맨드는 제거됨
  describe.skip("/finops 커맨드", () => {
    it("AC: /finops 커맨드가 존재해야 한다", () => {
      const finopsCmd = getSlashCommandById(SlashCommandId.FINOPS);
      expect(finopsCmd).toBeDefined();
      expect(finopsCmd?.id).toBe(SlashCommandId.FINOPS);
      expect(finopsCmd?.name).toBe("/finops");
    });

    it("AC: /finops는 INFRASTRUCTURE 카테고리에 속해야 한다", () => {
      const finopsCmd = getSlashCommandById(SlashCommandId.FINOPS);
      expect(finopsCmd?.category).toBe(SlashCommandCategory.INFRASTRUCTURE);
    });

    it("AC: /finops는 behavior.purpose가 정의되어 있어야 한다", () => {
      const finopsCmd = getSlashCommandById(SlashCommandId.FINOPS);
      expect(finopsCmd?.behavior?.purpose).toBeDefined();
      expect(finopsCmd?.behavior?.purpose).toContain("cost");
    });

    it("AC: /finops는 behavior.workflow가 정의되어 있어야 한다", () => {
      const finopsCmd = getSlashCommandById(SlashCommandId.FINOPS);
      expect(finopsCmd?.behavior?.workflow).toBeDefined();
      expect(finopsCmd?.behavior?.workflow?.length).toBeGreaterThanOrEqual(4);
    });

    it("AC: /finops는 behavior.options가 정의되어 있어야 한다", () => {
      const finopsCmd = getSlashCommandById(SlashCommandId.FINOPS);
      expect(finopsCmd?.behavior?.options).toBeDefined();
      expect(finopsCmd?.behavior?.options?.length).toBeGreaterThanOrEqual(2);
    });

    it("AC: /finops는 behavior.examples가 정의되어 있어야 한다", () => {
      const finopsCmd = getSlashCommandById(SlashCommandId.FINOPS);
      expect(finopsCmd?.behavior?.examples).toBeDefined();
      expect(finopsCmd?.behavior?.examples?.length).toBeGreaterThanOrEqual(2);
    });

    it("AC: /finops는 behavior.outputFormat이 정의되어 있어야 한다", () => {
      const finopsCmd = getSlashCommandById(SlashCommandId.FINOPS);
      expect(finopsCmd?.behavior?.outputFormat).toBeDefined();
      expect(finopsCmd?.behavior?.outputFormat).toContain("FinOps");
    });

    it("AC: /finops는 behavior.relatedCommands가 정의되어 있어야 한다", () => {
      const finopsCmd = getSlashCommandById(SlashCommandId.FINOPS);
      expect(finopsCmd?.behavior?.relatedCommands).toBeDefined();
      expect(finopsCmd?.behavior?.relatedCommands).toContain("/metrics");
    });

    it("AC: /finops 키워드에 cost, finops, savings가 포함되어 있어야 한다", () => {
      const finopsCmd = getSlashCommandById(SlashCommandId.FINOPS);
      expect(finopsCmd?.keywords).toContain("cost");
      expect(finopsCmd?.keywords).toContain("finops");
      expect(finopsCmd?.keywords).toContain("savings");
    });

    it("AC: /finops 검색 시 결과에 나타나야 한다", () => {
      const results = searchSlashCommands("cost");
      expect(results.some((cmd) => cmd.id === SlashCommandId.FINOPS)).toBe(true);
    });
  });
});
