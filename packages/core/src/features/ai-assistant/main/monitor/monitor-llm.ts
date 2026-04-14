/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";
import { ChatOpenRouter } from "@langchain/openrouter";
import { execFile } from "child_process";
import { promisify } from "util";
import { z } from "zod";
import { buildAgentPrompt, getMonitorAgentSystemPrompt } from "./monitor-prompts";

import type { BaseMessage } from "@langchain/core/messages";

import type { CustomRuleEvalResult, MonitorConfig } from "../../common/monitor-types";

const execFileAsync = promisify(execFile);

/** 최대 에이전트 루프 스텝 수 (tool call → 실행 → 반복) */
const MAX_STEPS = 12;

type MonitorLLMModel = ChatAnthropic | ChatOpenAI | ChatGoogleGenerativeAI | ChatOllama | ChatOpenRouter;

/**
 * 목적: 모니터 에이전트 루프 실행 (ReAct — tool calling 필수)
 *
 * UI에서 supportsTools=true 모델만 선택 가능하므로 fallback 불필요.
 */
export async function runMonitorAgent(params: {
  config: MonitorConfig;
  clusterName: string;
  kubeconfigPath: string;
  initialFindings: string;
  previousAlerts: string[];
  customRules: string[];
  customRuleResults?: CustomRuleEvalResult[];
}): Promise<string> {
  const { provider, modelId } = params.config;
  const resolvedModelId = modelId ?? "claude-sonnet-4-6";
  console.log(`[MonitorLLM] provider=${provider}, model=${resolvedModelId}`);

  const model = createModel(params.config);

  const prompt = buildAgentPrompt({
    clusterName: params.clusterName,
    initialFindings: params.initialFindings,
    previousAlerts: params.previousAlerts,
    customRules: params.customRules,
    customRuleResults: params.customRuleResults,
  });

  const kubectlTool = createKubectlTool(params.config.kubectlPath, params.kubeconfigPath);
  const modelWithTools = model.bindTools([kubectlTool]);

  const messages: BaseMessage[] = [new SystemMessage(getMonitorAgentSystemPrompt()), new HumanMessage(prompt)];

  try {
    // 수동 ReAct 루프: tool call → 실행 → 결과 피드백 → 반복
    for (let step = 0; step < MAX_STEPS; step++) {
      const response = await modelWithTools.invoke(messages);
      messages.push(response);

      // tool call 없으면 최종 응답 — 루프 종료
      const toolCalls = response.tool_calls ?? [];
      if (toolCalls.length === 0) {
        const text = extractText(response);
        console.log(`[MonitorLLM] completed at step ${step + 1} — textLength: ${text.length}`);
        return text;
      }

      // tool call 실행 후 ToolMessage로 결과 피드백
      for (const tc of toolCalls) {
        let result: string;
        if (tc.name === "kubectl") {
          const output = await kubectlTool.invoke(tc.args as { command: string });
          result = typeof output === "string" ? output : String(output);
        } else {
          result = `Error: unknown tool '${tc.name}'`;
        }
        messages.push(new ToolMessage({ content: result, tool_call_id: tc.id! }));
      }
    }

    // MAX_STEPS 도달 — 마지막 AIMessage에서 텍스트 추출
    console.warn(`[MonitorLLM] reached MAX_STEPS (${MAX_STEPS})`);
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i] instanceof AIMessage) {
        const text = extractText(messages[i] as AIMessage);
        if (text.length > 0) {
          console.log(`[MonitorLLM] Using text from message ${i}`);
          return text;
        }
      }
    }

    return "";
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[MonitorLLM] agent loop FAILED — provider=${provider}, model=${resolvedModelId}`, errMsg);
    if (error && typeof error === "object" && "status" in error) {
      console.error(`[MonitorLLM] HTTP status: ${(error as any).status}`);
    }
    throw error;
  }
}

/**
 * 목적: AIMessage의 content에서 텍스트 추출
 *
 * content가 string일 수도 있고 content block 배열일 수도 있음 (Anthropic)
 */
function extractText(message: AIMessage): string {
  if (typeof message.content === "string") {
    return message.content.trim();
  }
  if (Array.isArray(message.content)) {
    return message.content
      .filter((block): block is { type: "text"; text: string } => typeof block === "object" && block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
  }
  return "";
}

/**
 * 목적: kubectl tool 생성 (LangChain Core tool)
 */
function createKubectlTool(kubectlPath: string, kubeconfigPath: string) {
  return tool(
    async ({ command }) => {
      const allowed = ["get", "describe", "logs", "top", "events", "api-resources", "rollout", "auth"];
      const args = command.trim().split(/\s+/);
      const firstArg = args[0];
      if (!allowed.includes(firstArg)) {
        return `Error: command '${firstArg}' not allowed. Only read-only commands: ${allowed.join(", ")}`;
      }

      // rollout: status/history만 허용 (restart, undo 등 차단)
      if (firstArg === "rollout") {
        const sub = args[1];
        if (sub && !["status", "history"].includes(sub)) {
          return `Error: 'rollout ${sub}' not allowed. Only 'rollout status' and 'rollout history' are permitted.`;
        }
      }

      // auth: can-i만 허용
      if (firstArg === "auth") {
        const sub = args[1];
        if (sub !== "can-i") {
          return `Error: 'auth ${sub}' not allowed. Only 'auth can-i' is permitted.`;
        }
      }

      try {
        const { stdout } = await execFileAsync(kubectlPath, [...command.split(/\s+/), "--kubeconfig", kubeconfigPath], {
          timeout: 20_000,
          maxBuffer: 1024 * 1024 * 2,
        });
        return stdout.length > 4000 ? stdout.slice(0, 4000) + "\n...(truncated)" : stdout;
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
    {
      name: "kubectl",
      description:
        "Execute a read-only kubectl command against the monitored cluster. " +
        "Allowed commands: get, describe, logs, top, events, api-resources, rollout (status/history), auth (can-i).",
      schema: z.object({
        command: z
          .string()
          .describe("kubectl arguments without 'kubectl' prefix. " + "Example: 'get pods -n kube-system -o wide'"),
      }),
    },
  );
}

/**
 * 목적: provider 설정에 따른 LangChain 모델 인스턴스 생성
 *
 * monitor는 DI 없이 apiKey 직접 전달받으므로 LLMModelFactory와 별도 헬퍼.
 */
function createModel(config: MonitorConfig): MonitorLLMModel {
  const modelId = config.modelId ?? "claude-sonnet-4-6";

  if (!config.apiKey && config.provider !== "ollama") {
    console.warn(`[MonitorLLM] No API key for provider "${config.provider}" — LLM call will likely fail`);
  }

  switch (config.provider) {
    case "anthropic": {
      return new ChatAnthropic({
        apiKey: config.apiKey,
        model: modelId,
        temperature: 0,
        maxTokens: 8192,
      });
    }
    case "openai":
      return new ChatOpenAI({
        apiKey: config.apiKey,
        model: modelId,
        temperature: 0,
        maxTokens: 8192,
      });
    case "google":
      return new ChatGoogleGenerativeAI({
        apiKey: config.apiKey,
        model: modelId,
        temperature: 0,
      } as any);
    case "ollama":
      return new ChatOllama({
        model: modelId,
      });
    case "openrouter":
      return new ChatOpenRouter({
        model: modelId,
        apiKey: config.apiKey,
        temperature: 0,
        maxTokens: 8192,
      });
    default:
      return new ChatAnthropic({
        apiKey: config.apiKey,
        model: modelId,
        temperature: 0,
        maxTokens: 8192,
      });
  }
}
