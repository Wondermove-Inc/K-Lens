/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Agent Settings Component
 *
 * Renders the "Agents" tab in Preferences Dialog.
 * Manages expert panel agents: list, create, edit, delete, toggle, reset.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { type RequestFromChannel, requestFromChannelInjectionToken } from "@skuberplus/messaging";
import { Edit3, Plus, RotateCcw, Trash2 } from "lucide-react";
import * as React from "react";
import {
  type AgentGetToolNamesResponse,
  type AgentListResponse,
  type AgentRegistryRequest,
  type AgentRegistryResponse,
  agentRegistryChannel,
} from "../../../features/ai-assistant/common/agent-registry-channels";
import { Badge } from "../shadcn-ui/badge";
import { Button } from "../shadcn-ui/button";
import { Checkbox } from "../shadcn-ui/checkbox";
import { Input } from "../shadcn-ui/input";
import { Label } from "../shadcn-ui/label";
import { RadioGroup, RadioGroupItem } from "../shadcn-ui/radio-group";
import { Separator } from "../shadcn-ui/separator";
import { Switch } from "../shadcn-ui/switch";
import { Textarea } from "../shadcn-ui/textarea";

import type { AgentDefinition } from "../../../features/ai-assistant/main/agent/agent-registry";

// ============================================
// Types
// ============================================

interface AgentSettingsDeps {
  requestFromChannel: RequestFromChannel;
}

interface EditingAgent {
  id: string;
  name: string;
  systemPrompt: string;
  focusAreas: string;
  isNew?: boolean;
  /** "all" = use all tools, "select" = use allowedTools only */
  toolMode: "all" | "select";
  allowedTools: string[];
}

// ============================================
// Component
// ============================================

const NonInjectedAgentSettings: React.FC<AgentSettingsDeps> = ({ requestFromChannel }) => {
  const [agents, setAgents] = React.useState<AgentDefinition[]>([]);
  const [editingAgent, setEditingAgent] = React.useState<EditingAgent | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [availableToolNames, setAvailableToolNames] = React.useState<string[]>([]);

  // Load agents on mount
  const loadAgents = React.useCallback(async () => {
    try {
      const [listResp, toolsResp] = await Promise.all([
        requestFromChannel<AgentRegistryRequest, AgentRegistryResponse>(agentRegistryChannel, { type: "list" }),
        requestFromChannel<AgentRegistryRequest, AgentRegistryResponse>(agentRegistryChannel, {
          type: "get-tool-names",
        }),
      ]);
      const listResponse = listResp as AgentListResponse;
      const toolNamesResponse = toolsResp as AgentGetToolNamesResponse;

      if (listResponse.success) {
        setAgents(listResponse.agents);
      }
      if (toolNamesResponse.success) {
        setAvailableToolNames(toolNamesResponse.toolNames);
      }
    } catch (error) {
      console.error("[AgentSettings] Failed to load agents:", error);
    } finally {
      setLoading(false);
    }
  }, [requestFromChannel]);

  React.useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // Save agent
  const handleSave = React.useCallback(async () => {
    if (!editingAgent) return;

    const agent: AgentDefinition = {
      id: editingAgent.id,
      name: editingAgent.name.trim(),
      systemPrompt: editingAgent.systemPrompt.trim(),
      focusAreas: editingAgent.focusAreas
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      enabled: true,
      ...(editingAgent.toolMode === "select" && editingAgent.allowedTools.length > 0
        ? { allowedTools: editingAgent.allowedTools }
        : {}),
    };

    if (!agent.name || !agent.systemPrompt) return;

    try {
      await requestFromChannel<AgentRegistryRequest, AgentRegistryResponse>(agentRegistryChannel, {
        type: "save",
        agent,
      });
      setEditingAgent(null);
      await loadAgents();
    } catch (error) {
      console.error("[AgentSettings] Failed to save agent:", error);
    }
  }, [editingAgent, requestFromChannel, loadAgents]);

  // Delete agent
  const handleDelete = React.useCallback(
    async (agentId: string) => {
      try {
        await requestFromChannel<AgentRegistryRequest, AgentRegistryResponse>(agentRegistryChannel, {
          type: "delete",
          agentId,
        });
        await loadAgents();
      } catch (error) {
        console.error("[AgentSettings] Failed to delete agent:", error);
      }
    },
    [requestFromChannel, loadAgents],
  );

  // Reset built-in agent to default
  const handleReset = React.useCallback(
    async (agentId: string) => {
      try {
        await requestFromChannel<AgentRegistryRequest, AgentRegistryResponse>(agentRegistryChannel, {
          type: "reset",
          agentId,
        });
        setEditingAgent(null);
        await loadAgents();
      } catch (error) {
        console.error("[AgentSettings] Failed to reset agent:", error);
      }
    },
    [requestFromChannel, loadAgents],
  );

  // Toggle agent enabled/disabled
  const handleToggle = React.useCallback(
    async (agent: AgentDefinition, enabled: boolean) => {
      try {
        await requestFromChannel<AgentRegistryRequest, AgentRegistryResponse>(agentRegistryChannel, {
          type: "save",
          agent: { ...agent, enabled, isBuiltin: undefined, isOverridden: undefined },
        });
        await loadAgents();
      } catch (error) {
        console.error("[AgentSettings] Failed to toggle agent:", error);
      }
    },
    [requestFromChannel, loadAgents],
  );

  // Start editing an agent
  const startEdit = React.useCallback((agent: AgentDefinition) => {
    setEditingAgent({
      id: agent.id,
      name: agent.name,
      systemPrompt: agent.systemPrompt,
      focusAreas: agent.focusAreas.join(", "),
      toolMode: agent.allowedTools?.length ? "select" : "all",
      allowedTools: agent.allowedTools ?? [],
    });
  }, []);

  // Start creating a new agent
  const startNew = React.useCallback(() => {
    const id = `custom-${Date.now()}`;

    setEditingAgent({
      id,
      name: "",
      systemPrompt: "",
      focusAreas: "",
      isNew: true,
      toolMode: "all",
      allowedTools: [],
    });
  }, []);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading agents...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <Label className="text-sm font-medium">Expert Panel Agents</Label>
        <p className="text-muted-foreground text-sm">
          Manage the expert agents used in multi-perspective analysis (/assess, /diagnose).
        </p>
      </div>

      {/* Agent List */}
      <div className="flex flex-col gap-3">
        {agents.map((agent) => (
          <div key={agent.id} className="bg-muted/30 border-border flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{agent.name}</span>
                  {agent.isBuiltin ? (
                    <Badge variant="secondary" className="text-xs">
                      Built-in
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      Custom
                    </Badge>
                  )}
                  {agent.isOverridden && (
                    <Badge variant="outline" className="text-orange-500 text-xs">
                      Modified
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">{agent.focusAreas.join(", ")}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => startEdit(agent)} title="Edit">
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
                {agent.isBuiltin && agent.isOverridden && (
                  <Button variant="ghost" size="icon-sm" onClick={() => handleReset(agent.id)} title="Reset to default">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
                {!agent.isBuiltin && (
                  <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(agent.id)} title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Switch checked={agent.enabled !== false} onCheckedChange={(checked) => handleToggle(agent, checked)} />
              </div>
            </div>

            {/* Inline Edit Form */}
            {editingAgent && editingAgent.id === agent.id && (
              <EditForm
                editingAgent={editingAgent}
                setEditingAgent={setEditingAgent}
                onSave={handleSave}
                onCancel={() => setEditingAgent(null)}
                onReset={agent.isBuiltin ? () => handleReset(agent.id) : undefined}
                availableToolNames={availableToolNames}
              />
            )}
          </div>
        ))}
      </div>

      {/* New Agent Form (when creating) */}
      {editingAgent?.isNew && (
        <div className="bg-muted/30 border-border rounded-lg border p-3">
          <EditForm
            editingAgent={editingAgent}
            setEditingAgent={setEditingAgent}
            onSave={handleSave}
            onCancel={() => setEditingAgent(null)}
            availableToolNames={availableToolNames}
          />
        </div>
      )}

      {/* Add button */}
      {!editingAgent?.isNew && (
        <Button variant="outline" size="sm" className="w-fit" onClick={startNew}>
          <Plus className="mr-1 h-4 w-4" />
          Add New Agent
        </Button>
      )}

      <Separator />

      {/* Settings section placeholder for future Level 2+ features */}
      <div className="flex flex-col gap-1">
        <Label className="text-muted-foreground text-xs font-medium">
          Agent JSON files are stored in your user data directory under ai-agents/.
        </Label>
      </div>
    </div>
  );
};

// ============================================
// Edit Form sub-component
// ============================================

const EditForm: React.FC<{
  editingAgent: EditingAgent;
  setEditingAgent: (agent: EditingAgent | null) => void;
  onSave: () => void;
  onCancel: () => void;
  onReset?: () => void;
  availableToolNames: string[];
}> = ({ editingAgent, setEditingAgent, onSave, onCancel, onReset, availableToolNames }) => {
  const toggleTool = React.useCallback(
    (toolName: string, checked: boolean) => {
      const current = editingAgent.allowedTools;
      const updated = checked ? [...current, toolName] : current.filter((t) => t !== toolName);

      setEditingAgent({ ...editingAgent, allowedTools: updated });
    },
    [editingAgent, setEditingAgent],
  );

  return (
    <div className="mt-2 flex flex-col gap-3 border-t pt-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agent-name" className="text-xs font-medium">
          Name
        </Label>
        <Input
          id="agent-name"
          value={editingAgent.name}
          onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })}
          placeholder="e.g., Security Analyst"
          className="bg-input/30 border-border h-8 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agent-focus" className="text-xs font-medium">
          Focus Areas (comma-separated)
        </Label>
        <Input
          id="agent-focus"
          value={editingAgent.focusAreas}
          onChange={(e) => setEditingAgent({ ...editingAgent, focusAreas: e.target.value })}
          placeholder="e.g., RBAC, NetworkPolicy, Secrets"
          className="bg-input/30 border-border h-8 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agent-prompt" className="text-xs font-medium">
          System Prompt
        </Label>
        <Textarea
          id="agent-prompt"
          value={editingAgent.systemPrompt}
          onChange={(e) => setEditingAgent({ ...editingAgent, systemPrompt: e.target.value })}
          placeholder="You are a Kubernetes expert..."
          className="bg-input/30 border-border min-h-[120px] text-sm"
          rows={5}
        />
      </div>

      {/* Tool Access Section */}
      {availableToolNames.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-medium">Tool Access</Label>
          <RadioGroup
            value={editingAgent.toolMode}
            onValueChange={(value: string) =>
              setEditingAgent({
                ...editingAgent,
                toolMode: value as "all" | "select",
                allowedTools: value === "all" ? [] : editingAgent.allowedTools,
              })
            }
            className="flex gap-4"
          >
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="all" id="tool-all" />
              <Label htmlFor="tool-all" className="text-xs cursor-pointer">
                All tools (default)
              </Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="select" id="tool-select" />
              <Label htmlFor="tool-select" className="text-xs cursor-pointer">
                Select tools
              </Label>
            </div>
          </RadioGroup>

          {editingAgent.toolMode === "select" && (
            <div className="bg-input/20 border-border grid grid-cols-3 gap-x-4 gap-y-1.5 rounded-md border p-2">
              {availableToolNames.map((toolName) => (
                <div key={toolName} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`tool-${toolName}`}
                    checked={editingAgent.allowedTools.includes(toolName)}
                    onCheckedChange={(checked) => toggleTool(toolName, checked === true)}
                  />
                  <Label htmlFor={`tool-${toolName}`} className="text-xs font-mono cursor-pointer">
                    {toolName}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          {onReset && (
            <Button variant="ghost" size="sm" onClick={onReset}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Reset to default
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onSave}
            disabled={!editingAgent.name.trim() || !editingAgent.systemPrompt.trim()}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// DI wrapper
// ============================================

export const AgentSettings = withInjectables<AgentSettingsDeps>(NonInjectedAgentSettings, {
  getProps: (di) => ({
    requestFromChannel: di.inject(requestFromChannelInjectionToken),
  }),
});
