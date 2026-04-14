/**
 * PromptBuilder 테스트
 *
 * PHASE 1-3: PromptBuilder 구현
 *
 * Acceptance Criteria:
 * - AC1: PromptBuilder 클래스 구현 (Fluent Interface)
 * - AC2: withStandardRules() - STANDARD_RULES 자동 적용
 * - AC3: withLanguageRules() - 언어 규칙만
 * - AC4: withEmojiProhibition() - 이모지 금지만
 * - AC5: withOutputFormat() - 출력 포맷만
 * - AC6: withRole(role: string) - [ROLE] 섹션
 * - AC7: withTask(task: string) - [TASK] 섹션
 * - AC8: withSection(name: string, content: string) - 커스텀 섹션
 * - AC9: withRawContent(content: string) - 원시 내용
 * - AC10: build() - 최종 프롬프트 생성
 * - AC11: 테스트 커버리지 80%+
 *
 * @module prompt-builder.test
 */

import { EMOJI_PROHIBITION, LANGUAGE_INSTRUCTION, OUTPUT_FORMAT_RULES, STANDARD_RULES } from "../../partials";
import { PromptBuilder } from "../prompt-builder";

describe("PHASE 1-3: PromptBuilder", () => {
  /**
   * AC1: PromptBuilder 클래스 구현 (Fluent Interface)
   */
  describe("AC1: Fluent Interface", () => {
    it("PromptBuilder 인스턴스 생성 가능", () => {
      const builder = new PromptBuilder();
      expect(builder).toBeInstanceOf(PromptBuilder);
    });

    it("체이닝 가능 - 각 메서드는 새 인스턴스 반환", () => {
      const builder1 = new PromptBuilder();
      const builder2 = builder1.withRole("Agent");

      expect(builder2).toBeInstanceOf(PromptBuilder);
      expect(builder2).not.toBe(builder1); // 불변성 보장
    });

    it("긴 체이닝 동작", () => {
      const builder = new PromptBuilder()
        .withStandardRules()
        .withRole("TestAgent@DAIVE")
        .withTask("Perform test task")
        .withSection("EXAMPLE", "Example content");

      expect(builder).toBeInstanceOf(PromptBuilder);
    });
  });

  /**
   * AC2: withStandardRules() - STANDARD_RULES 자동 적용
   */
  describe("AC2: withStandardRules()", () => {
    it("STANDARD_RULES 포함", () => {
      const prompt = new PromptBuilder().withStandardRules().build();

      expect(prompt).toContain("[LANGUAGE_REQUIREMENT]");
      expect(prompt).toContain("[EMOJI_PROHIBITION");
      expect(prompt).toContain("[OUTPUT_RULES]");
    });

    it("STANDARD_RULES가 프롬프트 시작 부분에 위치", () => {
      const prompt = new PromptBuilder().withStandardRules().withRole("Agent").build();

      const languageIndex = prompt.indexOf("[LANGUAGE_REQUIREMENT]");
      const roleIndex = prompt.indexOf("[ROLE]");

      expect(languageIndex).toBeLessThan(roleIndex);
    });
  });

  /**
   * AC3: withLanguageRules() - 언어 규칙만
   */
  describe("AC3: withLanguageRules()", () => {
    it("LANGUAGE_INSTRUCTION만 포함", () => {
      const prompt = new PromptBuilder().withLanguageRules().build();

      expect(prompt).toContain("[LANGUAGE_REQUIREMENT]");
      expect(prompt).not.toContain("[EMOJI_PROHIBITION");
      expect(prompt).not.toContain("[OUTPUT_RULES]");
    });

    it("언어 규칙 내용 검증", () => {
      const prompt = new PromptBuilder().withLanguageRules().build();

      expect(prompt).toContain("SAME LANGUAGE");
      expect(prompt).toContain("Korean -> Respond in Korean");
    });
  });

  /**
   * AC4: withEmojiProhibition() - 이모지 금지만
   */
  describe("AC4: withEmojiProhibition()", () => {
    it("EMOJI_PROHIBITION만 포함", () => {
      const prompt = new PromptBuilder().withEmojiProhibition().build();

      expect(prompt).toContain("[EMOJI_PROHIBITION");
      expect(prompt).not.toContain("[LANGUAGE_REQUIREMENT]");
      expect(prompt).not.toContain("[OUTPUT_RULES]");
    });

    it("이모지 금지 내용 검증", () => {
      const prompt = new PromptBuilder().withEmojiProhibition().build();

      expect(prompt).toContain("FORBIDDEN");
      expect(prompt).toContain("Unicode emojis");
    });
  });

  /**
   * AC5: withOutputFormat() - 출력 포맷만
   */
  describe("AC5: withOutputFormat()", () => {
    it("OUTPUT_FORMAT_RULES만 포함", () => {
      const prompt = new PromptBuilder().withOutputFormat().build();

      expect(prompt).toContain("[OUTPUT_RULES]");
      expect(prompt).not.toContain("[LANGUAGE_REQUIREMENT]");
      expect(prompt).not.toContain("[EMOJI_PROHIBITION");
    });

    it("출력 포맷 규칙 내용 검증", () => {
      const prompt = new PromptBuilder().withOutputFormat().build();

      expect(prompt).toContain("FORBIDDEN");
      expect(prompt).toContain("REQUIRED");
      expect(prompt).toContain("Markdown tables");
    });
  });

  /**
   * AC6: withRole(role: string) - [ROLE] 섹션
   */
  describe("AC6: withRole()", () => {
    it("[ROLE] 섹션 생성", () => {
      const prompt = new PromptBuilder().withRole("ObserveAgent@DAIVE").build();

      expect(prompt).toContain("[ROLE] ObserveAgent@DAIVE");
    });

    it("빈 role 전달 시 섹션 생략", () => {
      const prompt = new PromptBuilder().withRole("").build();

      expect(prompt).not.toContain("[ROLE]");
    });

    it("role 체이닝 시 마지막 값 사용", () => {
      const prompt = new PromptBuilder().withRole("FirstAgent").withRole("SecondAgent").build();

      expect(prompt).toContain("SecondAgent");
      expect(prompt).not.toContain("FirstAgent");
    });
  });

  /**
   * AC7: withTask(task: string) - [TASK] 섹션
   */
  describe("AC7: withTask()", () => {
    it("[TASK] 섹션 생성", () => {
      const prompt = new PromptBuilder().withTask("Observe Kubernetes cluster state").build();

      expect(prompt).toContain("[TASK]");
      expect(prompt).toContain("Observe Kubernetes cluster state");
    });

    it("빈 task 전달 시 섹션 생략", () => {
      const prompt = new PromptBuilder().withTask("").build();

      expect(prompt).not.toContain("[TASK]");
    });

    it("다중 라인 task 지원", () => {
      const multilineTask = `Step 1: Analyze symptoms
Step 2: Form hypothesis
Step 3: Validate`;

      const prompt = new PromptBuilder().withTask(multilineTask).build();

      expect(prompt).toContain("Step 1: Analyze symptoms");
      expect(prompt).toContain("Step 2: Form hypothesis");
      expect(prompt).toContain("Step 3: Validate");
    });
  });

  /**
   * AC8: withSection(name: string, content: string) - 커스텀 섹션
   */
  describe("AC8: withSection()", () => {
    it("커스텀 섹션 생성", () => {
      const prompt = new PromptBuilder().withSection("ALGORITHM", "1. Step one\n2. Step two").build();

      expect(prompt).toContain("[ALGORITHM]");
      expect(prompt).toContain("1. Step one");
      expect(prompt).toContain("2. Step two");
    });

    it("여러 커스텀 섹션 추가 가능", () => {
      const prompt = new PromptBuilder()
        .withSection("PREREQUISITES", "Requirement 1")
        .withSection("ALGORITHM", "Step 1")
        .withSection("OUTPUT_FORMAT", "JSON format")
        .build();

      expect(prompt).toContain("[PREREQUISITES]");
      expect(prompt).toContain("[ALGORITHM]");
      expect(prompt).toContain("[OUTPUT_FORMAT]");
    });

    it("빈 섹션명 또는 내용 시 섹션 생략", () => {
      const prompt = new PromptBuilder().withSection("", "content").withSection("NAME", "").build();

      expect(prompt.trim()).toBe("");
    });

    it("같은 섹션명 중복 시 마지막 값 사용", () => {
      const prompt = new PromptBuilder()
        .withSection("ALGORITHM", "First algorithm")
        .withSection("ALGORITHM", "Second algorithm")
        .build();

      expect(prompt).toContain("Second algorithm");
      expect(prompt).not.toContain("First algorithm");
    });
  });

  /**
   * AC9: withRawContent(content: string) - 원시 내용
   */
  describe("AC9: withRawContent()", () => {
    it("원시 내용 그대로 추가", () => {
      const rawContent = "This is raw content without any formatting.";
      const prompt = new PromptBuilder().withRawContent(rawContent).build();

      expect(prompt).toContain(rawContent);
    });

    it("여러 원시 내용 추가 시 모두 포함", () => {
      const prompt = new PromptBuilder()
        .withRawContent("First raw content")
        .withRawContent("Second raw content")
        .build();

      expect(prompt).toContain("First raw content");
      expect(prompt).toContain("Second raw content");
    });

    it("원시 내용은 섹션 뒤에 위치", () => {
      const prompt = new PromptBuilder().withRole("Agent").withRawContent("Raw content").build();

      const roleIndex = prompt.indexOf("[ROLE]");
      const rawIndex = prompt.indexOf("Raw content");

      expect(rawIndex).toBeGreaterThan(roleIndex);
    });
  });

  /**
   * AC10: build() - 최종 프롬프트 생성
   */
  describe("AC10: build()", () => {
    it("빈 builder는 빈 문자열 반환", () => {
      const prompt = new PromptBuilder().build();

      expect(prompt).toBe("");
    });

    it("전체 프롬프트 구조 검증", () => {
      const prompt = new PromptBuilder()
        .withStandardRules()
        .withRole("ObserveAgent@DAIVE")
        .withTask("Observe Kubernetes cluster")
        .withSection("ALGORITHM", "1. Collect data\n2. Analyze")
        .withRawContent("Note: Use kubectl commands")
        .build();

      // 순서 검증
      const indices = {
        language: prompt.indexOf("[LANGUAGE_REQUIREMENT]"),
        emoji: prompt.indexOf("[EMOJI_PROHIBITION"),
        output: prompt.indexOf("[OUTPUT_RULES]"),
        role: prompt.indexOf("[ROLE]"),
        task: prompt.indexOf("[TASK]"),
        algorithm: prompt.indexOf("[ALGORITHM]"),
        raw: prompt.indexOf("Note: Use kubectl"),
      };

      expect(indices.language).toBeLessThan(indices.emoji);
      expect(indices.emoji).toBeLessThan(indices.output);
      expect(indices.output).toBeLessThan(indices.role);
      expect(indices.role).toBeLessThan(indices.task);
      expect(indices.task).toBeLessThan(indices.algorithm);
      expect(indices.algorithm).toBeLessThan(indices.raw);
    });

    it("동일한 builder에서 여러 번 build() 호출 시 같은 결과", () => {
      const builder = new PromptBuilder().withRole("Agent").withTask("Test task");

      const prompt1 = builder.build();
      const prompt2 = builder.build();

      expect(prompt1).toBe(prompt2);
    });
  });

  /**
   * 통합 테스트: 실제 사용 시나리오
   */
  describe("통합 테스트", () => {
    it("진단 프롬프트 구성 시나리오", () => {
      const prompt = new PromptBuilder()
        .withStandardRules()
        .withRole("ObserveAgent@DAIVE - Kubernetes Cluster Observation Expert")
        .withTask(
          "Observe Kubernetes cluster state and collect symptoms.\nInvestigate related resources based on user's question/problem description.",
        )
        .withSection(
          "ALGORITHM",
          `1. Analyze symptoms from collectedData
2. Extract problem states (CrashLoopBackOff, Pending, etc.)
3. Extract Warning events
4. Extract detailed error messages`,
        )
        .withSection(
          "OUTPUT_FORMAT",
          `1. symptoms: Symptom list (string array)
2. observedResources: Observed resources list (optional)
3. rawObservations: Raw observation data (optional)`,
        )
        .build();

      expect(prompt).toContain("[LANGUAGE_REQUIREMENT]");
      expect(prompt).toContain("[EMOJI_PROHIBITION");
      expect(prompt).toContain("[OUTPUT_RULES]");
      expect(prompt).toContain("[ROLE] ObserveAgent@DAIVE");
      expect(prompt).toContain("[TASK]");
      expect(prompt).toContain("[ALGORITHM]");
      expect(prompt).toContain("[OUTPUT_FORMAT]");
      expect(prompt).toContain("Observe Kubernetes cluster state");
    });

    it("최소 프롬프트 구성", () => {
      const prompt = new PromptBuilder().withRole("SimpleAgent").withTask("Simple task").build();

      expect(prompt).toContain("[ROLE] SimpleAgent");
      expect(prompt).toContain("[TASK]");
      expect(prompt).toContain("Simple task");
      expect(prompt.length).toBeLessThan(200);
    });

    it("커스텀 규칙 조합", () => {
      const prompt = new PromptBuilder().withLanguageRules().withEmojiProhibition().withRole("CustomAgent").build();

      expect(prompt).toContain("[LANGUAGE_REQUIREMENT]");
      expect(prompt).toContain("[EMOJI_PROHIBITION");
      expect(prompt).not.toContain("[OUTPUT_RULES]");
      expect(prompt).toContain("[ROLE] CustomAgent");
    });
  });

  /**
   * 불변성 테스트
   */
  describe("불변성 (Immutability)", () => {
    it("각 메서드는 새 인스턴스 반환", () => {
      const builder1 = new PromptBuilder();
      const builder2 = builder1.withRole("Agent");
      const builder3 = builder2.withTask("Task");

      expect(builder1).not.toBe(builder2);
      expect(builder2).not.toBe(builder3);
    });

    it("원본 builder는 변경되지 않음", () => {
      const original = new PromptBuilder().withRole("OriginalAgent");
      const originalPrompt = original.build();

      const modified = original.withTask("New task");
      const modifiedPrompt = modified.build();

      expect(originalPrompt).not.toContain("New task");
      expect(modifiedPrompt).toContain("New task");
    });
  });

  /**
   * 엣지 케이스
   */
  describe("엣지 케이스", () => {
    it("null/undefined 처리", () => {
      const prompt = new PromptBuilder()
        .withRole(null as any)
        .withTask(undefined as any)
        .withSection(null as any, "content")
        .withSection("name", undefined as any)
        .build();

      expect(prompt.trim()).toBe("");
    });

    it("매우 긴 내용 처리", () => {
      const longContent = "A".repeat(10000);
      const prompt = new PromptBuilder().withTask(longContent).build();

      expect(prompt).toContain(longContent);
      expect(prompt.length).toBeGreaterThan(10000);
    });

    it("특수 문자 처리", () => {
      const specialChars = "Special: <>&\"'[]{}()`;";
      const prompt = new PromptBuilder().withTask(specialChars).build();

      expect(prompt).toContain(specialChars);
    });

    it("중복된 standard rules 호출", () => {
      const prompt = new PromptBuilder().withStandardRules().withStandardRules().build();

      // STANDARD_RULES가 두 번 포함되어야 함
      const matches = prompt.match(/\[LANGUAGE_REQUIREMENT\]/g);
      expect(matches).toHaveLength(2);
    });
  });
});
