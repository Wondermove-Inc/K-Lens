/**
 * 🎯 목적: OpenRouter Model Browser 컴포넌트
 * OpenRouter 공식 API에서 모델 목록을 가져와 정렬/필터링하여 표시
 *
 * 공식 API(/api/v1/models)를 사용하여 안정적이고 최신 모델 목록을 제공합니다.
 * 가격순, 컨텍스트순, 최신순 정렬과 무료/Tool지원/멀티모달 필터를 지원합니다.
 *
 * @packageDocumentation
 */

import { AlertCircle, ChevronDown, Loader2, Search, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "../shadcn-ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../shadcn-ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../shadcn-ui/dropdown-menu";
import { Input } from "../shadcn-ui/input";

/**
 * OpenRouter 공식 API 모델 데이터 타입
 */
interface OpenRouterModel {
  id: string;
  name: string;
  created: number;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  supported_parameters?: string[];
  architecture?: {
    modality?: string;
    input_modalities?: string[];
  };
}

/**
 * OpenRouter 공식 API 응답 타입
 */
interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

/**
 * 정렬 옵션 타입
 */
type SortOption = "price" | "context" | "newest";

/**
 * OpenRouterModelBrowser Props
 */
export interface OpenRouterModelBrowserProps {
  /** Dialog 열림/닫힘 상태 */
  isOpen: boolean;
  /** Dialog 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 모델 선택 핸들러 */
  onSelectModel: (modelId: string) => void;
}

/** OpenRouter 공식 모델 API URL */
const OPENROUTER_MODELS_API = "https://openrouter.ai/api/v1/models";

/**
 * 가격 문자열을 숫자로 변환
 */
const parsePrice = (price: string): number => {
  const num = parseFloat(price);
  return isNaN(num) ? Infinity : num;
};

/**
 * 가격을 사람이 읽기 쉬운 형태로 포맷
 */
const formatPrice = (prompt: string, completion: string): string => {
  const promptPrice = parseFloat(prompt);
  const completionPrice = parseFloat(completion);

  // NaN이나 음수 처리
  if (isNaN(promptPrice) || isNaN(completionPrice) || promptPrice < 0 || completionPrice < 0) {
    return "N/A";
  }

  if (promptPrice === 0 && completionPrice === 0) {
    return "Free";
  }

  // 가격을 1M 토큰당 달러로 변환
  const promptPerM = promptPrice * 1_000_000;
  const completionPerM = completionPrice * 1_000_000;

  // 매우 작은 가격 (1M당 $0.01 미만)
  if (promptPerM < 0.01 && completionPerM < 0.01) {
    return `<$0.01/M`;
  }

  return `$${promptPerM.toFixed(2)}/M`;
};

/**
 * 컨텍스트 길이를 읽기 쉬운 형태로 포맷
 */
const formatContextLength = (length: number): string => {
  if (length >= 1_000_000) {
    return `${(length / 1_000_000).toFixed(1)}M`;
  }
  if (length >= 1_000) {
    return `${Math.round(length / 1_000)}K`;
  }
  return `${length}`;
};

/**
 * 모델이 Tool calling을 지원하는지 확인
 */
const supportsTools = (model: OpenRouterModel): boolean => {
  return model.supported_parameters?.includes("tools") ?? false;
};

/**
 * 모델이 무료인지 확인
 */
const isFreeModel = (model: OpenRouterModel): boolean => {
  return parsePrice(model.pricing.prompt) === 0 && parsePrice(model.pricing.completion) === 0;
};

/**
 * OpenRouter 모델 브라우저 컴포넌트
 */
export const OpenRouterModelBrowser: React.FC<OpenRouterModelBrowserProps> = ({
  isOpen,
  onOpenChange,
  onSelectModel,
}) => {
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 정렬 상태
  const [sortBy, setSortBy] = useState<SortOption>("price");

  // 필터 상태 (활성화된 필터 목록)
  type PriceFilter = "free" | "under1" | "under3" | "custom" | null;
  type DateFilter = "7d" | "30d" | "90d" | "custom" | null;
  const [priceFilter, setPriceFilter] = useState<PriceFilter>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>(null);

  // 커스텀 범위 상태
  const [customPriceMin, setCustomPriceMin] = useState("");
  const [customPriceMax, setCustomPriceMax] = useState("");
  const [customDays, setCustomDays] = useState("");

  /**
   * 모델 데이터 가져오기
   */
  useEffect(() => {
    if (!isOpen) return;

    const fetchModels = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(OPENROUTER_MODELS_API);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: OpenRouterModelsResponse = await response.json();
        setModels(data.data || []);
      } catch (err) {
        setError("Failed to load models. Please try again later.");
        console.error("Failed to fetch OpenRouter models:", err);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchModels();
  }, [isOpen]);

  /**
   * 모델의 1M 토큰당 가격 계산 (input 기준)
   */
  const getModelPricePerM = (model: OpenRouterModel): number => {
    const price = parsePrice(model.pricing.prompt);
    return price * 1_000_000;
  };

  /**
   * 필터링 및 정렬된 모델 목록
   */
  const filteredModels = useMemo(() => {
    // Tool 지원 모델만 기본 필터 (Tool 미지원 모델은 앱에서 사용 불가)
    let result = models.filter(supportsTools);

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (model) => model.id.toLowerCase().includes(query) || model.name.toLowerCase().includes(query),
      );
    }

    // 가격 필터 적용
    if (priceFilter === "free") {
      result = result.filter(isFreeModel);
    } else if (priceFilter === "under1") {
      result = result.filter((model) => getModelPricePerM(model) <= 1);
    } else if (priceFilter === "under3") {
      result = result.filter((model) => getModelPricePerM(model) <= 3);
    } else if (priceFilter === "custom") {
      const minPrice = parseFloat(customPriceMin) || 0;
      const maxPrice = parseFloat(customPriceMax) || Infinity;
      result = result.filter((model) => {
        const price = getModelPricePerM(model);
        return price >= minPrice && price <= maxPrice;
      });
    }

    // 날짜 필터 적용
    if (dateFilter === "custom" && customDays) {
      const days = parseInt(customDays);
      if (!isNaN(days) && days > 0) {
        const cutoffTimestamp = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
        result = result.filter((model) => model.created >= cutoffTimestamp);
      }
    } else if (dateFilter && dateFilter !== "custom") {
      const daysMap = { "7d": 7, "30d": 30, "90d": 90 };
      const days = daysMap[dateFilter];
      const cutoffTimestamp = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
      result = result.filter((model) => model.created >= cutoffTimestamp);
    }

    // 정렬 적용
    result.sort((a, b) => {
      switch (sortBy) {
        case "price": {
          const priceA = parsePrice(a.pricing.prompt) + parsePrice(a.pricing.completion);
          const priceB = parsePrice(b.pricing.prompt) + parsePrice(b.pricing.completion);
          return priceA - priceB;
        }
        case "context":
          return b.context_length - a.context_length;
        case "newest":
          return b.created - a.created;
        default:
          return 0;
      }
    });

    return result;
  }, [models, searchQuery, sortBy, priceFilter, dateFilter, customPriceMin, customPriceMax, customDays]);

  // 활성 필터 개수
  const activeFilterCount = (priceFilter ? 1 : 0) + (dateFilter ? 1 : 0);

  // 필터 라벨
  const getPriceFilterLabel = (filter: PriceFilter) => {
    switch (filter) {
      case "free":
        return "Free";
      case "under1":
        return "<$1/M";
      case "under3":
        return "<$3/M";
      case "custom": {
        const min = customPriceMin || "0";
        const max = customPriceMax || "∞";
        return `$${min}-${max}/M`;
      }
      default:
        return "";
    }
  };

  const getDateFilterLabel = (filter: DateFilter) => {
    switch (filter) {
      case "7d":
        return "Last 7 days";
      case "30d":
        return "Last 30 days";
      case "90d":
        return "Last 90 days";
      case "custom":
        return `Last ${customDays} days`;
      default:
        return "";
    }
  };

  const getSortLabel = (sort: SortOption) => {
    switch (sort) {
      case "price":
        return "Price (low to high)";
      case "context":
        return "Context (largest)";
      case "newest":
        return "Newest first";
    }
  };

  /**
   * 모델 선택 핸들러
   */
  const handleSelectModel = (modelId: string) => {
    onSelectModel(modelId);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogTitle>Browse OpenRouter Models</DialogTitle>
        <DialogDescription>
          {models.length > 0
            ? `Tool-compatible models only. Sort and filter to find the best model.`
            : "Loading models from OpenRouter..."}
        </DialogDescription>

        {/* 검색창 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* 필터 바 */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 정렬 드롭다운 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                {getSortLabel(sortBy)}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setSortBy("price")}>Price (low to high)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("context")}>Context (largest)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("newest")}>Newest first</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 가격 필터 드롭다운 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={priceFilter ? "secondary" : "outline"} size="sm" className="h-7 text-xs gap-1">
                {priceFilter ? getPriceFilterLabel(priceFilter) : "Price"}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem
                onClick={() => {
                  setPriceFilter(null);
                  setCustomPriceMin("");
                  setCustomPriceMax("");
                }}
              >
                All prices
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPriceFilter("free")}>Free only</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPriceFilter("under1")}>Under $1/M</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPriceFilter("under3")}>Under $3/M</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Custom range ($/M)
              </DropdownMenuLabel>
              <div className="flex items-center gap-1 px-2 pb-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={customPriceMin}
                  onChange={(e) => {
                    setCustomPriceMin(e.target.value);
                    if (e.target.value || customPriceMax) {
                      setPriceFilter("custom");
                    }
                  }}
                  className="h-7 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={customPriceMax}
                  onChange={(e) => {
                    setCustomPriceMax(e.target.value);
                    if (e.target.value || customPriceMin) {
                      setPriceFilter("custom");
                    }
                  }}
                  className="h-7 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 날짜 필터 드롭다운 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={dateFilter ? "secondary" : "outline"} size="sm" className="h-7 text-xs gap-1">
                {dateFilter ? getDateFilterLabel(dateFilter) : "Added"}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuItem
                onClick={() => {
                  setDateFilter(null);
                  setCustomDays("");
                }}
              >
                Any time
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateFilter("7d")}>Last 7 days</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateFilter("30d")}>Last 30 days</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateFilter("90d")}>Last 90 days</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Custom</DropdownMenuLabel>
              <div className="flex items-center gap-1 px-2 pb-2">
                <span className="text-xs text-muted-foreground">Last</span>
                <Input
                  type="number"
                  placeholder="N"
                  value={customDays}
                  onChange={(e) => {
                    setCustomDays(e.target.value);
                    if (e.target.value) {
                      setDateFilter("custom");
                    }
                  }}
                  className="h-7 w-16 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-xs text-muted-foreground">days</span>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 필터 초기화 */}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => {
                setPriceFilter(null);
                setDateFilter(null);
                setCustomPriceMin("");
                setCustomPriceMax("");
                setCustomDays("");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* 활성 필터 칩 */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {priceFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-xs">
                {getPriceFilterLabel(priceFilter)}
                <button onClick={() => setPriceFilter(null)} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {dateFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-xs">
                {getDateFilterLabel(dateFilter)}
                <button onClick={() => setDateFilter(null)} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        )}

        {/* 결과 수 표시 */}
        {!isLoading && !error && (
          <div className="text-xs text-muted-foreground">
            Showing {filteredModels.length} of {models.length} models
          </div>
        )}

        {/* 모델 목록 (헤더 포함) */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
              <span className="text-muted-foreground">Loading models...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-12">
              <AlertCircle className="h-6 w-6 text-destructive mr-2" />
              <span className="text-destructive">{error}</span>
            </div>
          )}

          {!isLoading && !error && filteredModels.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <span className="text-muted-foreground">No models found matching your criteria.</span>
            </div>
          )}

          {!isLoading && !error && filteredModels.length > 0 && (
            <div>
              {/* 컬럼 헤더 - sticky로 스크롤 시 고정, Button과 동일한 구조 */}
              <div className="py-1 px-3 border-b bg-background sticky top-0 z-10">
                <div className="flex items-center gap-2 w-full text-xs text-muted-foreground">
                  <div className="flex-1 min-w-0">Model</div>
                  <div className="flex-shrink-0 w-16 text-right">Price</div>
                  <div className="flex-shrink-0 w-10 text-right">Context</div>
                </div>
              </div>
              {filteredModels.map((model) => (
                <Button
                  key={model.id}
                  variant="ghost"
                  className="w-full justify-start h-auto py-2 px-3 hover:bg-accent"
                  onClick={() => handleSelectModel(model.id)}
                >
                  <div className="flex items-center gap-2 w-full">
                    {/* 모델 정보 */}
                    <div className="flex-1 min-w-0 text-left overflow-hidden">
                      <div className="font-medium text-sm truncate" title={model.id}>
                        {model.id}
                      </div>
                      <div className="text-xs text-muted-foreground truncate" title={model.name}>
                        {model.name}
                      </div>
                    </div>

                    {/* 가격 */}
                    <div
                      className={`text-xs font-medium flex-shrink-0 w-16 text-right ${
                        isFreeModel(model) ? "text-green-500" : "text-muted-foreground"
                      }`}
                      title={`Input: ${model.pricing.prompt}, Output: ${model.pricing.completion} per token`}
                    >
                      {formatPrice(model.pricing.prompt, model.pricing.completion)}
                    </div>

                    {/* 컨텍스트 */}
                    <div
                      className="text-xs text-muted-foreground flex-shrink-0 w-10 text-right"
                      title={`Context: ${model.context_length.toLocaleString()} tokens`}
                    >
                      {formatContextLength(model.context_length)}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
