/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 *
 * Custom Skill Settings Component
 *
 * Renders custom skill management UI in the Skills tab of Preferences Dialog.
 * Users can view, create, edit, delete, and toggle custom skills (MD files).
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { type RequestFromChannel, requestFromChannelInjectionToken } from "@skuberplus/messaging";
import { ChevronDown, ChevronRight, Edit3, FileText, Plus, Sparkles, Trash2 } from "lucide-react";
import * as React from "react";
import {
  type CustomSkillInfo,
  type CustomSkillRequest,
  type CustomSkillResponse,
  customSkillChannel,
} from "../../../features/ai-assistant/common/custom-skill-channels";
import { Badge } from "../shadcn-ui/badge";
import { Button } from "../shadcn-ui/button";
import { Input } from "../shadcn-ui/input";
import { Label } from "../shadcn-ui/label";
import { Switch } from "../shadcn-ui/switch";
import { Textarea } from "../shadcn-ui/textarea";

// ============================================
// Types
// ============================================

interface CustomSkillSettingsDeps {
  requestFromChannel: RequestFromChannel;
}

interface EditingCustomSkill {
  id: string;
  name: string;
  description: string;
  content: string;
  isNew?: boolean;
}

// ============================================
// Component
// ============================================

const NonInjectedCustomSkillSettings: React.FC<CustomSkillSettingsDeps> = ({ requestFromChannel }) => {
  const [skills, setSkills] = React.useState<CustomSkillInfo[]>([]);
  const [maxSkills, setMaxSkills] = React.useState(10);
  const [editingSkill, setEditingSkill] = React.useState<EditingCustomSkill | null>(null);
  const [viewingSkillId, setViewingSkillId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const loadSkills = React.useCallback(async () => {
    try {
      const resp = await requestFromChannel<CustomSkillRequest, CustomSkillResponse>(customSkillChannel, {
        type: "list",
      });

      if (resp.type === "list") {
        setSkills(resp.skills);
        setMaxSkills(resp.maxSkills);
      }
    } catch (error) {
      console.error("[CustomSkillSettings] Failed to load:", error);
    } finally {
      setLoading(false);
    }
  }, [requestFromChannel]);

  React.useEffect(() => {
    let cancelled = false;
    let retryCount = 0;
    const maxRetries = 3;

    const loadWithRetry = async () => {
      try {
        const resp = await requestFromChannel<CustomSkillRequest, CustomSkillResponse>(customSkillChannel, {
          type: "list",
        });

        if (cancelled) return;

        if (resp.type === "list") {
          setSkills(resp.skills);
          setMaxSkills(resp.maxSkills);

          // 빈 결과 + 재시도 횟수 남았으면 1초 후 재시도 (race condition 대응)
          if (resp.skills.length === 0 && retryCount < maxRetries) {
            retryCount++;
            setTimeout(() => {
              if (!cancelled) loadWithRetry();
            }, 1000);
            return;
          }
        }
        setLoading(false);
      } catch (error) {
        console.error("[CustomSkillSettings] loadWithRetry failed:", error);
        if (!cancelled) setLoading(false);
      }
    };

    loadWithRetry();

    return () => {
      cancelled = true;
    };
  }, [requestFromChannel]);

  const handleSave = React.useCallback(async () => {
    if (!editingSkill || !editingSkill.name.trim()) return;

    try {
      const resp = await requestFromChannel<CustomSkillRequest, CustomSkillResponse>(customSkillChannel, {
        type: "save",
        id: editingSkill.id,
        name: editingSkill.name.trim(),
        description: editingSkill.description.trim(),
        content: editingSkill.content,
      });

      if (resp.type === "error") {
        console.error("[CustomSkillSettings] Save error:", resp.error);

        return;
      }

      setEditingSkill(null);
      setViewingSkillId(null);
      await loadSkills();
    } catch (error) {
      console.error("[CustomSkillSettings] Failed to save:", error);
    }
  }, [editingSkill, requestFromChannel, loadSkills]);

  const handleDelete = React.useCallback(
    async (id: string) => {
      try {
        await requestFromChannel<CustomSkillRequest, CustomSkillResponse>(customSkillChannel, { type: "delete", id });

        if (viewingSkillId === id) setViewingSkillId(null);
        if (editingSkill?.id === id) setEditingSkill(null);
        await loadSkills();
      } catch (error) {
        console.error("[CustomSkillSettings] Failed to delete:", error);
      }
    },
    [requestFromChannel, loadSkills, viewingSkillId, editingSkill],
  );

  const handleToggle = React.useCallback(
    async (id: string, enabled: boolean) => {
      try {
        await requestFromChannel<CustomSkillRequest, CustomSkillResponse>(customSkillChannel, {
          type: "toggle",
          id,
          enabled,
        });
        await loadSkills();
      } catch (error) {
        console.error("[CustomSkillSettings] Failed to toggle:", error);
      }
    },
    [requestFromChannel, loadSkills],
  );

  const startEdit = React.useCallback((skill: CustomSkillInfo) => {
    setEditingSkill({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      content: skill.content,
    });
  }, []);

  const startNew = React.useCallback(() => {
    const id = `skill-${Date.now()}`;

    setEditingSkill({
      id,
      name: "",
      description: "",
      content: "",
      isNew: true,
    });
    setViewingSkillId(null);
  }, []);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading custom skills...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Custom Skills</Label>
          <span className="text-muted-foreground text-xs">
            {skills.length} {isFinite(maxSkills) ? `/ ${maxSkills}` : skills.length === 1 ? "skill" : "skills"}
          </span>
        </div>
        <p className="text-muted-foreground text-xs">
          User-defined skills loaded via Progressive Disclosure. AI reads the full content when needed.
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
                <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{skill.name || skill.id}</span>
                    {!skill.enabled && (
                      <Badge variant="outline" className="text-muted-foreground text-xs">
                        Disabled
                      </Badge>
                    )}
                  </div>
                  {skill.description && (
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">{skill.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(skill.id)} title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Switch checked={skill.enabled} onCheckedChange={(checked) => handleToggle(skill.id, checked)} />
                </div>
              </div>

              {/* Detail View */}
              {viewingSkillId === skill.id && !editingSkill && (
                <div className="border-border flex flex-col gap-3 border-t p-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
                      Description
                    </span>
                    <p className="text-foreground/80 text-xs">{skill.description || "(no description)"}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
                      Content
                    </span>
                    <pre className="bg-muted/50 max-h-[200px] overflow-auto rounded p-2 font-mono text-[11px] leading-relaxed">
                      {skill.content || "(empty)"}
                    </pre>
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
                              detail: { text: `Edit custom skill "${skill.name}": ` },
                            }),
                          );
                        }, 400);
                      }}
                    >
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                      Edit with AI
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => startEdit(skill)}>
                      <Edit3 className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </div>
                </div>
              )}

              {/* Edit Form */}
              {editingSkill && editingSkill.id === skill.id && (
                <div className="border-border flex flex-col gap-3 border-t p-3">
                  <CustomSkillEditForm
                    editingSkill={editingSkill}
                    setEditingSkill={setEditingSkill}
                    onSave={handleSave}
                    onCancel={() => setEditingSkill(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {skills.length === 0 && !editingSkill?.isNew && (
        <div className="bg-muted/20 border-border flex flex-col items-center gap-2 rounded-lg border border-dashed p-6">
          <FileText className="text-muted-foreground h-8 w-8" />
          <p className="text-muted-foreground text-sm">No custom skills yet</p>
          <p className="text-muted-foreground text-xs">Create skills manually or let AI generate them via chat.</p>
        </div>
      )}

      {/* New Skill Form */}
      {editingSkill?.isNew && (
        <div className="bg-muted/30 border-border rounded-lg border p-3">
          <CustomSkillEditForm
            editingSkill={editingSkill}
            setEditingSkill={setEditingSkill}
            onSave={handleSave}
            onCancel={() => setEditingSkill(null)}
          />
        </div>
      )}

      {/* Add buttons */}
      {!editingSkill?.isNew && skills.length < maxSkills && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={startNew}>
            <Plus className="mr-1 h-4 w-4" />
            Add Custom Skill
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // 1. 설정 다이얼로그 닫기 (현재 frame의 window)
              window.dispatchEvent(new CustomEvent("daive:close-preferences"));
              // 2. AI 채팅 패널 열기 (root frame의 window로 전달 — 클러스터 프레임은 iframe)
              const rootWindow = window.parent || window;
              rootWindow.dispatchEvent(new CustomEvent("daive:open-chat"));
              // 3. 패널 열림 + 렌더링 후 채팅에 프리필 (root frame)
              setTimeout(() => {
                rootWindow.dispatchEvent(
                  new CustomEvent("daive:prefill-chat", {
                    detail: { text: "Create a custom skill for: " },
                  }),
                );
              }, 400);
            }}
          >
            <Sparkles className="mr-1 h-4 w-4" />
            Generate with AI
          </Button>
        </div>
      )}
    </div>
  );
};

// ============================================
// Edit Form
// ============================================

const CustomSkillEditForm: React.FC<{
  editingSkill: EditingCustomSkill;
  setEditingSkill: (skill: EditingCustomSkill | null) => void;
  onSave: () => void;
  onCancel: () => void;
}> = ({ editingSkill, setEditingSkill, onSave, onCancel }) => {
  return (
    <div className="flex flex-col gap-3">
      {editingSkill.isNew && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cs-id" className="text-xs font-medium">
            Skill ID
          </Label>
          <Input
            id="cs-id"
            value={editingSkill.id}
            onChange={(e) =>
              setEditingSkill({
                ...editingSkill,
                id: e.target.value.replace(/[^a-z0-9-]/g, ""),
              })
            }
            placeholder="e.g., k8s-troubleshoot"
            className="bg-input/30 border-border h-8 font-mono text-sm"
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cs-name" className="text-xs font-medium">
          Name
        </Label>
        <Input
          id="cs-name"
          value={editingSkill.name}
          onChange={(e) => setEditingSkill({ ...editingSkill, name: e.target.value })}
          placeholder="e.g., K8s Troubleshooting Guide"
          className="bg-input/30 border-border h-8 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cs-desc" className="text-xs font-medium">
          Description
          <span className="text-muted-foreground ml-1 font-normal">(triggers AI to load this skill)</span>
        </Label>
        <Textarea
          id="cs-desc"
          value={editingSkill.description}
          onChange={(e) => setEditingSkill({ ...editingSkill, description: e.target.value })}
          placeholder="Describe when this skill should be used. Include specific keywords and trigger conditions."
          className="bg-input/30 border-border min-h-[60px] text-sm"
          rows={2}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cs-content" className="text-xs font-medium">
          Content
          <span className="text-muted-foreground ml-1 font-normal">(instructions AI follows when skill is loaded)</span>
        </Label>
        <Textarea
          id="cs-content"
          value={editingSkill.content}
          onChange={(e) => setEditingSkill({ ...editingSkill, content: e.target.value })}
          placeholder={"# When to Apply\n...\n\n# Context\n...\n\n# Steps\n1. ...\n2. ...\n\n# Output Format\n..."}
          className="bg-input/30 border-border min-h-[200px] font-mono text-sm"
          rows={10}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="default" size="sm" onClick={onSave} disabled={!editingSkill.name.trim()}>
          Save
        </Button>
      </div>
    </div>
  );
};

// ============================================
// DI wrapper
// ============================================

export const CustomSkillSettings = withInjectables<CustomSkillSettingsDeps>(NonInjectedCustomSkillSettings, {
  getProps: (di) => ({
    requestFromChannel: di.inject(requestFromChannelInjectionToken),
  }),
});
