import HandlebarsRuntime from "handlebars/runtime";

import type { TemplateDelegate } from "handlebars";

const handlebarsModule: typeof import("handlebars") = require("handlebars");

/**
 * 🎯 목적: 핸들바 템플릿을 사전 컴파일해 런타임에서는 runtime 패키지만 사용
 * @param source 원본 템플릿 문자열
 * @returns 템플릿 함수
 */
export const precompileHandlebarsTemplate = (source: string): TemplateDelegate => {
  const templateSpecSource = handlebarsModule.precompile(source, { compat: false });
  // eslint-disable-next-line no-new-func
  const templateSpec = new Function(`return ${templateSpecSource};`)();
  return HandlebarsRuntime.template(templateSpec);
};
