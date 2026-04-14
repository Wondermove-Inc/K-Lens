/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * daive-image-validator.ts 단위 테스트
 * 실제 trivy Target 66개 케이스 기반 전수 검증
 */
import { isValidImageTarget, stripOsSuffix } from "../daive-image-validator";

describe("stripOsSuffix", () => {
  it("removes OS info suffix", () => {
    expect(stripOsSuffix("quay.io/argoproj/argocd:v2.13.2 (ubuntu 24.04)")).toBe("quay.io/argoproj/argocd:v2.13.2");
    expect(stripOsSuffix("grafana/loki:2.9.4 (alpine 3.18.5)")).toBe("grafana/loki:2.9.4");
    expect(stripOsSuffix("longhornio/longhorn-manager:v1.7.2 (sles 15.6)")).toBe("longhornio/longhorn-manager:v1.7.2");
    expect(stripOsSuffix("postgres:16-alpine (alpine 3.23.3)")).toBe("postgres:16-alpine");
    expect(stripOsSuffix("redis:7.0.15-alpine (alpine 3.20.3)")).toBe("redis:7.0.15-alpine");
  });

  it("does not modify clean URIs", () => {
    expect(stripOsSuffix("quay.io/argoproj/argocd:v2.13.2")).toBe("quay.io/argoproj/argocd:v2.13.2");
    expect(stripOsSuffix("nginx:latest")).toBe("nginx:latest");
    expect(stripOsSuffix("longhornio/longhorn-manager:v1.7.2")).toBe("longhornio/longhorn-manager:v1.7.2");
  });
});

describe("isValidImageTarget", () => {
  describe("FQDN registry images (valid)", () => {
    it("accepts FQDN images with OS suffix", () => {
      expect(isValidImageTarget("docker.io/grafana/grafana:10.3.3 (alpine 3.18.4)")).toBe(true);
      expect(isValidImageTarget("ghcr.io/dexidp/dex:v2.41.1 (alpine 3.20.2)")).toBe(true);
      expect(isValidImageTarget("quay.io/argoproj/argocd:v2.13.2 (ubuntu 24.04)")).toBe(true);
      expect(isValidImageTarget("quay.io/cilium/cilium:v1.19.1 (ubuntu 24.04)")).toBe(true);
      expect(isValidImageTarget("quay.io/kiwigrid/k8s-sidecar:1.30.10 (alpine 3.22.1)")).toBe(true);
    });

    it("accepts registry.k8s.io images", () => {
      expect(isValidImageTarget("registry.k8s.io/pause:3.9")).toBe(true);
      expect(isValidImageTarget("registry.k8s.io/coredns/coredns:v1.11.3")).toBe(true);
      expect(isValidImageTarget("registry.k8s.io/metrics-server/metrics-server:v0.7.2")).toBe(true);
      expect(isValidImageTarget("registry.k8s.io/ingress-nginx/controller:v1.11.2")).toBe(true);
    });

    it("accepts localhost registry", () => {
      expect(isValidImageTarget("localhost:5000/myapp:v1")).toBe(true);
    });
  });

  describe("Docker Hub short-form images (valid)", () => {
    it("accepts org/image:tag with OS suffix", () => {
      expect(isValidImageTarget("grafana/loki:2.9.4 (alpine 3.18.5)")).toBe(true);
      expect(isValidImageTarget("longhornio/longhorn-manager:v1.7.2 (sles 15.6)")).toBe(true);
      expect(isValidImageTarget("longhornio/longhorn-engine:v1.7.2 (sles 15.6)")).toBe(true);
    });

    it("accepts org/image:tag without OS suffix", () => {
      expect(isValidImageTarget("longhornio/longhorn-manager:v1.7.2")).toBe(true);
      expect(isValidImageTarget("prom/prometheus:v2.49.0")).toBe(true);
      expect(isValidImageTarget("bitnami/postgresql:16")).toBe(true);
      expect(isValidImageTarget("grafana/grafana:10.3.3")).toBe(true);
    });

    it("accepts official images with OS suffix", () => {
      expect(isValidImageTarget("postgres:16-alpine (alpine 3.23.3)")).toBe(true);
      expect(isValidImageTarget("redis:7.0.15-alpine (alpine 3.20.3)")).toBe(true);
    });

    it("accepts official images without OS suffix", () => {
      expect(isValidImageTarget("nginx:latest")).toBe(true);
      expect(isValidImageTarget("redis:7")).toBe(true);
      expect(isValidImageTarget("postgres:16-alpine")).toBe(true);
    });

    it("accepts simple names", () => {
      expect(isValidImageTarget("coredns")).toBe(true);
      expect(isValidImageTarget("go-runner")).toBe(true);
      expect(isValidImageTarget("kube-state-metrics")).toBe(true);
      expect(isValidImageTarget("metrics-server")).toBe(true);
      expect(isValidImageTarget("csi-attacher")).toBe(true);
    });
  });

  describe("binary/file paths (invalid)", () => {
    it("rejects 3+ segment paths without registry", () => {
      expect(isValidImageTarget("app/cmd/controller/controller")).toBe(false);
      expect(isValidImageTarget("app/cmd/controller/controller:latest")).toBe(false);
      expect(isValidImageTarget("usr/local/bin/argocd")).toBe(false);
      expect(isValidImageTarget("usr/local/bin/argocd:latest")).toBe(false);
      expect(isValidImageTarget("opt/cni/bin/cilium-cni")).toBe(false);
      expect(isValidImageTarget("app/cmd/webhook/webhook")).toBe(false);
      expect(isValidImageTarget("app/cmd/cainjector/cainjector")).toBe(false);
    });

    it("rejects known binary path prefixes", () => {
      expect(isValidImageTarget("bin/alertmanager")).toBe(false);
      expect(isValidImageTarget("bin/prometheus")).toBe(false);
      expect(isValidImageTarget("cni/loopback")).toBe(false);
    });
  });

  describe("invalid values", () => {
    it("rejects sha256 digests", () => {
      expect(isValidImageTarget("sha256:" + "a".repeat(64))).toBe(false);
    });

    it("rejects version strings starting with digits", () => {
      expect(isValidImageTarget("8.5.0-2ubuntu10.7")).toBe(false);
    });

    it("rejects empty/null", () => {
      expect(isValidImageTarget("")).toBe(false);
    });

    it("strips OS suffix before validation", () => {
      // longhornio/longhorn (sles 15.6) → strip → longhornio/longhorn → 2세그먼트 → valid
      expect(isValidImageTarget("longhornio/longhorn (sles 15.6)")).toBe(true);
    });
  });
});
