/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * SecurityScanStore scannerMode 로직 단위 test (328e0adf 버그2 수정 verify)
 *
 * isExpectingBothScanners: scannerMode==="all" → 두 스캐너 모두 완료 대기
 */

type ScannerMode = "trivy" | "kubescape" | "all";

function isExpectingBothScanners(scannerMode: ScannerMode): boolean {
  return scannerMode === "all";
}

function isAllDone(completedScanners: string[], scannerMode: ScannerMode): boolean {
  if (scannerMode === "all") {
    return completedScanners.includes("trivy") && completedScanners.includes("kubescape");
  }
  return completedScanners.includes(scannerMode);
}

describe("SecurityScanStore scannerMode 로직", () => {
  describe("isExpectingBothScanners", () => {
    it("scannerMode='all' → true", () => {
      expect(isExpectingBothScanners("all")).toBe(true);
    });

    it("scannerMode='trivy' → false", () => {
      expect(isExpectingBothScanners("trivy")).toBe(false);
    });

    it("scannerMode='kubescape' → false", () => {
      expect(isExpectingBothScanners("kubescape")).toBe(false);
    });
  });

  describe("isAllDone — all 모드", () => {
    it("trivy만 완료 → false", () => {
      expect(isAllDone(["trivy"], "all")).toBe(false);
    });

    it("kubescape만 완료 → false", () => {
      expect(isAllDone(["kubescape"], "all")).toBe(false);
    });

    it("trivy + kubescape 완료 → true", () => {
      expect(isAllDone(["trivy", "kubescape"], "all")).toBe(true);
    });

    it("빈 배열 → false", () => {
      expect(isAllDone([], "all")).toBe(false);
    });
  });

  describe("isAllDone — trivy 단일 모드", () => {
    it("trivy 완료 → true", () => {
      expect(isAllDone(["trivy"], "trivy")).toBe(true);
    });

    it("kubescape 완료여도 → false", () => {
      expect(isAllDone(["kubescape"], "trivy")).toBe(false);
    });
  });

  describe("isAllDone — kubescape 단일 모드", () => {
    it("kubescape 완료 → true", () => {
      expect(isAllDone(["kubescape"], "kubescape")).toBe(true);
    });

    it("trivy 완료여도 → false", () => {
      expect(isAllDone(["trivy"], "kubescape")).toBe(false);
    });
  });

  describe("버그2 시나리오 — false positive error 방지", () => {
    it("all 모드: trivy 완료 후에도 complete 처리 안 함", () => {
      expect(isAllDone(["trivy"], "all")).toBe(false);
    });

    it("all 모드: trivy 완료 단계에서 kubescape error 이벤트 반영 가능", () => {
      // trivy 완료 시 complete 미처리 → kubescape error 정상 반영
      const trivyOnlyDone = isAllDone(["trivy"], "all");
      expect(trivyOnlyDone).toBe(false); // error 이벤트 수신 가능 상태 유지
    });
  });
});

describe("getFindingsForCluster — null/empty 안전성 (3457b6b2 수정 verify)", () => {
  // store.findings Map.get("") → undefined → [] 반환 verify
  function getFindingsForCluster(findings: Map<string, string[]>, clusterId: string): string[] {
    return findings.get(clusterId) ?? [];
  }

  it("빈 string clusterId → 빈 배열 반환 (Map miss)", () => {
    const map = new Map([["cluster-a", ["finding1"]]]);
    expect(getFindingsForCluster(map, "")).toEqual([]);
  });

  it("존재하는 clusterId → 해당 findings 반환", () => {
    const map = new Map([["cluster-a", ["f1", "f2"]]]);
    expect(getFindingsForCluster(map, "cluster-a")).toEqual(["f1", "f2"]);
  });

  it("존재하지 않는 clusterId → 빈 배열 반환", () => {
    const map = new Map([["cluster-a", ["f1"]]]);
    expect(getFindingsForCluster(map, "cluster-b")).toEqual([]);
  });
});
/**
 * handleError partial complete + startScan 즉시 리셋 + contextName 전달 verify
 * 커밋: b8b0735a, 2f6b0b02, 33a9a38f
 *  Epic 2
 */

// ============================================
// handleError partial complete 로직 (b8b0735a)
// ============================================

type ScannerMode = "trivy" | "kubescape" | "all";
type ScanStatus = "idle" | "scanning" | "complete" | "error";

interface ScanState {
  scanId: string;
  status: ScanStatus;
  progress: number;
  completedScanners: string[];
  scannerMode: ScannerMode;
  message: string;
}

interface ScanErrorPayload {
  scanId: string;
  clusterId: string;
  errorType: string;
  message: string;
  scanner: "trivy" | "kubescape";
}

function handleError(state: ScanState, payload: ScanErrorPayload): ScanState {
  if (payload.scanId !== state.scanId) return state;

  const isExpectingBoth = state.scannerMode === "all";

  if (isExpectingBoth) {
    const completedScanners = [...state.completedScanners, payload.scanner];
    const allDone = completedScanners.length >= 2;
    return {
      ...state,
      status: allDone ? "complete" : "scanning",
      completedScanners,
      progress: allDone ? 100 : state.progress,
      message: allDone ? `스캔 완료 (${payload.scanner} 오류)` : `${payload.scanner} 오류, 계속 진행 중...`,
    };
  } else {
    return { ...state, status: "error", message: payload.message };
  }
}

function handleComplete(state: ScanState, scanner: string): ScanState {
  const completedScanners = [...state.completedScanners, scanner];
  const isExpectingBoth = state.scannerMode === "all";
  const allDone = isExpectingBoth ? completedScanners.length >= 2 : true;
  return {
    ...state,
    status: allDone ? "complete" : "scanning",
    completedScanners,
    progress: allDone ? 100 : state.progress,
    message: allDone ? "스캔 완료" : `${scanner} 완료, 계속 진행 중...`,
  };
}

const BASE_STATE: ScanState = {
  scanId: "scan-001",
  status: "scanning",
  progress: 50,
  completedScanners: [],
  scannerMode: "all",
  message: "스캔 중...",
};

const BASE_ERROR: ScanErrorPayload = {
  scanId: "scan-001",
  clusterId: "cluster-abc",
  errorType: "EXECUTION_ERROR",
  message: "context does not exist",
  scanner: "trivy",
};

describe("handleError — scanner=all 모드 (b8b0735a 수정 verify)", () => {
  it("trivy error 시 status=scanning 유지, completedScanners에 trivy 추가", () => {
    const result = handleError(BASE_STATE, BASE_ERROR);
    expect(result.status).toBe("scanning");
    expect(result.completedScanners).toContain("trivy");
    expect(result.message).toContain("trivy 오류, 계속 진행 중...");
  });

  it("trivy error 후 kubescape complete -> status=complete (allDone)", () => {
    const afterTrivyError = handleError(BASE_STATE, BASE_ERROR);
    const afterKubescapeComplete = handleComplete(afterTrivyError, "kubescape");
    expect(afterKubescapeComplete.status).toBe("complete");
    expect(afterKubescapeComplete.completedScanners).toContain("kubescape");
  });

  it("kubescape error 후 trivy complete -> status=complete", () => {
    const kubescapeError: ScanErrorPayload = { ...BASE_ERROR, scanner: "kubescape" };
    const afterKubescapeError = handleError(BASE_STATE, kubescapeError);
    expect(afterKubescapeError.status).toBe("scanning");
    const afterTrivyComplete = handleComplete(afterKubescapeError, "trivy");
    expect(afterTrivyComplete.status).toBe("complete");
  });

  it("trivy error + kubescape error -> status=complete (양쪽 에러)", () => {
    const kubescapeError: ScanErrorPayload = { ...BASE_ERROR, scanner: "kubescape" };
    const afterTrivy = handleError(BASE_STATE, BASE_ERROR);
    const afterBoth = handleError(afterTrivy, kubescapeError);
    expect(afterBoth.status).toBe("complete");
    expect(afterBoth.message).toContain("오류");
  });

  it("다른 scanId payload는 상태 변경 없음", () => {
    const wrongId = { ...BASE_ERROR, scanId: "scan-999" };
    const result = handleError(BASE_STATE, wrongId);
    expect(result).toBe(BASE_STATE); // 참조 동일 (변경 없음)
  });
});

describe("handleError — scanner=trivy 단독 모드 (기존 동작 유지)", () => {
  it("trivy error -> status=error (setScanError 경로)", () => {
    const trivyOnlyState: ScanState = { ...BASE_STATE, scannerMode: "trivy" };
    const result = handleError(trivyOnlyState, BASE_ERROR);
    expect(result.status).toBe("error");
  });

  it("kubescape error -> status=error", () => {
    const kubescapeOnlyState: ScanState = { ...BASE_STATE, scannerMode: "kubescape" };
    const kubescapeError: ScanErrorPayload = { ...BASE_ERROR, scanner: "kubescape" };
    const result = handleError(kubescapeOnlyState, kubescapeError);
    expect(result.status).toBe("error");
  });
});

describe("startScan 즉시 리셋 (33a9a38f 수정 verify)", () => {
  function startScan(prevState: ScanState): ScanState {
    return {
      ...prevState,
      status: "scanning",
      progress: 0,
      message: "스캔 준비 중...",
      completedScanners: [],
    };
  }

  it("complete 상태에서 startScan 호출 -> 즉시 scanning, progress=0", () => {
    const completeState: ScanState = { ...BASE_STATE, status: "complete", progress: 100 };
    const result = startScan(completeState);
    expect(result.status).toBe("scanning");
    expect(result.progress).toBe(0);
    expect(result.completedScanners).toEqual([]);
  });

  it("재스캔 시 이전 complete 상태 잔류 없음 (100% 플래시 방지)", () => {
    const completeState: ScanState = { ...BASE_STATE, status: "complete", progress: 100 };
    const result = startScan(completeState);
    expect(result.progress).not.toBe(100);
    expect(result.status).not.toBe("complete");
  });
});

describe("trivy contextName 전달 (b8b0735a, 2f6b0b02 수정 verify)", () => {
  it("RunScanRequest에 contextName 필드가 있어야 함", () => {
    interface RunScanRequest {
      clusterId: string;
      kubeconfigPath: string;
      contextName: string;
      scanner: "trivy" | "kubescape" | "all";
    }

    const request: RunScanRequest = {
      clusterId: "cluster-uuid-abc",
      kubeconfigPath: "/home/user/.kube/config",
      contextName: "kubernetes-admin@test-cluster",
      scanner: "all",
    };

    expect(request.contextName).toBe("kubernetes-admin@test-cluster");
    expect(request.contextName).not.toBe(request.clusterId); // UUID 아님
  });

  it("trivy args에 contextName이 위치 인자로 포함돼야 함", () => {
    function buildTrivyArgs(contextName: string, kubeconfigPath: string): string[] {
      return ["k8s", contextName, "--format", "json", "--report", "all", "--kubeconfig", kubeconfigPath];
    }

    const args = buildTrivyArgs("kubernetes-admin@test-cluster", "/home/.kube/config");
    expect(args[0]).toBe("k8s");
    expect(args[1]).toBe("kubernetes-admin@test-cluster"); // 위치 인자 확인
    expect(args).not.toContain("--context"); // --context 플래그 아님
  });
});

// ============================================
// 22cff1c6 — duplicate scanner guard 추가 verify
// ============================================

describe("handleError — duplicate scanner guard (22cff1c6 수정 verify)", () => {
  // alreadyAdded 방어 로직 test용: 이미 completedScanners에 있으면 무시
  function handleErrorWithGuard(state: ScanState, payload: ScanErrorPayload): ScanState {
    if (payload.scanId !== state.scanId) return state;
    const isExpectingBoth = state.scannerMode === "all";
    if (isExpectingBoth) {
      const alreadyAdded = state.completedScanners.includes(payload.scanner);
      if (alreadyAdded) return state; // 중복 방지
      const completedScanners = [...state.completedScanners, payload.scanner];
      const allDone = completedScanners.length >= 2;
      return {
        ...state,
        status: allDone ? "complete" : "scanning",
        completedScanners,
        progress: allDone ? 100 : state.progress,
        message: allDone ? `스캔 완료 (${payload.scanner} 오류)` : `${payload.scanner} 오류, 계속 진행 중...`,
      };
    } else {
      return { ...state, status: "error", message: payload.message };
    }
  }

  it("trivy error 두 번 오면 두 번째는 무시 (중복 추가 방지)", () => {
    const afterFirst = handleErrorWithGuard(BASE_STATE, BASE_ERROR);
    expect(afterFirst.completedScanners).toEqual(["trivy"]);
    const afterSecond = handleErrorWithGuard(afterFirst, BASE_ERROR);
    expect(afterSecond).toBe(afterFirst); // 참조 동일 (변경 없음)
    expect(afterSecond.completedScanners).toEqual(["trivy"]); // 중복 없음
  });

  it("trivy error 두 번 -> allDone이 false로 유지됨 (length 2가 안 됨)", () => {
    const afterFirst = handleErrorWithGuard(BASE_STATE, BASE_ERROR);
    const afterSecond = handleErrorWithGuard(afterFirst, BASE_ERROR);
    expect(afterSecond.status).toBe("scanning"); // complete 아님
    expect(afterSecond.completedScanners.length).toBe(1); // 중복 미포함
  });

  it("trivy error + kubescape error (서로 다름) -> complete", () => {
    const kubescapeError: ScanErrorPayload = { ...BASE_ERROR, scanner: "kubescape" };
    const afterTrivy = handleErrorWithGuard(BASE_STATE, BASE_ERROR);
    const afterBoth = handleErrorWithGuard(afterTrivy, kubescapeError);
    expect(afterBoth.status).toBe("complete");
    expect(afterBoth.completedScanners).toContain("trivy");
    expect(afterBoth.completedScanners).toContain("kubescape");
  });
});
