/**
 * remark-gfm 모킹
 *
 * 🎯 목적: Jest 테스트 시 remark-gfm ESM 문제 해결
 *
 * 문제: remark-gfm 패키지가 ESM을 사용하여 Jest에서 오류 발생
 *
 * 해결: 빈 플러그인 함수 반환
 */

/**
 * remarkGfm Mock
 * 📝 빈 remark 플러그인 반환
 */
function remarkGfm() {
  // 빈 플러그인 - 테스트에서 실제 GFM 변환 불필요
  return function transformer() {
    // no-op
  };
}

export default remarkGfm;
