/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "@csstools/postcss-oklab-function": { preserve: true },
    "@tailwindcss/postcss": {},
  },
};

export default config;
