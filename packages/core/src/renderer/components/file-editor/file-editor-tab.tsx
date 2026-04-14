/**
 * 🎯 Purpose: File Editor Tab component (Monaco Editor integration)
 * 📝 Features:
 *   - Monaco editor integration
 *   - Auto language detection
 *   - Ctrl+S to save
 *   - isDirty state management
 *   - Markdown Edit/Preview/Split modes
 * 🔄 Change History:
 *   - 2026-01-24: Initial implementation
 *   - 2026-01-25: FIX-030 - kubectl apply injectable pattern
 *   - 2026-01-25: FIX-031 - hostedClusterId fallback
 *   - 2026-01-25: FIX-032 - English UI, Notification Panel integration
 * @module file-editor/file-editor-tab
 */

import { ipcRenderer } from "electron";
import { Loader2 } from "lucide-react";
import { observer } from "mobx-react";
import React, { useCallback, useEffect, useState } from "react";
import { fileSystemChannels, type WriteFileResponse } from "../../../common/ipc/filesystem";
import { cn } from "../../utils/cn";
import { MarkdownPreview } from "../markdown-preview";
import { MonacoEditor, type MonacoLanguage } from "../monaco-editor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../shadcn-ui/alert-dialog";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
import { FileEditorToolbar } from "./file-editor-toolbar";

import type { KubectlApplyFile } from "../../kubectl/apply-file.injectable";
import type { MarkdownViewMode } from "../main-tabs/main-tab.model";

/**
 * FileEditorTab Props
 */
export interface FileEditorTabProps {
  /** Tab ID */
  tabId: string;
  /** File path */
  filePath: string;
  /** File language */
  language?: string;
  /** Original content */
  originalContent: string;
  /** Current content */
  currentContent: string;
  /** Whether content is modified */
  isDirty: boolean;
  /** Read-only mode */
  readOnly?: boolean;
  /** Cluster ID (for kubectl apply) */
  clusterId?: string;
  /** Markdown view mode (for preserving state across tab switches) */
  markdownViewMode?: MarkdownViewMode;
  /** Content change callback */
  onContentChange?: (tabId: string, content: string) => void;
  /** Save complete callback */
  onSave?: (tabId: string, content: string) => void;
  /** Refresh callback (reload file from disk) */
  onRefresh?: (tabId: string) => void;
  /** Markdown view mode change callback */
  onMarkdownViewModeChange?: (tabId: string, viewMode: MarkdownViewMode) => void;
}

/**
 * FileEditorTab Internal Props (with DI dependencies)
 */
export interface FileEditorTabInternalProps extends FileEditorTabProps {
  /** kubectl apply function (DI injected) */
  kubectlApplyFile: KubectlApplyFile;
  /** Hosted cluster ID (DI injected, for fallback) */
  hostedClusterId?: string;
}

/**
 * Check if file is markdown
 */
function isMarkdownFile(language?: string): boolean {
  return language === "markdown";
}

/**
 * Check if file is Kubernetes resource (YAML/JSON)
 */
function isKubernetesFile(language?: string): boolean {
  return language === "yaml" || language === "json";
}

/**
 * File Editor Tab component (Internal - with DI dependencies)
 * 📝 FileEditorTab is exported from file-editor-tab.injectable.tsx
 */
export const FileEditorTabInternal = observer(function FileEditorTabInternal({
  tabId,
  filePath,
  language = "plaintext",
  originalContent,
  currentContent,
  isDirty,
  readOnly = false,
  clusterId,
  markdownViewMode = "edit",
  onContentChange,
  onSave,
  onRefresh,
  onMarkdownViewModeChange,
  kubectlApplyFile,
  hostedClusterId,
}: FileEditorTabInternalProps) {
  // State
  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // Apply related state
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);

  // FIX-031: Effective cluster ID (props > hostedClusterId fallback)
  const effectiveClusterId = clusterId || hostedClusterId;

  // Extract file name
  const fileName = filePath.split("/").pop() || filePath;
  const isMarkdown = isMarkdownFile(language);
  const isKubernetes = isKubernetesFile(language);

  /**
   * Save file
   */
  const handleSave = useCallback(async () => {
    if (isSaving || !isDirty || readOnly) {
      return;
    }

    setIsSaving(true);

    try {
      const response = (await ipcRenderer.invoke(
        fileSystemChannels.writeFile,
        filePath,
        currentContent,
        "utf-8",
      )) as WriteFileResponse;

      if (response.success) {
        onSave?.(tabId, currentContent);
      } else {
        console.error(`[FileEditorTab] Save failed: ${response.error}`);
        notificationPanelStore.addError("file", "Save Failed", response.error || "Unknown error");
      }
    } catch (error) {
      console.error("[FileEditorTab] Save error:", error);
      notificationPanelStore.addError("file", "Save Error", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsSaving(false);
    }
  }, [tabId, filePath, currentContent, isDirty, readOnly, isSaving, onSave]);

  /**
   * Refresh file from disk
   */
  const handleRefresh = useCallback(() => {
    onRefresh?.(tabId);
  }, [tabId, onRefresh]);

  /**
   * Execute kubectl apply
   * FIX-032: Uses notificationPanelStore instead of toast
   */
  const executeApply = useCallback(async () => {
    if (isApplying || readOnly) {
      return;
    }

    // FIX-032: Show error if no cluster selected
    if (!effectiveClusterId) {
      notificationPanelStore.addError(
        "operations",
        "Apply Failed",
        "No cluster selected. Please select a cluster first.",
      );
      return;
    }

    setIsApplying(true);

    try {
      // Save first if dirty
      if (isDirty) {
        const saveResponse = (await ipcRenderer.invoke(
          fileSystemChannels.writeFile,
          filePath,
          currentContent,
          "utf-8",
        )) as WriteFileResponse;

        if (!saveResponse.success) {
          notificationPanelStore.addError(
            "file",
            "Save Failed",
            saveResponse.error || "Could not save file before apply.",
          );
          return;
        }

        // Notify save success
        onSave?.(tabId, currentContent);
      }

      // Execute kubectl apply (FIX-030: injectable pattern, FIX-031: effectiveClusterId)
      const response = await kubectlApplyFile({
        clusterId: effectiveClusterId,
        filePath,
      });

      if (response.success) {
        notificationPanelStore.addSuccess(
          "operations",
          `Deploy: ${fileName}`,
          response.stdout || "Resource applied successfully.",
        );
      } else {
        notificationPanelStore.addError(
          "operations",
          `Deploy Failed: ${fileName}`,
          response.stderr || "Unknown error occurred.",
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[FileEditorTab] Apply error:", error);
      notificationPanelStore.addError("operations", `Deploy Error: ${fileName}`, errorMessage);
    } finally {
      setIsApplying(false);
    }
  }, [
    tabId,
    filePath,
    fileName,
    currentContent,
    isDirty,
    readOnly,
    effectiveClusterId,
    isApplying,
    onSave,
    kubectlApplyFile,
  ]);

  /**
   * Apply button click - show confirmation dialog
   */
  const handleApplyClick = useCallback(() => {
    setShowApplyConfirm(true);
  }, []);

  /**
   * Apply confirmation dialog - confirm click
   */
  const handleApplyConfirm = useCallback(() => {
    setShowApplyConfirm(false);
    executeApply();
  }, [executeApply]);

  /**
   * Editor content change
   */
  const handleEditorChange = useCallback(
    (value: string) => {
      onContentChange?.(tabId, value);
    },
    [tabId, onContentChange],
  );

  /**
   * Ctrl+S keyboard shortcut
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleSave]);

  /**
   * Handle markdown view mode change (persisted to store)
   */
  const handleViewModeChange = useCallback(
    (viewMode: MarkdownViewMode) => {
      onMarkdownViewModeChange?.(tabId, viewMode);
    },
    [tabId, onMarkdownViewModeChange],
  );

  // Monaco editor language mapping (12 language support)
  const monacoLanguage: MonacoLanguage | undefined =
    language === "plaintext" ? undefined : (language as MonacoLanguage);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <FileEditorToolbar
        fileName={fileName}
        filePath={filePath}
        language={language}
        isDirty={isDirty}
        readOnly={readOnly}
        isSaving={isSaving}
        isApplying={isApplying}
        isMarkdown={isMarkdown}
        markdownViewMode={markdownViewMode}
        onSave={handleSave}
        onRefresh={handleRefresh}
        onApply={isKubernetes ? handleApplyClick : undefined}
        onViewModeChange={handleViewModeChange}
      />

      {/* Editor area */}
      <div className="flex-1 min-h-0 relative">
        {/* Saving overlay */}
        {isSaving && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Editor layout */}
        {isMarkdown && markdownViewMode !== "edit" ? (
          // Markdown mode (Preview or Split)
          <div className={cn("h-full", markdownViewMode === "split" && "grid grid-cols-2 gap-0")}>
            {/* Split mode: Left editor */}
            {markdownViewMode === "split" && (
              <div className="h-full border-r border-border overflow-hidden">
                <MonacoEditor
                  id={`file-editor-${tabId}`}
                  value={currentContent}
                  language={monacoLanguage}
                  readOnly={readOnly}
                  onChange={handleEditorChange}
                  className="h-full"
                  style={{ height: "100%" }}
                />
              </div>
            )}

            {/* Preview area (MarkdownPreview component) */}
            <div className="h-full overflow-auto p-4 bg-background">
              <MarkdownPreview content={currentContent} />
            </div>
          </div>
        ) : (
          // Normal mode (Edit Only)
          <MonacoEditor
            id={`file-editor-${tabId}`}
            value={currentContent}
            language={monacoLanguage}
            readOnly={readOnly}
            onChange={handleEditorChange}
            className="h-full"
            style={{ height: "100%" }}
          />
        )}
      </div>

      {/* Apply confirmation dialog */}
      <AlertDialog open={showApplyConfirm} onOpenChange={setShowApplyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply to Kubernetes?</AlertDialogTitle>
            <AlertDialogDescription>
              {isDirty ? (
                <>This file has unsaved changes. It will be saved first, then applied to the cluster.</>
              ) : (
                <>
                  Apply <span className="font-semibold">{fileName}</span> to the Kubernetes cluster?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApplyConfirm}>{isDirty ? "Save & Apply" : "Apply"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* FIX-032: Apply results shown in Notification Panel */}
    </div>
  );
});
