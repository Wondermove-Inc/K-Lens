/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Observability 헤더 컴포넌트
 */

import { ArrowUpRight } from "lucide-react";
import React from "react";
import { Button } from "../../shadcn-ui/button";
import { LEARN_MORE_URL } from "../utils/constants";
import { openContactSalesEmail } from "../utils/email";

interface ObservabilityHeaderProps {
  isDark: boolean;
}

const SkuberLogo = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 1024 1024"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0 }}
  >
    <g clipPath="url(#clip0)">
      <g filter="url(#filter0_i)">
        <path
          d="M512 1024C794.77 1024 1024 794.77 1024 512C1024 229.23 794.77 0 512 0C229.23 0 0 229.23 0 512C0 794.77 229.23 1024 512 1024Z"
          fill="url(#paint0_radial)"
        />
      </g>
      <g filter="url(#filter1_di)">
        <path
          d="M511.791 97.6111C282.802 97.6111 97.3398 283.245 97.3398 512.063C97.3398 740.88 282.974 926.514 511.791 926.514C740.609 926.514 926.243 740.88 926.243 512.063C926.243 283.245 740.781 97.6111 511.791 97.6111ZM701.555 460.278L563.576 322.299L613.469 272.407C651.49 234.385 713.254 234.385 751.447 272.407C789.469 310.428 789.469 372.192 751.447 410.385L701.555 460.278ZM751.447 613.568C789.469 651.589 789.469 713.353 751.447 751.546C713.426 789.568 651.662 789.568 613.469 751.546L563.576 701.654L701.555 563.675L751.447 613.568ZM511.791 649.869L442.974 581.052H511.791L374.157 512.235L373.813 511.891L511.791 373.912L580.781 442.901H511.791L649.598 511.891L511.619 649.869H511.791ZM272.136 751.718C234.114 713.697 234.114 651.934 272.136 613.74L322.2 563.675L460.178 701.654L410.114 751.718C372.092 789.74 310.329 789.74 272.136 751.718ZM272.136 410.213C234.114 372.192 234.114 310.428 272.136 272.235C310.157 234.213 371.92 234.213 410.114 272.235L460.178 322.299L322.2 460.278L272.136 410.213ZM612.609 185.869C594.2 194.127 576.996 205.654 561.856 220.794L511.963 270.686L462.071 220.794C446.931 205.654 429.727 194.127 411.318 185.869C443.146 176.063 476.867 170.729 511.963 170.729C547.06 170.729 580.781 176.063 612.781 185.869H612.609ZM185.77 411.073C194.028 429.482 205.555 446.858 220.695 461.998L270.587 511.891L220.695 561.783C205.555 576.923 194.028 594.299 185.77 612.88C175.963 581.052 170.63 547.159 170.63 512.063C170.63 476.966 175.963 443.073 185.77 411.073ZM411.146 838.256C429.555 829.998 446.931 818.471 462.243 803.331L512.135 753.439L562.028 803.331C577.168 818.471 594.544 829.998 612.953 838.256C581.125 848.063 547.232 853.396 511.963 853.396C476.695 853.396 442.974 848.063 411.146 838.256ZM838.329 612.708C830.071 594.299 818.544 577.095 803.404 561.955L753.512 512.063L803.404 462.17C818.544 447.03 830.071 429.826 838.329 411.417C848.135 443.245 853.469 477.138 853.469 512.235C853.469 547.331 848.135 581.052 838.329 612.88V612.708Z"
          fill="url(#paint1_linear)"
          shapeRendering="crispEdges"
        />
      </g>
    </g>
    <defs>
      <filter
        id="filter0_i"
        x="0"
        y="0"
        width="1024"
        height="1029"
        filterUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix" />
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
        <feColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset dy="5" />
        <feGaussianBlur stdDeviation="12.5" />
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.036628 0 0 0 0 0.08777 0 0 0 0 0.317909 0 0 0 0.2 0" />
        <feBlend mode="normal" in2="shape" result="effect1_innerShadow" />
      </filter>
      <filter
        id="filter1_di"
        x="82.3398"
        y="87.6111"
        width="858.902"
        height="858.903"
        filterUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix" />
        <feColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset dy="5" />
        <feGaussianBlur stdDeviation="7.5" />
        <feComposite in2="hardAlpha" operator="out" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.0352941 0 0 0 0 0.0862745 0 0 0 0 0.317647 0 0 0 0.2 0" />
        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
        <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
        <feColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset dy="-4" />
        <feGaussianBlur stdDeviation="7.5" />
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
        <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0" />
        <feBlend mode="normal" in2="shape" result="effect2_innerShadow" />
      </filter>
      <radialGradient
        id="paint0_radial"
        cx="0"
        cy="0"
        r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="translate(206.5 224.5) rotate(43.1836) scale(1003.89 887.736)"
      >
        <stop offset="0.2" stopColor="#328EFF" />
        <stop offset="0.5" stopColor="#216AFF" />
        <stop offset="0.85" stopColor="#004AE2" />
        <stop offset="1" stopColor="#216AFF" />
      </radialGradient>
      <linearGradient
        id="paint1_linear"
        x1="511.791"
        y1="97.6111"
        x2="511.791"
        y2="926.514"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0.65" stopColor="white" />
        <stop offset="1" stopColor="white" stopOpacity="0.88" />
      </linearGradient>
      <clipPath id="clip0">
        <rect width="1024" height="1024" fill="white" />
      </clipPath>
    </defs>
  </svg>
);

export const ObservabilityHeader = ({ isDark }: ObservabilityHeaderProps) => {
  return (
    <header className="shrink-0">
      {/* 1행: 로고 + 타이틀 + WONDERMOVE ————— Contact Sales / Learn more */}
      <div className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          <SkuberLogo />
          <div className="flex flex-col">
            <span className="text-foreground text-2xl font-medium">Skuber⁺ Observability</span>
            <span className="text-muted-foreground text-xs font-normal leading-none">WONDERMOVE, Inc.</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="default"
            className="w-[130px]"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openContactSalesEmail();
            }}
          >
            Contact Sales
          </Button>
          <Button
            variant="default"
            size="default"
            className="w-[130px] gap-2 [color:var(--color-primary-foreground)]"
            onClick={() => window.open(LEARN_MORE_URL, "_blank", "noreferrer")}
          >
            Learn more
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 2행: Category / Language / CSP / Price */}
      <div
        style={{
          borderTop: "1px solid var(--accent)",
          borderBottom: "1px solid var(--accent)",
          padding: "24px 0",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <div className="flex flex-col">
          <span className="text-muted-foreground text-sm leading-none">Category</span>
          <span className="text-primary text-xl font-medium mt-0.5">Monitoring</span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground text-sm leading-none">Language</span>
          <span className="text-primary text-xl font-medium mt-0.5">English</span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground text-sm leading-none">CSP</span>
          <span className="text-primary text-xl font-medium mt-0.5">All k8s Clusters</span>
        </div>
        <div className="flex flex-col pr-12">
          <span className="text-muted-foreground text-sm leading-none">Price</span>
          <span className="text-primary text-xl font-medium mt-0.5">Contact Sales</span>
        </div>
      </div>
    </header>
  );
};
