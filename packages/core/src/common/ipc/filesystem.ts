/**
 * 🎯 목적: 파일 시스템 IPC 채널 정의
 * 📝 기능:
 *   - IPC 채널명 상수 정의
 *   - 요청/응답 타입 정의
 *   - 민감 파일 패턴 정의
 * 🔄 변경이력:
 *   - 2026-01-24: 초기 구현
 * @module common/ipc/filesystem
 */

/**
 * 파일 시스템 IPC 채널명
 */
export const fileSystemChannels = {
  /** 파일 내용 읽기 */
  readFile: "fs:readFile",
  /** 파일 저장 */
  writeFile: "fs:writeFile",
  /** 디렉토리 목록 조회 */
  readDir: "fs:readDir",
  /** 파일/디렉토리 정보 조회 */
  stat: "fs:stat",
  /** 파일/디렉토리 존재 여부 확인 */
  exists: "fs:exists",
  /** 파일 변경 감시 시작 */
  watch: "fs:watch",
  /** 파일 변경 감시 중지 */
  unwatch: "fs:unwatch",
  /** 파일 변경 알림 이벤트 */
  fileChanged: "fs:fileChanged",
  /** 파일 내용 검색 */
  searchContent: "fs:searchContent",
  /** 파일/폴더 삭제 */
  delete: "fs:delete",
  /** 파일/폴더 이름 변경 */
  rename: "fs:rename",
  /** 파일 복사 */
  copy: "fs:copy",
  /** 새 파일 생성 */
  createFile: "fs:createFile",
  /** 새 폴더 생성 */
  createDir: "fs:createDir",
  /** 파일/폴더를 시스템 파일 탐색기에서 표시 */
  revealInExplorer: "fs:revealInExplorer",
  /** 파일/폴더 복제 */
  duplicate: "fs:duplicate",
  /** 파일 상세 정보 조회 */
  getFileInfo: "fs:getFileInfo",
  /** YAML 파일 검증 */
  validateYaml: "fs:validateYaml",
  /** 🆕 FIX-038: 홈 디렉토리 경로 조회 */
  getHomePath: "fs:getHomePath",
  /** 🆕 파일/폴더 이동 (드래그 앤 드롭) */
  move: "fs:move",
  /** 🆕 네이티브 OS 드래그 시작 */
  startDrag: "fs:startDrag",
  /** 🆕 OS 클립보드에 파일 경로 쓰기 (Internal → External) */
  clipboardWriteFiles: "fs:clipboard:writeFiles",
  /** 🆕 OS 클립보드에서 파일 경로 읽기 (External → Internal) */
  clipboardReadFiles: "fs:clipboard:readFiles",
} as const;

/**
 * 파일 읽기 요청
 */
export interface ReadFileRequest {
  /** 파일 경로 */
  filePath: string;
  /** 인코딩 (기본값: utf-8) */
  encoding?: BufferEncoding;
}

/**
 * 파일 읽기 응답
 */
export interface ReadFileResponse {
  /** 성공 여부 */
  success: boolean;
  /** 파일 내용 */
  content?: string;
  /** 에러 메시지 */
  error?: string;
  /** 파일 크기 (바이트) */
  size?: number;
}

/**
 * 파일 저장 요청
 */
export interface WriteFileRequest {
  /** 파일 경로 */
  filePath: string;
  /** 파일 내용 */
  content: string;
  /** 인코딩 (기본값: utf-8) */
  encoding?: BufferEncoding;
}

/**
 * 파일 저장 응답
 */
export interface WriteFileResponse {
  /** 성공 여부 */
  success: boolean;
  /** 에러 메시지 */
  error?: string;
}

/**
 * 디렉토리 목록 조회 응답 엔트리
 */
export interface DirectoryEntry {
  /** 파일/폴더 이름 */
  name: string;
  /** 전체 경로 */
  path: string;
  /** 디렉토리 여부 */
  isDirectory: boolean;
  /** 파일 크기 (바이트) */
  size?: number;
  /** 수정 시간 (timestamp) */
  modifiedAt?: number;
}

/**
 * 파일/디렉토리 정보
 */
export interface FileStatInfo {
  /** 전체 경로 */
  path: string;
  /** 디렉토리 여부 */
  isDirectory: boolean;
  /** 파일 크기 (바이트) */
  size: number;
  /** 생성 시간 (timestamp) */
  createdAt: number;
  /** 수정 시간 (timestamp) */
  modifiedAt: number;
  /** 접근 시간 (timestamp) */
  accessedAt: number;
}

/**
 * 파일 변경 이벤트 타입
 */
export type FileChangeEventType = "change" | "rename" | "delete";

/**
 * 파일 변경 이벤트
 */
export interface FileChangeEvent {
  /** 변경 타입 */
  type: FileChangeEventType;
  /** 파일 경로 */
  filePath: string;
  /** 타임스탬프 */
  timestamp: number;
}

/**
 * 민감 파일 패턴 (읽기/저장 경고 또는 차단)
 */
export const SENSITIVE_FILE_PATTERNS = [
  // 환경 변수 파일
  /^\.env($|\.)/i,
  /^\.env\..+$/i,
  // 인증서 및 키 파일
  /\.pem$/i,
  /\.key$/i,
  /\.crt$/i,
  /\.p12$/i,
  /\.pfx$/i,
  // 자격 증명 파일
  /credentials/i,
  /secrets?\.ya?ml$/i,
  /password/i,
  // SSH 키
  /^id_rsa$/i,
  /^id_dsa$/i,
  /^id_ed25519$/i,
  // AWS 자격 증명
  /aws.*credentials/i,
  /\.aws\/config$/i,
  // kubeconfig (보안 토큰 포함 가능)
  /kubeconfig/i,
  /\.kube\/config$/i,
];

/**
 * 파일 크기 제한 (바이트)
 */
export const FILE_SIZE_LIMITS = {
  /** 경고 임계값 (10MB) */
  WARNING: 10 * 1024 * 1024,
  /** 차단 임계값 (50MB) */
  MAX: 50 * 1024 * 1024,
} as const;

/**
 * 민감 파일 여부 확인
 * @param filePath - 파일 경로
 * @returns 민감 파일 여부
 */
export function isSensitiveFile(filePath: string): boolean {
  const fileName = filePath.split("/").pop() ?? filePath;
  return SENSITIVE_FILE_PATTERNS.some((pattern) => pattern.test(fileName));
}

/**
 * 파일 크기 검사 결과
 */
export type FileSizeCheckResult = "ok" | "warning" | "blocked";

/**
 * 파일 크기 검사
 * @param size - 파일 크기 (바이트)
 * @returns 검사 결과
 */
export function checkFileSize(size: number): FileSizeCheckResult {
  if (size > FILE_SIZE_LIMITS.MAX) {
    return "blocked";
  }
  if (size > FILE_SIZE_LIMITS.WARNING) {
    return "warning";
  }
  return "ok";
}

/**
 * 파일 내용 검색 요청
 */
export interface SearchContentRequest {
  /** 검색 대상 디렉토리 */
  rootPath: string;
  /** 검색어 */
  query: string;
  /** 대소문자 구분 여부 (기본값: false) */
  caseSensitive?: boolean;
  /** 정규식 사용 여부 (기본값: false) */
  useRegex?: boolean;
  /** 검색 제외 패턴 (glob 형식) */
  excludePatterns?: string[];
  /** 최대 결과 수 (기본값: 100) */
  maxResults?: number;
}

/**
 * 검색 결과 매치
 */
export interface SearchMatch {
  /** 파일 경로 */
  filePath: string;
  /** 매칭된 라인 번호 (1-based) */
  lineNumber: number;
  /** 라인 내용 */
  lineContent: string;
  /** 매칭 시작 위치 */
  matchStart: number;
  /** 매칭 끝 위치 */
  matchEnd: number;
}

/**
 * 파일 내용 검색 응답
 */
export interface SearchContentResponse {
  /** 성공 여부 */
  success: boolean;
  /** 검색 결과 */
  matches: SearchMatch[];
  /** 총 매치 수 */
  totalMatches: number;
  /** 검색된 파일 수 */
  filesSearched: number;
  /** 에러 메시지 */
  error?: string;
  /** 검색 소요 시간 (ms) */
  elapsedMs?: number;
}

/**
 * 파일 상세 정보 응답
 */
export interface FileInfoResponse {
  /** 성공 여부 */
  success: boolean;
  /** 파일명 */
  name?: string;
  /** 전체 경로 */
  path?: string;
  /** 디렉토리 여부 */
  isDirectory?: boolean;
  /** 파일 크기 (바이트) */
  size?: number;
  /** 사람이 읽을 수 있는 크기 (예: "1.5 MB") */
  sizeFormatted?: string;
  /** 생성 시간 (ISO 문자열) */
  createdAt?: string;
  /** 수정 시간 (ISO 문자열) */
  modifiedAt?: string;
  /** 접근 시간 (ISO 문자열) */
  accessedAt?: string;
  /** 파일 권한 (예: "rwxr-xr-x") */
  permissions?: string;
  /** 에러 메시지 */
  error?: string;
}

/**
 * YAML 검증 요청
 */
export interface ValidateYamlRequest {
  /** YAML 파일 경로 */
  filePath: string;
  /** K8s 스키마 검증 여부 (기본값: true) */
  validateK8sSchema?: boolean;
}

/**
 * YAML 검증 결과의 개별 오류
 */
export interface YamlValidationError {
  /** 오류 유형 (syntax, schema) */
  type: "syntax" | "schema";
  /** 오류 메시지 */
  message: string;
  /** 라인 번호 (선택) */
  line?: number;
  /** 컬럼 번호 (선택) */
  column?: number;
  /** 경로 (스키마 오류 시, 예: "spec.containers[0].image") */
  path?: string;
}

/**
 * YAML 검증 응답
 */
export interface ValidateYamlResponse {
  /** 검증 성공 여부 */
  success: boolean;
  /** 유효한 YAML 여부 */
  isValid: boolean;
  /** 검증 오류 목록 */
  errors: YamlValidationError[];
  /** K8s 리소스 종류 (검출된 경우) */
  resourceKind?: string;
  /** K8s API 버전 (검출된 경우) */
  apiVersion?: string;
  /** 에러 메시지 */
  error?: string;
}

/**
 * 파일 복제 응답
 */
export interface DuplicateResponse {
  /** 성공 여부 */
  success: boolean;
  /** 복제된 파일/폴더 경로 */
  newPath?: string;
  /** 에러 메시지 */
  error?: string;
}

/**
 * YAML 파일 여부 확인
 * @param filePath - 파일 경로
 * @returns YAML 파일 여부
 */
export function isYamlFile(filePath: string): boolean {
  const ext = filePath.toLowerCase().split(".").pop();
  return ext === "yaml" || ext === "yml";
}
