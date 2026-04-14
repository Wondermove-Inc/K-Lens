/**
 * 🎯 목적: Context Types 모듈 단위 테스트
 *
 * 01: Context 타입 정의
 *
 * 테스트 범위:
 * - ContextType 열거형 검증
 * - ContextItem 인터페이스 구조 검증
 * - 유틸리티 함수 동작 검증
 * - 타입 가드 함수 검증
 *
 * @packageDocumentation
 */

import {
  CONTEXT_TYPE_METADATA,
  type ContextItem,
  ContextType,
  createContextItem,
  getContextTypeIcon,
  getContextTypeLabel,
  getContextTypePriority,
  isValidContextType,
} from "../context-types";

describe("Context Types 모듈", () => {
  describe("ContextType 열거형", () => {
    it("AC1: Kubernetes 리소스 타입이 정의되어 있어야 한다", () => {
      // Pod, Deployment, Service, Node, Namespace 등
      expect(ContextType.POD).toBeDefined();
      expect(ContextType.DEPLOYMENT).toBeDefined();
      expect(ContextType.SERVICE).toBeDefined();
      expect(ContextType.NODE).toBeDefined();
      expect(ContextType.NAMESPACE).toBeDefined();
      expect(ContextType.CONFIGMAP).toBeDefined();
      expect(ContextType.SECRET).toBeDefined();
      expect(ContextType.INGRESS).toBeDefined();
      expect(ContextType.PVC).toBeDefined();
      expect(ContextType.STATEFULSET).toBeDefined();
    });

    it("AC2: 시스템 컨텍스트 타입이 정의되어 있어야 한다", () => {
      // Cluster, File, Error, Log 등
      expect(ContextType.CLUSTER).toBeDefined();
      expect(ContextType.FILE).toBeDefined();
      expect(ContextType.ERROR).toBeDefined();
      expect(ContextType.LOG).toBeDefined();
      expect(ContextType.METRIC).toBeDefined();
      expect(ContextType.EVENT).toBeDefined();
    });

    it("ContextType 값이 문자열이어야 한다", () => {
      expect(typeof ContextType.POD).toBe("string");
      expect(typeof ContextType.CLUSTER).toBe("string");
    });
  });

  describe("CONTEXT_TYPE_METADATA", () => {
    it("AC3: 모든 ContextType에 대한 메타데이터가 정의되어 있어야 한다", () => {
      const allTypes = Object.values(ContextType);

      for (const type of allTypes) {
        expect(CONTEXT_TYPE_METADATA[type]).toBeDefined();
        expect(CONTEXT_TYPE_METADATA[type].icon).toBeDefined();
        expect(CONTEXT_TYPE_METADATA[type].label).toBeDefined();
        expect(CONTEXT_TYPE_METADATA[type].priority).toBeDefined();
      }
    });

    it("메타데이터가 올바른 구조를 가져야 한다", () => {
      const podMeta = CONTEXT_TYPE_METADATA[ContextType.POD];

      expect(typeof podMeta.icon).toBe("string");
      expect(typeof podMeta.label).toBe("string");
      expect(typeof podMeta.priority).toBe("number");
      expect(podMeta.priority).toBeGreaterThanOrEqual(0);
    });
  });

  describe("isValidContextType 함수", () => {
    it("AC4: 유효한 ContextType에 대해 true를 반환해야 한다", () => {
      expect(isValidContextType("pod")).toBe(true);
      expect(isValidContextType("deployment")).toBe(true);
      expect(isValidContextType("cluster")).toBe(true);
    });

    it("유효하지 않은 타입에 대해 false를 반환해야 한다", () => {
      expect(isValidContextType("invalid")).toBe(false);
      expect(isValidContextType("")).toBe(false);
      expect(isValidContextType("UNKNOWN_TYPE")).toBe(false);
    });

    it("대소문자 구분 없이 검증해야 한다", () => {
      expect(isValidContextType("POD")).toBe(true);
      expect(isValidContextType("Pod")).toBe(true);
      expect(isValidContextType("pOd")).toBe(true);
    });
  });

  describe("createContextItem 함수", () => {
    it("AC5: 올바른 ContextItem 객체를 생성해야 한다", () => {
      const item = createContextItem({
        type: ContextType.POD,
        name: "nginx-pod",
        namespace: "default",
      });

      expect(item.id).toBeDefined();
      expect(item.type).toBe(ContextType.POD);
      expect(item.name).toBe("nginx-pod");
      expect(item.namespace).toBe("default");
      expect(item.createdAt).toBeInstanceOf(Date);
    });

    it("고유한 ID를 생성해야 한다", () => {
      const item1 = createContextItem({
        type: ContextType.POD,
        name: "pod-1",
      });
      const item2 = createContextItem({
        type: ContextType.POD,
        name: "pod-2",
      });

      expect(item1.id).not.toBe(item2.id);
    });

    it("선택적 필드가 올바르게 처리되어야 한다", () => {
      const itemWithMeta = createContextItem({
        type: ContextType.DEPLOYMENT,
        name: "my-app",
        namespace: "production",
        metadata: { replicas: 3, image: "nginx:latest" },
      });

      expect(itemWithMeta.metadata).toEqual({ replicas: 3, image: "nginx:latest" });

      const itemWithoutMeta = createContextItem({
        type: ContextType.NODE,
        name: "worker-1",
      });

      expect(itemWithoutMeta.metadata).toBeUndefined();
      expect(itemWithoutMeta.namespace).toBeUndefined();
    });
  });

  describe("getContextTypeIcon 함수", () => {
    it("각 타입에 맞는 아이콘을 반환해야 한다", () => {
      expect(getContextTypeIcon(ContextType.POD)).toBeDefined();
      expect(getContextTypeIcon(ContextType.DEPLOYMENT)).toBeDefined();
      expect(getContextTypeIcon(ContextType.CLUSTER)).toBeDefined();
    });

    it("알 수 없는 타입에 대해 기본 아이콘을 반환해야 한다", () => {
      // @ts-expect-error 존재하지 않는 타입 테스트
      const icon = getContextTypeIcon("unknown_type");
      expect(icon).toBeDefined();
    });
  });

  describe("getContextTypeLabel 함수", () => {
    it("각 타입에 맞는 한글 라벨을 반환해야 한다", () => {
      expect(getContextTypeLabel(ContextType.POD)).toBe("파드");
      expect(getContextTypeLabel(ContextType.DEPLOYMENT)).toBe("디플로이먼트");
      expect(getContextTypeLabel(ContextType.CLUSTER)).toBe("클러스터");
    });

    it("알 수 없는 타입에 대해 타입 값을 그대로 반환해야 한다", () => {
      // @ts-expect-error 존재하지 않는 타입 테스트
      const label = getContextTypeLabel("custom_type");
      expect(label).toBe("custom_type");
    });
  });

  describe("getContextTypePriority 함수", () => {
    it("각 타입에 맞는 우선순위를 반환해야 한다", () => {
      // 클러스터가 가장 높은 우선순위
      expect(getContextTypePriority(ContextType.CLUSTER)).toBeLessThan(getContextTypePriority(ContextType.POD));
    });

    it("알 수 없는 타입에 대해 가장 낮은 우선순위를 반환해야 한다", () => {
      // @ts-expect-error 존재하지 않는 타입 테스트
      const priority = getContextTypePriority("unknown_type");
      expect(priority).toBe(999);
    });
  });

  describe("ContextItem 인터페이스", () => {
    it("필수 필드가 정의되어야 한다", () => {
      const item: ContextItem = {
        id: "test-id",
        type: ContextType.POD,
        name: "test-pod",
        createdAt: new Date(),
      };

      expect(item.id).toBeDefined();
      expect(item.type).toBeDefined();
      expect(item.name).toBeDefined();
      expect(item.createdAt).toBeDefined();
    });

    it("선택적 필드를 포함할 수 있어야 한다", () => {
      const item: ContextItem = {
        id: "test-id",
        type: ContextType.DEPLOYMENT,
        name: "my-deployment",
        namespace: "default",
        displayName: "My App Deployment",
        description: "Main application deployment",
        metadata: { replicas: 3 },
        resourceVersion: "12345",
        createdAt: new Date(),
      };

      expect(item.namespace).toBe("default");
      expect(item.displayName).toBe("My App Deployment");
      expect(item.description).toBe("Main application deployment");
      expect(item.metadata).toEqual({ replicas: 3 });
      expect(item.resourceVersion).toBe("12345");
    });
  });

  describe("타입 안전성", () => {
    it("ContextType 타입이 올바르게 정의되어야 한다", () => {
      const validType: (typeof ContextType)[keyof typeof ContextType] = ContextType.POD;
      expect(validType).toBe("pod");
    });

    it("ContextItem 타입이 올바르게 정의되어야 한다", () => {
      const item: ContextItem = {
        id: "uuid",
        type: ContextType.SERVICE,
        name: "my-service",
        createdAt: new Date(),
      };

      expect(item).toBeDefined();
    });
  });
});
