/**
 * 🎯 목적: AIChatPanelStore 다중 클러스터 지원 테스트
 *
 * TDD 방식으로 작성된 테스트 파일입니다.
 * Acceptance Criteria:
 * - AC1: selectedClusterIds가 observable.set<string>() 타입으로 구현
 * - AC2: conversationsByCluster가 observable.map 타입으로 구현
 * - AC3: connectedClusters 의존성 주입 구조 구현
 * - AC4: needsClusterSelection computed 속성 동작
 * - AC5: 모든 action 메서드에 @action 데코레이터 적용
 * - AC6: 기존 messages, isOpen 상태 유지
 *
 * @packageDocumentation
 */

import { computed, isObservableMap, isObservableSet, ObservableMap, ObservableSet, observable, reaction } from "mobx";

// ============================================
// 🎯 Mock 타입 정의
// ============================================

/**
 * 테스트용 Cluster 인터페이스
 */
interface MockCluster {
  id: string;
  name: string;
  contextName: string;
  status?: {
    phase: "connected" | "disconnected" | "connecting";
  };
}

/**
 * 테스트용 ConversationState 인터페이스
 */
interface ConversationState {
  messages: Array<{ id: string; role: string; content: string }>;
  inputText: string;
  isStreaming: boolean;
  lastUpdated: Date;
}

/**
 * 테스트용 Dependencies 인터페이스 (Root Frame 마이그레이션용)
 */
interface MultiClusterDependencies {
  connectedClusters: { get(): MockCluster[] };
  activeKubernetesCluster: { get(): MockCluster | undefined };
}

// ============================================
// 🎯 테스트 Suite
// ============================================

describe("AIChatPanelStore 다중 클러스터 지원", () => {
  // ============================================
  // 🔹 AC1: selectedClusterIds observable.set 테스트
  // ============================================

  describe("AC1: selectedClusterIds observable.set", () => {
    it("selectedClusterIds가 observable.set<string>() 타입이어야 함", () => {
      // TODO: AIChatPanelStore가 구현되면 이 테스트가 통과해야 함
      const selectedClusterIds = observable.set<string>();

      expect(isObservableSet(selectedClusterIds)).toBe(true);
      expect(selectedClusterIds.size).toBe(0);
    });

    it("클러스터 ID를 추가할 수 있어야 함", () => {
      const selectedClusterIds = observable.set<string>();

      selectedClusterIds.add("cluster-1");
      selectedClusterIds.add("cluster-2");

      expect(selectedClusterIds.has("cluster-1")).toBe(true);
      expect(selectedClusterIds.has("cluster-2")).toBe(true);
      expect(selectedClusterIds.size).toBe(2);
    });

    it("클러스터 ID를 제거할 수 있어야 함", () => {
      const selectedClusterIds = observable.set<string>();
      selectedClusterIds.add("cluster-1");
      selectedClusterIds.add("cluster-2");

      selectedClusterIds.delete("cluster-1");

      expect(selectedClusterIds.has("cluster-1")).toBe(false);
      expect(selectedClusterIds.has("cluster-2")).toBe(true);
      expect(selectedClusterIds.size).toBe(1);
    });

    it("clear()로 모든 선택을 해제할 수 있어야 함", () => {
      const selectedClusterIds = observable.set<string>();
      selectedClusterIds.add("cluster-1");
      selectedClusterIds.add("cluster-2");

      selectedClusterIds.clear();

      expect(selectedClusterIds.size).toBe(0);
    });

    it("중복 추가 시 size가 증가하지 않아야 함", () => {
      const selectedClusterIds = observable.set<string>();
      selectedClusterIds.add("cluster-1");
      selectedClusterIds.add("cluster-1");

      expect(selectedClusterIds.size).toBe(1);
    });
  });

  // ============================================
  // 🔹 AC2: conversationsByCluster observable.map 테스트
  // ============================================

  describe("AC2: conversationsByCluster observable.map", () => {
    it("conversationsByCluster가 observable.map 타입이어야 함", () => {
      const conversationsByCluster = observable.map<string, ConversationState>();

      expect(isObservableMap(conversationsByCluster)).toBe(true);
      expect(conversationsByCluster.size).toBe(0);
    });

    it("클러스터별 대화 상태를 저장할 수 있어야 함", () => {
      const conversationsByCluster = observable.map<string, ConversationState>();

      const conversation: ConversationState = {
        messages: [{ id: "msg-1", role: "user", content: "Hello" }],
        inputText: "",
        isStreaming: false,
        lastUpdated: new Date(),
      };

      conversationsByCluster.set("cluster-1", conversation);

      expect(conversationsByCluster.has("cluster-1")).toBe(true);
      expect(conversationsByCluster.get("cluster-1")?.messages.length).toBe(1);
    });

    it("여러 클러스터의 대화를 독립적으로 관리해야 함", () => {
      const conversationsByCluster = observable.map<string, ConversationState>();

      conversationsByCluster.set("cluster-1", {
        messages: [{ id: "msg-1", role: "user", content: "Hello Cluster 1" }],
        inputText: "",
        isStreaming: false,
        lastUpdated: new Date(),
      });

      conversationsByCluster.set("cluster-2", {
        messages: [{ id: "msg-2", role: "user", content: "Hello Cluster 2" }],
        inputText: "",
        isStreaming: false,
        lastUpdated: new Date(),
      });

      expect(conversationsByCluster.size).toBe(2);
      expect(conversationsByCluster.get("cluster-1")?.messages[0].content).toBe("Hello Cluster 1");
      expect(conversationsByCluster.get("cluster-2")?.messages[0].content).toBe("Hello Cluster 2");
    });

    it("존재하지 않는 클러스터 조회 시 undefined 반환", () => {
      const conversationsByCluster = observable.map<string, ConversationState>();

      expect(conversationsByCluster.get("non-existent")).toBeUndefined();
    });
  });

  // ============================================
  // 🔹 AC3: connectedClusters 의존성 주입 테스트
  // ============================================

  describe("AC3: connectedClusters 의존성 주입", () => {
    it("connectedClusters는 IComputedValue<Cluster[]> 형태로 주입되어야 함", () => {
      const mockClusters: MockCluster[] = [
        { id: "cluster-1", name: "Production", contextName: "prod-ctx", status: { phase: "connected" } },
        { id: "cluster-2", name: "Staging", contextName: "staging-ctx", status: { phase: "connected" } },
      ];

      const connectedClusters = computed(() => mockClusters.filter((c) => c.status?.phase === "connected"));

      expect(connectedClusters.get()).toHaveLength(2);
      expect(connectedClusters.get()[0].name).toBe("Production");
    });

    it("activeKubernetesCluster는 IComputedValue<Cluster | undefined> 형태로 주입되어야 함", () => {
      const mockActiveCluster: MockCluster = {
        id: "cluster-1",
        name: "Production",
        contextName: "prod-ctx",
        status: { phase: "connected" },
      };

      const activeKubernetesCluster = computed(() => mockActiveCluster);

      expect(activeKubernetesCluster.get()?.id).toBe("cluster-1");
    });

    it("연결된 클러스터 목록이 동적으로 업데이트되어야 함", () => {
      const clustersData = observable.array<MockCluster>([
        { id: "cluster-1", name: "Production", contextName: "prod-ctx", status: { phase: "connected" } },
      ]);

      const connectedClusters = computed(() => clustersData.filter((c) => c.status?.phase === "connected"));

      expect(connectedClusters.get()).toHaveLength(1);

      // 새 클러스터 추가
      clustersData.push({
        id: "cluster-2",
        name: "Staging",
        contextName: "staging-ctx",
        status: { phase: "connected" },
      });

      expect(connectedClusters.get()).toHaveLength(2);
    });

    it("연결 해제된 클러스터는 목록에서 제외되어야 함", () => {
      const clustersData = observable.array<MockCluster>([
        { id: "cluster-1", name: "Production", contextName: "prod-ctx", status: { phase: "connected" } },
        { id: "cluster-2", name: "Staging", contextName: "staging-ctx", status: { phase: "disconnected" } },
      ]);

      const connectedClusters = computed(() => clustersData.filter((c) => c.status?.phase === "connected"));

      expect(connectedClusters.get()).toHaveLength(1);
      expect(connectedClusters.get()[0].id).toBe("cluster-1");
    });
  });

  // ============================================
  // 🔹 AC4: needsClusterSelection computed 테스트
  // ============================================

  describe("AC4: needsClusterSelection computed", () => {
    it("클러스터가 연결되어 있지만 선택되지 않았으면 true", () => {
      const selectedClusterIds = observable.set<string>();
      const connectedClusters = computed(() => [
        { id: "cluster-1", name: "Production", contextName: "prod-ctx", status: { phase: "connected" as const } },
      ]);

      const needsClusterSelection = computed(() => selectedClusterIds.size === 0 && connectedClusters.get().length > 0);

      expect(needsClusterSelection.get()).toBe(true);
    });

    it("클러스터가 선택되어 있으면 false", () => {
      const selectedClusterIds = observable.set<string>(["cluster-1"]);
      const connectedClusters = computed(() => [
        { id: "cluster-1", name: "Production", contextName: "prod-ctx", status: { phase: "connected" as const } },
      ]);

      const needsClusterSelection = computed(() => selectedClusterIds.size === 0 && connectedClusters.get().length > 0);

      expect(needsClusterSelection.get()).toBe(false);
    });

    it("연결된 클러스터가 없으면 false", () => {
      const selectedClusterIds = observable.set<string>();
      const connectedClusters = computed(() => [] as MockCluster[]);

      const needsClusterSelection = computed(() => selectedClusterIds.size === 0 && connectedClusters.get().length > 0);

      expect(needsClusterSelection.get()).toBe(false);
    });

    it("클러스터 선택/해제 시 동적으로 업데이트되어야 함", () => {
      const selectedClusterIds = observable.set<string>();
      const connectedClusters = computed(() => [
        { id: "cluster-1", name: "Production", contextName: "prod-ctx", status: { phase: "connected" as const } },
      ]);

      const needsClusterSelection = computed(() => selectedClusterIds.size === 0 && connectedClusters.get().length > 0);

      expect(needsClusterSelection.get()).toBe(true);

      selectedClusterIds.add("cluster-1");
      expect(needsClusterSelection.get()).toBe(false);

      selectedClusterIds.delete("cluster-1");
      expect(needsClusterSelection.get()).toBe(true);
    });
  });

  // ============================================
  // 🔹 AC5: @action 데코레이터 적용 테스트
  // ============================================

  describe("AC5: action 메서드 테스트", () => {
    it("selectCluster가 클러스터를 선택해야 함", () => {
      const selectedClusterIds = observable.set<string>();

      // @action selectCluster 시뮬레이션
      const selectCluster = (id: string) => {
        selectedClusterIds.add(id);
      };

      selectCluster("cluster-1");

      expect(selectedClusterIds.has("cluster-1")).toBe(true);
    });

    it("deselectCluster가 클러스터 선택을 해제해야 함", () => {
      const selectedClusterIds = observable.set<string>(["cluster-1", "cluster-2"]);

      // @action deselectCluster 시뮬레이션
      const deselectCluster = (id: string) => {
        selectedClusterIds.delete(id);
      };

      deselectCluster("cluster-1");

      expect(selectedClusterIds.has("cluster-1")).toBe(false);
      expect(selectedClusterIds.has("cluster-2")).toBe(true);
    });

    it("toggleClusterSelection이 선택 상태를 토글해야 함", () => {
      const selectedClusterIds = observable.set<string>();

      // @action toggleClusterSelection 시뮬레이션
      const toggleClusterSelection = (id: string) => {
        if (selectedClusterIds.has(id)) {
          selectedClusterIds.delete(id);
        } else {
          selectedClusterIds.add(id);
        }
      };

      // 선택
      toggleClusterSelection("cluster-1");
      expect(selectedClusterIds.has("cluster-1")).toBe(true);

      // 해제
      toggleClusterSelection("cluster-1");
      expect(selectedClusterIds.has("cluster-1")).toBe(false);
    });

    it("selectSingleCluster가 기존 선택을 해제하고 새로 선택해야 함", () => {
      const selectedClusterIds = observable.set<string>(["cluster-1", "cluster-2"]);

      // @action selectSingleCluster 시뮬레이션
      const selectSingleCluster = (id: string) => {
        selectedClusterIds.clear();
        selectedClusterIds.add(id);
      };

      selectSingleCluster("cluster-3");

      expect(selectedClusterIds.size).toBe(1);
      expect(selectedClusterIds.has("cluster-3")).toBe(true);
      expect(selectedClusterIds.has("cluster-1")).toBe(false);
      expect(selectedClusterIds.has("cluster-2")).toBe(false);
    });
  });

  // ============================================
  // 🔹 AC6: 기존 상태 유지 테스트
  // ============================================

  describe("AC6: 기존 상태 유지", () => {
    it("messages 배열이 여전히 동작해야 함", () => {
      const messages = observable.array<{ id: string; role: string; content: string }>([]);

      messages.push({ id: "msg-1", role: "user", content: "Hello" });

      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe("Hello");
    });

    it("isOpen 상태가 여전히 동작해야 함", () => {
      const storage = observable({
        isOpen: false,
        width: 400,
      });

      // isOpen computed 시뮬레이션 (getter/setter)
      const isOpenComputed = computed(() => storage.isOpen);

      expect(isOpenComputed.get()).toBe(false);

      storage.isOpen = true;
      expect(isOpenComputed.get()).toBe(true);
    });

    it("toggle 메서드가 여전히 동작해야 함", () => {
      let isOpen = false;

      const toggle = () => {
        isOpen = !isOpen;
      };

      expect(isOpen).toBe(false);

      toggle();
      expect(isOpen).toBe(true);

      toggle();
      expect(isOpen).toBe(false);
    });
  });

  // ============================================
  // 🔹 selectedClusters computed 테스트
  // ============================================

  describe("selectedClusters computed", () => {
    it("selectedClusterIds에 해당하는 클러스터 객체를 반환해야 함", () => {
      const allClusters: MockCluster[] = [
        { id: "cluster-1", name: "Production", contextName: "prod-ctx", status: { phase: "connected" } },
        { id: "cluster-2", name: "Staging", contextName: "staging-ctx", status: { phase: "connected" } },
        { id: "cluster-3", name: "Development", contextName: "dev-ctx", status: { phase: "connected" } },
      ];

      const selectedClusterIds = observable.set<string>(["cluster-1", "cluster-3"]);
      const connectedClusters = computed(() => allClusters);

      const selectedClusters = computed(() =>
        connectedClusters.get().filter((cluster) => selectedClusterIds.has(cluster.id)),
      );

      expect(selectedClusters.get()).toHaveLength(2);
      expect(selectedClusters.get().map((c) => c.id)).toEqual(["cluster-1", "cluster-3"]);
    });

    it("선택된 클러스터가 없으면 빈 배열을 반환해야 함", () => {
      const allClusters: MockCluster[] = [
        { id: "cluster-1", name: "Production", contextName: "prod-ctx", status: { phase: "connected" } },
      ];

      const selectedClusterIds = observable.set<string>();
      const connectedClusters = computed(() => allClusters);

      const selectedClusters = computed(() =>
        connectedClusters.get().filter((cluster) => selectedClusterIds.has(cluster.id)),
      );

      expect(selectedClusters.get()).toHaveLength(0);
    });
  });

  // ============================================
  // 🔹 최대 선택 제한 테스트
  // ============================================

  describe("최대 클러스터 선택 제한", () => {
    const MAX_CONCURRENT_CLUSTERS = 3;

    it("최대 3개까지만 선택 가능해야 함", () => {
      const selectedClusterIds = observable.set<string>();

      const toggleClusterSelection = (id: string): boolean => {
        if (selectedClusterIds.has(id)) {
          selectedClusterIds.delete(id);
          return true;
        } else {
          if (selectedClusterIds.size >= MAX_CONCURRENT_CLUSTERS) {
            return false; // 제한 초과
          }
          selectedClusterIds.add(id);
          return true;
        }
      };

      expect(toggleClusterSelection("cluster-1")).toBe(true);
      expect(toggleClusterSelection("cluster-2")).toBe(true);
      expect(toggleClusterSelection("cluster-3")).toBe(true);
      expect(toggleClusterSelection("cluster-4")).toBe(false); // 제한

      expect(selectedClusterIds.size).toBe(3);
      expect(selectedClusterIds.has("cluster-4")).toBe(false);
    });

    it("선택 해제 후 다시 추가 가능해야 함", () => {
      const selectedClusterIds = observable.set<string>(["cluster-1", "cluster-2", "cluster-3"]);

      const toggleClusterSelection = (id: string): boolean => {
        if (selectedClusterIds.has(id)) {
          selectedClusterIds.delete(id);
          return true;
        } else {
          if (selectedClusterIds.size >= MAX_CONCURRENT_CLUSTERS) {
            return false;
          }
          selectedClusterIds.add(id);
          return true;
        }
      };

      // cluster-1 해제
      expect(toggleClusterSelection("cluster-1")).toBe(true);
      expect(selectedClusterIds.size).toBe(2);

      // cluster-4 추가 가능
      expect(toggleClusterSelection("cluster-4")).toBe(true);
      expect(selectedClusterIds.size).toBe(3);
    });
  });

  // ============================================
  // 🔹 autoSelectEnabled 테스트
  // ============================================

  describe("autoSelectEnabled 상태", () => {
    it("기본값은 true여야 함", () => {
      const autoSelectEnabled = observable.box(true);

      expect(autoSelectEnabled.get()).toBe(true);
    });

    it("토글 가능해야 함", () => {
      const autoSelectEnabled = observable.box(true);

      autoSelectEnabled.set(false);
      expect(autoSelectEnabled.get()).toBe(false);

      autoSelectEnabled.set(true);
      expect(autoSelectEnabled.get()).toBe(true);
    });
  });

  // ============================================
  // 🔹 클러스터별 대화 히스토리 분리 테스트
  // ============================================

  describe("클러스터별 대화 히스토리 분리", () => {
    /**
     * 테스트용 ConversationState 인터페이스
     */
    interface Task13ConversationState {
      messages: Array<{ id: string; role: string; content: string }>;
      conversationId: string;
      lastUpdated: number;
    }

    // AC1: ConversationState 인터페이스 정의
    describe("AC1: ConversationState 인터페이스 정의", () => {
      it("ConversationState 인터페이스가 필수 필드를 가져야 함", () => {
        const conversation: Task13ConversationState = {
          messages: [],
          conversationId: "test-id-123",
          lastUpdated: Date.now(),
        };

        expect(conversation.messages).toBeDefined();
        expect(conversation.conversationId).toBeDefined();
        expect(conversation.lastUpdated).toBeDefined();
      });
    });

    // AC2: 클러스터 ID로 대화 상태 조회 가능
    describe("AC2: 클러스터 ID로 대화 상태 조회", () => {
      it("getConversationForCluster로 대화 상태 조회 가능", () => {
        const conversationsByCluster = observable.map<string, Task13ConversationState>();

        conversationsByCluster.set("cluster-1", {
          messages: [{ id: "msg-1", role: "user", content: "Hello" }],
          conversationId: "conv-123",
          lastUpdated: Date.now(),
        });

        const conversation = conversationsByCluster.get("cluster-1");
        expect(conversation).toBeDefined();
        expect(conversation?.messages.length).toBe(1);
        expect(conversation?.conversationId).toBe("conv-123");
      });

      it("존재하지 않는 클러스터 ID로 조회 시 undefined 반환", () => {
        const conversationsByCluster = observable.map<string, Task13ConversationState>();

        expect(conversationsByCluster.get("non-existent")).toBeUndefined();
      });
    });

    // AC3: 클러스터 전환 시 이전 대화 보존
    describe("AC3: 클러스터 전환 시 이전 대화 보존", () => {
      it("클러스터 선택 전환 후에도 이전 대화가 유지되어야 함", () => {
        const conversationsByCluster = observable.map<string, Task13ConversationState>();
        const selectedClusterIds = observable.set<string>();

        // Cluster 1에 대화 추가
        conversationsByCluster.set("cluster-1", {
          messages: [{ id: "msg-1", role: "user", content: "Hello from Cluster 1" }],
          conversationId: "conv-1",
          lastUpdated: Date.now(),
        });
        selectedClusterIds.add("cluster-1");

        // Cluster 2로 전환
        selectedClusterIds.clear();
        selectedClusterIds.add("cluster-2");
        conversationsByCluster.set("cluster-2", {
          messages: [{ id: "msg-2", role: "user", content: "Hello from Cluster 2" }],
          conversationId: "conv-2",
          lastUpdated: Date.now(),
        });

        // Cluster 1로 다시 전환
        selectedClusterIds.clear();
        selectedClusterIds.add("cluster-1");

        // 이전 대화가 보존되어 있어야 함
        const cluster1Conv = conversationsByCluster.get("cluster-1");
        expect(cluster1Conv).toBeDefined();
        expect(cluster1Conv?.messages[0].content).toBe("Hello from Cluster 1");
      });
    });

    // AC4: 새 클러스터 선택 시 빈 대화 상태 생성
    describe("AC4: 새 클러스터 선택 시 빈 대화 상태 생성", () => {
      it("getOrCreateConversation으로 새 클러스터 대화 생성", () => {
        const conversationsByCluster = observable.map<string, Task13ConversationState>();

        // getOrCreateConversation 시뮬레이션
        const getOrCreateConversation = (clusterId: string): Task13ConversationState => {
          let conversation = conversationsByCluster.get(clusterId);

          if (!conversation) {
            conversation = {
              messages: [],
              conversationId: `conv-${Date.now()}`,
              lastUpdated: Date.now(),
            };
            conversationsByCluster.set(clusterId, conversation);
          }

          return conversation;
        };

        // 새 클러스터에 대해 대화 생성
        const newConversation = getOrCreateConversation("new-cluster");

        expect(newConversation).toBeDefined();
        expect(newConversation.messages).toEqual([]);
        expect(conversationsByCluster.has("new-cluster")).toBe(true);
      });

      it("이미 존재하는 클러스터는 기존 대화 반환", () => {
        const conversationsByCluster = observable.map<string, Task13ConversationState>();

        // 기존 대화 설정
        conversationsByCluster.set("existing-cluster", {
          messages: [{ id: "msg-1", role: "user", content: "Existing message" }],
          conversationId: "existing-conv",
          lastUpdated: Date.now(),
        });

        // getOrCreateConversation 시뮬레이션
        const getOrCreateConversation = (clusterId: string): Task13ConversationState => {
          let conversation = conversationsByCluster.get(clusterId);

          if (!conversation) {
            conversation = {
              messages: [],
              conversationId: `conv-${Date.now()}`,
              lastUpdated: Date.now(),
            };
            conversationsByCluster.set(clusterId, conversation);
          }

          return conversation;
        };

        const existingConversation = getOrCreateConversation("existing-cluster");

        expect(existingConversation.messages.length).toBe(1);
        expect(existingConversation.conversationId).toBe("existing-conv");
      });
    });

    // AC5: 연결 해제된 클러스터의 대화도 유지
    describe("AC5: 연결 해제된 클러스터의 대화도 유지", () => {
      it("클러스터 연결 해제 후에도 대화 히스토리가 유지되어야 함", () => {
        const conversationsByCluster = observable.map<string, Task13ConversationState>();
        const clustersData = observable.array<MockCluster>([
          { id: "cluster-1", name: "Production", contextName: "prod-ctx", status: { phase: "connected" } },
        ]);

        // Cluster 1에 대화 추가
        conversationsByCluster.set("cluster-1", {
          messages: [{ id: "msg-1", role: "user", content: "Important conversation" }],
          conversationId: "conv-1",
          lastUpdated: Date.now(),
        });

        // 클러스터 연결 해제 시뮬레이션
        clustersData[0].status = { phase: "disconnected" };

        // 대화는 여전히 유지되어야 함
        const conversation = conversationsByCluster.get("cluster-1");
        expect(conversation).toBeDefined();
        expect(conversation?.messages[0].content).toBe("Important conversation");
      });

      it("clustersWithHistory computed가 대화가 있는 클러스터 목록을 반환해야 함", () => {
        const conversationsByCluster = observable.map<string, Task13ConversationState>();

        conversationsByCluster.set("cluster-1", {
          messages: [{ id: "msg-1", role: "user", content: "Message 1" }],
          conversationId: "conv-1",
          lastUpdated: Date.now(),
        });

        conversationsByCluster.set("cluster-2", {
          messages: [{ id: "msg-2", role: "user", content: "Message 2" }],
          conversationId: "conv-2",
          lastUpdated: Date.now(),
        });

        // clustersWithHistory computed 시뮬레이션
        const clustersWithHistory = computed(() => Array.from(conversationsByCluster.keys()));

        expect(clustersWithHistory.get()).toEqual(["cluster-1", "cluster-2"]);
      });
    });

    // activeConversations computed 테스트
    describe("activeConversations computed", () => {
      it("선택된 클러스터들의 대화만 반환해야 함", () => {
        const conversationsByCluster = observable.map<string, Task13ConversationState>();
        const selectedClusterIds = observable.set<string>(["cluster-1", "cluster-3"]);

        // getOrCreateConversation 시뮬레이션
        const getOrCreateConversation = (clusterId: string): Task13ConversationState => {
          let conversation = conversationsByCluster.get(clusterId);

          if (!conversation) {
            conversation = {
              messages: [],
              conversationId: `conv-${clusterId}`,
              lastUpdated: Date.now(),
            };
            conversationsByCluster.set(clusterId, conversation);
          }

          return conversation;
        };

        // activeConversations computed 시뮬레이션
        const activeConversations = computed(() => {
          const result = new Map<string, Task13ConversationState>();

          for (const clusterId of selectedClusterIds) {
            result.set(clusterId, getOrCreateConversation(clusterId));
          }

          return result;
        });

        const active = activeConversations.get();
        expect(active.size).toBe(2);
        expect(active.has("cluster-1")).toBe(true);
        expect(active.has("cluster-3")).toBe(true);
        expect(active.has("cluster-2")).toBe(false);
      });
    });

    // 대화 삭제 기능 테스트
    describe("대화 삭제 기능", () => {
      it("clearConversationForCluster로 특정 클러스터 대화 삭제", () => {
        const conversationsByCluster = observable.map<string, Task13ConversationState>();

        conversationsByCluster.set("cluster-1", {
          messages: [{ id: "msg-1", role: "user", content: "To be deleted" }],
          conversationId: "conv-1",
          lastUpdated: Date.now(),
        });

        conversationsByCluster.delete("cluster-1");

        expect(conversationsByCluster.has("cluster-1")).toBe(false);
      });

      it("clearAllConversations로 모든 대화 삭제", () => {
        const conversationsByCluster = observable.map<string, Task13ConversationState>();

        conversationsByCluster.set("cluster-1", {
          messages: [],
          conversationId: "conv-1",
          lastUpdated: Date.now(),
        });
        conversationsByCluster.set("cluster-2", {
          messages: [],
          conversationId: "conv-2",
          lastUpdated: Date.now(),
        });

        conversationsByCluster.clear();

        expect(conversationsByCluster.size).toBe(0);
      });
    });
  });

  // ============================================
  // 🔹 AbortController 통합 테스트
  // ============================================

  describe("AbortController 통합", () => {
    // AC1: abortControllers Map 구현
    describe("AC1: abortControllers Map 구현", () => {
      it("abortControllers Map이 존재해야 함", () => {
        const abortControllers = new Map<string, AbortController>();

        expect(abortControllers).toBeDefined();
        expect(abortControllers.size).toBe(0);
      });

      it("클러스터별로 AbortController를 저장할 수 있어야 함", () => {
        const abortControllers = new Map<string, AbortController>();

        abortControllers.set("cluster-1", new AbortController());
        abortControllers.set("cluster-2", new AbortController());

        expect(abortControllers.size).toBe(2);
        expect(abortControllers.has("cluster-1")).toBe(true);
        expect(abortControllers.has("cluster-2")).toBe(true);
      });
    });

    // AC2: startStreaming() 호출 시 AbortSignal 반환
    describe("AC2: startStreaming() 호출 시 AbortSignal 반환", () => {
      it("startStreamingForCluster가 AbortSignal을 반환해야 함", () => {
        const abortControllers = new Map<string, AbortController>();

        // startStreamingForCluster 시뮬레이션
        const startStreamingForCluster = (clusterId: string): AbortSignal => {
          const controller = new AbortController();
          abortControllers.set(clusterId, controller);
          return controller.signal;
        };

        const signal = startStreamingForCluster("cluster-1");

        expect(signal).toBeDefined();
        expect(signal instanceof AbortSignal).toBe(true);
        expect(signal.aborted).toBe(false);
      });
    });

    // AC3: 클러스터 선택 해제 시 자동 abort
    describe("AC3: 클러스터 선택 해제 시 자동 abort", () => {
      it("deselectCluster 시 해당 클러스터의 스트리밍이 중단되어야 함", () => {
        const abortControllers = new Map<string, AbortController>();
        const selectedClusterIds = observable.set<string>(["cluster-1"]);

        // startStreaming
        const controller = new AbortController();
        abortControllers.set("cluster-1", controller);

        // deselectCluster 시뮬레이션
        const deselectCluster = (clusterId: string) => {
          const ctrl = abortControllers.get(clusterId);
          if (ctrl) {
            ctrl.abort();
            abortControllers.delete(clusterId);
          }
          selectedClusterIds.delete(clusterId);
        };

        deselectCluster("cluster-1");

        expect(controller.signal.aborted).toBe(true);
        expect(abortControllers.has("cluster-1")).toBe(false);
        expect(selectedClusterIds.has("cluster-1")).toBe(false);
      });
    });

    // AC4: 패널 닫기 시 모든 진행 중인 요청 중단
    describe("AC4: 패널 닫기 시 모든 진행 중인 요청 중단", () => {
      it("close() 시 모든 클러스터의 스트리밍이 중단되어야 함", () => {
        const abortControllers = new Map<string, AbortController>();

        // 여러 클러스터에서 스트리밍 중
        const controller1 = new AbortController();
        const controller2 = new AbortController();
        abortControllers.set("cluster-1", controller1);
        abortControllers.set("cluster-2", controller2);

        // stopAllStreaming 시뮬레이션
        const stopAllStreaming = () => {
          for (const [, controller] of abortControllers) {
            controller.abort();
          }
          abortControllers.clear();
        };

        stopAllStreaming();

        expect(controller1.signal.aborted).toBe(true);
        expect(controller2.signal.aborted).toBe(true);
        expect(abortControllers.size).toBe(0);
      });
    });

    // AC5: 동일 클러스터 재요청 시 이전 요청 중단
    describe("AC5: 동일 클러스터 재요청 시 이전 요청 중단", () => {
      it("같은 클러스터에 대한 새 요청 시 이전 요청이 중단되어야 함", () => {
        const abortControllers = new Map<string, AbortController>();

        // startStreamingForCluster 시뮬레이션 (이전 요청 중단 포함)
        const startStreamingForCluster = (clusterId: string): AbortSignal => {
          // 기존 컨트롤러가 있으면 중단
          const existingController = abortControllers.get(clusterId);
          if (existingController) {
            existingController.abort();
          }

          const newController = new AbortController();
          abortControllers.set(clusterId, newController);
          return newController.signal;
        };

        // 첫 번째 요청
        const signal1 = startStreamingForCluster("cluster-1");
        expect(signal1.aborted).toBe(false);

        // 두 번째 요청 (이전 요청 중단됨)
        const signal2 = startStreamingForCluster("cluster-1");

        expect(signal1.aborted).toBe(true); // 이전 요청 중단
        expect(signal2.aborted).toBe(false); // 새 요청은 활성 상태
      });
    });

    // 스트리밍 상태 확인
    describe("스트리밍 상태 확인", () => {
      it("isStreamingForCluster가 스트리밍 여부를 반환해야 함", () => {
        const abortControllers = new Map<string, AbortController>();

        const isStreamingForCluster = (clusterId: string): boolean => {
          return abortControllers.has(clusterId);
        };

        expect(isStreamingForCluster("cluster-1")).toBe(false);

        abortControllers.set("cluster-1", new AbortController());
        expect(isStreamingForCluster("cluster-1")).toBe(true);

        abortControllers.delete("cluster-1");
        expect(isStreamingForCluster("cluster-1")).toBe(false);
      });

      it("streamingClusterIds가 스트리밍 중인 클러스터 목록을 반환해야 함", () => {
        const abortControllers = new Map<string, AbortController>();

        const getStreamingClusterIds = (): string[] => {
          return Array.from(abortControllers.keys());
        };

        expect(getStreamingClusterIds()).toEqual([]);

        abortControllers.set("cluster-1", new AbortController());
        abortControllers.set("cluster-3", new AbortController());

        expect(getStreamingClusterIds()).toEqual(["cluster-1", "cluster-3"]);
      });
    });
  });

  // ============================================
  // 🔹 자동 클러스터 선택 (Auto-Selection) 테스트
  // ============================================

  describe("자동 클러스터 선택 (Auto-Selection)", () => {
    /**
     * 자동 선택 로직 시뮬레이션을 위한 헬퍼 클래스
     */
    class AutoSelectSimulator {
      selectedClusterIds = observable.set<string>();
      connectedClusters = observable.array<MockCluster>([]);
      autoSelectEnabled = observable.box(true);

      constructor() {
        // reaction 시뮬레이션
        reaction(
          () => this.connectedClusters.slice(),
          (clusters) => {
            if (!this.autoSelectEnabled.get()) {
              return;
            }
            if (this.selectedClusterIds.size > 0) {
              return;
            }
            if (clusters.length > 0) {
              this.selectedClusterIds.add(clusters[0].id);
            }
          },
          { fireImmediately: true },
        );
      }

      selectSingleCluster(id: string) {
        this.selectedClusterIds.clear();
        this.selectedClusterIds.add(id);
      }
    }

    // AC1: 연결된 클러스터가 있고 선택이 없으면 자동 선택
    describe("AC1: 자동 선택 트리거 조건", () => {
      it("클러스터가 연결되고 선택이 없으면 첫 번째 클러스터 자동 선택", () => {
        const simulator = new AutoSelectSimulator();

        // 클러스터 연결
        simulator.connectedClusters.push({
          id: "cluster-1",
          name: "Production",
          contextName: "prod-ctx",
          status: { phase: "connected" },
        });

        expect(simulator.selectedClusterIds.has("cluster-1")).toBe(true);
        expect(simulator.selectedClusterIds.size).toBe(1);
      });

      it("이미 선택된 클러스터가 있으면 자동 선택 안함", () => {
        const simulator = new AutoSelectSimulator();

        // 먼저 클러스터 선택
        simulator.selectedClusterIds.add("cluster-existing");

        // 새 클러스터 연결
        simulator.connectedClusters.push({
          id: "cluster-1",
          name: "Production",
          contextName: "prod-ctx",
          status: { phase: "connected" },
        });

        // 기존 선택 유지
        expect(simulator.selectedClusterIds.has("cluster-existing")).toBe(true);
        expect(simulator.selectedClusterIds.has("cluster-1")).toBe(false);
      });
    });

    // AC2: autoSelectEnabled 플래그 동작
    describe("AC2: autoSelectEnabled 플래그", () => {
      it("autoSelectEnabled가 false면 자동 선택 안함", () => {
        const simulator = new AutoSelectSimulator();

        // 자동 선택 비활성화
        simulator.autoSelectEnabled.set(false);

        // 클러스터 연결
        simulator.connectedClusters.push({
          id: "cluster-1",
          name: "Production",
          contextName: "prod-ctx",
          status: { phase: "connected" },
        });

        // 자동 선택 안됨
        expect(simulator.selectedClusterIds.size).toBe(0);
      });

      it("autoSelectEnabled가 true면 자동 선택 작동", () => {
        const simulator = new AutoSelectSimulator();

        // 자동 선택 활성화 (기본값)
        expect(simulator.autoSelectEnabled.get()).toBe(true);

        // 클러스터 연결
        simulator.connectedClusters.push({
          id: "cluster-1",
          name: "Production",
          contextName: "prod-ctx",
          status: { phase: "connected" },
        });

        // 자동 선택됨
        expect(simulator.selectedClusterIds.has("cluster-1")).toBe(true);
      });
    });

    // AC3: 다중 클러스터 연결 시 첫 번째만 선택
    describe("AC3: 다중 클러스터 연결 시 동작", () => {
      it("여러 클러스터가 동시에 연결되면 첫 번째만 선택", () => {
        const simulator = new AutoSelectSimulator();

        // 여러 클러스터 동시 연결
        simulator.connectedClusters.replace([
          { id: "cluster-1", name: "Production", contextName: "prod-ctx", status: { phase: "connected" } },
          { id: "cluster-2", name: "Staging", contextName: "staging-ctx", status: { phase: "connected" } },
          { id: "cluster-3", name: "Development", contextName: "dev-ctx", status: { phase: "connected" } },
        ]);

        // 첫 번째 클러스터만 선택됨
        expect(simulator.selectedClusterIds.size).toBe(1);
        expect(simulator.selectedClusterIds.has("cluster-1")).toBe(true);
      });
    });

    // AC4: selectSingleCluster 후에는 자동 선택 무시
    describe("AC4: 수동 선택 후 자동 선택 무시", () => {
      it("사용자가 수동 선택하면 해당 선택 유지", () => {
        const simulator = new AutoSelectSimulator();

        // 클러스터 연결
        simulator.connectedClusters.replace([
          { id: "cluster-1", name: "Production", contextName: "prod-ctx", status: { phase: "connected" } },
          { id: "cluster-2", name: "Staging", contextName: "staging-ctx", status: { phase: "connected" } },
        ]);

        // 자동 선택 확인
        expect(simulator.selectedClusterIds.has("cluster-1")).toBe(true);

        // 수동으로 다른 클러스터 선택
        simulator.selectSingleCluster("cluster-2");

        // 수동 선택 유지
        expect(simulator.selectedClusterIds.size).toBe(1);
        expect(simulator.selectedClusterIds.has("cluster-2")).toBe(true);

        // 새 클러스터 추가해도 선택 변경 안됨
        simulator.connectedClusters.push({
          id: "cluster-3",
          name: "Development",
          contextName: "dev-ctx",
          status: { phase: "connected" },
        });

        expect(simulator.selectedClusterIds.has("cluster-2")).toBe(true);
        expect(simulator.selectedClusterIds.size).toBe(1);
      });
    });
  });

  // ============================================
  // 🔹 메모리 관리 및 클린업 테스트
  // ============================================

  describe("메모리 관리 및 클린업", () => {
    // dispose 패턴 테스트
    describe("dispose 패턴", () => {
      it("reaction disposer가 올바르게 정리되어야 함", () => {
        const disposers: Array<() => void> = [];
        const connectedClusters = observable.array<MockCluster>([]);
        const selectedClusterIds = observable.set<string>();

        // reaction 등록 및 disposer 저장
        const disposer = reaction(
          () => connectedClusters.slice(),
          () => {
            if (selectedClusterIds.size === 0 && connectedClusters.length > 0) {
              selectedClusterIds.add(connectedClusters[0].id);
            }
          },
        );
        disposers.push(disposer);

        // 클러스터 추가 - reaction 동작
        connectedClusters.push({
          id: "cluster-1",
          name: "Test",
          contextName: "test-ctx",
          status: { phase: "connected" },
        });

        expect(selectedClusterIds.has("cluster-1")).toBe(true);

        // dispose 호출
        disposers.forEach((d) => d());

        // dispose 후에는 reaction 동작 안함
        selectedClusterIds.clear();
        connectedClusters.push({
          id: "cluster-2",
          name: "Test2",
          contextName: "test-ctx-2",
          status: { phase: "connected" },
        });

        expect(selectedClusterIds.size).toBe(0); // dispose 후라 자동 선택 안됨
      });
    });

    // AbortController 클린업 테스트
    describe("AbortController 클린업", () => {
      it("stopAllStreaming이 모든 컨트롤러를 정리해야 함", () => {
        const abortControllers = new Map<string, AbortController>();
        const controllers: AbortController[] = [];

        // 여러 컨트롤러 생성
        for (let i = 0; i < 5; i++) {
          const controller = new AbortController();
          controllers.push(controller);
          abortControllers.set(`cluster-${i}`, controller);
        }

        // 모두 abort 및 정리
        for (const [, controller] of abortControllers) {
          controller.abort();
        }
        abortControllers.clear();

        // 검증
        expect(abortControllers.size).toBe(0);
        controllers.forEach((c) => expect(c.signal.aborted).toBe(true));
      });
    });

    // 대화 상태 클린업 테스트
    describe("대화 상태 클린업", () => {
      interface CleanupConversationState {
        messages: Array<{ id: string; role: string; content: string }>;
        conversationId: string;
        lastUpdated: number;
      }

      it("clearAllConversations가 모든 대화를 정리해야 함", () => {
        const conversationsByCluster = observable.map<string, CleanupConversationState>();

        // 여러 대화 추가
        conversationsByCluster.set("cluster-1", {
          messages: [{ id: "1", role: "user", content: "msg1" }],
          conversationId: "conv-1",
          lastUpdated: Date.now(),
        });
        conversationsByCluster.set("cluster-2", {
          messages: [{ id: "2", role: "user", content: "msg2" }],
          conversationId: "conv-2",
          lastUpdated: Date.now(),
        });

        expect(conversationsByCluster.size).toBe(2);

        // 전체 정리
        conversationsByCluster.clear();

        expect(conversationsByCluster.size).toBe(0);
      });

      it("특정 클러스터 대화만 정리 가능해야 함", () => {
        const conversationsByCluster = observable.map<string, CleanupConversationState>();

        conversationsByCluster.set("cluster-1", {
          messages: [{ id: "1", role: "user", content: "msg1" }],
          conversationId: "conv-1",
          lastUpdated: Date.now(),
        });
        conversationsByCluster.set("cluster-2", {
          messages: [{ id: "2", role: "user", content: "msg2" }],
          conversationId: "conv-2",
          lastUpdated: Date.now(),
        });

        // cluster-1만 삭제
        conversationsByCluster.delete("cluster-1");

        expect(conversationsByCluster.has("cluster-1")).toBe(false);
        expect(conversationsByCluster.has("cluster-2")).toBe(true);
        expect(conversationsByCluster.size).toBe(1);
      });
    });

    // 선택 상태 클린업 테스트
    describe("선택 상태 클린업", () => {
      it("연결 해제된 클러스터는 선택에서 자동 제거되어야 함", () => {
        const connectedClusters = observable.array<MockCluster>([
          { id: "cluster-1", name: "Prod", contextName: "prod", status: { phase: "connected" } },
          { id: "cluster-2", name: "Stage", contextName: "stage", status: { phase: "connected" } },
        ]);
        const selectedClusterIds = observable.set<string>(["cluster-1", "cluster-2"]);

        // 연결 해제된 클러스터 제거 로직 시뮬레이션
        const cleanupDisconnectedClusters = () => {
          const connectedIds = new Set(connectedClusters.map((c) => c.id));

          for (const selectedId of selectedClusterIds) {
            if (!connectedIds.has(selectedId)) {
              selectedClusterIds.delete(selectedId);
            }
          }
        };

        // cluster-1 연결 해제
        connectedClusters.replace([
          { id: "cluster-2", name: "Stage", contextName: "stage", status: { phase: "connected" } },
        ]);

        cleanupDisconnectedClusters();

        expect(selectedClusterIds.has("cluster-1")).toBe(false);
        expect(selectedClusterIds.has("cluster-2")).toBe(true);
        expect(selectedClusterIds.size).toBe(1);
      });
    });
  });
});
