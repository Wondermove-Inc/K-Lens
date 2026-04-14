/**
 * 🎯 목적: Tailwind CSS 처리를 위한 PostCSS 설정
 * 📝 주의사항: storybook-shadcn의 globals.css를 프로젝트 전체에서 사용하기 위한 설정
 * 🔄 변경이력: 2025-10-17 - 초기 생성 (Tailwind CSS 중앙화)
 */

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "@csstools/postcss-oklab-function": { preserve: true },
    "@tailwindcss/postcss": {},
  },
};

export default config;
