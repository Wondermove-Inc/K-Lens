/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Observability 관련 타입 정의
 */

export interface Feature {
  title: string;
  description: string;
  imageDark: string;
  imageLight: string;
}

export interface CloudLogo {
  srcDark: string;
  srcLight: string;
  alt: string;
}

export interface InfoItem {
  key: string;
  value: string | string[];
}
