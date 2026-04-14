/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Skill Settings Component
 *
 * Renders the "Skills" tab in Preferences Dialog.
 * Manages slash command skills: list, create, edit, delete, toggle, reset.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { type RequestFromChannel, requestFromChannelInjectionToken } from "@skuberplus/messaging";
import { ChevronDown, ChevronRight, Edit3, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import * as React from "react";
import {
  type SkillListResponse,
  type SkillRegistryRequest,
  type SkillRegistryResponse,
  skillRegistryChannel,
} from "../../../features/ai-assistant/common/skill-registry-channels";
import { syncSlashCommandEnabled } from "../../../features/ai-assistant/common/slash-commands";
import { Badge } from "../shadcn-ui/badge";
import { Button } from "../shadcn-ui/button";
import { Input } from "../shadcn-ui/input";
import { Label } from "../shadcn-ui/label";
import { Separator } from "../shadcn-ui/separator";
import { Switch } from "../shadcn-ui/switch";
import { Textarea } from "../shadcn-ui/textarea";
import { CustomSkillSettings } from "./custom-skill-settings";

import type { SkillDefinition } from "../../../features/ai-assistant/main/skills/skill-registry";

// ============================================
// Types
// ============================================

interface SkillSettingsDeps {
  requestFromChannel: RequestFromChannel;
}

interface EditingSkill {
  id: string;
  name: string;
  description: string;
  content: string;
}

// ============================================
// Component
// ============================================

const NonInjectedSkillSettings: React.FC<SkillSettingsDeps> = ({ requestFromChannel }) => {
  const [skills, setSkills] = React.useState<SkillDefinition[]>([]);
  const [editingSkill, setEditingSkill] = React.useState<EditingSkill | null>(null);
  const [viewingSkillId, setViewingSkillId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const loadSkills = React.useCallback(async () => {
    try {
      const resp = await requestFromChannel<SkillRegistryRequest, SkillRegistryResponse>(skillRegistryChannel, {
        type: "list",
      });
      const listResponse = resp as SkillListResponse;

      if (listResponse.success && Array.isArray(listResponse.skills)) {
        setSkills(listResponse.skills);

        // Sync disabled state to slash command palette (renderer process)
        const disabledIds = new Set<string>();

        for (const s of listResponse.skills) {
          if (s.enabled === false) disabledIds.add(s.id);
        }
        syncSlashCommandEnabled(disabledIds);

        // Notify slash command palette to refresh (send disabledIds for cross-frame sync)
        const rootWindow = window.parent || window;
        rootWindow.dispatchEvent(
          new CustomEvent("daive:skills-changed", {
            detail: { disabledIds: Array.from(disabledIds) },
          }),
        );
      }
    } catch (error) {
      console.error("[SkillSettings] Failed to load skills:", error);
    } finally {
      setLoading(false);
    }
  }, [requestFromChannel]);

  React.useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const handleSave = React.useCallback(async () => {
    if (!editingSkill) return;

    // Build MD with frontmatter
    const md = [
      "---",
      `id: ${editingSkill.id}`,
      `name: "${editingSkill.name.trim()}"`,
      `description: "${editingSkill.description.trim()}"`,
      `category: kubernetes`,
      `type: react`,
      "---",
      "",
      editingSkill.content,
    ].join("\n");

    try {
      await requestFromChannel<SkillRegistryRequest, SkillRegistryResponse>(skillRegistryChannel, {
        type: "save-content",
        skillId: editingSkill.id,
        content: md,
      });
      setEditingSkill(null);
      setViewingSkillId(null);
      await loadSkills();
    } catch (error) {
      console.error("[SkillSettings] Failed to save skill:", error);
    }
  }, [editingSkill, requestFromChannel, loadSkills]);

  const handleDelete = React.useCallback(
    async (skillId: string) => {
      try {
        await requestFromChannel<SkillRegistryRequest, SkillRegistryResponse>(skillRegistryChannel, {
          type: "delete",
          skillId,
        });
        await loadSkills();
      } catch (error) {
        console.error("[SkillSettings] Failed to delete skill:", error);
      }
    },
    [requestFromChannel, loadSkills],
  );

  const handleReset = React.useCallback(
    async (skillId: string) => {
      try {
        await requestFromChannel<SkillRegistryRequest, SkillRegistryResponse>(skillRegistryChannel, {
          type: "reset",
          skillId,
        });
        setEditingSkill(null);
        await loadSkills();
      } catch (error) {
        console.error("[SkillSettings] Failed to reset skill:", error);
      }
    },
    [requestFromChannel, loadSkills],
  );

  const handleToggle = React.useCallback(
    async (skill: SkillDefinition, enabled: boolean) => {
      try {
        await requestFromChannel<SkillRegistryRequest, SkillRegistryResponse>(skillRegistryChannel, {
          type: "save",
          skill: { ...skill, enabled, isBuiltin: undefined, isOverridden: undefined },
        });
        await loadSkills();
      } catch (error) {
        console.error("[SkillSettings] Failed to toggle skill:", error);
      }
    },
    [requestFromChannel, loadSkills],
  );

  const startEdit = React.useCallback(
    async (skill: SkillDefinition) => {
      // Fetch MD content via IPC
      try {
        const resp = await requestFromChannel<SkillRegistryRequest, SkillRegistryResponse>(skillRegistryChannel, {
          type: "get-content",
          skillId: skill.id,
        });
        const content = "content" in resp ? (resp.content ?? "") : "";

        setEditingSkill({
          id: skill.id,
          name: skill.name,
          description: skill.description,
          content,
        });
        setViewingSkillId(skill.id);
      } catch (error) {
        console.error("[SkillSettings] Failed to load content for edit:", error);
      }
    },
    [requestFromChannel],
  );

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading skills...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Custom Skills Section — 사용자 정의 스킬 먼저 */}
      <CustomSkillSettings />

      <Separator />

      {/* Built-in Slash Command Skills */}
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Slash Command Skills</Label>
            <span className="text-muted-foreground text-xs">
              {skills.length} {skills.length === 1 ? "skill" : "skills"}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            Built-in skills for slash commands. You can customize behavior or disable unused skills.
          </p>
        </div>

        {/* Skill List */}
        {skills.length > 0 && (
          <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
            {skills.map((skill) => (
              <div key={skill.id} className="bg-muted/30 border-border flex flex-col rounded-lg border">
                {/* Skill Row */}
                <div className="flex items-center gap-2 p-3">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      if (viewingSkillId === skill.id) {
                        setViewingSkillId(null);
                        setEditingSkill(null);
                      } else {
                        setViewingSkillId(skill.id);
                        setEditingSkill(null);
                      }
                    }}
                  >
                    {viewingSkillId === skill.id ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">/{skill.id}</span>
                      <span className="text-muted-foreground text-xs">{skill.name}</span>
                      {skill.isOverridden && (
                        <Badge variant="outline" className="text-orange-500 text-xs">
                          Modified
                        </Badge>
                      )}
                      {!skill.enabled && (
                        <Badge variant="outline" className="text-muted-foreground text-xs">
                          Disabled
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {skill.category} · {skill.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {skill.isOverridden && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleReset(skill.id)}
                        title="Reset to default"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {!skill.isBuiltin && (
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(skill.id)} title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Switch
                      checked={skill.enabled !== false}
                      onCheckedChange={(checked) => handleToggle(skill, checked)}
                    />
                  </div>
                </div>

                {/* Detail View */}
                {viewingSkillId === skill.id && !editingSkill && (
                  <SkillDetailView
                    skill={skill}
                    onEdit={() => startEdit(skill)}
                    requestFromChannel={requestFromChannel}
                  />
                )}

                {/* Edit Form */}
                {editingSkill && editingSkill.id === skill.id && (
                  <SkillEditForm
                    editingSkill={editingSkill}
                    setEditingSkill={setEditingSkill}
                    onSave={handleSave}
                    onCancel={() => setEditingSkill(null)}
                    onReset={skill.isBuiltin ? () => handleReset(skill.id) : undefined}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// Detail View sub-component (read-only)
// ============================================

const SkillDetailView: React.FC<{
  skill: SkillDefinition;
  onEdit: () => void;
  requestFromChannel: RequestFromChannel;
}> = ({ skill, onEdit, requestFromChannel }) => {
  const [mdContent, setMdContent] = React.useState<string | null>(null);
  const [mdLoading, setMdLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const resp = await requestFromChannel<SkillRegistryRequest, SkillRegistryResponse>(skillRegistryChannel, {
          type: "get-content",
          skillId: skill.id,
        });

        if (!cancelled && "content" in resp) {
          setMdContent(resp.content ?? null);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setMdLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [skill.id, requestFromChannel]);

  return (
    <div className="border-border flex flex-col gap-3 border-t p-3">
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">Description</span>
        <p className="text-foreground/80 text-xs">{skill.description || "(no description)"}</p>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">Content</span>
        {mdLoading ? (
          <p className="text-muted-foreground text-xs">Loading...</p>
        ) : (
          <pre className="bg-muted/50 max-h-[200px] overflow-auto rounded p-2 font-mono text-[11px] leading-relaxed">
            {mdContent || "(empty)"}
          </pre>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("daive:close-preferences"));
            const rootWindow = window.parent || window;
            rootWindow.dispatchEvent(new CustomEvent("daive:open-chat"));
            setTimeout(() => {
              rootWindow.dispatchEvent(
                new CustomEvent("daive:prefill-chat", {
                  detail: { text: `Edit the /${skill.id} skill: ` },
                }),
              );
            }, 400);
          }}
        >
          <Sparkles className="mr-1 h-3.5 w-3.5" />
          Edit with AI
        </Button>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Edit3 className="mr-1 h-3.5 w-3.5" />
          Edit
        </Button>
      </div>
    </div>
  );
};

// ============================================
// Edit Form sub-component
// ============================================

const SkillEditForm: React.FC<{
  editingSkill: EditingSkill;
  setEditingSkill: (skill: EditingSkill | null) => void;
  onSave: () => void;
  onCancel: () => void;
  onReset?: () => void;
}> = ({ editingSkill, setEditingSkill, onSave, onCancel, onReset }) => {
  return (
    <div className="border-border flex flex-col gap-3 border-t p-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bs-name" className="text-xs font-medium">
          Name
        </Label>
        <Input
          id="bs-name"
          value={editingSkill.name}
          onChange={(e) => setEditingSkill({ ...editingSkill, name: e.target.value })}
          className="bg-input/30 border-border h-8 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bs-desc" className="text-xs font-medium">
          Description
        </Label>
        <Textarea
          id="bs-desc"
          value={editingSkill.description}
          onChange={(e) => setEditingSkill({ ...editingSkill, description: e.target.value })}
          className="bg-input/30 border-border min-h-[60px] text-sm"
          rows={2}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bs-content" className="text-xs font-medium">
          Content
          <span className="text-muted-foreground ml-1 font-normal">(instructions AI follows when skill is loaded)</span>
        </Label>
        <Textarea
          id="bs-content"
          value={editingSkill.content}
          onChange={(e) => setEditingSkill({ ...editingSkill, content: e.target.value })}
          className="bg-input/30 border-border min-h-[200px] font-mono text-sm"
          rows={10}
        />
      </div>

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
          <Button variant="default" size="sm" onClick={onSave} disabled={!editingSkill.name.trim()}>
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

export const SkillSettings = withInjectables<SkillSettingsDeps>(NonInjectedSkillSettings, {
  getProps: (di) => ({
    requestFromChannel: di.inject(requestFromChannelInjectionToken),
  }),
});
