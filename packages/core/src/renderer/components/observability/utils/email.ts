/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Observability 이메일 관련 유틸리티 함수
 */

import { shell } from "electron";
import { CONTACT_EMAIL } from "./constants";

/**
 * Contact Sales 이메일 템플릿을 생성합니다.
 */
const createContactEmailBody = (): string => {
  return `Hello,

I'd like to get in touch regarding Skuber+.


Name:
Company:
Contact:
Company Size: [1-10, 11-50, 51-200, 201-500, 501-1000, 1000+]
Inquiry: [e.g., Plan details, Re-subscription, Technical support, Partnership, etc.]


Please get back to me at your earliest convenience.
Looking forward to your response.`;
};

/**
 * Contact Sales 이메일 클라이언트(Outlook 등)를 엽니다.
 */
export const openContactSalesEmail = () => {
  const subject = "Inquiry about Skuber+ Observability";
  const body = createContactEmailBody();

  // encodeURIComponent를 사용하여 올바른 URL 인코딩 적용
  const mailtoUrl = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  // Electron 환경에서 shell.openExternal 사용
  shell.openExternal(mailtoUrl).catch((error) => {
    console.error("Failed to open email client:", error);
  });
};
