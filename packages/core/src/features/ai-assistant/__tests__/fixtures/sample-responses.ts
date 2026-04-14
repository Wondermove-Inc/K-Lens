/**
 * Phase 1 통합 테스트용 샘플 응답 데이터
 *
 * Phase 1 통합 테스트
 * 테스트용 샘플 LLM 응답과 kubectl 출력을 정의합니다.
 *
 * @module sample-responses
 */

/**
 * 포맷팅 규칙 위반 응답 (Before Phase 1)
 *
 * 이모지, ASCII 아트, 과도한 구분선 등이 포함된 응답
 * 토큰 사용량이 높음
 */
export const SAMPLE_RESPONSE_BEFORE_PHASE1 = `
🎯 **문제 분석 완료**

╔══════════════════════════════════════════════╗
║  📊 클러스터 상태 분석 결과                    ║
╚══════════════════════════════════════════════╝

✅ **정상 리소스**:
• nginx-deployment ✓
• redis-master ✓
• api-gateway ✓

⚠️ **주의 필요**:
• prometheus-server (Pending)

❌ **장애 발생**:
• payment-service (CrashLoopBackOff) 🔥

──────────────────────────────────────────────

📝 **권장 조치**:
1. 🔍 payment-service 로그 확인
2. 🔧 리소스 제한 검토
3. 📞 담당자 연락

🚀 Happy debugging!
`;

/**
 * 포맷팅 규칙 준수 응답 (After Phase 1)
 *
 * 이모지 없음, Markdown 테이블 사용, 간결한 설명
 * 토큰 사용량 최적화
 */
export const SAMPLE_RESPONSE_AFTER_PHASE1 = `
**문제 분석 완료**

| Resource | Status | Details |
|----------|--------|---------|
| nginx-deployment | Running | Ready, Restarts: 0 |
| redis-master | Running | Ready, Restarts: 0 |
| api-gateway | Running | Ready, Restarts: 1 |
| prometheus-server | Pending | ImagePullBackOff |
| payment-service | Failed | CrashLoopBackOff, Exit 137 |

**권장 조치**:
- payment-service 로그 확인
- 리소스 제한 검토
- 담당자 연락
`;

/**
 * kubectl describe 전체 출력 (Before Phase 1)
 *
 * 불필요한 정보가 많아 토큰 사용량이 높음
 */
export const KUBECTL_DESCRIBE_OUTPUT = `
Name:             nginx-deployment-7f8b7c8d4f-abc12
Namespace:        default
Priority:         0
Service Account:  default
Node:             node-1/10.0.0.1
Start Time:       Mon, 01 Feb 2026 10:00:00 +0900
Labels:           app=nginx
                  pod-template-hash=7f8b7c8d4f
Annotations:      kubernetes.io/created-by: nginx-deployment
Status:           Running
IP:               172.17.0.5
IPs:
  IP:           172.17.0.5
Controlled By:  ReplicaSet/nginx-deployment-7f8b7c8d4f
Containers:
  nginx:
    Container ID:   docker://abc123def456
    Image:          nginx:1.21
    Image ID:       docker-pullable://nginx@sha256:abc123
    Port:           80/TCP
    Host Port:      0/TCP
    State:          Running
      Started:      Mon, 01 Feb 2026 10:00:05 +0900
    Ready:          True
    Restart Count:  0
    Limits:
      cpu:     500m
      memory:  128Mi
    Requests:
      cpu:        250m
      memory:     64Mi
    Environment:  <none>
    Mounts:
      /var/run/secrets/kubernetes.io/serviceaccount from default-token-abc12 (ro)
Conditions:
  Type              Status
  Initialized       True
  Ready             True
  ContainersReady   True
  PodScheduled      True
Volumes:
  default-token-abc12:
    Type:        Secret (a volume populated by a Secret)
    SecretName:  default-token-abc12
    Optional:    false
QoS Class:       Burstable
Node-Selectors:  <none>
Tolerations:     node.kubernetes.io/not-ready:NoExecute op=Exists for 300s
                 node.kubernetes.io/unreachable:NoExecute op=Exists for 300s
Events:
  Type    Reason     Age   From               Message
  ----    ------     ----  ----               -------
  Normal  Scheduled  10m   default-scheduler  Successfully assigned default/nginx-deployment-7f8b7c8d4f-abc12 to node-1
  Normal  Pulled     10m   kubelet            Container image "nginx:1.21" already present on machine
  Normal  Created    10m   kubelet            Created container nginx
  Normal  Started    10m   kubelet            Started container nginx
`;

/**
 * kubectl jsonpath 필터링 출력 (After Phase 1)
 *
 * 필수 필드만 추출하여 토큰 사용량 최소화
 */
export const KUBECTL_JSONPATH_OUTPUT = `nginx-deployment-7f8b7c8d4f-abc12\tdefault\tRunning\t0`;

/**
 * 토큰 계산용 상수
 *
 * 대략적인 토큰 추정 (4 characters = 1 token)
 */
export const TOKEN_ESTIMATION = {
  CHARS_PER_TOKEN: 4,
};

/**
 * 응답 토큰 수 추정
 *
 * @param text 텍스트
 * @returns 추정 토큰 수
 */
export function estimateTokens(text: string): number {
  // 간단한 추정: 4자 = 1 토큰
  return Math.ceil(text.length / TOKEN_ESTIMATION.CHARS_PER_TOKEN);
}

/**
 * 토큰 절감율 계산
 *
 * @param before 이전 토큰 수
 * @param after 이후 토큰 수
 * @returns 절감율 (0.0 ~ 1.0)
 */
export function calculateTokenReduction(before: number, after: number): number {
  if (before === 0) return 0;
  return (before - after) / before;
}

/**
 * 포맷팅 규칙 위반 여부 검사
 */
export const FORMAT_RULES = {
  /**
   * 금지된 이모지 패턴
   */
  FORBIDDEN_EMOJI_PATTERN:
    /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|✓|✅|❌|⚠️|🔥|🎯|📊|📝|🔍|🔧|📞|🚀|✨|💡|🎉/gu,

  /**
   * 금지된 ASCII 아트 패턴
   */
  FORBIDDEN_ASCII_ART_PATTERN: /[╔╗╚╝═║─│┌┐└┘├┤┬┴┼]/g,

  /**
   * 과도한 구분선 패턴 (15개 이상 연속, Markdown 테이블 허용)
   *
   * Markdown 테이블 헤더 구분선 (|---|---|)은 허용하기 위해
   * 15개 이상 연속일 때만 위반으로 처리
   */
  EXCESSIVE_DIVIDER_PATTERN: /[-=~]{15,}/g,
};

/**
 * 응답이 포맷팅 규칙을 준수하는지 확인
 *
 * @param response LLM 응답 텍스트
 * @returns 규칙 준수 여부와 위반 상세
 */
export function validateFormatRules(response: string): {
  isValid: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  // 이모지 검사
  const emojiMatches = response.match(FORMAT_RULES.FORBIDDEN_EMOJI_PATTERN);
  if (emojiMatches) {
    violations.push(`이모지 사용 감지: ${emojiMatches.join(", ")}`);
  }

  // ASCII 아트 검사
  const asciiMatches = response.match(FORMAT_RULES.FORBIDDEN_ASCII_ART_PATTERN);
  if (asciiMatches) {
    violations.push(`ASCII 아트 사용 감지: ${[...new Set(asciiMatches)].join(", ")}`);
  }

  // 과도한 구분선 검사
  const dividerMatches = response.match(FORMAT_RULES.EXCESSIVE_DIVIDER_PATTERN);
  if (dividerMatches) {
    violations.push(`과도한 구분선 사용 감지: ${dividerMatches.length}개`);
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}

/**
 * Markdown 테이블 형식 검증
 *
 * @param response LLM 응답 텍스트
 * @returns 테이블 포맷 사용 여부
 */
export function hasMarkdownTable(response: string): boolean {
  // Markdown 테이블 패턴: |로 시작하고 |로 끝나는 줄
  const tablePattern = /^\|.+\|$/m;
  // 헤더 구분자 패턴: |---|---|
  const headerPattern = /^\|[-:\s|]+\|$/m;

  return tablePattern.test(response) && headerPattern.test(response);
}

/**
 * 샘플 Pod 데이터 (캐싱 테스트용)
 */
export const SAMPLE_POD_DATA = {
  name: "nginx-deployment-7f8b7c8d4f-abc12",
  namespace: "default",
  status: "Running",
  restarts: 0,
};

/**
 * 샘플 Deployment 데이터 (캐싱 테스트용)
 */
export const SAMPLE_DEPLOYMENT_DATA = {
  name: "nginx-deployment",
  namespace: "default",
  replicas: 3,
  available: 3,
  status: "Available",
};

/**
 * 샘플 Service 데이터 (캐싱 테스트용)
 */
export const SAMPLE_SERVICE_DATA = {
  name: "nginx-service",
  namespace: "default",
  type: "ClusterIP",
  clusterIP: "10.0.0.100",
  ports: [80],
};
