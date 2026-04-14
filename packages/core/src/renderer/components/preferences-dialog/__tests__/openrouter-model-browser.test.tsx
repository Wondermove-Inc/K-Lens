/**
 * 🎯 목적: OpenRouter Model Browser 컴포넌트 단위 테스트
 * OpenRouter 공식 API 기반 모델 탐색 기능
 *
 * 공식 API에서 모델 목록을 가져와 정렬/필터링하고 선택하는 기능 테스트
 * @packageDocumentation
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { OpenRouterModelBrowser } from "../openrouter-model-browser";

// Mock fetch
global.fetch = jest.fn();

const mockModelsData = {
  data: [
    {
      id: "qwen/qwen3.6-plus:free",
      name: "Qwen: Qwen3.6 Plus (free)",
      created: 1775133557,
      context_length: 1000000,
      pricing: { prompt: "0", completion: "0" },
      supported_parameters: ["tools", "temperature", "max_tokens"],
      architecture: { input_modalities: ["text", "image"] },
    },
    {
      id: "google/gemma-4-31b-it",
      name: "Google: Gemma 4 31B",
      created: 1775148486,
      context_length: 262144,
      pricing: { prompt: "0.00000014", completion: "0.0000004" },
      supported_parameters: ["tools", "temperature"],
      architecture: { input_modalities: ["text", "image", "video"] },
    },
    {
      id: "deepseek/deepseek-chat-v3.2",
      name: "DeepSeek: DeepSeek Chat V3.2",
      created: 1775000000,
      context_length: 128000,
      pricing: { prompt: "0.00000014", completion: "0.00000028" },
      supported_parameters: ["temperature", "max_tokens"],
      architecture: { input_modalities: ["text"] },
    },
    {
      id: "meta-llama/llama-3.1-8b-instruct",
      name: "Meta: Llama 3.1 8B Instruct",
      created: 1774000000,
      context_length: 32000,
      pricing: { prompt: "0.00000005", completion: "0.0000001" },
      supported_parameters: ["temperature"],
      architecture: { input_modalities: ["text"] },
    },
  ],
};

describe("OpenRouterModelBrowser 컴포넌트", () => {
  const defaultProps = {
    isOpen: true,
    onOpenChange: jest.fn(),
    onSelectModel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockModelsData,
    });
  });

  describe("기본 렌더링", () => {
    it("AC1: Dialog가 열렸을 때 제목이 표시되어야 한다", async () => {
      render(<OpenRouterModelBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Browse OpenRouter Models")).toBeInTheDocument();
      });
    });

    it("AC2: 검색창이 렌더링되어야 한다", async () => {
      render(<OpenRouterModelBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search models/i)).toBeInTheDocument();
      });
    });

    it("AC3: 로딩 중일 때 로딩 인디케이터가 표시되어야 한다", () => {
      (global.fetch as jest.Mock).mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)));

      render(<OpenRouterModelBrowser {...defaultProps} />);

      expect(screen.getByText("Loading models...")).toBeInTheDocument();
    });

    it("AC4: 정렬 드롭다운이 렌더링되어야 한다", async () => {
      render(<OpenRouterModelBrowser {...defaultProps} />);

      await waitFor(() => {
        // 기본 정렬 라벨이 표시됨 (트리거 버튼과 메뉴 아이템 모두 포함)
        const elements = screen.getAllByText("Price (low to high)");
        expect(elements.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("AC5: 필터 드롭다운들이 렌더링되어야 한다", async () => {
      render(<OpenRouterModelBrowser {...defaultProps} />);

      await waitFor(() => {
        // 필터 드롭다운 버튼들 (Price는 정렬/필터 양쪽에 있으므로 getAllByRole 사용)
        const priceButtons = screen.getAllByRole("button", { name: /Price/i });
        expect(priceButtons.length).toBeGreaterThanOrEqual(1);
        expect(screen.getByRole("button", { name: /Added/i })).toBeInTheDocument();
      });
    });

    it("AC5-2: 컬럼 헤더가 렌더링되어야 한다", async () => {
      render(<OpenRouterModelBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Model")).toBeInTheDocument();
        expect(screen.getByText("Context")).toBeInTheDocument();
      });
    });
  });

  describe("데이터 페칭", () => {
    it("AC6: 컴포넌트가 마운트되면 공식 API에서 데이터를 가져와야 한다", async () => {
      render(<OpenRouterModelBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("https://openrouter.ai/api/v1/models");
      });
    });

    it("AC7: 데이터 로드 성공 시 모델 목록이 표시되어야 한다", async () => {
      render(<OpenRouterModelBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("qwen/qwen3.6-plus:free")).toBeInTheDocument();
        expect(screen.getByText("google/gemma-4-31b-it")).toBeInTheDocument();
      });
    });

    it("AC8: 네트워크 오류 시 에러 메시지가 표시되어야 한다", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      render(<OpenRouterModelBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });
  });

  describe("모델 정보 표시", () => {
    it("AC9: 무료 모델에 Free 라벨이 표시되어야 한다", async () => {
      render(<OpenRouterModelBrowser {...defaultProps} />);

      await waitFor(() => {
        // 무료 모델의 가격 표시에 Free가 있어야 함
        const modelList = screen.getByText("qwen/qwen3.6-plus:free").closest("button");
        expect(modelList?.textContent).toContain("Free");
      });
    });

    it("AC10: 유료 모델에 가격이 표시되어야 한다", async () => {
      render(<OpenRouterModelBrowser {...defaultProps} />);

      await waitFor(() => {
        // 가격이 /M 형식으로 표시됨
        const priceElements = screen.getAllByText(/\/M/);
        expect(priceElements.length).toBeGreaterThan(0);
      });
    });

    it("AC11: 컨텍스트 길이가 표시되어야 한다", async () => {
      render(<OpenRouterModelBrowser {...defaultProps} />);

      await waitFor(() => {
        // 1M, 262K 등의 형식으로 표시
        expect(screen.getByText("1.0M")).toBeInTheDocument();
        expect(screen.getByText("262K")).toBeInTheDocument();
      });
    });
  });

  describe("정렬 기능", () => {
    it("AC12: 기본적으로 가격순으로 정렬되어야 한다 (무료 모델 먼저)", async () => {
      render(<OpenRouterModelBrowser {...defaultProps} />);

      await waitFor(() => {
        const buttons = screen.getAllByRole("button");
        const modelButtons = buttons.filter(
          (btn) => btn.textContent?.includes("qwen") || btn.textContent?.includes("google"),
        );
        // 첫 번째 모델이 무료 모델이어야 함
        expect(modelButtons[0].textContent).toContain("qwen/qwen3.6-plus:free");
      });
    });

    it("AC13: Context 정렬 클릭 시 컨텍스트 길이순으로 정렬되어야 한다", async () => {
      const user = userEvent.setup();
      render(<OpenRouterModelBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("qwen/qwen3.6-plus:free")).toBeInTheDocument();
      });

      const contextSortBtn = screen.getByText("Context");
      await user.click(contextSortBtn);

      // 가장 긴 컨텍스트 (1M)를 가진 모델이 첫 번째여야 함
      await waitFor(() => {
        const buttons = screen.getAllByRole("button");
        const modelButtons = buttons.filter(
          (btn) => btn.textContent?.includes("qwen") || btn.textContent?.includes("google"),
        );
        expect(modelButtons[0].textContent).toContain("qwen/qwen3.6-plus:free");
      });
    });

    it("AC14: Newest 정렬 클릭 시 최신순으로 정렬되어야 한다", async () => {
      const user = userEvent.setup();
      render(<OpenRouterModelBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("qwen/qwen3.6-plus:free")).toBeInTheDocument();
      });

      const newestSortBtn = screen.getByText("Newest first");
      await user.click(newestSortBtn);

      // 가장 최신 모델이 첫 번째여야 함 (gemma가 가장 최신)
      await waitFor(() => {
        const buttons = screen.getAllByRole("button");
        const modelButtons = buttons.filter(
          (btn) => btn.textContent?.includes("qwen") || btn.textContent?.includes("google"),
        );
        expect(modelButtons[0].textContent).toContain("google/gemma-4-31b-it");
      });
    });
  });

  describe("필터 기능", () => {
    it("AC15: Free 필터 선택 시 무료 모델만 표시되어야 한다", async () => {
      const user = userEvent.setup();
      render(<OpenRouterModelBrowser {...defaultProps} />);

      await waitFor(() => {
        // Tool 지원 모델 2개가 표시됨
        expect(screen.getByText("qwen/qwen3.6-plus:free")).toBeInTheDocument();
        expect(screen.getByText("google/gemma-4-31b-it")).toBeInTheDocument();
      });

      // Price 필터 드롭다운 클릭 (정렬 드롭다운 "Price (low to high)"이 아닌 필터 "Price" 버튼)
      const priceButtons = screen.getAllByRole("button", { name: /Price/i });
      const priceDropdown =
        priceButtons.find((btn) => btn.textContent?.trim() === "Price") ?? priceButtons[priceButtons.length - 1];
      await user.click(priceDropdown);

      // Free only 옵션 선택
      const freeOption = await screen.findByText("Free only");
      await user.click(freeOption);

      await waitFor(() => {
        // 무료 + Tool 지원 모델만 표시
        expect(screen.getByText("qwen/qwen3.6-plus:free")).toBeInTheDocument();
        // 유료 모델은 숨김
        expect(screen.queryByText("google/gemma-4-31b-it")).not.toBeInTheDocument();
      });
    });

    it("AC16: Tool 미지원 모델은 기본적으로 표시되지 않아야 한다", async () => {
      render(<OpenRouterModelBrowser {...defaultProps} />);

      await waitFor(() => {
        // Tool 지원하는 모델만 표시
        expect(screen.getByText("qwen/qwen3.6-plus:free")).toBeInTheDocument();
        expect(screen.getByText("google/gemma-4-31b-it")).toBeInTheDocument();
        // Tool 미지원 모델은 기본적으로 숨김
        expect(screen.queryByText("deepseek/deepseek-chat-v3.2")).not.toBeInTheDocument();
        expect(screen.queryByText("meta-llama/llama-3.1-8b-instruct")).not.toBeInTheDocument();
      });
    });
  });

  describe("검색 기능", () => {
    it("AC18: 검색어 입력 시 모델 ID로 필터링되어야 한다", async () => {
      const user = userEvent.setup();
      render(<OpenRouterModelBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("qwen/qwen3.6-plus:free")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search models/i);
      await user.type(searchInput, "qwen");

      await waitFor(() => {
        expect(screen.getByText("qwen/qwen3.6-plus:free")).toBeInTheDocument();
        expect(screen.queryByText("google/gemma-4-31b-it")).not.toBeInTheDocument();
      });
    });

    it("AC19: 검색어가 대소문자를 구분하지 않아야 한다", async () => {
      const user = userEvent.setup();
      render(<OpenRouterModelBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("qwen/qwen3.6-plus:free")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search models/i);
      await user.type(searchInput, "QWEN");

      await waitFor(() => {
        expect(screen.getByText("qwen/qwen3.6-plus:free")).toBeInTheDocument();
      });
    });

    it("AC20: 검색 결과가 없을 때 메시지가 표시되어야 한다", async () => {
      const user = userEvent.setup();
      render(<OpenRouterModelBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("qwen/qwen3.6-plus:free")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search models/i);
      await user.type(searchInput, "nonexistent");

      await waitFor(() => {
        expect(screen.getByText(/no models found/i)).toBeInTheDocument();
      });
    });
  });

  describe("모델 선택", () => {
    it("AC21: 모델 클릭 시 onSelectModel이 호출되어야 한다", async () => {
      const user = userEvent.setup();
      const onSelectModel = jest.fn();

      render(<OpenRouterModelBrowser {...defaultProps} onSelectModel={onSelectModel} />);

      await waitFor(() => {
        expect(screen.getByText("qwen/qwen3.6-plus:free")).toBeInTheDocument();
      });

      const modelItem = screen.getByText("qwen/qwen3.6-plus:free").closest("button");
      if (modelItem) {
        await user.click(modelItem);
      }

      expect(onSelectModel).toHaveBeenCalledWith("qwen/qwen3.6-plus:free");
    });

    it("AC22: 모델 선택 후 Dialog가 닫혀야 한다", async () => {
      const user = userEvent.setup();
      const onOpenChange = jest.fn();

      render(<OpenRouterModelBrowser {...defaultProps} onOpenChange={onOpenChange} />);

      await waitFor(() => {
        expect(screen.getByText("qwen/qwen3.6-plus:free")).toBeInTheDocument();
      });

      const modelItem = screen.getByText("qwen/qwen3.6-plus:free").closest("button");
      if (modelItem) {
        await user.click(modelItem);
      }

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("결과 수 표시", () => {
    it("AC23: 현재 표시 중인 모델 수가 표시되어야 한다", async () => {
      render(<OpenRouterModelBrowser {...defaultProps} />);

      await waitFor(() => {
        // Tool 지원 모델만 표시되므로 2개
        expect(screen.getByText(/showing 2 of 4 models/i)).toBeInTheDocument();
      });
    });

    it("AC24: 필터 적용 시 결과 수가 업데이트되어야 한다", async () => {
      const user = userEvent.setup();
      render(<OpenRouterModelBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/showing 2 of 4 models/i)).toBeInTheDocument();
      });

      // Price 필터 드롭다운 클릭 (정렬 드롭다운 "Price (low to high)"이 아닌 필터 "Price" 버튼)
      const priceButtons = screen.getAllByRole("button", { name: /Price/i });
      const priceDropdown =
        priceButtons.find((btn) => btn.textContent?.trim() === "Price") ?? priceButtons[priceButtons.length - 1];
      await user.click(priceDropdown);

      // Free only 옵션 선택
      const freeOption = await screen.findByText("Free only");
      await user.click(freeOption);

      await waitFor(() => {
        expect(screen.getByText(/showing 1 of 4 models/i)).toBeInTheDocument();
      });
    });
  });
});
