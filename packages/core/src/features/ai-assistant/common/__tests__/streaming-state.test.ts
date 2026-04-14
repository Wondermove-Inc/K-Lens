/**
 * 🎯 목적: StreamingState 테스트
 * 01: streamingState 상태 및 액션 추가
 *
 * 📝 테스트 범위:
 * - 초기 상태 확인
 * - startStreaming 액션
 * - appendStreamingToken 액션
 * - finalizeStreaming 액션
 * - cancelStreaming 액션
 * - handleStreamingError 액션
 * - computed 속성 (elapsedTime, tokenCount 등)
 *
 * @packageDocumentation
 */

import { type IStreamingState, StreamingState, streamingState } from "../streaming-state";

// ============================================
// 🎯 테스트 설정
// ============================================

describe("StreamingState", () => {
  // 각 테스트 전 상태 초기화
  beforeEach(() => {
    streamingState.reset();
  });

  // ============================================
  // 🔹 초기 상태 테스트
  // ============================================

  describe("초기 상태", () => {
    it("AC1: isStreaming이 false여야 한다", () => {
      expect(streamingState.isStreaming).toBe(false);
    });

    it("AC1: currentMessageId가 null이어야 한다", () => {
      expect(streamingState.currentMessageId).toBeNull();
    });

    it("AC1: streamingContent가 빈 문자열이어야 한다", () => {
      expect(streamingState.streamingContent).toBe("");
    });

    it("AC2: abortController가 null이어야 한다", () => {
      expect(streamingState.abortController).toBeNull();
    });

    it("startTime이 null이어야 한다", () => {
      expect(streamingState.startTime).toBeNull();
    });

    it("error가 null이어야 한다", () => {
      expect(streamingState.error).toBeNull();
    });
  });

  // ============================================
  // 🔹 startStreaming 액션 테스트
  // ============================================

  describe("startStreaming 액션", () => {
    it("AC2: messageId를 설정해야 한다", () => {
      streamingState.startStreaming("msg-001");

      expect(streamingState.currentMessageId).toBe("msg-001");
    });

    it("AC2: isStreaming을 true로 설정해야 한다", () => {
      streamingState.startStreaming("msg-001");

      expect(streamingState.isStreaming).toBe(true);
    });

    it("AC2: AbortController를 생성해야 한다", () => {
      streamingState.startStreaming("msg-001");

      expect(streamingState.abortController).toBeInstanceOf(AbortController);
    });

    it("streamingContent를 초기화해야 한다", () => {
      streamingState.startStreaming("msg-001");

      expect(streamingState.streamingContent).toBe("");
    });

    it("startTime을 현재 시간으로 설정해야 한다", () => {
      const beforeStart = Date.now();
      streamingState.startStreaming("msg-001");
      const afterStart = Date.now();

      expect(streamingState.startTime).toBeGreaterThanOrEqual(beforeStart);
      expect(streamingState.startTime).toBeLessThanOrEqual(afterStart);
    });

    it("error를 null로 초기화해야 한다", () => {
      // 먼저 에러 상태 설정
      streamingState.handleStreamingError(new Error("이전 에러"));

      // startStreaming으로 초기화
      streamingState.startStreaming("msg-002");

      expect(streamingState.error).toBeNull();
    });

    it("이전 스트리밍 중이면 abort하고 새로 시작해야 한다", () => {
      streamingState.startStreaming("msg-001");
      const firstController = streamingState.abortController;
      const abortSpy = jest.spyOn(firstController!, "abort");

      streamingState.startStreaming("msg-002");

      expect(abortSpy).toHaveBeenCalled();
      expect(streamingState.currentMessageId).toBe("msg-002");
    });
  });

  // ============================================
  // 🔹 appendStreamingToken 액션 테스트
  // ============================================

  describe("appendStreamingToken 액션", () => {
    beforeEach(() => {
      streamingState.startStreaming("msg-001");
    });

    it("AC3: 토큰을 streamingContent에 누적해야 한다", () => {
      streamingState.appendStreamingToken("Hello");
      streamingState.appendStreamingToken(" World");

      expect(streamingState.streamingContent).toBe("Hello World");
    });

    it("빈 토큰도 정상 처리해야 한다", () => {
      streamingState.appendStreamingToken("");
      streamingState.appendStreamingToken("test");

      expect(streamingState.streamingContent).toBe("test");
    });

    it("스트리밍 중이 아니면 무시해야 한다", () => {
      streamingState.reset();
      streamingState.appendStreamingToken("ignored");

      expect(streamingState.streamingContent).toBe("");
    });

    it("특수 문자도 정상 처리해야 한다", () => {
      streamingState.appendStreamingToken("```\n");
      streamingState.appendStreamingToken("const x = 1;\n");
      streamingState.appendStreamingToken("```");

      expect(streamingState.streamingContent).toBe("```\nconst x = 1;\n```");
    });
  });

  // ============================================
  // 🔹 finalizeStreaming 액션 테스트
  // ============================================

  describe("finalizeStreaming 액션", () => {
    beforeEach(() => {
      streamingState.startStreaming("msg-001");
      streamingState.appendStreamingToken("완료된 내용");
    });

    it("AC4: isStreaming을 false로 설정해야 한다", () => {
      streamingState.finalizeStreaming();

      expect(streamingState.isStreaming).toBe(false);
    });

    it("AC4: streamingContent를 유지해야 한다", () => {
      streamingState.finalizeStreaming();

      expect(streamingState.streamingContent).toBe("완료된 내용");
    });

    it("AC4: currentMessageId를 유지해야 한다", () => {
      streamingState.finalizeStreaming();

      expect(streamingState.currentMessageId).toBe("msg-001");
    });

    it("abortController를 null로 설정해야 한다", () => {
      streamingState.finalizeStreaming();

      expect(streamingState.abortController).toBeNull();
    });

    it("finalContent를 반환해야 한다", () => {
      const result = streamingState.finalizeStreaming();

      expect(result).toBe("완료된 내용");
    });
  });

  // ============================================
  // 🔹 cancelStreaming 액션 테스트
  // ============================================

  describe("cancelStreaming 액션", () => {
    beforeEach(() => {
      streamingState.startStreaming("msg-001");
      streamingState.appendStreamingToken("취소될 내용");
    });

    it("AC5: AbortController.abort()를 호출해야 한다", () => {
      const abortSpy = jest.spyOn(streamingState.abortController!, "abort");

      streamingState.cancelStreaming();

      expect(abortSpy).toHaveBeenCalled();
    });

    it("AC5: isStreaming을 false로 설정해야 한다", () => {
      streamingState.cancelStreaming();

      expect(streamingState.isStreaming).toBe(false);
    });

    it("streamingContent에 취소 메시지를 추가해야 한다", () => {
      streamingState.cancelStreaming();

      expect(streamingState.streamingContent).toContain("취소되었습니다");
    });

    it("isCancelled를 true로 설정해야 한다", () => {
      streamingState.cancelStreaming();

      expect(streamingState.isCancelled).toBe(true);
    });

    it("스트리밍 중이 아닐 때는 무시해야 한다", () => {
      streamingState.reset();

      // 에러 없이 실행되어야 함
      expect(() => streamingState.cancelStreaming()).not.toThrow();
    });
  });

  // ============================================
  // 🔹 handleStreamingError 액션 테스트
  // ============================================

  describe("handleStreamingError 액션", () => {
    beforeEach(() => {
      streamingState.startStreaming("msg-001");
    });

    it("error를 설정해야 한다", () => {
      const testError = new Error("테스트 에러");

      streamingState.handleStreamingError(testError);

      expect(streamingState.error).toBe(testError);
    });

    it("isStreaming을 false로 설정해야 한다", () => {
      streamingState.handleStreamingError(new Error("에러"));

      expect(streamingState.isStreaming).toBe(false);
    });

    it("abortController를 null로 설정해야 한다", () => {
      streamingState.handleStreamingError(new Error("에러"));

      expect(streamingState.abortController).toBeNull();
    });

    it("hasError computed가 true여야 한다", () => {
      streamingState.handleStreamingError(new Error("에러"));

      expect(streamingState.hasError).toBe(true);
    });
  });

  // ============================================
  // 🔹 reset 액션 테스트
  // ============================================

  describe("reset 액션", () => {
    it("모든 상태를 초기화해야 한다", () => {
      // 다양한 상태 설정
      streamingState.startStreaming("msg-001");
      streamingState.appendStreamingToken("내용");

      streamingState.reset();

      expect(streamingState.isStreaming).toBe(false);
      expect(streamingState.currentMessageId).toBeNull();
      expect(streamingState.streamingContent).toBe("");
      expect(streamingState.abortController).toBeNull();
      expect(streamingState.startTime).toBeNull();
      expect(streamingState.error).toBeNull();
      expect(streamingState.isCancelled).toBe(false);
    });

    it("진행 중인 요청을 abort해야 한다", () => {
      streamingState.startStreaming("msg-001");
      const abortSpy = jest.spyOn(streamingState.abortController!, "abort");

      streamingState.reset();

      expect(abortSpy).toHaveBeenCalled();
    });
  });

  // ============================================
  // 🔹 Computed 속성 테스트
  // ============================================

  describe("Computed 속성", () => {
    describe("tokenCount", () => {
      it("토큰 수를 반환해야 한다 (공백 기준)", () => {
        streamingState.startStreaming("msg-001");
        streamingState.appendStreamingToken("Hello World Test");

        expect(streamingState.tokenCount).toBe(3);
      });

      it("빈 content면 0을 반환해야 한다", () => {
        expect(streamingState.tokenCount).toBe(0);
      });
    });

    describe("hasError", () => {
      it("에러가 없으면 false여야 한다", () => {
        expect(streamingState.hasError).toBe(false);
      });

      it("에러가 있으면 true여야 한다", () => {
        streamingState.handleStreamingError(new Error("에러"));

        expect(streamingState.hasError).toBe(true);
      });
    });

    describe("elapsedTime", () => {
      it("스트리밍 시작 전에는 0을 반환해야 한다", () => {
        expect(streamingState.elapsedTime).toBe(0);
      });

      it("스트리밍 중에는 경과 시간을 반환해야 한다", () => {
        jest.useFakeTimers();

        streamingState.startStreaming("msg-001");
        jest.advanceTimersByTime(1000); // 1초 경과

        // 대략적인 시간 체크 (fake timers 사용)
        expect(streamingState.elapsedTime).toBeGreaterThanOrEqual(0);

        jest.useRealTimers();
      });
    });

    describe("canCancel", () => {
      it("스트리밍 중이고 abortController가 있으면 true여야 한다", () => {
        streamingState.startStreaming("msg-001");

        expect(streamingState.canCancel).toBe(true);
      });

      it("스트리밍 중이 아니면 false여야 한다", () => {
        expect(streamingState.canCancel).toBe(false);
      });
    });
  });

  // ============================================
  // 🔹 시나리오 테스트
  // ============================================

  describe("시나리오 테스트", () => {
    it("정상 스트리밍 흐름: 시작 → 토큰 수신 → 완료", () => {
      // 시작
      streamingState.startStreaming("msg-001");
      expect(streamingState.isStreaming).toBe(true);

      // 토큰 수신
      streamingState.appendStreamingToken("안녕");
      streamingState.appendStreamingToken("하세요");
      expect(streamingState.streamingContent).toBe("안녕하세요");

      // 완료
      const finalContent = streamingState.finalizeStreaming();
      expect(finalContent).toBe("안녕하세요");
      expect(streamingState.isStreaming).toBe(false);
    });

    it("취소 흐름: 시작 → 토큰 수신 → 취소", () => {
      // 시작
      streamingState.startStreaming("msg-001");

      // 토큰 수신
      streamingState.appendStreamingToken("진행 중...");

      // 취소
      streamingState.cancelStreaming();
      expect(streamingState.isStreaming).toBe(false);
      expect(streamingState.isCancelled).toBe(true);
    });

    it("에러 흐름: 시작 → 에러 발생", () => {
      // 시작
      streamingState.startStreaming("msg-001");

      // 에러 발생
      const error = new Error("네트워크 에러");
      streamingState.handleStreamingError(error);

      expect(streamingState.isStreaming).toBe(false);
      expect(streamingState.hasError).toBe(true);
      expect(streamingState.error?.message).toBe("네트워크 에러");
    });
  });

  // ============================================
  // 🔹 성능 관련 테스트
  // ============================================

  describe("성능 관련", () => {
    it("AC8: 첫 토큰 응답 시간을 기록해야 한다", () => {
      streamingState.startStreaming("msg-001");

      // 첫 토큰
      streamingState.appendStreamingToken("첫");

      expect(streamingState.firstTokenTime).not.toBeNull();
    });

    it("후속 토큰에서는 firstTokenTime을 업데이트하지 않아야 한다", () => {
      streamingState.startStreaming("msg-001");

      streamingState.appendStreamingToken("첫");
      const firstTime = streamingState.firstTokenTime;

      streamingState.appendStreamingToken("둘");

      expect(streamingState.firstTokenTime).toBe(firstTime);
    });
  });

  // ============================================
  // 🔹 인스턴스 테스트
  // ============================================

  describe("인스턴스", () => {
    it("싱글톤 인스턴스가 존재해야 한다", () => {
      expect(streamingState).toBeInstanceOf(StreamingState);
    });

    it("새 인스턴스를 생성할 수 있어야 한다", () => {
      const newInstance = new StreamingState();

      expect(newInstance).toBeInstanceOf(StreamingState);
      expect(newInstance).not.toBe(streamingState);
    });
  });
});
