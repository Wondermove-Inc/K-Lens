/**
 * PromptBuilder - Fluent interface for composing prompts.
 *
 * Immutable builder pattern for structured prompts with standard rules, roles, tasks, and sections.
 *
 * @example
 * ```typescript
 * const prompt = new PromptBuilder()
 *   .withStandardRules()
 *   .withRole('ObserveAgent@DAIVE')
 *   .withTask('Observe Kubernetes cluster...')
 *   .withSection('ALGORITHM', '1. Step\n2. Step')
 *   .build();
 * ```
 */

import { EMOJI_PROHIBITION, LANGUAGE_INSTRUCTION, OUTPUT_FORMAT_RULES, STANDARD_RULES } from "../partials";

/** Internal state for PromptBuilder */
interface PromptBuilderState {
  standardRules: string[];
  role: string;
  task: string;
  sections: Map<string, string>;
  rawContents: string[];
}

/** PromptBuilder - Immutable builder for composing prompts with fluent interface */
export class PromptBuilder {
  private readonly state: PromptBuilderState;

  constructor(initialState?: PromptBuilderState) {
    this.state = initialState ?? {
      standardRules: [],
      role: "",
      task: "",
      sections: new Map(),
      rawContents: [],
    };
  }

  /** Creates a clone with updated state (ensures immutability) */
  private clone(updates: Partial<PromptBuilderState>): PromptBuilder {
    return new PromptBuilder({
      standardRules: [...this.state.standardRules],
      role: this.state.role,
      task: this.state.task,
      sections: new Map(this.state.sections),
      rawContents: [...this.state.rawContents],
      ...updates,
    });
  }

  /** Adds STANDARD_RULES (language + emoji + output format) */
  withStandardRules(): PromptBuilder {
    return this.clone({
      standardRules: [...this.state.standardRules, STANDARD_RULES],
    });
  }

  /** Adds LANGUAGE_INSTRUCTION only */
  withLanguageRules(): PromptBuilder {
    return this.clone({
      standardRules: [...this.state.standardRules, LANGUAGE_INSTRUCTION],
    });
  }

  /** Adds EMOJI_PROHIBITION only */
  withEmojiProhibition(): PromptBuilder {
    return this.clone({
      standardRules: [...this.state.standardRules, EMOJI_PROHIBITION],
    });
  }

  /** Adds OUTPUT_FORMAT_RULES only */
  withOutputFormat(): PromptBuilder {
    return this.clone({
      standardRules: [...this.state.standardRules, OUTPUT_FORMAT_RULES],
    });
  }

  /** Sets the [ROLE] section */
  withRole(role: string): PromptBuilder {
    if (!role) return this;
    return this.clone({ role });
  }

  /** Sets the [TASK] section */
  withTask(task: string): PromptBuilder {
    if (!task) return this;
    return this.clone({ task });
  }

  /** Adds a custom section [NAME]\ncontent */
  withSection(name: string, content: string): PromptBuilder {
    if (!name || !content) return this;
    const newSections = new Map(this.state.sections);
    newSections.set(name, content);
    return this.clone({ sections: newSections });
  }

  /** Adds raw content without formatting */
  withRawContent(content: string): PromptBuilder {
    if (!content) return this;
    return this.clone({
      rawContents: [...this.state.rawContents, content],
    });
  }

  /** Adds [CONTEXT] section (alias for withSection) */
  withContext(context: string | Record<string, any>): PromptBuilder {
    const content =
      typeof context === "string"
        ? context
        : Object.entries(context)
            .map(([key, value]) => `- ${key}: ${value}`)
            .join("\n");
    return this.withSection("CONTEXT", content);
  }

  /** Adds [OUTPUT] section (alias for withSection) */
  withOutput(format: string): PromptBuilder {
    return this.withSection("OUTPUT", format);
  }

  /** Adds [CONSTRAINTS] section (alias for withSection) */
  withConstraints(constraints: string): PromptBuilder {
    return this.withSection("CONSTRAINTS", constraints);
  }

  /** Builds the prompt and registers it to the registry */
  buildAndRegister(registry: any, key: string, metadata?: any): string {
    const content = this.build();
    registry.register(key, content, metadata);
    return content;
  }

  /** Builds the final prompt (order: rules -> role -> task -> sections -> raw) */
  build(): string {
    const parts: string[] = [];
    if (this.state.standardRules.length > 0) parts.push(...this.state.standardRules);
    if (this.state.role) parts.push(`[ROLE] ${this.state.role}`);
    if (this.state.task) parts.push(`[TASK]\n${this.state.task}`);
    if (this.state.sections.size > 0) {
      for (const [name, content] of this.state.sections) {
        parts.push(`[${name}]\n${content}`);
      }
    }
    if (this.state.rawContents.length > 0) parts.push(...this.state.rawContents);
    return parts.join("\n\n").trim();
  }
}
