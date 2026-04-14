import { ArrowUp, ChevronDown, Infinity, StickyNote } from "lucide-react";
import React, { useMemo, useState } from "react";
import { Badge } from "../shadcn-ui/badge";
import { Button } from "../shadcn-ui/button";
import { ButtonGroup } from "../shadcn-ui/button-group";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "../shadcn-ui/input-group";
import { ScrollArea } from "../shadcn-ui/scroll-area";

import type { ClarifyInputMode, ClarifySuggestion, SlotDetail } from "./ai-chat-panel-store";

interface ClarifyProps {
  prompt: string;
  suggestions: ClarifySuggestion[];
  missingSlots: string[];
  attempts: number;
  slotDetails?: Record<string, SlotDetail>;
  collectedValues?: Record<string, string>;
  latestRawInput?: string;
  lastInputMode?: ClarifyInputMode | null;
  isSubmitting?: boolean;
  onSelectSuggestion?(value: ClarifySuggestion): void;
  onSubmitManual?(value: string): void;
}

/**
 * 🎯 목적: Clarify 노드가 사용자 입력을 요구할 때 표시할 UI 컴포넌트
 */
export const Clarify: React.FC<ClarifyProps> = ({
  prompt,
  suggestions,
  missingSlots,
  attempts,
  slotDetails,
  collectedValues,
  latestRawInput,
  lastInputMode,
  isSubmitting = false,
  onSelectSuggestion,
  onSubmitManual,
}) => {
  const [isManualEditing, setIsManualEditing] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const displaySuggestions = useMemo(() => suggestions.slice(0, 3), [suggestions]);
  const collectedEntries = useMemo(() => {
    if (!collectedValues) {
      return [];
    }

    return Object.entries(collectedValues)
      .map(([slot, value]) => ({ slot, value: value?.trim() ?? "" }))
      .filter(({ slot, value }) => slot.trim().length > 0 && value.length > 0);
  }, [collectedValues]);
  const slotExamples = useMemo(() => {
    const normalizedSlots = missingSlots.map((slot) => slot.trim()).filter(Boolean);
    if (normalizedSlots.length === 0) {
      return [];
    }

    const lookup = new Map<string, string>();

    // 🎯 suggestion valueHints를 우선 사용
    for (const option of displaySuggestions) {
      option.slotIds.forEach((slotId) => {
        if (!lookup.has(slotId) && option.valueHints?.[slotId]) {
          lookup.set(slotId, option.valueHints[slotId]);
        }
      });
    }

    return normalizedSlots.map((slot) => {
      const detail = slotDetails?.[slot];
      const exampleCandidate = detail?.example?.trim();
      const descriptionCandidate = detail?.description?.trim();

      return {
        slot,
        example:
          exampleCandidate && exampleCandidate.length > 0
            ? exampleCandidate
            : (lookup.get(slot) ??
              (descriptionCandidate && descriptionCandidate.length > 0 ? descriptionCandidate : `<${slot}>`)),
        description:
          descriptionCandidate && descriptionCandidate.length > 0 && descriptionCandidate !== exampleCandidate
            ? descriptionCandidate
            : undefined,
      };
    });
  }, [displaySuggestions, missingSlots, slotDetails]);
  const hasPlanCard = missingSlots.length > 0 || displaySuggestions.length > 0;
  const canSubmitManual = useMemo(() => manualValue.trim().length > 0 && !isSubmitting, [manualValue, isSubmitting]);

  const handleSuggestion = (value: ClarifySuggestion) => {
    if (isSubmitting) {
      return;
    }
    onSelectSuggestion?.(value);
  };

  const openManualEditor = () => {
    if (isSubmitting) {
      return;
    }

    setIsManualEditing(true);
    setManualValue("");
  };

  const toggleManual = () => {
    if (isSubmitting) {
      return;
    }

    setIsManualEditing((current) => !current);
    setManualValue("");
  };

  const handleManualSubmit = () => {
    const trimmed = manualValue.trim();
    if (!trimmed || isSubmitting) {
      return;
    }

    onSubmitManual?.(trimmed);
    setManualValue("");
    setIsManualEditing(false);
  };

  const renderSuggestionHints = (option: ClarifySuggestion) => {
    if (!option.slotIds?.length) {
      return null;
    }

    return (
      <ul className="text-muted-foreground mt-1 flex flex-col gap-0.5 text-xs leading-4">
        {option.slotIds.map((slotId) => (
          <li key={`${option.title}-${slotId}`} className="flex flex-wrap items-center gap-1">
            <span className="rounded-sm bg-secondary px-1 py-0.5 font-mono text-[10px] uppercase text-primary-foreground">
              {slotId}
            </span>
            <span className="text-foreground/80 break-words">{option.valueHints?.[slotId] ?? `<${slotId}>`}</span>
          </li>
        ))}
      </ul>
    );
  };

  const renderExampleBlock = (variant: "card" | "compact" = "card") => {
    if (slotExamples.length === 0) {
      return null;
    }

    const baseClass =
      variant === "card"
        ? "bg-secondary/30 border border-dashed border-border rounded-md p-3 w-full flex flex-col gap-1"
        : "bg-secondary/20 border border-border rounded-md p-2 w-full flex flex-col gap-1";

    return (
      <div className={baseClass}>
        <span className="text-muted-foreground text-xs font-medium leading-4">예시 값</span>
        <ul className="text-foreground flex flex-col gap-1.5 text-xs leading-4">
          {slotExamples.map(({ slot, example, description }) => (
            <li key={slot} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-1">
                <span className="rounded-sm bg-background/70 px-1 py-0.5 font-mono text-[10px] uppercase text-primary">
                  {slot}
                </span>
                <span className="text-foreground/80 break-words">{example}</span>
              </div>
              {description && (
                <span className="text-muted-foreground text-[11px] leading-4 break-words">{description}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="flex w-full flex-col items-start gap-5 self-stretch">
      <div className="flex w-full flex-col items-start gap-2">
        <div className="border-border flex w-full shrink-0 items-center gap-2 border-l-2 px-0 py-0 pl-4">
          <span className="text-foreground flex-grow text-sm leading-5 whitespace-pre-wrap">{prompt}</span>
        </div>
        <span className="text-muted-foreground text-xs leading-4">시도 횟수: {attempts}</span>
        {lastInputMode === "freeform" && (
          <span className="text-muted-foreground text-[11px] leading-4">
            최근 입력은 자유 형식으로 처리됩니다. 필요한 슬롯 이름을 함께 적어주시면 더 정확하게 인식할 수 있어요.
          </span>
        )}
        {collectedEntries.length > 0 && (
          <div className="bg-secondary/20 border border-border/60 rounded-md p-3 w-full flex flex-col gap-2">
            <span className="text-muted-foreground text-xs font-medium leading-4">현재 입력된 값</span>
            <ul className="text-foreground flex flex-col gap-1 text-xs leading-4">
              {collectedEntries.map(({ slot, value }) => (
                <li key={slot} className="flex flex-wrap items-center gap-1">
                  <span className="rounded-sm bg-background/70 px-1 py-0.5 font-mono text-[10px] uppercase text-primary">
                    {slot}
                  </span>
                  <span className="text-foreground/80 break-words">{value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {latestRawInput && collectedEntries.length === 0 && (
          <div className="text-muted-foreground text-[11px] leading-4 break-words">
            최근 입력: <span className="font-mono">{latestRawInput}</span>
          </div>
        )}
      </div>

      {hasPlanCard && (
        <div className="border-primary flex h-auto w-full flex-col items-start gap-3 self-stretch rounded-[14px] border p-[10px]">
          <Badge variant="default" className="h-5 gap-1">
            <StickyNote className="h-3.5 w-3.5" />
            Plan
          </Badge>

          {missingSlots.length > 0 && (
            <ul className="text-foreground flex list-disc flex-col gap-1 pl-6 text-sm leading-5">
              {missingSlots.map((slot) => (
                <li key={slot} className="whitespace-pre-wrap">
                  {slot}
                </li>
              ))}
            </ul>
          )}

          {missingSlots.length > 1 && displaySuggestions.length === 0 && (
            <div className="text-muted-foreground text-xs leading-4">
              여러 필드를 동시에 채워야 하므로 예시를 참고하여 직접 입력해주세요.
            </div>
          )}

          {renderExampleBlock()}

          {displaySuggestions.length > 0 && (
            <ButtonGroup orientation="vertical" className="w-full gap-[1px]">
              {displaySuggestions.map((option, index) => (
                <Button
                  key={`${option.title}-${index}`}
                  variant="outline"
                  className="hover:bg-primary hover:text-primary-foreground h-auto justify-start gap-2 whitespace-normal text-left py-3"
                  disabled={isSubmitting}
                  onClick={() => handleSuggestion(option)}
                >
                  <Badge
                    variant="secondary"
                    className="h-4 min-w-4 rounded-full px-1 font-mono text-[11px] tabular-nums"
                  >
                    {index + 1}
                  </Badge>
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-sm leading-5 break-words">{option.title}</span>
                    {renderSuggestionHints(option)}
                  </div>
                </Button>
              ))}

              <Button
                variant={isManualEditing ? "default" : "outline"}
                className="hover:bg-primary hover:text-primary-foreground h-auto justify-start gap-2 whitespace-normal text-left py-3"
                disabled={isSubmitting}
                onClick={openManualEditor}
              >
                <Badge variant="secondary" className="h-4 min-w-4 rounded-full px-1 font-mono text-[11px] tabular-nums">
                  {displaySuggestions.length + 1}
                </Badge>
                <span className="text-sm leading-5 break-words">직접 입력으로 추가 정보를 제공할게요</span>
              </Button>
            </ButtonGroup>
          )}

          {displaySuggestions.length === 0 && (
            <Button
              variant={isManualEditing ? "default" : "outline"}
              className="hover:bg-primary hover:text-primary-foreground h-auto justify-start gap-2 whitespace-normal text-left py-3"
              disabled={isSubmitting}
              onClick={openManualEditor}
            >
              <Badge variant="secondary" className="h-4 min-w-4 rounded-full px-1 font-mono text-[11px] tabular-nums">
                1
              </Badge>
              <span className="text-sm leading-5 break-words">직접 입력으로 추가 정보를 제공할게요</span>
            </Button>
          )}
        </div>
      )}

      <div className="bg-border h-px w-full" />

      <div className="flex w-full flex-col gap-2">
        {isManualEditing && renderExampleBlock("compact")}

        {isManualEditing ? (
          <InputGroup className="!bg-secondary dark:!bg-secondary flex-col">
            <ScrollArea className="min-h-12 max-h-60 w-full p-3">
              <InputGroupTextarea
                value={manualValue}
                onChange={(event) => setManualValue(event.target.value)}
                placeholder="추가 정보를 입력하세요..."
                rows={3}
                disabled={isSubmitting}
                className="min-h-0 whitespace-pre-wrap text-left text-sm leading-5"
              />
            </ScrollArea>

            <InputGroupAddon align="block-end" className="flex items-center justify-between gap-2">
              <div className="flex flex-1 items-center gap-2">
                <InputGroupButton size="xs" className="rounded-full border" variant="ghost" disabled>
                  <Infinity className="h-4 w-4" />
                  Agent
                  <ChevronDown className="h-4 w-4" />
                </InputGroupButton>
                <InputGroupButton size="xs" variant="ghost" disabled>
                  Auto
                  <ChevronDown className="h-4 w-4" />
                </InputGroupButton>
              </div>

              <div className="flex items-center gap-2">
                <InputGroupButton
                  size="xs"
                  variant="ghost"
                  className="rounded-full px-3"
                  onClick={toggleManual}
                  disabled={isSubmitting}
                >
                  취소
                </InputGroupButton>
                <InputGroupButton
                  size="icon-xs"
                  className={`rounded-full ${
                    canSubmitManual
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                  }`}
                  onClick={handleManualSubmit}
                  disabled={!canSubmitManual}
                >
                  <ArrowUp className="h-4 w-4" />
                </InputGroupButton>
              </div>
            </InputGroupAddon>
          </InputGroup>
        ) : (
          !hasPlanCard && (
            <Button
              variant="outline"
              className="h-auto w-full cursor-pointer justify-start rounded-lg border-dashed text-left text-sm font-medium leading-5"
              onClick={toggleManual}
              disabled={isSubmitting}
            >
              직접 입력으로 추가 정보를 제공할게요
            </Button>
          )
        )}
      </div>
    </div>
  );
};
