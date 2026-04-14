/**
 * pkce-challenge 모킹
 *
 * 🎯 목적: Jest 테스트 시 pkce-challenge ESM 문제 해결
 *
 * 문제: pkce-challenge 패키지가 ESM export를 사용하며
 * Jest에서 파싱 오류 발생
 *
 * 해결: PKCE 챌린지 생성을 위한 Mock 함수 제공
 */

/**
 * PKCE Code Verifier 생성
 * 📝 테스트용 고정 문자열 반환
 */
export function generateVerifier(): string {
  return "mock-code-verifier-for-testing-1234567890";
}

/**
 * PKCE Challenge 생성
 * 📝 테스트용 고정 문자열 반환
 */
export async function generateChallenge(verifier?: string): Promise<string> {
  return "mock-code-challenge-for-testing-abcdefghij";
}

/**
 * PKCE Code Challenge와 Verifier 쌍 생성
 * 📝 테스트용 고정 값 반환
 */
export interface PKCEChallenge {
  code_verifier: string;
  code_challenge: string;
}

export async function pkceChallenge(): Promise<PKCEChallenge> {
  return {
    code_verifier: "mock-code-verifier-for-testing-1234567890",
    code_challenge: "mock-code-challenge-for-testing-abcdefghij",
  };
}

/**
 * Code Verifier 검증
 * 📝 항상 true 반환 (테스트에서는 검증 스킵)
 */
export function verifyChallenge(verifier: string, challenge: string): Promise<boolean> {
  return Promise.resolve(true);
}

// 기본 내보내기
export default {
  generateVerifier,
  generateChallenge,
  pkceChallenge,
  verifyChallenge,
};
