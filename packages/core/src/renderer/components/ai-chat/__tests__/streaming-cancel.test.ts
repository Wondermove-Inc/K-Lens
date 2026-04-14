/**
 * 🎯 목적: 스트리밍 취소 기능 테스트
 * 02: 취소 버튼 및 AbortController 통합
 *
 * 📝 테스트 범위:
 * - cancelStreaming 호출 시 streamingState 상태 변경
 * - AbortController signal.aborted 확인
 * - 취소 메시지 추가 확인
 * - isCancelled 플래그 설정 확인
 *
 * @packageDocumentation
 */

import { streamingState } from "../../../../features/ai-assistant/common/streaming-state";

// ============================================
// 🎯 테스트 설정
// ============================================

describe("스트리밍 취소 기능", () => {
  beforeEach(() => {
    streamingState.reset();
  });

  afterEach(() => {
    streamingState.reset();
  });

  // ============================================
  // 🔹 cancelStreaming 테스트
  // ============================================

  describe("cancelStreaming", () => {
    it("AC1: 스트리밍 중일 때 취소하면 isStreaming=false가 되어야 함", () => {
      streamingState.startStreaming("msg-001");
      expect(streamingState.isStreaming).toBe(true);

      streamingState.cancelStreaming();

      expect(streamingState.isStreaming).toBe(false);
    });

    it("AC2: 취소 시 isCancelled=true가 되어야 함", () => {
      streamingState.startStreaming("msg-002");
      expect(streamingState.isCancelled).toBe(false);

      streamingState.cancelStreaming();

      expect(streamingState.isCancelled).toBe(true);
    });

    it("AC3: 취소 시 취소 메시지가 추가되어야 함", () => {
      streamingState.startStreaming("msg-003");
      streamingState.appendStreamingToken("Hello");

      streamingState.cancelStreaming();

      expect(streamingState.streamingContent).toContain("[응답이 취소되었습니다]");
    });

    it("AC4: AbortController.abort()가 호출되어야 함", () => {
      streamingState.startStreaming("msg-004");
      const abortController = streamingState.abortController;

      expect(abortController).not.toBeNull();
      expect(abortController?.signal.aborted).toBe(false);

      streamingState.cancelStreaming();

      expect(abortController?.signal.aborted).toBe(true);
    });

    it("스트리밍 중이 아닐 때 취소해도 에러가 발생하지 않아야 함", () => {
      expect(streamingState.isStreaming).toBe(false);

      expect(() => {
        streamingState.cancelStreaming();
      }).not.toThrow();

      expect(streamingState.isCancelled).toBe(false);
    });

    it("취소 후 abortController는 null이 되어야 함", () => {
      streamingState.startStreaming("msg-005");
      expect(streamingState.abortController).not.toBeNull();

      streamingState.cancelStreaming();

      expect(streamingState.abortController).toBeNull();
    });
  });

  // ============================================
  // 🔹 canCancel computed 테스트
  // ============================================

  describe("canCancel computed", () => {
    it("스트리밍 중이고 abortController가 있으면 true", () => {
      streamingState.startStreaming("msg-006");

      expect(streamingState.canCancel).toBe(true);
    });

    it("스트리밍 중이 아니면 false", () => {
      expect(streamingState.canCancel).toBe(false);
    });

    it("취소 후 false", () => {
      streamingState.startStreaming("msg-007");
      streamingState.cancelStreaming();

      expect(streamingState.canCancel).toBe(false);
    });
  });

  // ============================================
  // 🔹 AbortController signal 테스트
  // ============================================

  describe("AbortController signal", () => {
    it("abort 이벤트 리스너가 동작해야 함", () => {
      streamingState.startStreaming("msg-008");
      const abortHandler = jest.fn();

      streamingState.abortController?.signal.addEventListener("abort", abortHandler);
      streamingState.cancelStreaming();

      expect(abortHandler).toHaveBeenCalledTimes(1);
    });

    it("새 스트리밍 시작 시 새 AbortController가 생성되어야 함", () => {
      streamingState.startStreaming("msg-009");
      const firstController = streamingState.abortController;

      streamingState.cancelStreaming();
      streamingState.startStreaming("msg-010");

      expect(streamingState.abortController).not.toBe(firstController);
      expect(streamingState.abortController?.signal.aborted).toBe(false);
    });
  });

  // ============================================
  // 🔹 시나리오 테스트
  // ============================================

  describe("시나리오 테스트", () => {
    it("스트리밍 → 토큰 수신 → 취소 흐름", () => {
      // 시작
      streamingState.startStreaming("scenario-001");
      expect(streamingState.isStreaming).toBe(true);

      // 토큰 수신
      streamingState.appendStreamingToken("안녕하세요, ");
      streamingState.appendStreamingToken("도움이 필요하시");

      expect(streamingState.streamingContent).toBe("안녕하세요, 도움이 필요하시");

      // 취소
      streamingState.cancelStreaming();

      // 검증
      expect(streamingState.isStreaming).toBe(false);
      expect(streamingState.isCancelled).toBe(true);
      expect(streamingState.streamingContent).toContain("안녕하세요, 도움이 필요하시");
      expect(streamingState.streamingContent).toContain("[응답이 취소되었습니다]");
    });

    it("이전 스트리밍이 진행 중일 때 새 스트리밍 시작하면 이전 것이 abort되어야 함", () => {
      streamingState.startStreaming("msg-old");
      const oldController = streamingState.abortController;

      expect(oldController?.signal.aborted).toBe(false);

      // 새 스트리밍 시작
      streamingState.startStreaming("msg-new");

      // 이전 abortController는 abort됨
      expect(oldController?.signal.aborted).toBe(true);
      // 새 abortController는 정상
      expect(streamingState.abortController?.signal.aborted).toBe(false);
    });

    it("reset 호출 시 진행 중인 스트리밍이 abort되어야 함", () => {
      streamingState.startStreaming("msg-reset");
      const controller = streamingState.abortController;

      expect(controller?.signal.aborted).toBe(false);

      streamingState.reset();

      expect(controller?.signal.aborted).toBe(true);
      expect(streamingState.isStreaming).toBe(false);
      expect(streamingState.isCancelled).toBe(false);
    });
  });
});
