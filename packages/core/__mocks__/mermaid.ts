/**
 * mermaid 모킹
 *
 * 🎯 목적: Jest 테스트 시 mermaid ESM 문제 해결
 *
 * 문제: mermaid 패키지가 ESM export를 사용하며
 * Jest에서 파싱 오류 발생 (Cannot use import statement outside a module)
 *
 * 해결: mermaid Mock 제공
 *
 * 📝 2026-01-18: - MermaidRenderer 테스트 지원
 */

/**
 * mermaid Mock 객체
 */
const mermaid = {
  /**
   * mermaid 초기화
   */
  initialize: jest.fn(),

  /**
   * mermaid 렌더링
   * @returns Promise<{ svg: string }> - 렌더링된 SVG 문자열
   */
  render: jest.fn().mockResolvedValue({
    svg: '<svg data-testid="mermaid-svg" class="mock-mermaid"><text>Mock Mermaid Diagram</text></svg>',
  }),

  /**
   * mermaid 문법 검증
   * @returns Promise<boolean> - 검증 결과 (항상 true)
   */
  parse: jest.fn().mockResolvedValue(true),
};

export default mermaid;
module.exports = mermaid;
