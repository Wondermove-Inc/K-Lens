/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Purpose: 워크로드의 현재 securityContext 읽기 + 패치 충돌 검증
 *
 * fix-yaml-builder가 패치 생성 전에 호출하여 안전 여부를 판단.
 * extractSafetyProfile: pod spec JSON → WorkloadSafetyProfile
 * checkPatchSafety: checkId + profile → 적용 가능 여부
 *
 * 이미지 USER 확인: securityContext.runAsUser 및 uid 정보 기반 보수적 검증.
 *
 * @packageDocumentation
 */

// ============================================
// Types
// ============================================

export interface ContainerSafetyInfo {
  /** 컨테이너 이름 */
  name: string;
  /** container.securityContext.privileged === true — root 필수 워크로드 */
  privileged: boolean;
  /** SYS_ADMIN, NET_ADMIN 등 — capabilities.drop: ALL 패치 위험 */
  dangerousCapabilities: string[];
  /** mountPropagation: Bidirectional 볼륨 마운트 존재 — 스토리지 드라이버 */
  hasBidirectionalMount: boolean;
  /** readOnlyRootFilesystem 현재 값 (true면 이미 설정됨, 중복 패치 불필요) */
  readOnlyRootFilesystem: boolean;
  /**
   * 컨테이너 실행 UID
   * - 0 : root (runAsNonRoot 패치 시 crash)
   * - >0 : non-root (안전)
   * - undefined : 확인 불가 → 보수적으로 unsafe
   *
   * 출처: spec.securityContext.runAsUser (pod/container level)
   */
  runningAsUid?: number;
  /**
   * 이미지 USER 지시문 확인 결과
   * - 값 있음: Dockerfile USER 지시문 (예: "1000", "postgres", "root")
   * - undefined: 확인 불가 (이미지 inspect 미수행 또는 실패)
   *
   * NOTE: 실제 이미지 inspect는 Main Process에서 수행.
   *       여기서는 타입 정의만 — 값은 호출자가 채워서 전달.
   */
  imageUser?: string;
}

export interface WorkloadSafetyProfile {
  /** 워크로드 고유 키: "kind/name/namespace" 형태 */
  key: string;
  /** 컨테이너(+ initContainers) 별 안전성 정보 */
  containers: ContainerSafetyInfo[];
  /** Pod-level 위험 플래그 */
  hostNetwork: boolean;
  hostPID: boolean;
  hostIPC: boolean;
}

export interface SafetyCheckResult {
  /** 패치 적용 가능 여부 */
  safe: boolean;
  /** skip 사유 목록 (UI / AI 프롬프트 표시용) */
  reasons: string[];
}

// ============================================
// 상수
// ============================================

/**
 * 제거하면 워크로드가 crash할 가능성이 높은 특수 capabilities.
 * 이 cap을 add한 컨테이너에 capabilities.drop: ALL 패치(KSV-0036/0048)는 위험.
 */
const DANGEROUS_CAPABILITIES = new Set<string>([
  "SYS_ADMIN", // 커널 관리 — CSI, 컨테이너 런타임
  "NET_ADMIN", // 네트워크 인터페이스 조작
  "SYS_PTRACE", // 다른 프로세스 tracing — 디버깅, Java agents
  "NET_RAW", // RAW/PACKET 소켓 — 네트워크 모니터링
  "SYS_MODULE", // 커널 모듈 로드/언로드
  "SYS_RAWIO", // raw I/O (ioperm/iopl)
  "DAC_READ_SEARCH", // 파일 권한 우회 — 에이전트 워크로드
]);

/**
 * Pod-level host* 플래그가 켜져 있을 때 패치를 skip해야 하는 checkId 목록.
 * host namespace 공유 워크로드는 보안 컨텍스트를 직접 바꾸면 위험.
 */
const HOST_NAMESPACE_SENSITIVE_CHECK_IDS = new Set<string>([
  "KSV-0001", // runAsNonRoot
  "KSV-0012", // runAsUser
  "KSV-0014", // runAsGroup
  "KSV-0017", // privileged: false
  "KSV-0020", // runAsNonRoot (별칭)
  "KSV-0021", // runAsNonRoot UID > 0
  "KSV-0022", // runAsNonRoot (container-level)
  "KSV-0032", // allowPrivilegeEscalation: false
  "KSV-0036", // capabilities.drop: ALL
  "KSV-0048", // capabilities.drop: [ALL]
]);

/**
 * runAsNonRoot 관련 checkId — root UID 검증 필요
 */
const RUNS_AS_NONROOT_CHECK_IDS = new Set<string>([
  "KSV-0001", // runAsNonRoot (pod-level)
  "KSV-0020", // runAsNonRoot (별칭)
  "KSV-0021", // runAsNonRoot UID > 0
  "KSV-0022", // runAsNonRoot (container-level)
]);

// ============================================
// extractSafetyProfile
// ============================================

/**
 * kubectl get <resource> -o json 결과의 `spec.template.spec`(pod spec) 부분을 받아
 * WorkloadSafetyProfile을 추출.
 *
 * 호출 예시:
 * ```ts
 * const raw = JSON.parse(kubectlGetOutput);
 * const podSpec = raw.spec?.template?.spec ?? raw.spec; // Deployment vs Pod
 * const profile = extractSafetyProfile(podSpec, "Deployment/nginx/default");
 * ```
 *
 * @param podSpec     - kubectl JSON의 spec.template.spec (Deployment/DaemonSet 등) 또는 Pod.spec
 * @param resourceKey - "Kind/name/namespace" 형태 (로깅 / UI용)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractSafetyProfile(podSpec: any, resourceKey: string): WorkloadSafetyProfile {
  const containers: ContainerSafetyInfo[] = [];

  // containers + initContainers 모두 검사
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allContainers: any[] = [...(podSpec?.containers ?? []), ...(podSpec?.initContainers ?? [])];

  for (const c of allContainers) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const secCtx: Record<string, any> = c.securityContext ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const caps: Record<string, any> = secCtx.capabilities ?? {};
    const addCaps: string[] = (caps.add ?? []) as string[];

    const hasBidirectionalMount = ((c.volumeMounts ?? []) as Array<{ mountPropagation?: string }>).some(
      (vm) => vm.mountPropagation === "Bidirectional",
    );

    // runningAsUid 추출
    // container-level securityContext.runAsUser 우선,
    // 없으면 pod-level spec.securityContext.runAsUser 참조.
    // 둘 다 없으면 undefined (확인 불가 → 보수적 unsafe).
    const podSecCtx: Record<string, unknown> = podSpec?.securityContext ?? {};
    const containerRunAsUser = secCtx.runAsUser as number | undefined;
    const podRunAsUser = podSecCtx.runAsUser as number | undefined;
    const runningAsUid: number | undefined = containerRunAsUser ?? podRunAsUser;

    containers.push({
      name: c.name as string,
      privileged: secCtx.privileged === true,
      dangerousCapabilities: addCaps.filter((cap) => DANGEROUS_CAPABILITIES.has(cap)),
      hasBidirectionalMount,
      readOnlyRootFilesystem: secCtx.readOnlyRootFilesystem === true,
      runningAsUid,
      // imageUser는 호출자(Main Process)가 채워서 전달 (이미지 inspect 필요)
      imageUser: undefined,
    });
  }

  return {
    key: resourceKey,
    containers,
    hostNetwork: podSpec?.hostNetwork === true,
    hostPID: podSpec?.hostPID === true,
    hostIPC: podSpec?.hostIPC === true,
  };
}

// ============================================
// resolveContainerUid
// ============================================

/**
 * 실행 중인 pod status에서 컨테이너 UID를 추출하는 헬퍼.
 *
 * K8s API는 pod status에서 실행 UID를 직접 제공하지 않습니다.
 * 실제 UID 확인은  또는 crictl inspect가 필요하며,
 * 이는 Main Process에서 처리합니다.
 *
 * 여기서는 spec.securityContext.runAsUser 설정값을 사용하되,
 * 미설정이면 undefined를 반환하여 **보수적으로 unsafe** 처리합니다.
 *
 * 이 설계 의도: ud655uc778ud560 uc218 uc5c6uc73cuba74 unsafe — 어떤 환경에서도 안전.
 *
 * @param podStatus     - kubectl get pod -o json 의 status 객체
 * @param containerName - 확인할 컨테이너 이름
 * @returns UID 숫자 또는 undefined (확인 불가)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveContainerUid(podStatus: any, containerName: string): number | undefined {
  // K8s status에는 실행 UID가 없음 — containerStatuses는 image/ready/restartCount만 제공.
  // Main Process에서 kubectl exec / crictl inspect로 실제 UID를 채운 후
  // ContainerSafetyInfo.runningAsUid에 직접 할당하는 방식을 권장.
  //
  // 이 함수는 placeholder이며, 향후 확장 시 아래 로직을 구체화합니다:
  // 1. podStatus.containerStatuses 에서 containerName 매칭
  // 2. containerStatus.containerID 로 crictl inspect 호출
  // 3. OCI spec의 process.user.uid 추출
  void podStatus;
  void containerName;
  return undefined;
}

// ============================================
// checkPatchSafety
// ============================================

/**
 * 특정 checkId 패치가 이 워크로드에 안전한지 판단 (pure function).
 *
 * 판단 기준:
 * 1. Pod-level host* namespace 공유 → securityContext 관련 checkId는 skip
 * 2. privileged=true 컨테이너 → 모든 securityContext 패치 skip
 * 3. Dangerous capabilities → capabilities.drop: ALL 패치 skip
 * 4. Bidirectional mount → 모든 securityContext 패치 skip (스토리지 드라이버)
 *
 * @param profile  - extractSafetyProfile()로 추출한 프로파일
 * @param checkId  - 적용하려는 패치의 KSV checkId (예: "KSV-0001")
 */
export function checkPatchSafety(profile: WorkloadSafetyProfile, checkId: string): SafetyCheckResult {
  const reasons: string[] = [];

  // 1. Pod-level host namespace 공유
  if (HOST_NAMESPACE_SENSITIVE_CHECK_IDS.has(checkId)) {
    if (profile.hostNetwork) {
      reasons.push(`hostNetwork: true — network namespace shared with host`);
    }
    if (profile.hostPID) {
      reasons.push(`hostPID: true — PID namespace shared with host`);
    }
    if (profile.hostIPC) {
      reasons.push(`hostIPC: true — IPC namespace shared with host`);
    }
  }

  // 2. Container-level 검증 (하나라도 위험하면 skip)
  for (const c of profile.containers) {
    // privileged=true → securityContext 패치 전체 위험
    if (c.privileged && HOST_NAMESPACE_SENSITIVE_CHECK_IDS.has(checkId)) {
      reasons.push(`container "${c.name}": privileged=true — requires full privileges, securityContext patch unsafe`);
    }

    // dangerous capabilities → capabilities.drop: ALL 패치 위험
    if (c.dangerousCapabilities.length > 0 && (checkId === "KSV-0036" || checkId === "KSV-0048")) {
      reasons.push(`container "${c.name}": uses ${c.dangerousCapabilities.join(", ")} — cannot drop ALL capabilities`);
    }

    // Bidirectional mount → 스토리지 드라이버, securityContext 변경 위험
    if (c.hasBidirectionalMount && HOST_NAMESPACE_SENSITIVE_CHECK_IDS.has(checkId)) {
      reasons.push(
        `container "${c.name}": mountPropagation=Bidirectional — storage driver, securityContext patch unsafe`,
      );
    }
  }

  // 5. runAsNonRoot 패치 — root 실행 이미지 검증
  if (RUNS_AS_NONROOT_CHECK_IDS.has(checkId)) {
    for (const c of profile.containers) {
      // UID 0 = root → runAsNonRoot: true 패치 시 즉시 crash
      if (c.runningAsUid === 0) {
        reasons.push(`container "${c.name}": runs as root (UID 0) — runAsNonRoot: true will cause CrashLoopBackOff`);
      }
      // UID 미확인 + imageUser 정보도 없음 → 보수적 unsafe
      // postgres, redis 등 root 실행 이미지 보호 목적
      if (c.runningAsUid === undefined && c.imageUser === undefined) {
        reasons.push(
          `container "${c.name}": running UID unknown, imageUser not inspected — cannot verify runAsNonRoot safety`,
        );
      }
      // imageUser가 "root" 또는 "0"으로 명시된 경우
      if (c.imageUser === "root" || c.imageUser === "0") {
        reasons.push(
          `container "${c.name}": image USER="${c.imageUser}" (root) — runAsNonRoot: true will cause CrashLoopBackOff`,
        );
      }
    }
  }

  return { safe: reasons.length === 0, reasons };
}

// ============================================
// buildSafetyProfiles (병렬 구축 헬퍼)
// ============================================

export interface BuildSafetyProfilesOptions {
  /**
   * 워크로드 kind/name/namespace → PodSpec 반환.
   * 찾을 수 없으면 null 반환.
   * Main Process에서 kubectl get으로 구현.
   */
  getWorkloadSpec: (kind: string, name: string, namespace: string) => Promise<unknown | null>;
  /**
   * 동시 실행 수 (기본: 15).
   * 500+ 워크로드도 concurrency 15 × timeout 10s = ~35초 이내 완료.
   */
  concurrency?: number;
  /**
   * 단일 워크로드 조회 타임아웃 ms (기본: 10000).
   * 초과 시 skip (Map에 미포함).
   */
  timeoutMs?: number;
}

/**
 * 유니크 워크로드 목록 → WorkloadSafetyProfile Map 병렬 구축.
 *
 * 특징:
 * - 외부 의존성 없는 Promise 기반 concurrency limiter
 * - Promise.race로 단일 워크로드 timeout 처리
 * - 실패/timeout → skip (Map에 미포함 → classifyFindings에서 기존 분류 유지)
 *
 * @param workloads - 유니크 워크로드 목록 (resourceKey 단위)
 * @param options   - getWorkloadSpec DI + concurrency + timeoutMs
 * @returns Map<"Kind/name/namespace", WorkloadSafetyProfile>
 */
export async function buildSafetyProfiles(
  workloads: Array<{ kind: string; name: string; namespace: string }>,
  options: BuildSafetyProfilesOptions,
): Promise<Map<string, WorkloadSafetyProfile>> {
  if (workloads.length === 0) return new Map();

  const concurrency = options.concurrency ?? 15;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const result = new Map<string, WorkloadSafetyProfile>();

  // Promise 기반 concurrency limiter
  // activeSlots: 현재 실행 중인 Promise 수
  let activeSlots = 0;
  let idx = 0;

  await new Promise<void>((resolve) => {
    const tryNext = (): void => {
      // 모든 워크로드 처리 완료
      if (idx >= workloads.length && activeSlots === 0) {
        resolve();
        return;
      }

      // concurrency 한도 내에서 새 작업 시작
      while (activeSlots < concurrency && idx < workloads.length) {
        const workload = workloads[idx++]!;
        activeSlots++;

        const resourceKey = `${workload.kind}/${workload.name}/${workload.namespace}`;

        // timeout sentinel
        const timeoutPromise = new Promise<null>((r) => setTimeout(() => r(null), timeoutMs));
        const specPromise = options.getWorkloadSpec(workload.kind, workload.name, workload.namespace);

        Promise.race([specPromise, timeoutPromise])
          .then((spec) => {
            if (spec !== null) {
              try {
                const profile = extractSafetyProfile(spec, resourceKey);
                result.set(resourceKey, profile);
              } catch {
                // extractSafetyProfile 실패 → skip
              }
            }
          })
          .catch(() => {
            // getWorkloadSpec 에러 → skip
          })
          .finally(() => {
            activeSlots--;
            tryNext();
          });
      }

      // 모든 슬롯이 채워진 상태에서 idx 소진 → 완료 대기
      if (idx >= workloads.length && activeSlots === 0) {
        resolve();
      }
    };

    tryNext();
  });

  return result;
}

// ============================================
// resolveImageUser (이미지 inspect 기반 USER 확인)
// ============================================

/**
 * 이미지 inspect DI 설정.
 * Main Process에서 crictl/docker inspect로 구현.
 */
export interface ImageInspectConfig {
  /**
   * 이미지 참조 → 이미지 설정 반환.
   * 실패 시 null 반환 (throw 안 함).
   * Main Process에서 crictl inspect 또는 docker inspect CLI로 구현.
   */
  inspectImage: (imageRef: string) => Promise<{ user?: string } | null>;
}

/**
 * 이미지 USER 지시문에서 UID 추출.
 *
 * 처리 패턴:
 * - "0" | "root"           → "0" (root)
 * - "1000"                 → "1000"
 * - "nobody"               → "65534" (표준 nobody UID)
 * - "user:group" 형식      → user 부분만 추출
 * - "postgres"             → "postgres" (이름 그대로 — 런타임에서 /etc/passwd 조회)
 * - undefined / ""         → undefined (이미지에 USER 지시문 없음)
 *
 * @param imageRef - 풀 이미지 URI (태그 포함)
 * @param config   - inspectImage DI
 * @returns USER 값 문자열 (UID 또는 username) | undefined (확인 불가)
 */
export async function resolveImageUser(imageRef: string, config: ImageInspectConfig): Promise<string | undefined> {
  let result: { user?: string } | null = null;

  try {
    result = await config.inspectImage(imageRef);
  } catch {
    return undefined;
  }

  if (!result) return undefined;

  const rawUser = result.user?.trim();
  if (!rawUser) return undefined;

  // "user:group" 형식 → user 부분만
  const colonIdx = rawUser.indexOf(":");
  const userPart = colonIdx !== -1 ? rawUser.slice(0, colonIdx) : rawUser;

  if (!userPart) return undefined;

  // nobody / nfsnobody → well-known UID
  const noBodyNames = new Set(["nobody", "nfsnobody"]);
  if (noBodyNames.has(userPart.toLowerCase())) return "65534";

  return userPart;
}

/**
 * buildSafetyProfiles에서 resolveImageUser 호출 통합 헬퍼.
 *
 * WorkloadSafetyProfile.containers[].imageUser 를 채움.
 * imageInspect DI가 없거나 실패해도 기존 profile은 그대로 유지.
 *
 * @param profiles       - buildSafetyProfiles 결과 Map (변경됨)
 * @param containerImages - resourceKey → { containerName, imageRef }[] 매핑
 * @param config          - ImageInspectConfig DI
 */
export async function enrichProfilesWithImageUser(
  profiles: Map<string, WorkloadSafetyProfile>,
  containerImages: Map<string, Array<{ containerName: string; imageRef: string }>>,
  config: ImageInspectConfig,
): Promise<void> {
  const tasks: Promise<void>[] = [];

  for (const [key, profile] of profiles) {
    const images = containerImages.get(key);
    if (!images) continue;

    for (const { containerName, imageRef } of images) {
      const containerInfo = profile.containers.find((c) => c.name === containerName);
      if (!containerInfo) continue;

      // 이미 채워진 경우 skip
      if (containerInfo.imageUser !== undefined) continue;

      tasks.push(
        resolveImageUser(imageRef, config).then((user) => {
          containerInfo.imageUser = user;
        }),
      );
    }
  }

  await Promise.allSettled(tasks);
}
