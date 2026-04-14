/**
 * 🎯 목적: SlashCommandState 상태 관리 테스트
 * 01: slashCommandState 상태 및 액션 추가
 *
 * @packageDocumentation
 */

import { slashCommandState } from "../slash-command-state";
import { SlashCommandId } from "../slash-commands";

describe("SlashCommandState 상태 관리", () => {
  beforeEach(() => {
    // 각 테스트 전 상태 초기화
    slashCommandState.reset();
  });

  describe("초기 상태", () => {
    it("AC1: 초기 상태가 올바르게 설정되어야 한다", () => {
      expect(slashCommandState.isOpen).toBe(false);
      expect(slashCommandState.searchQuery).toBe("");
      expect(slashCommandState.selectedIndex).toBe(0);
    });
  });

  describe("팔레트 열기/닫기", () => {
    it("AC2: openPalette()로 팔레트를 열 수 있어야 한다", () => {
      slashCommandState.openPalette();

      expect(slashCommandState.isOpen).toBe(true);
      expect(slashCommandState.searchQuery).toBe("");
      expect(slashCommandState.selectedIndex).toBe(0);
    });

    it("AC3: closePalette()로 팔레트를 닫을 수 있어야 한다", () => {
      slashCommandState.openPalette();
      slashCommandState.closePalette();

      expect(slashCommandState.isOpen).toBe(false);
    });

    it("closePalette() 호출 시 검색어와 인덱스가 초기화되어야 한다", () => {
      slashCommandState.openPalette();
      slashCommandState.setSearchQuery("test");
      slashCommandState.setSelectedIndex(5);
      slashCommandState.closePalette();

      expect(slashCommandState.searchQuery).toBe("");
      expect(slashCommandState.selectedIndex).toBe(0);
    });
  });

  describe("검색어 관리", () => {
    it("AC4: setSearchQuery()로 검색어를 설정할 수 있어야 한다", () => {
      slashCommandState.setSearchQuery("pods");

      expect(slashCommandState.searchQuery).toBe("pods");
    });

    it("검색어 변경 시 selectedIndex가 0으로 리셋되어야 한다", () => {
      slashCommandState.setSelectedIndex(5);
      slashCommandState.setSearchQuery("new query");

      expect(slashCommandState.selectedIndex).toBe(0);
    });
  });

  describe("선택 인덱스 관리", () => {
    it("AC5: setSelectedIndex()로 선택 인덱스를 설정할 수 있어야 한다", () => {
      slashCommandState.setSelectedIndex(3);

      expect(slashCommandState.selectedIndex).toBe(3);
    });

    it("moveSelection('down')으로 다음 항목을 선택할 수 있어야 한다", () => {
      slashCommandState.moveSelection("down");

      expect(slashCommandState.selectedIndex).toBe(1);
    });

    it("moveSelection('up')으로 이전 항목을 선택할 수 있어야 한다", () => {
      slashCommandState.setSelectedIndex(3);
      slashCommandState.moveSelection("up");

      expect(slashCommandState.selectedIndex).toBe(2);
    });

    it("첫 번째 항목에서 up은 0을 유지해야 한다", () => {
      slashCommandState.setSelectedIndex(0);
      slashCommandState.moveSelection("up");

      expect(slashCommandState.selectedIndex).toBe(0);
    });
  });

  describe("슬래시 입력 감지", () => {
    it("AC6: detectSlashInput()이 / 입력을 감지해야 한다", () => {
      const result = slashCommandState.detectSlashInput("/");

      expect(result).toBe(true);
      expect(slashCommandState.isOpen).toBe(true);
    });

    it("슬래시로 시작하는 문자열을 감지해야 한다", () => {
      const result = slashCommandState.detectSlashInput("/pods");

      expect(result).toBe(true);
      expect(slashCommandState.isOpen).toBe(true);
      expect(slashCommandState.searchQuery).toBe("pods");
    });

    it("슬래시가 없으면 false를 반환해야 한다", () => {
      const result = slashCommandState.detectSlashInput("hello");

      expect(result).toBe(false);
      expect(slashCommandState.isOpen).toBe(false);
    });

    it("빈 문자열이면 false를 반환해야 한다", () => {
      const result = slashCommandState.detectSlashInput("");

      expect(result).toBe(false);
    });
  });

  describe("명령어 실행", () => {
    it("AC7: executeCommand()가 명령어를 실행하고 팔레트를 닫아야 한다", () => {
      slashCommandState.openPalette();

      const command = slashCommandState.executeCommand(SlashCommandId.CLEAR);

      expect(command).toBeDefined();
      expect(command?.id).toBe(SlashCommandId.CLEAR);
      expect(slashCommandState.isOpen).toBe(false);
    });

    it("존재하지 않는 명령어는 undefined를 반환해야 한다", () => {
      const command = slashCommandState.executeCommand("not-exist" as any);

      expect(command).toBeUndefined();
    });
  });

  describe("리셋", () => {
    it("reset()으로 모든 상태를 초기화할 수 있어야 한다", () => {
      slashCommandState.openPalette();
      slashCommandState.setSearchQuery("test");
      slashCommandState.setSelectedIndex(5);

      slashCommandState.reset();

      expect(slashCommandState.isOpen).toBe(false);
      expect(slashCommandState.searchQuery).toBe("");
      expect(slashCommandState.selectedIndex).toBe(0);
    });
  });

  describe("필터링된 명령어", () => {
    it("AC8: filteredCommands가 검색어에 따라 필터링되어야 한다", () => {
      slashCommandState.setSearchQuery("pod");

      const filtered = slashCommandState.filteredCommands;

      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.some((cmd) => cmd.id === SlashCommandId.PODS)).toBe(true);
    });

    it("검색어가 비어있으면 모든 명령어를 반환해야 한다", () => {
      slashCommandState.setSearchQuery("");

      const filtered = slashCommandState.filteredCommands;

      expect(filtered.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe("현재 선택된 명령어", () => {
    it("AC9: currentCommand가 현재 선택된 명령어를 반환해야 한다", () => {
      slashCommandState.setSelectedIndex(0);

      const current = slashCommandState.currentCommand;

      expect(current).toBeDefined();
    });

    it("인덱스가 범위를 벗어나면 undefined를 반환해야 한다", () => {
      slashCommandState.setSelectedIndex(999);

      const current = slashCommandState.currentCommand;

      expect(current).toBeUndefined();
    });
  });
});
