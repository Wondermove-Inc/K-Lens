/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { render, screen } from "@testing-library/react";
import React from "react";
import { HelmChartIcon } from "../icon";

describe("HelmChartIcon", () => {
  it("renders the placeholder image by default", () => {
    render(<HelmChartIcon />);
    const imageContainer = screen.getByTestId("image-container");

    expect(imageContainer.style.backgroundImage).toContain("data:image/svg+xml");
  });

  it("renders image-container div with testid", () => {
    render(<HelmChartIcon imageUrl="https://example.com/image.jpg" />);
    const imageContainer = screen.getByTestId("image-container");

    expect(imageContainer).toBeInTheDocument();
  });

  it("renders placeholder initially for http urls (async load)", () => {
    render(<HelmChartIcon imageUrl="https://example.com/image.jpg" />);
    const imageContainer = screen.getByTestId("image-container");

    // 초기 상태에서는 placeholder가 표시됨 (이미지 로드 전)
    expect(imageContainer.style.backgroundImage).toContain("data:image/svg+xml");
  });

  it("renders placeholder for empty imageUrl", () => {
    render(<HelmChartIcon imageUrl="" />);
    const imageContainer = screen.getByTestId("image-container");

    expect(imageContainer.style.backgroundImage).toContain("data:image/svg+xml");
  });

  it("renders data url directly without async load", () => {
    const dataUrl = "data:image/png;base64,abc123";

    render(<HelmChartIcon imageUrl={dataUrl} />);
    const imageContainer = screen.getByTestId("image-container");

    expect(imageContainer.style.backgroundImage).toBe(`url(${dataUrl})`);
  });
});
