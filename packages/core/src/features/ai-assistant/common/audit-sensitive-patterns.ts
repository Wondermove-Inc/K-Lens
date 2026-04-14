/**
 * 🎯 목적: AI Assistant 감사 로깅 - 민감 정보 마스킹 패턴
 * 01: AuditLogger 구현
 *
 * 📝 주의사항:
 * - 민감 정보 마스킹을 위한 정규식 패턴 정의
 * - API 키, 토큰, 비밀번호, Secret 값 등을 마스킹
 * - 새 패턴 추가 시 이 파일 확장
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (audit-types.ts에서 분리)
 *
 * @packageDocumentation
 */

// ============================================
// 🎯 민감 정보 패턴 인터페이스
// ============================================

/**
 * 민감 정보 패턴 인터페이스
 *
 * 🎯 목적: 마스킹할 민감 정보 패턴 정의
 *
 * @example
 * ```typescript
 * const apiKeyPattern: SensitivePattern = {
 *   name: 'API Key',
 *   pattern: /api[_-]?key[\s:="']+([a-zA-Z0-9-_]+)/gi,
 *   replacement: 'api_key=***MASKED***',
 * };
 * ```
 */
export interface SensitivePattern {
  /** 패턴 이름 */
  name: string;

  /** 정규식 패턴 */
  pattern: RegExp;

  /** 대체 문자열 또는 대체 함수 */
  replacement: string | ((match: string) => string);
}

// ============================================
// 🎯 기본 민감 정보 패턴
// ============================================

/**
 * 기본 민감 정보 패턴 목록
 *
 * 📝 주의사항:
 * - API 키, 토큰, 비밀번호, Secret 값 등을 마스킹
 * - 새 패턴 추가 시 이 배열 확장
 */
export const DEFAULT_SENSITIVE_PATTERNS: SensitivePattern[] = [
  {
    name: "API Key",
    pattern: /api[_-]?key[\s:="']+([a-zA-Z0-9\-_]+)/gi,
    replacement: "api_key=***MASKED***",
  },
  {
    name: "Bearer Token",
    pattern: /bearer\s+([a-zA-Z0-9\-_.]+)/gi,
    replacement: "Bearer ***MASKED***",
  },
  {
    name: "Authorization Header",
    pattern: /authorization[\s:="']+([a-zA-Z0-9\-_.]+)/gi,
    replacement: "Authorization: ***MASKED***",
  },
  {
    name: "Password",
    pattern: /password[\s:="']+([^\s"']+)/gi,
    replacement: "password=***MASKED***",
  },
  {
    name: "Secret",
    pattern: /secret[\s:="']+([^\s"']+)/gi,
    replacement: "secret=***MASKED***",
  },
  {
    name: "Token",
    pattern: /token[\s:="']+([a-zA-Z0-9\-_.]+)/gi,
    replacement: "token=***MASKED***",
  },
  {
    name: "Private Key",
    pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/gi,
    replacement: "***PRIVATE KEY MASKED***",
  },
  {
    name: "AWS Access Key",
    pattern: /AKIA[0-9A-Z]{16}/gi,
    replacement: "***AWS_ACCESS_KEY_MASKED***",
  },
  {
    name: "AWS Secret Key",
    pattern: /aws[_-]?secret[_-]?access[_-]?key[\s:="']+([a-zA-Z0-9/+=]+)/gi,
    replacement: "aws_secret_access_key=***MASKED***",
  },
  {
    name: "Base64 Data (potential secrets)",
    pattern: /data:\s*([A-Za-z0-9+/=]{40,})/gi,
    replacement: "data: ***BASE64_MASKED***",
  },
];

// ============================================
// 🎯 추가 민감 정보 패턴 (확장용)
// ============================================

/**
 * Kubernetes Secret 관련 패턴
 */
export const KUBERNETES_SECRET_PATTERNS: SensitivePattern[] = [
  {
    name: "Kubernetes Secret Data",
    pattern: /stringData:\s*\n([\s\S]*?)(?=\n\w|$)/gi,
    replacement: "stringData:\n  ***MASKED***",
  },
  {
    name: "Kubernetes TLS Secret",
    pattern: /tls\.key:\s*([A-Za-z0-9+/=]+)/gi,
    replacement: "tls.key: ***MASKED***",
  },
  {
    name: "Kubernetes TLS Cert",
    pattern: /tls\.crt:\s*([A-Za-z0-9+/=]+)/gi,
    replacement: "tls.crt: ***MASKED***",
  },
];

/**
 * 데이터베이스 연결 문자열 패턴
 */
export const DATABASE_CONNECTION_PATTERNS: SensitivePattern[] = [
  {
    name: "PostgreSQL Connection String",
    pattern: /postgresql:\/\/([^:]+):([^@]+)@/gi,
    replacement: "postgresql://***:***@",
  },
  {
    name: "MySQL Connection String",
    pattern: /mysql:\/\/([^:]+):([^@]+)@/gi,
    replacement: "mysql://***:***@",
  },
  {
    name: "MongoDB Connection String",
    pattern: /mongodb\+srv:\/\/([^:]+):([^@]+)@/gi,
    replacement: "mongodb+srv://***:***@",
  },
  {
    name: "Redis Connection String",
    pattern: /redis:\/\/([^:]+):([^@]+)@/gi,
    replacement: "redis://***:***@",
  },
];

/**
 * 클라우드 서비스 패턴
 */
export const CLOUD_SERVICE_PATTERNS: SensitivePattern[] = [
  {
    name: "Google Cloud Service Account Key",
    pattern: /"private_key":\s*"([^"]+)"/gi,
    replacement: '"private_key": "***MASKED***"',
  },
  {
    name: "Azure Client Secret",
    pattern: /azure[_-]?client[_-]?secret[\s:="']+([^\s"']+)/gi,
    replacement: "azure_client_secret=***MASKED***",
  },
  {
    name: "GitHub Token",
    pattern: /ghp_[a-zA-Z0-9]{36}/gi,
    replacement: "***GITHUB_TOKEN_MASKED***",
  },
  {
    name: "GitLab Token",
    pattern: /glpat-[a-zA-Z0-9]{20}/gi,
    replacement: "***GITLAB_TOKEN_MASKED***",
  },
];

// ============================================
// 🎯 패턴 병합 유틸리티
// ============================================

/**
 * 여러 패턴 배열을 병합
 *
 * @param patternArrays - 패턴 배열들
 * @returns 병합된 패턴 배열
 */
export function mergePatterns(...patternArrays: SensitivePattern[][]): SensitivePattern[] {
  return patternArrays.flat();
}

/**
 * 모든 기본 + 확장 패턴 반환
 *
 * @returns 전체 민감 정보 패턴 배열
 */
export function getAllSensitivePatterns(): SensitivePattern[] {
  return mergePatterns(
    DEFAULT_SENSITIVE_PATTERNS,
    KUBERNETES_SECRET_PATTERNS,
    DATABASE_CONNECTION_PATTERNS,
    CLOUD_SERVICE_PATTERNS,
  );
}
