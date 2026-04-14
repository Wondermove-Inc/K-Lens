/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { validateOpenRouterModelHandler } from "../validate-openrouter-model-channel-responder.injectable";

import type { ValidateOpenRouterModelResponse } from "../../../../common/features/user-preferences/validate-openrouter-model-channel";

/**
 * TDD: OpenRouter Model Validation Handler Tests
 *
 * Test Cases:
 * 1. Valid model ID returns { valid: true }
 * 2. Invalid model ID returns { valid: false, error: "Model not found" }
 * 3. Network error returns { valid: false, error: "Network error: ..." }
 * 4. API error (non-200) returns { valid: false, error: "API error: HTTP ..." }
 */

// Mock fetch globally
global.fetch = jest.fn();

describe("validateOpenRouterModelHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Valid Model ID", () => {
    it("should return valid: true when model exists in OpenRouter catalog", async () => {
      // Given: Mock OpenRouter API response with valid models
      const mockResponse = {
        data: [
          { id: "mistralai/mistral-large", name: "Mistral Large" },
          { id: "anthropic/claude-3-opus", name: "Claude 3 Opus" },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      // When: Validate existing model ID
      const result: ValidateOpenRouterModelResponse = await validateOpenRouterModelHandler({
        modelId: "mistralai/mistral-large",
      });

      // Then: Should return valid
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(global.fetch).toHaveBeenCalledWith("https://openrouter.ai/api/v1/models");
    });

    it("should handle model IDs with special characters", async () => {
      // Given: Mock response with model containing special chars
      const mockResponse = {
        data: [{ id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3" }],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      // When: Validate model with special chars
      const result = await validateOpenRouterModelHandler({
        modelId: "meta-llama/llama-3.3-70b-instruct",
      });

      // Then: Should return valid
      expect(result.valid).toBe(true);
    });
  });

  describe("Invalid Model ID", () => {
    it("should return valid: false when model does not exist", async () => {
      // Given: Mock response without the requested model
      const mockResponse = {
        data: [
          { id: "mistralai/mistral-large", name: "Mistral Large" },
          { id: "anthropic/claude-3-opus", name: "Claude 3 Opus" },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      // When: Validate non-existent model
      const result = await validateOpenRouterModelHandler({
        modelId: "non-existent/model",
      });

      // Then: Should return invalid with error message
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Model not found");
    });

    it("should be case-sensitive for model IDs", async () => {
      // Given: Mock response with lowercase model ID
      const mockResponse = {
        data: [{ id: "mistralai/mistral-large", name: "Mistral Large" }],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      // When: Validate with different case
      const result = await validateOpenRouterModelHandler({
        modelId: "MistralAI/Mistral-Large",
      });

      // Then: Should return invalid
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Model not found");
    });

    it("should handle empty model ID", async () => {
      // Given: Mock successful API call
      const mockResponse = { data: [] };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      // When: Validate empty string
      const result = await validateOpenRouterModelHandler({
        modelId: "",
      });

      // Then: Should return invalid
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Model not found");
    });
  });

  describe("API Error Handling", () => {
    it("should handle HTTP 404 error", async () => {
      // Given: Mock 404 response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      // When: Validate model
      const result = await validateOpenRouterModelHandler({
        modelId: "any/model",
      });

      // Then: Should return API error
      expect(result.valid).toBe(false);
      expect(result.error).toBe("API error: HTTP 404");
    });

    it("should handle HTTP 500 error", async () => {
      // Given: Mock server error
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      // When: Validate model
      const result = await validateOpenRouterModelHandler({
        modelId: "any/model",
      });

      // Then: Should return API error
      expect(result.valid).toBe(false);
      expect(result.error).toBe("API error: HTTP 500");
    });

    it("should handle malformed JSON response", async () => {
      // Given: Mock response with invalid JSON
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      // When: Validate model
      const result = await validateOpenRouterModelHandler({
        modelId: "any/model",
      });

      // Then: Should return error
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid JSON");
    });
  });

  describe("Network Error Handling", () => {
    it("should handle network timeout", async () => {
      // Given: Mock network error
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network timeout"));

      // When: Validate model
      const result = await validateOpenRouterModelHandler({
        modelId: "any/model",
      });

      // Then: Should return network error
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Network error: Network timeout");
    });

    it("should handle connection refused", async () => {
      // Given: Mock connection error
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("ECONNREFUSED"));

      // When: Validate model
      const result = await validateOpenRouterModelHandler({
        modelId: "any/model",
      });

      // Then: Should return network error
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Network error: ECONNREFUSED");
    });
  });

  describe("Response Format Validation", () => {
    it("should handle missing data field in response", async () => {
      // Given: Mock response without data field
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      // When: Validate model
      const result = await validateOpenRouterModelHandler({
        modelId: "any/model",
      });

      // Then: Should return invalid
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Model not found");
    });

    it("should handle non-array data field", async () => {
      // Given: Mock response with invalid data type
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: "not an array" }),
      });

      // When: Validate model
      const result = await validateOpenRouterModelHandler({
        modelId: "any/model",
      });

      // Then: Should return invalid
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Model not found");
    });
  });
});
