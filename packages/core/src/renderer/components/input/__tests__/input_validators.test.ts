/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { isEmail, isUrl, systemName, unionInputValidators, unionInputValidatorsAsync } from "../input_validators";

import type { InputValidator } from "../input_validators";

type TextValidationCase = [string, boolean];

describe("input validation tests", () => {
  describe("unionInputValidators()", () => {
    const emailOrUrl = unionInputValidators(
      {
        message: "Not an email or URL",
      },
      isEmail,
      isUrl,
    );

    it.each(["abc@news.com", "abc@news.co.uk"])("Given '%s' is a valid email, emailOrUrl matches", (input) => {
      expect(emailOrUrl.validate(input)).toBe(true);
    });

    it.each([
      "https://example.s3.amazonaws.com/test-file?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20201127%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20201127T123754Z&X-Amz-Expires=300&X-Amz-Signature=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890&X-Amz-SignedHeaders=host",
      "http://www.google.com",
    ])("Given '%s' is a valid url, emailOrUrl matches", (input) => {
      expect(emailOrUrl.validate(input)).toBe(true);
    });

    it.each(["hello", "57"])("Given '%s' is neither a valid email nor URL, emailOrUrl does not match", (input) => {
      expect(emailOrUrl.validate(input)).toBe(false);
    });
  });

  describe("unionInputValidatorsAsync()", () => {
    const emailOrUrl = unionInputValidatorsAsync(
      {
        message: "Not an email or URL",
      },
      isEmail,
      isUrl,
    );

    it.each(["abc@news.com", "abc@news.co.uk"])("Given '%s' is a valid email, emailOrUrl matches", async (input) => {
      try {
        await emailOrUrl.validate(input);
      } catch {
        fail("Should not throw on valid input");
      }
    });

    it.each([
      "https://example.s3.amazonaws.com/test-file?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20201127%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20201127T123754Z&X-Amz-Expires=300&X-Amz-Signature=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890&X-Amz-SignedHeaders=host",
      "http://www.google.com",
    ])("Given '%s' is a valid url, emailOrUrl matches", async (input) => {
      try {
        await emailOrUrl.validate(input);
      } catch {
        fail("Should not throw on valid input");
      }
    });

    it.each(["hello", "57"])(
      "Given '%s' is neither a valid email nor URL, emailOrUrl does not match",
      async (input) => {
        try {
          await emailOrUrl.validate(input);
          fail("Should throw on invalid input");
        } catch {
          // We want this to happen
        }
      },
    );
  });

  describe("isEmail tests", () => {
    const tests: TextValidationCase[] = [
      ["abc@news.com", true],
      ["abc@news.co.uk", true],
      ["abc1.3@news.co.uk", true],
      ["abc1.3@news.name", true],
      ["@news.com", false],
      ["abcnews.co.uk", false],
      ["abc1.3@news", false],
      ["abc1.3@news.name.a.b.c.d.d", false],
    ];

    it.each(tests)("validate %s", (input, output) => {
      expect(isEmail.validate(input)).toBe(output);
    });
  });

  describe("isUrl tests", () => {
    const cases: TextValidationCase[] = [
      [
        "https://example.s3.amazonaws.com/test-file?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20201127%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20201127T123754Z&X-Amz-Expires=300&X-Amz-Signature=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890&X-Amz-SignedHeaders=host",
        true,
      ],
      ["google.ca", false],
      ["", false],
      [".", false],
      ["google.askdgjkhsadjkhdas.dsakljsd", false],
      ["https://google.com", true],
      ["https://example.org", true],
      ["https://www.example.org", true],
    ];

    it.each(cases)("validate %s", (input, output) => {
      expect(isUrl.validate(input)).toBe(output);
    });
  });

  describe("systemName tests", () => {
    const tests: TextValidationCase[] = [
      ["a", true],
      ["ab", true],
      ["abc", true],
      ["1", true],
      ["12", true],
      ["123", true],
      ["1a2", true],
      ["1-2", true],
      ["1---------------2", true],
      ["1---------------2.a", true],
      ["1---------------2.a.1", true],
      ["1---------------2.9-a.1", true],
      ["", false],
      ["-", false],
      [".", false],
      ["as.", false],
      [".asd", false],
      ["a.-", false],
      ["a.1-", false],
      ["o.2-2.", false],
      ["o.2-2....", false],
    ];

    it.each(tests)("validate %s", (input, output) => {
      expect(systemName.validate(input)).toBe(output);
    });
  });

  it("should allow InputValidator to be used without any type params", () => {
    const v: InputValidator = {
      validate: (input: string) => input.length > 10,
    };

    expect(v.validate("hello")).toBe(false);
  });
});
