/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Observability 데이터 정의
 */

import React from "react";
import * as images from "./images";

import type { CloudLogo, Feature, InfoItem } from "./types";

// LogoSkuber SVG Component
export const LogoSkuber = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="url(#paint0_linear)" />
    <path
      d="M24 12L14 18V30L24 36L34 30V18L24 12Z"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M24 12V36" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 18L34 30" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M34 18L14 30" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <defs>
      <linearGradient id="paint0_linear" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop stopColor="#3B82F6" />
        <stop offset="1" stopColor="#1E40AF" />
      </linearGradient>
    </defs>
  </svg>
);

// Info table data
export const INFO_TABLE: InfoItem[] = [
  { key: "Version", value: "v0.0.1" },
  { key: "Latest Updates", value: "Jan 14, 2026" },
  { key: "Provider", value: "WONDERMOVE, Inc." },
  {
    key: "Hardware Recommendations",
    value: ["CPU: 2 Core", "RAM: 4GB ~ 8GB", "Disk: 100GB +"],
  },
];

// Features data
export const FEATURES: Feature[] = [
  {
    title: "Logs Explorer",
    description: "Search and analyze logs across multi-cluster environments in one place.",
    imageDark: images.logsImgDark,
    imageLight: images.logsImgLight,
  },
  {
    title: "Real-time Metrics Dashboard",
    description: "Collect and visualize infrastructure metrics like CPU, memory, and network in real-time.",
    imageDark: images.realTimeImgDark,
    imageLight: images.realTimeImgLight,
  },
  {
    title: "Distributed Tracing",
    description: "Track request flows across microservices and identify bottlenecks.",
    imageDark: images.traceImgDark,
    imageLight: images.traceImgLight,
  },
  {
    title: "Cross-Cloud Service Map",
    description: "Visualize dependencies and traffic flow across all multi-cloud services.",
    imageDark: images.servicemapImgDark,
    imageLight: images.servicemapImgLight,
  },
  {
    title: "Service Monitoring",
    description: "Analyze P99 latency, error rate, Apdex score, and API endpoint performance per service.",
    imageDark: images.serviceImgDark,
    imageLight: images.serviceImgLight,
  },
  {
    title: "Insight Dashboard",
    description: "Monitor key metrics like SLA compliance, response time, and error rates.",
    imageDark: images.insightImgDark,
    imageLight: images.insightImgLight,
  },
];

// Cloud logos data
export const CLOUD_LOGOS: CloudLogo[] = [
  { srcDark: images.eksLogoDark, srcLight: images.eksLogoLight, alt: "EKS" },
  { srcDark: images.aksLogoDark, srcLight: images.aksLogoLight, alt: "AKS" },
  { srcDark: images.gkeLogoDark, srcLight: images.gkeLogoLight, alt: "GKE" },
  { srcDark: images.okeLogoDark, srcLight: images.okeLogoLight, alt: "OKE" },
  { srcDark: images.alibabaLogoDark, srcLight: images.alibabaLogoLight, alt: "Alibaba Cloud" },
  { srcDark: images.cloudLogoDark, srcLight: images.cloudLogoLight, alt: "Kubernetes" },
  { srcDark: images.tencentLogoDark, srcLight: images.tencentLogoLight, alt: "Tencent Cloud" },
];

// Main images
export const MAIN_IMAGES = {
  dark: images.mainImgDark,
  light: images.mainImgLight,
};

// Footer images
export const FOOTER_IMAGES = {
  dark: images.footerImgDark,
  light: images.footerImgLight,
};
