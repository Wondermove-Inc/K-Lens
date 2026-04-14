/**
 * 🎯 목적: MentionState 상태 관리 단위 테스트
 * 01: mentionState 상태 및 액션 추가
 *
 * @packageDocumentation
 */

import { MentionState, mentionState } from "../mention-state";

describe("MentionState 상태 관리", () => {
  beforeEach(() => {
    // 각 테스트 전 상태 초기화
    mentionState.reset();
  });

  describe("초기 상태", () => {
    it("isOpen은 false여야 한다", () => {
      expect(mentionState.isOpen).toBe(false);
    });

    it("query는 빈 문자열이어야 한다", () => {
      expect(mentionState.query).toBe("");
    });

    it("position은 { top: 0, left: 0 }이어야 한다", () => {
      expect(mentionState.position).toEqual({ top: 0, left: 0 });
    });

    it("selectedIndex는 0이어야 한다", () => {
      expect(mentionState.selectedIndex).toBe(0);
    });

    it("triggerIndex는 -1이어야 한다", () => {
      expect(mentionState.triggerIndex).toBe(-1);
    });
  });

  describe("openMention", () => {
    it("AC2: position 설정 및 isOpen=true 해야 한다", () => {
      mentionState.openMention({ top: 100, left: 50 }, 10);

      expect(mentionState.isOpen).toBe(true);
      expect(mentionState.position).toEqual({ top: 100, left: 50 });
      expect(mentionState.triggerIndex).toBe(10);
    });

    it("openMention 시 query와 selectedIndex는 초기화되어야 한다", () => {
      // 먼저 쿼리 설정
      mentionState.updateQuery("test");
      mentionState.setSelectedIndex(5);

      // 새로 열기
      mentionState.openMention({ top: 100, left: 50 }, 10);

      expect(mentionState.query).toBe("");
      expect(mentionState.selectedIndex).toBe(0);
    });
  });

  describe("closeMention", () => {
    it("AC3: 상태가 초기화되어야 한다", () => {
      // 상태 설정
      mentionState.openMention({ top: 100, left: 50 }, 10);
      mentionState.updateQuery("test");
      mentionState.setSelectedIndex(3);

      // 닫기
      mentionState.closeMention();

      expect(mentionState.isOpen).toBe(false);
      expect(mentionState.query).toBe("");
      expect(mentionState.position).toEqual({ top: 0, left: 0 });
      expect(mentionState.selectedIndex).toBe(0);
      expect(mentionState.triggerIndex).toBe(-1);
    });
  });

  describe("updateQuery", () => {
    it("AC4: 쿼리가 업데이트되어야 한다", () => {
      mentionState.updateQuery("nginx");

      expect(mentionState.query).toBe("nginx");
    });

    it("AC4: selectedIndex가 리셋되어야 한다", () => {
      mentionState.setSelectedIndex(5);
      mentionState.updateQuery("nginx");

      expect(mentionState.selectedIndex).toBe(0);
    });
  });

  describe("setSelectedIndex", () => {
    it("인덱스가 설정되어야 한다", () => {
      mentionState.setSelectedIndex(3);

      expect(mentionState.selectedIndex).toBe(3);
    });
  });

  describe("moveSelection", () => {
    it("down 방향으로 인덱스가 증가해야 한다", () => {
      mentionState.moveSelection("down", 10);

      expect(mentionState.selectedIndex).toBe(1);
    });

    it("up 방향으로 인덱스가 감소해야 한다", () => {
      mentionState.setSelectedIndex(3);
      mentionState.moveSelection("up", 10);

      expect(mentionState.selectedIndex).toBe(2);
    });

    it("최대 인덱스를 넘어가지 않아야 한다", () => {
      mentionState.setSelectedIndex(9);
      mentionState.moveSelection("down", 10);

      expect(mentionState.selectedIndex).toBe(9);
    });

    it("최소 인덱스(0) 아래로 내려가지 않아야 한다", () => {
      mentionState.setSelectedIndex(0);
      mentionState.moveSelection("up", 10);

      expect(mentionState.selectedIndex).toBe(0);
    });
  });

  describe("reset", () => {
    it("모든 상태가 초기값으로 돌아가야 한다", () => {
      mentionState.openMention({ top: 100, left: 50 }, 10);
      mentionState.updateQuery("test");
      mentionState.setSelectedIndex(5);

      mentionState.reset();

      expect(mentionState.isOpen).toBe(false);
      expect(mentionState.query).toBe("");
      expect(mentionState.position).toEqual({ top: 0, left: 0 });
      expect(mentionState.selectedIndex).toBe(0);
      expect(mentionState.triggerIndex).toBe(-1);
    });
  });

  describe("detectMentionTrigger", () => {
    it("@ 입력 시 트리거를 감지하고 열어야 한다", () => {
      const result = mentionState.detectMentionTrigger("hello @", 7, { top: 100, left: 50 });

      expect(result).toBe(true);
      expect(mentionState.isOpen).toBe(true);
      expect(mentionState.triggerIndex).toBe(6);
    });

    it("@가 없으면 false 반환하고 열지 않아야 한다", () => {
      const result = mentionState.detectMentionTrigger("hello", 5, { top: 100, left: 50 });

      expect(result).toBe(false);
      expect(mentionState.isOpen).toBe(false);
    });

    it("@ 뒤에 공백이 있으면 닫아야 한다", () => {
      mentionState.openMention({ top: 100, left: 50 }, 6);

      const result = mentionState.detectMentionTrigger("hello @pod ", 11, { top: 100, left: 50 });

      expect(result).toBe(false);
      expect(mentionState.isOpen).toBe(false);
    });
  });

  describe("computed: filterType", () => {
    it("타입 접두사가 있으면 filterType 반환", () => {
      mentionState.updateQuery("pod:nginx");

      expect(mentionState.filterType).toBe("pod");
    });

    it("타입 접두사가 없으면 null 반환", () => {
      mentionState.updateQuery("nginx");

      expect(mentionState.filterType).toBeNull();
    });
  });

  describe("computed: searchQuery", () => {
    it("타입 접두사가 있으면 접두사 제외한 쿼리 반환", () => {
      mentionState.updateQuery("pod:nginx");

      expect(mentionState.searchQuery).toBe("nginx");
    });

    it("타입 접두사가 없으면 전체 쿼리 반환", () => {
      mentionState.updateQuery("nginx");

      expect(mentionState.searchQuery).toBe("nginx");
    });
  });
});
