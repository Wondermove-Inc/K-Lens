const INPUT_VALIDATION_EMPTY = "Please enter a message.";
const INPUT_VALIDATION_TOO_LONG = (max: number) => `Message is too long. (max ${max.toLocaleString()} characters)`;
const INPUT_VALIDATION_TOO_MANY_TOKENS = (max: number) => `Message is too long. (max ~${max.toLocaleString()} tokens)`;

// 약 24만 문자(평균 4 chars/token)까지 허용하여 모델 컨텍스트(128K 토큰) 대비 여유를 둔다.
const DEFAULT_MAX_LENGTH = 240000;
// GPT‑4o 등 최소 컨텍스트 128K 토큰 중 절반 이하로 안전선을 잡는다.
const DEFAULT_MAX_TOKENS = 64000;

export interface ValidationOptions {
  maxLength?: number;
  maxTokens?: number;
}

export interface ValidationResult {
  ok: boolean;
  reason?: string;
  code?: "empty" | "too_long" | "too_many_tokens";
}

const estimateTokenCount = (text: string): number => {
  if (!text.trim()) {
    return 0;
  }

  return Math.ceil(text.length / 4);
};

export const validateUserInput = (text: string, options: ValidationOptions = {}): ValidationResult => {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      ok: false,
      code: "empty",
      reason: INPUT_VALIDATION_EMPTY,
    };
  }

  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
  if (trimmed.length > maxLength) {
    return {
      ok: false,
      code: "too_long",
      reason: INPUT_VALIDATION_TOO_LONG(maxLength),
    };
  }

  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const tokenCount = estimateTokenCount(trimmed);
  if (tokenCount > maxTokens) {
    return {
      ok: false,
      code: "too_many_tokens",
      reason: INPUT_VALIDATION_TOO_MANY_TOKENS(maxTokens),
    };
  }

  return { ok: true };
};
