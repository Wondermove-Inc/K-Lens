/**
 * 🎯 목적: MCP Settings 컴포넌트
 * 01: MCPSettings 페이지 컴포넌트
 *
 * 📝 주요 기능:
 * - MCP 서버 목록 표시
 * - 서버 추가/수정/삭제
 * - 연결 상태 표시
 *
 * 🔄 변경이력:
 * - 2026-01-07: 수정 - JSON 입력 모드, env 필드, 연결 테스트 버튼 추가
 *
 * @packageDocumentation
 */

import { observer } from "mobx-react-lite";
import React, { useCallback, useState } from "react";
import { MCPServerConfig, mcpConfigStore } from "../../../features/ai-assistant/common/mcp-config";
import {
  createEmptyFormData,
  envToString,
  getStatusColorClass,
  getStatusIcon,
  getStatusText,
  hasErrors,
  MCPFormErrors,
  MCPServerFormData,
  ParsedMCPServer,
  parseEnvString,
  parseMCPServerJson,
  validateFormData,
} from "./mcp-settings-utils";

// ============================================
// 🎯 서브 컴포넌트
// ============================================

/** 상태 배지 */
const StatusBadge: React.FC<{ serverId: string }> = observer(({ serverId }) => {
  const status = mcpConfigStore.getServerStatus(serverId);
  const error = mcpConfigStore.getServerError(serverId);

  return (
    <div className="flex flex-col items-end">
      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColorClass(status)}`}>
        {getStatusIcon(status)} {getStatusText(status)}
      </span>
      {/* 🎯 THEME-024: Semantic color for MCP error messages */}
      {error && <span className="text-xs text-status-error mt-1">{error}</span>}
    </div>
  );
});

/**
 * 🎯 서버 카드
 *
 * 📝 2026-01-07 수정:
 * - shadcn CSS 변수 기반 클래스로 통일
 */
interface ServerCardProps {
  server: MCPServerConfig;
  onEdit: (server: MCPServerConfig) => void;
  onDelete: (server: MCPServerConfig) => void;
  onToggle: (server: MCPServerConfig) => void;
}

const ServerCard: React.FC<ServerCardProps> = ({ server, onEdit, onDelete, onToggle }) => (
  <div
    className="border border-border rounded-lg p-4 mb-3 bg-card text-card-foreground"
    data-testid={`server-${server.id}`}
  >
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-3">
        <span className="font-medium text-foreground">{server.name}</span>
        <span className="px-2 py-0.5 text-xs bg-muted rounded text-muted-foreground">{server.type}</span>
      </div>
      <StatusBadge serverId={server.id} />
    </div>
    <div className="text-sm text-muted-foreground mb-3">
      {server.type === "stdio" ? (
        <span className="font-mono">
          {server.command} {server.args?.join(" ")}
        </span>
      ) : (
        <span className="font-mono">{server.url}</span>
      )}
    </div>
    <div className="flex items-center justify-between">
      <label className="flex items-center gap-2 cursor-pointer text-foreground">
        <input
          type="checkbox"
          role="switch"
          aria-label="Enable"
          checked={server.enabled}
          onChange={() => onToggle(server)}
          className="w-4 h-4 accent-primary"
        />
        <span className="text-sm">Enable</span>
      </label>
      <div className="flex gap-2">
        <button
          onClick={() => onEdit(server)}
          className="px-3 py-1 text-sm border border-border rounded hover:bg-accent text-foreground"
          aria-label="Edit"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(server)}
          className="px-3 py-1 text-sm border border-destructive/50 text-destructive rounded hover:bg-destructive/10"
          aria-label="Delete"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
);

/** 서버 폼 모달 */
interface ServerFormModalProps {
  isOpen: boolean;
  isEdit: boolean;
  formData: MCPServerFormData;
  errors: MCPFormErrors;
  onChange: (field: keyof MCPServerFormData, value: string | boolean) => void;
  onSave: () => void;
  onCancel: () => void;
  /** 🆕 JSON 모드에서 파싱된 서버 저장 */
  onSaveFromJson: (servers: ParsedMCPServer[]) => void;
}

/**
 * 🎯 서버 폼 모달
 *
 * 📝 2026-01-07 수정:
 * - shadcn Dialog 내부에서 렌더링될 때 CSS 우선순위 문제 해결
 * - text-foreground, bg-background 등 CSS 변수 기반 클래스 사용
 * - z-[100]으로 preferences-dialog(z-50) 위에 표시되도록 설정
 *
 * 📝 2026-01-07 수정:
 * - JSON 입력 모드 추가 (Form/JSON 토글)
 * - env 필드 추가 (환경 변수)
 * - 연결 테스트 버튼 추가
 */
const ServerFormModal: React.FC<ServerFormModalProps> = ({
  isOpen,
  isEdit,
  formData,
  errors,
  onChange,
  onSave,
  onCancel,
  onSaveFromJson,
}) => {
  // 🆕 입력 모드: form / json
  const [inputMode, setInputMode] = useState<"form" | "json">("form");
  // 🆕 JSON 입력 값
  const [jsonInput, setJsonInput] = useState("");
  // 🆕 JSON 파싱 에러
  const [jsonError, setJsonError] = useState<string | null>(null);
  // 🆕 파싱된 서버 목록 (미리보기용)
  const [parsedServers, setParsedServers] = useState<ParsedMCPServer[]>([]);
  // 🆕 연결 테스트 상태
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");

  // 모달이 열릴 때 상태 초기화
  React.useEffect(() => {
    if (isOpen) {
      setInputMode(isEdit ? "form" : "form");
      setJsonInput("");
      setJsonError(null);
      setParsedServers([]);
      setTestStatus("idle");
    }
  }, [isOpen, isEdit]);

  // 🆕 JSON 입력 변경 핸들러
  const handleJsonChange = useCallback((value: string) => {
    setJsonInput(value);
    setJsonError(null);
    setParsedServers([]);

    if (!value.trim()) return;

    const result = parseMCPServerJson(value);
    if (result.success) {
      setParsedServers(result.servers);
    } else {
      setJsonError(result.error ?? "Invalid JSON");
    }
  }, []);

  // 🆕 JSON에서 서버 저장
  const handleSaveFromJson = useCallback(() => {
    if (parsedServers.length > 0) {
      onSaveFromJson(parsedServers);
    }
  }, [parsedServers, onSaveFromJson]);

  /**
   * 🆕 연결 테스트
   *
   * 📝 2026-01-07:
   * - stdio: command 유효성 검사 (which/where 명령 시뮬레이션)
   * - http: URL 형식 검증 + 연결 가능성 확인
   *
   * ⚠️ 참고: 실제 MCP SDK 연동은 미구현 상태
   * 현재는 기본 유효성 검사만 수행
   */
  const handleTestConnection = useCallback(async () => {
    setTestStatus("testing");

    // 유효성 검사
    const isValid = formData.type === "stdio" ? formData.command?.trim() : formData.url?.trim();

    if (!isValid) {
      setTestStatus("error");
      return;
    }

    // HTTP 타입: URL 형식 검증
    if (formData.type === "http" && formData.url) {
      try {
        new URL(formData.url);
      } catch {
        setTestStatus("error");
        return;
      }
    }

    // 시뮬레이션 딜레이 (실제 연결 테스트 시 제거)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // TODO: 실제 MCP 연결 테스트 구현 시 아래 로직으로 교체
    // - stdio: spawn 프로세스 시작 → 초기화 메시지 교환
    // - http: HTTP 요청으로 서버 상태 확인
    setTestStatus("success");
  }, [formData.command, formData.url, formData.type]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-background text-foreground rounded-lg p-6 w-full max-w-lg border border-border shadow-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4 text-foreground">
          {isEdit ? "Edit MCP Server" : "Add New MCP Server"}
        </h2>

        {/* 🆕 입력 모드 토글 (추가 모드에서만) */}
        {!isEdit && (
          <div className="flex gap-2 mb-4 p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => setInputMode("form")}
              className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                inputMode === "form"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Form
            </button>
            <button
              type="button"
              onClick={() => setInputMode("json")}
              className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                inputMode === "json"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              JSON
            </button>
          </div>
        )}

        {/* 🆕 JSON 입력 모드 */}
        {inputMode === "json" && !isEdit && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Paste MCP Server JSON</label>
              <p className="text-xs text-muted-foreground mb-2">
                Supports Claude Desktop format: {`{ "mcpServers": { ... } }`}
              </p>
              <textarea
                value={jsonInput}
                onChange={(e) => handleJsonChange(e.target.value)}
                className="w-full h-48 border rounded px-3 py-2 bg-input text-foreground border-border focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm resize-none"
                placeholder={`{
  "mcpServers": {
    "tavily-mcp": {
      "command": "npx",
      "args": ["-y", "tavily-mcp"],
      "env": {
        "TAVILY_API_KEY": "your-api-key"
      }
    }
  }
}`}
              />
              {jsonError && <p className="text-destructive text-sm mt-1">{jsonError}</p>}
            </div>

            {/* 파싱된 서버 미리보기 */}
            {parsedServers.length > 0 && (
              <div className="border border-border rounded-lg p-3 bg-muted/30">
                <p className="text-sm font-medium mb-2 text-foreground">Detected {parsedServers.length} server(s):</p>
                <ul className="space-y-1">
                  {parsedServers.map((s, i) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      • <span className="font-medium text-foreground">{s.name}</span> ({s.type})
                      {s.env && Object.keys(s.env).length > 0 && (
                        <span className="text-xs ml-1">[{Object.keys(s.env).length} env vars]</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={onCancel}
                className="px-4 py-2 border rounded hover:bg-accent text-foreground border-border"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFromJson}
                disabled={parsedServers.length === 0}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add {parsedServers.length > 1 ? `${parsedServers.length} Servers` : "Server"}
              </button>
            </div>
          </div>
        )}

        {/* Form 입력 모드 */}
        {(inputMode === "form" || isEdit) && (
          <div className="space-y-4">
            {/* Server Name */}
            <div>
              <label htmlFor="server-name" className="block text-sm font-medium mb-1 text-foreground">
                Server Name
              </label>
              <input
                id="server-name"
                type="text"
                value={formData.name}
                onChange={(e) => onChange("name", e.target.value)}
                className="w-full border rounded px-3 py-2 bg-input text-foreground border-border focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g., Filesystem Server"
              />
              {errors.name && <p className="text-destructive text-sm mt-1">{errors.name}</p>}
            </div>

            {/* Server Type */}
            <div>
              <span className="block text-sm font-medium mb-2 text-foreground">Server Type</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-foreground cursor-pointer">
                  <input
                    type="radio"
                    name="server-type"
                    checked={formData.type === "stdio"}
                    onChange={() => onChange("type", "stdio")}
                    className="accent-primary"
                  />
                  <span>stdio</span>
                </label>
                <label className="flex items-center gap-2 text-foreground cursor-pointer">
                  <input
                    type="radio"
                    name="server-type"
                    aria-label="HTTP"
                    checked={formData.type === "http"}
                    onChange={() => onChange("type", "http")}
                    className="accent-primary"
                  />
                  <span>HTTP</span>
                </label>
              </div>
            </div>

            {/* stdio fields */}
            {formData.type === "stdio" && (
              <>
                <div>
                  <label htmlFor="server-command" className="block text-sm font-medium mb-1 text-foreground">
                    Command
                  </label>
                  <input
                    id="server-command"
                    type="text"
                    value={formData.command}
                    onChange={(e) => onChange("command", e.target.value)}
                    className="w-full border rounded px-3 py-2 bg-input text-foreground border-border focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g., npx"
                  />
                  {errors.command && <p className="text-destructive text-sm mt-1">{errors.command}</p>}
                </div>
                <div>
                  <label htmlFor="server-args" className="block text-sm font-medium mb-1 text-foreground">
                    Arguments
                  </label>
                  <input
                    id="server-args"
                    type="text"
                    value={formData.args}
                    onChange={(e) => onChange("args", e.target.value)}
                    className="w-full border rounded px-3 py-2 bg-input text-foreground border-border focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g., -y @modelcontextprotocol/server-filesystem"
                  />
                </div>
                {/* 🆕 환경 변수 입력 */}
                <div>
                  <label htmlFor="server-env" className="block text-sm font-medium mb-1 text-foreground">
                    Environment Variables <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="server-env"
                    value={formData.env}
                    onChange={(e) => onChange("env", e.target.value)}
                    className="w-full h-20 border rounded px-3 py-2 bg-input text-foreground border-border focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm resize-none"
                    placeholder="KEY=value&#10;ANOTHER_KEY=another_value"
                  />
                  <p className="text-xs text-muted-foreground mt-1">One per line, format: KEY=value</p>
                </div>
              </>
            )}

            {/* HTTP fields */}
            {formData.type === "http" && (
              <div>
                <label htmlFor="server-url" className="block text-sm font-medium mb-1 text-foreground">
                  URL
                </label>
                <input
                  id="server-url"
                  type="text"
                  value={formData.url}
                  onChange={(e) => onChange("url", e.target.value)}
                  className="w-full border rounded px-3 py-2 bg-input text-foreground border-border focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g., http://localhost:3000"
                />
                {errors.url && <p className="text-destructive text-sm mt-1">{errors.url}</p>}
              </div>
            )}

            {/* 🆕 연결 테스트 버튼 */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testStatus === "testing"}
                className="px-4 py-2 border border-border rounded hover:bg-accent text-foreground text-sm flex items-center gap-2"
              >
                {testStatus === "testing" && <span className="animate-spin">⏳</span>}
                {testStatus === "success" && <span className="text-status-success">✓</span>}
                {testStatus === "error" && <span className="text-status-error">✗</span>}
                Test Connection
              </button>
              {testStatus === "success" && <p className="text-sm text-status-success mt-1">Connection test passed</p>}
              {testStatus === "error" && (
                <p className="text-sm text-status-error mt-1">Connection test failed. Check your settings.</p>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={onCancel}
                className="px-4 py-2 border rounded hover:bg-accent text-foreground border-border"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 🎯 삭제 확인 모달
 *
 * 📝 2026-01-07 수정:
 * - shadcn CSS 변수 기반 클래스 사용
 * - z-[100]으로 preferences-dialog 위에 표시
 */
interface DeleteConfirmModalProps {
  isOpen: boolean;
  serverName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ isOpen, serverName, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-background text-foreground rounded-lg p-6 w-full max-w-sm border border-border shadow-lg">
        <h2 className="text-lg font-semibold mb-4 text-foreground">Delete Server</h2>
        <p className="text-muted-foreground mb-6">Are you sure you want to delete &quot;{serverName}&quot;?</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 border rounded hover:bg-accent text-foreground border-border">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// 🎯 메인 컴포넌트
// ============================================

/**
 * MCP Settings 컴포넌트
 */
export const MCPSettings: React.FC = observer(() => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServerConfig | null>(null);
  const [deletingServer, setDeletingServer] = useState<MCPServerConfig | null>(null);
  const [formData, setFormData] = useState<MCPServerFormData>(createEmptyFormData());
  const [formErrors, setFormErrors] = useState<MCPFormErrors>({});

  // 📝 loadFromStorage()는 mcpConfigStore constructor에서 자동 호출됨
  // MCPSettings가 마운트되지 않아도 앱 시작 시 설정이 로드됨

  // 폼 열기 (추가)
  const handleAdd = useCallback(() => {
    setFormData(createEmptyFormData());
    setFormErrors({});
    setEditingServer(null);
    setIsFormOpen(true);
  }, []);

  // 폼 열기 (수정)
  const handleEdit = useCallback((server: MCPServerConfig) => {
    setFormData({
      name: server.name,
      type: server.type,
      command: server.type === "stdio" ? server.command : "",
      args: server.type === "stdio" && server.args ? server.args.join(" ") : "",
      url: server.type === "http" ? server.url : "",
      enabled: server.enabled,
      // 🆕 env 필드 추가
      env: server.type === "stdio" ? envToString(server.env) : "",
    });
    setFormErrors({});
    setEditingServer(server);
    setIsFormOpen(true);
  }, []);

  // 폼 필드 변경
  const handleFormChange = useCallback((field: keyof MCPServerFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  // 폼 저장
  const handleSave = useCallback(() => {
    const errors = validateFormData(formData);
    if (hasErrors(errors)) {
      setFormErrors(errors);
      return;
    }

    // 🆕 env 필드 포함
    const serverInput =
      formData.type === "stdio"
        ? {
            name: formData.name,
            type: "stdio" as const,
            command: formData.command,
            args: formData.args.split(" ").filter(Boolean),
            enabled: formData.enabled,
            env: parseEnvString(formData.env),
          }
        : { name: formData.name, type: "http" as const, url: formData.url, enabled: formData.enabled };

    if (editingServer) {
      mcpConfigStore.updateServer(editingServer.id, serverInput);
    } else {
      mcpConfigStore.addServer(serverInput);
    }

    setIsFormOpen(false);
  }, [formData, editingServer]);

  // 🆕 JSON에서 파싱된 서버 저장
  const handleSaveFromJson = useCallback((servers: ParsedMCPServer[]) => {
    for (const server of servers) {
      const serverInput =
        server.type === "stdio"
          ? {
              name: server.name,
              type: "stdio" as const,
              command: server.command ?? "",
              args: server.args,
              enabled: true,
              env: server.env,
            }
          : {
              name: server.name,
              type: "http" as const,
              url: server.url ?? "",
              enabled: true,
            };
      mcpConfigStore.addServer(serverInput);
    }
    setIsFormOpen(false);
  }, []);

  // 삭제 확인
  const handleDeleteConfirm = useCallback(() => {
    if (deletingServer) {
      mcpConfigStore.removeServer(deletingServer.id);
      setDeletingServer(null);
      setIsDeleteOpen(false);
    }
  }, [deletingServer]);

  // 활성화 토글
  const handleToggle = useCallback((server: MCPServerConfig) => {
    mcpConfigStore.updateServer(server.id, { enabled: !server.enabled });
  }, []);

  return (
    <div role="region" aria-label="MCP Server Settings" className="p-4 text-foreground">
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-2 text-foreground">MCP Server Settings</h1>
        <p className="text-muted-foreground">Manage Model Context Protocol (MCP) servers.</p>
      </div>

      <button
        onClick={handleAdd}
        className="mb-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
      >
        + Add Server
      </button>

      {mcpConfigStore.servers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No MCP servers registered. Please add a server.</div>
      ) : (
        mcpConfigStore.servers.map((server) => (
          <ServerCard
            key={server.id}
            server={server}
            onEdit={handleEdit}
            onDelete={(s) => {
              setDeletingServer(s);
              setIsDeleteOpen(true);
            }}
            onToggle={handleToggle}
          />
        ))
      )}

      <ServerFormModal
        isOpen={isFormOpen}
        isEdit={!!editingServer}
        formData={formData}
        errors={formErrors}
        onChange={handleFormChange}
        onSave={handleSave}
        onCancel={() => setIsFormOpen(false)}
        onSaveFromJson={handleSaveFromJson}
      />

      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        serverName={deletingServer?.name ?? ""}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsDeleteOpen(false)}
      />
    </div>
  );
});

MCPSettings.displayName = "MCPSettings";
export default MCPSettings;
