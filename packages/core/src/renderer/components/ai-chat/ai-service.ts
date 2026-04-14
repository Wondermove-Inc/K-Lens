/**
 * 🎯 목적: DAIVE AI 서비스 (단순화된 버전)
 *
 * 기존 AI Extension의 복잡한 로직을 단순화하여
 * 메인 애플리케이션에서 사용할 수 있는 AI 서비스를 제공합니다.
 *
 * 📝 주요 기능:
 * - OpenAI, Gemini, Claude API 지원
 * - API 키 관리
 * - 간단한 채팅 인터페이스
 * - 쿠버네티스 컨텍스트 인식
 */

export interface ChatMessage {
  id: number;
  text: string;
  isAi: boolean;
  timestamp: Date;
}

export interface ApiConfig {
  provider: "openai" | "claude";
  apiKey: string;
}

export class AIService {
  private apiConfig: ApiConfig | null = null;
  private messages: ChatMessage[] = [];

  // 🔑 API 키 설정
  setApiConfig(config: ApiConfig) {
    this.apiConfig = config;
    // TODO: localStorage에 저장 (암호화 필요)
    localStorage.setItem(
      "daive-ai-config",
      JSON.stringify({
        provider: config.provider,
        // 보안상 API 키는 세션에만 저장
      }),
    );
  }

  // 🔍 API 키 확인
  isConfigured(): boolean {
    return this.apiConfig !== null && this.apiConfig.apiKey.length > 0;
  }

  // 💬 메시지 전송
  async sendMessage(text: string): Promise<ChatMessage> {
    if (!this.isConfigured()) {
      throw new Error("AI API가 설정되지 않았습니다.");
    }

    // 사용자 메시지 추가
    const userMessage: ChatMessage = {
      id: Date.now(),
      text,
      isAi: false,
      timestamp: new Date(),
    };
    this.messages.push(userMessage);

    // AI 응답 생성
    try {
      const aiResponse = await this.callAI(text);
      const aiMessage: ChatMessage = {
        id: Date.now() + 1,
        text: aiResponse,
        isAi: true,
        timestamp: new Date(),
      };
      this.messages.push(aiMessage);

      return aiMessage;
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: Date.now() + 1,
        text: `죄송합니다. AI 서비스에 오류가 발생했습니다: ${error}`,
        isAi: true,
        timestamp: new Date(),
      };
      this.messages.push(errorMessage);

      return errorMessage;
    }
  }

  // 🤖 실제 AI API 호출
  private async callAI(userMessage: string): Promise<string> {
    if (!this.apiConfig) {
      throw new Error("API 설정이 없습니다.");
    }

    const { provider, apiKey } = this.apiConfig;

    // 쿠버네티스 컨텍스트 추가
    const kubernetesContext = this.getKubernetesContext();
    const systemPrompt = `당신은 DAIVE AI 어시스턴트입니다. 쿠버네티스 관련 질문에 전문적으로 답변해주세요.

현재 쿠버네티스 컨텍스트:
${kubernetesContext}

사용자의 질문에 대해 실용적이고 정확한 답변을 제공해주세요.`;

    switch (provider) {
      case "openai":
        return await this.callOpenAI(systemPrompt, userMessage, apiKey);
      case "claude":
        return await this.callClaude(systemPrompt, userMessage, apiKey);
      default:
        throw new Error(`지원하지 않는 AI 제공업체: ${provider}`);
    }
  }

  // 🌐 OpenAI API 호출
  private async callOpenAI(systemPrompt: string, userMessage: string, apiKey: string): Promise<string> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API 오류: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "응답을 생성할 수 없습니다.";
  }

  // 🔮 Google Gemini API 호출
  // 🚫 Google Gemini 지원은 현재 비활성화됨

  // 🎭 Anthropic Claude API 호출
  private async callClaude(systemPrompt: string, userMessage: string, apiKey: string): Promise<string> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API 오류: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.content[0]?.text || "응답을 생성할 수 없습니다.";
  }

  // 🔍 쿠버네티스 컨텍스트 정보 수집
  private getKubernetesContext(): string {
    // TODO: 실제 쿠버네티스 컨텍스트 정보 수집
    // 현재는 시뮬레이션
    return `- 연결된 클러스터: Local Development Cluster
- 네임스페이스: default
- 활성 리소스: Pod, Service, Deployment 등
- 클러스터 상태: 정상`;
  }

  // 📝 메시지 히스토리 조회
  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  // 🗑️ 메시지 히스토리 초기화
  clearMessages() {
    this.messages = [];
  }

  // 🔄 저장된 설정 복원
  restoreConfig(): ApiConfig | null {
    try {
      const saved = localStorage.getItem("daive-ai-config");
      if (saved) {
        const config = JSON.parse(saved);
        // API 키는 보안상 세션에서만 유지
        return {
          provider: config.provider,
          apiKey: "", // 빈 문자열로 초기화
        };
      }
    } catch (error) {
      console.warn("AI 설정 복원 실패:", error);
    }
    return null;
  }
}

// 🎯 싱글톤 인스턴스
export const aiService = new AIService();
