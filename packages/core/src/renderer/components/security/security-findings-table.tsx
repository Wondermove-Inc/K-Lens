/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 *  Purpose: Vulnerability list table — react-window virtual-list optimization
 * CVE table with virtual-list implementation
 * Filter & sort by severity/resource/type
 *
 *  Key features:
 * - Virtualizes AnySecurityFinding[] with FixedSizeList (handles 1,000+ items)
 * - Filter: severity (multi-select), type (single), resource name search (text)
 * - Sort: severity / title / detectedAt (asc/desc toggle)
 * - Columns: severity, type, title, resource, source, detectedAt
 * - CveFinding shows additional CVE ID and CVSS score
 * - Handles empty data and pre-scan empty state UI
 *
 * @packageDocumentation
 */

import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { Button } from "@skuberplus/storybook-shadcn/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@skuberplus/storybook-shadcn/src/components/ui/card";
import { Input } from "@skuberplus/storybook-shadcn/src/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@skuberplus/storybook-shadcn/src/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@skuberplus/storybook-shadcn/src/components/ui/tooltip";
import { ArrowDown, ArrowUp, ArrowUpDown, MoreVertical, X } from "lucide-react";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList, type ListChildComponentProps } from "react-window";
import {
  type AnySecurityFinding,
  type CveFinding,
  FindingType,
  type RbacFinding,
  ScannerSource,
  Severity,
} from "../../../common/security/security-finding";
import { getKubescapeControlMeta } from "../../../features/security/main/kubescape-control-meta";

import type { ScanStatus } from "../../../features/security/renderer/security-scan-store";

// ============================================
//  Constants
// ============================================

const ROW_HEIGHT = 56;

const SEVERITY_ORDER: Severity[] = [Severity.Critical, Severity.High, Severity.Medium, Severity.Low, Severity.Unknown];

const SEVERITY_WEIGHT: Record<Severity, number> = {
  [Severity.Critical]: 5,
  [Severity.High]: 4,
  [Severity.Medium]: 3,
  [Severity.Low]: 2,
  [Severity.Unknown]: 1,
};

const SEVERITY_COLOR: Record<Severity, string> = {
  [Severity.Critical]: "bg-red-400 text-black dark:bg-red-800/55 dark:text-red-100",
  [Severity.High]: "bg-orange-400 text-black dark:bg-orange-700/50 dark:text-orange-100",
  [Severity.Medium]: "bg-amber-400 text-black dark:bg-amber-600/55 dark:text-amber-100/90",
  [Severity.Low]: "bg-green-500 text-black dark:bg-green-800/55 dark:text-green-100/90",
  [Severity.Unknown]: "bg-zinc-400 text-black dark:bg-zinc-600/45 dark:text-zinc-200/80",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  [Severity.Critical]: "Critical",
  [Severity.High]: "High",
  [Severity.Medium]: "Medium",
  [Severity.Low]: "Low",
  [Severity.Unknown]: "Unknown",
};

const FINDING_TYPE_LABEL: Record<FindingType, string> = {
  [FindingType.CVE]: "CVE",
  [FindingType.Misconfiguration]: "Misconfig",
  [FindingType.RBAC]: "RBAC",
  [FindingType.NetworkPolicy]: "NetworkPolicy",
};

const SOURCE_LABEL: Record<ScannerSource, string> = {
  [ScannerSource.Trivy]: "Trivy",
  [ScannerSource.Kubescape]: "Kubescape",
};

/** Format a risky permission string: replace wildcard tokens with human-readable labels */
const formatPerm = (p: string): string => {
  if (p === "* *") return "all verbs / all resources (wildcard)";
  if (p.startsWith("* ")) return `all verbs / ${p.slice(2)}`;
  if (p.endsWith(" *")) return `${p.slice(0, -2)} / all resources`;
  return p;
};

// ============================================
//  Filter & sort types
// ============================================

type SortKey = "severity" | "title" | "detectedAt" | "type" | "resource";
type SortDir = "asc" | "desc";

interface FilterState {
  severities: Set<Severity>; // empty = all
  type: FindingType | "all";
  resourceSearch: string;
  namespaceFilter: string; // "" = all, filters to matching namespace when set
}

interface SortState {
  key: SortKey;
  dir: SortDir;
}

// ============================================
//  Props
// ============================================

export interface SecurityFindingsTableProps {
  /** AI Fix callback — called with selected or single finding */
  onAiFix?: (findings: AnySecurityFinding[]) => void;
  onScrollRequest?: () => void; // auto-scroll trigger
  /** Scan status */
  status: ScanStatus;
  /** Finding list */
  findings: AnySecurityFinding[];
  /** Table height in px (default 400) */
  height?: number;
  /**
   * Initial resource search term injected from outside.
   * When an item is clicked in the RBAC Risks / Trivy Image Scan panel,
   * the findings table is auto-filtered by that resource name.
   * When the value changes, the table filter updates to the new value.
   */
  externalResourceSearch?: string;
  /** Type filter injected from outside (used on ComplianceMap section click) */
  externalTypeFilter?: FindingType | "all";
  /** Severity filter injected from outside (used on ScoreCard SeverityBreakdown click) */
  externalSeverityFilter?: Severity;
}

// ============================================
//  Filter & sort logic
// ============================================

function applyFilterAndSort(
  findings: AnySecurityFinding[],
  filter: FilterState,
  sort: SortState,
): AnySecurityFinding[] {
  let result = findings;

  // severity filter
  if (filter.severities.size > 0) {
    result = result.filter((f) => filter.severities.has(f.severity));
  }

  // type filter
  if (filter.type !== "all") {
    result = result.filter((f) => f.type === filter.type);
  }

  // Namespace filter (linked to ComplianceMap / NamespaceOverview click)
  if (filter.namespaceFilter.trim() !== "") {
    const ns = filter.namespaceFilter.trim().toLowerCase();
    result = result.filter((f) => (f.resource.namespace ?? "").toLowerCase() === ns);
  }

  // Resource name search (case-insensitive)
  if (filter.resourceSearch.trim() !== "") {
    const q = filter.resourceSearch.trim().toLowerCase();
    result = result.filter(
      (f) =>
        f.resource.name.toLowerCase().includes(q) ||
        (f.resource.namespace ?? "").toLowerCase().includes(q) ||
        f.title.toLowerCase().includes(q),
    );
  }

  // Sort
  // severity cmp is "b-a" (Critical first), so desc=as-is, asc=inverted
  // Others are "a→z" (ascending), so asc=as-is, desc=inverted
  result = [...result].sort((a, b) => {
    if (sort.key === "severity") {
      const cmp = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
      return sort.dir === "desc" ? cmp : -cmp;
    } else if (sort.key === "type") {
      const cmp = a.type.localeCompare(b.type);
      return sort.dir === "asc" ? cmp : -cmp;
    } else if (sort.key === "resource") {
      const aLabel = a.resource.namespace ? `${a.resource.namespace}/${a.resource.name}` : a.resource.name;
      const bLabel = b.resource.namespace ? `${b.resource.namespace}/${b.resource.name}` : b.resource.name;
      const cmp = aLabel.localeCompare(bLabel);
      return sort.dir === "asc" ? cmp : -cmp;
    } else if (sort.key === "title") {
      const cmp = a.title.localeCompare(b.title);
      return sort.dir === "asc" ? cmp : -cmp;
    } else {
      const cmp = a.detectedAt.localeCompare(b.detectedAt);
      return sort.dir === "asc" ? cmp : -cmp;
    }
  });

  return result;
}

// ============================================
//  SecurityFindingsTable component
// ============================================

export const SecurityFindingsTable: React.FC<SecurityFindingsTableProps> = ({
  status,
  findings,
  height = 400,
  externalResourceSearch,
  externalTypeFilter,
  externalSeverityFilter,
  onScrollRequest,
  onAiFix,
}) => {
  const isReady = status === "complete" || status === "error";
  const isEmpty = isReady && findings.length === 0;

  // filter status
  const [filter, setFilter] = useState<FilterState>({
    severities: new Set(),
    type: "all",
    resourceSearch: externalResourceSearch ?? "",
    namespaceFilter: "",
  });

  // Update filter + scroll when externalResourceSearch changes externally (RBAC/Trivy panel link)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (externalResourceSearch !== undefined) {
      setFilter((prev) => ({ ...prev, resourceSearch: externalResourceSearch }));
      if (externalResourceSearch) {
        onScrollRequest?.();
      }
    }
  }, [externalResourceSearch]);

  // externalTypeFilter: ComplianceMap section click → type filter sync
  React.useEffect(() => {
    if (externalTypeFilter !== undefined) {
      setFilter((prev) => ({ ...prev, type: externalTypeFilter }));
      if (externalTypeFilter !== "all") onScrollRequest?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalTypeFilter]);

  // externalSeverityFilter: ScoreCard SeverityBreakdown click sync
  React.useEffect(() => {
    if (externalSeverityFilter !== undefined) {
      setFilter((prev) => ({ ...prev, severities: new Set([externalSeverityFilter]) }));
      if (externalSeverityFilter) onScrollRequest?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSeverityFilter]);

  // Sort state (default: severity desc — Critical first)
  const [sort, setSort] = useState<SortState>({ key: "severity", dir: "desc" });

  // Selected finding (detail view)
  // Row/⋮ click → fullscreen modal directly, no side panel
  const [modalFinding, setModalFinding] = useState<AnySecurityFinding | null>(null);
  const handleOpenModal = useCallback((f: AnySecurityFinding) => {
    setModalFinding(f);
  }, []);

  // Apply filter & sort
  const filtered = useMemo(
    () => (isReady ? applyFilterAndSort(findings, filter, sort) : []),
    [findings, filter, sort, isReady],
  );

  const handleSeverityToggle = (values: string[]) => {
    setFilter((prev) => ({
      ...prev,
      severities: new Set(values as Severity[]),
    }));
  };

  const handleTypeToggle = (value: string) => {
    setFilter((prev) => ({
      ...prev,
      type: (value || "all") as FindingType | "all",
    }));
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter((prev) => ({ ...prev, resourceSearch: e.target.value }));
  };

  const handleClearFilters = () => {
    setFilter({ severities: new Set(), type: "all", resourceSearch: "", namespaceFilter: "" });
  };

  const handleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "severity" ? "desc" : "asc" },
    );
  };

  const hasActiveFilter =
    filter.severities.size > 0 ||
    filter.type !== "all" ||
    filter.resourceSearch.trim() !== "" ||
    filter.namespaceFilter.trim() !== "";

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Vulnerabilities</CardTitle>
          {isReady && findings.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {filtered.length.toLocaleString()} / {findings.length.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Filter toolbar — shown only when data is present */}
        {isReady && findings.length > 0 && (
          <FilterToolbar
            filter={filter}
            hasActiveFilter={hasActiveFilter}
            findings={findings}
            onSeverityToggle={handleSeverityToggle}
            onTypeToggle={handleTypeToggle}
            onSearch={handleSearch}
            onClear={handleClearFilters}
          />
        )}
      </CardHeader>
      <CardContent className="p-0">
        {status === "idle" && <EmptyPlaceholder message="Run a scan to view vulnerabilities" />}
        {status === "scanning" && <EmptyPlaceholder message="Scanning..." pulse />}
        {status === "error" && <EmptyPlaceholder message="An error occurred during scanning" />}
        {isEmpty && <EmptyPlaceholder message="No vulnerabilities found" />}
        {isReady && findings.length > 0 && filtered.length === 0 && (
          <EmptyPlaceholder message="No results match the current filters" />
        )}
        {isReady && filtered.length > 0 && (
          <>
            <FindingsVirtualList
              findings={filtered}
              height={height}
              sort={sort}
              onSort={handleSort}
              onSelectFinding={handleOpenModal}
              onOpenModal={handleOpenModal}
              onAiFix={onAiFix ? (f) => onAiFix([f]) : undefined}
              onBulkFix={onAiFix ? () => onAiFix(filtered) : undefined}
            />
            {/* row/⋮ click → fullscreen modal */}
            {modalFinding && (
              <FindingDetailModal finding={modalFinding} open={!!modalFinding} onClose={() => setModalFinding(null)} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

SecurityFindingsTable.displayName = "SecurityFindingsTable";

// ============================================
//  Filter toolbar
// ============================================

interface FilterToolbarProps {
  filter: FilterState;
  hasActiveFilter: boolean;
  findings: AnySecurityFinding[];
  onSeverityToggle: (values: string[]) => void;
  onTypeToggle: (value: string) => void;
  onSearch: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}

const FilterToolbar: React.FC<FilterToolbarProps> = ({
  filter,
  hasActiveFilter,
  findings,
  onSeverityToggle,
  onTypeToggle,
  onSearch,
  onClear,
}) => {
  // Count aggregation (computed on render without useMemo — findings change rarely)
  const severityCounts = React.useMemo(() => {
    const counts: Partial<Record<Severity, number>> = {};
    for (const f of findings) {
      counts[f.severity] = (counts[f.severity] ?? 0) + 1;
    }
    return counts;
  }, [findings]);

  const typeCounts = React.useMemo(() => {
    const counts: Partial<Record<FindingType, number>> = {};
    for (const f of findings) {
      counts[f.type] = (counts[f.type] ?? 0) + 1;
    }
    return counts;
  }, [findings]);

  // Sort by count descending (0-count items last)
  const sortedSeverities = [...SEVERITY_ORDER].sort((a, b) => (severityCounts[b] ?? 0) - (severityCounts[a] ?? 0));

  const sortedTypes = Object.values(FindingType).sort((a, b) => (typeCounts[b] ?? 0) - (typeCounts[a] ?? 0));

  return (
    <>
      <div className="flex flex-wrap gap-6 mt-2">
        {/* Severity filter group */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 shrink-0 select-none">
            Severity
          </span>
          <div className="flex items-center border rounded-md px-1.5 py-1 bg-background">
            <ToggleGroup
              type="multiple"
              size="sm"
              value={[...filter.severities]}
              onValueChange={onSeverityToggle}
              className="flex-wrap gap-1"
            >
              {/* All button — active when no severity is selected */}
              <ToggleGroupItem
                value="__all__"
                className="text-xs h-6 px-2.5"
                data-state={filter.severities.size === 0 ? "on" : "off"}
                onClick={() => onSeverityToggle([])}
              >
                All
              </ToggleGroupItem>
              {sortedSeverities.map((sev) => {
                const count = severityCounts[sev] ?? 0;
                return (
                  <ToggleGroupItem key={sev} value={sev} className="text-xs h-6 px-2" disabled={count === 0}>
                    {SEVERITY_LABEL[sev]}
                    {count > 0 && <span className="ml-1 text-[10px] opacity-60">({count.toLocaleString()})</span>}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>
        </div>

        {/* Type filter group — separated with more margin */}
        <div className="flex items-center gap-2 ml-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 shrink-0 select-none">
            Type
          </span>
          <div className="flex items-center border rounded-md px-1.5 py-1 bg-background">
            <ToggleGroup type="single" size="sm" value={filter.type} onValueChange={onTypeToggle} className="gap-1">
              <ToggleGroupItem value="all" className="text-xs h-6 px-2.5">
                All
              </ToggleGroupItem>
              {sortedTypes.map((t) => {
                const count = typeCounts[t] ?? 0;
                return (
                  <ToggleGroupItem key={t} value={t} className="text-xs h-6 px-2" disabled={count === 0}>
                    {FINDING_TYPE_LABEL[t]}
                    {count > 0 && <span className="ml-1 text-[10px] opacity-60">({count.toLocaleString()})</span>}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>
        </div>
      </div>

      {/* resource search — separate row below filter */}
      <div className="flex items-center gap-1.5 mt-1.5">
        <Input
          placeholder="Search resource..."
          value={filter.resourceSearch}
          onChange={onSearch}
          className="h-10 text-sm w-80"
        />

        {/* filter initialization */}
        {hasActiveFilter && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-6 px-2 text-xs text-muted-foreground">
            <X className="h-3 w-3 mr-1" />
            Reset
          </Button>
        )}
      </div>
    </>
  );
};

// ============================================
//  Empty state placeholder
// ============================================

interface EmptyPlaceholderProps {
  message: string;
  pulse?: boolean;
}

const EmptyPlaceholder: React.FC<EmptyPlaceholderProps> = ({ message, pulse }) => (
  <div
    className={`flex items-center justify-center h-32 text-sm text-muted-foreground px-4 text-center ${
      pulse ? "animate-pulse" : ""
    }`}
  >
    {message}
  </div>
);

// ============================================
//  Virtual List
// ============================================

interface FindingsVirtualListProps {
  findings: AnySecurityFinding[];
  height: number;
  sort: SortState;
  onSort: (key: SortKey) => void;
  onSelectFinding: (f: AnySecurityFinding) => void;
  onOpenModal: (f: AnySecurityFinding) => void;
  onAiFix?: (f: AnySecurityFinding) => void;
  onBulkFix?: () => void; // bulk
}

const FindingsVirtualList: React.FC<FindingsVirtualListProps> = ({
  findings,
  height,
  sort,
  onSort,
  onSelectFinding,
  onOpenModal,
  onAiFix,
  onBulkFix,
}) => {
  // Total column width state (px)
  const [colWidths, setColWidths] = useState({
    severity: 72, // severity badge
    type: 72, // short label (CVE / Misconfig)
    title: 130, // flex-2: takes 2/3 of remaining space (CVE titles are longer)
    resource: 100, // flex-1: takes 1/3 of remaining space
    source: 120, // source badge — wider to avoid squeezing
    detectedAt: 140, // HH:MM:SS + date fits
  });
  const dragRef = useRef<{ startX: number; startWidth: number; key: keyof typeof colWidths } | null>(null);

  // Column drag start helper
  const makeColResizeHandler = useCallback(
    (key: keyof typeof colWidths, min = 48, max = 400) =>
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragRef.current = { startX: e.clientX, startWidth: colWidths[key], key };
        const onMouseMove = (ev: MouseEvent) => {
          if (!dragRef.current || dragRef.current.key !== key) return;
          const delta = ev.clientX - dragRef.current.startX;
          setColWidths((prev) => ({
            ...prev,
            [key]: Math.max(min, Math.min(max, dragRef.current!.startWidth + delta)),
          }));
        };
        const onMouseUp = () => {
          dragRef.current = null;
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
          document.body.style.cursor = "";
          document.body.style.userSelect = "";
        };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      },
    [colWidths],
  );

  const Row = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      const finding = findings[index];
      if (!finding) return null;
      return (
        <div style={style}>
          <FindingRow
            finding={finding}
            isEven={index % 2 === 0}
            isSelected={false}
            onSelect={onSelectFinding}
            onOpenModal={onOpenModal}
            colWidths={colWidths}
            onAiFix={onAiFix ? (f) => onAiFix(f) : undefined}
          />
        </div>
      );
    },
    [findings, onSelectFinding, onOpenModal, colWidths, onAiFix],
  );

  // Column resize handle (right edge of header)
  const ColResizeHandle = ({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) => (
    <div
      className="absolute right-0 top-0 h-full w-2 cursor-col-resize group flex items-center justify-center z-10"
      onMouseDown={onMouseDown}
    >
      <div className="h-4 w-px bg-border group-hover:bg-primary group-hover:w-0.5 transition-all" />
    </div>
  );

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sort.key !== col) return <ArrowUpDown className="h-3 w-3 ml-0.5 opacity-40" />;
    return sort.dir === "asc" ? <ArrowUp className="h-3 w-3 ml-0.5" /> : <ArrowDown className="h-3 w-3 ml-0.5" />;
  };

  // Common render function to avoid duplicating header + list JSX
  // Called by both AutoSizer branches (fixed-height and auto-height)
  const renderTable = (width: number, resolvedHeight: number) => (
    <div style={{ width }}>
      {/* Header row — fixed height 36px to align with FixedSizeList offset.
          paddingRight compensates for the always-visible scrollbar (~15px) reserved by FixedSizeList overflowY:scroll */}
      <div
        className="flex items-center h-9 px-5 border-b bg-muted/40 text-xs font-medium text-muted-foreground sticky top-0 select-none"
        style={{ paddingRight: "calc(1.25rem + 15px)" }}
      >
        {/* Severity */}
        <div className="relative shrink-0 flex items-center" style={{ width: colWidths.severity }}>
          <button
            className="flex items-center hover:text-foreground transition-colors truncate"
            onClick={() => onSort("severity")}
          >
            Severity <SortIcon col="severity" />
          </button>
          <ColResizeHandle onMouseDown={makeColResizeHandler("severity", 60, 200)} />
        </div>
        {/* Type */}
        <div className="relative shrink-0 flex items-center" style={{ width: colWidths.type }}>
          <button
            className="flex items-center hover:text-foreground transition-colors truncate"
            onClick={() => onSort("type")}
          >
            Type <SortIcon col="type" />
          </button>
          <ColResizeHandle onMouseDown={makeColResizeHandler("type", 48, 160)} />
        </div>
        {/* Title — flex-2 (takes 2/3 of remaining space); no minWidth so flex calc is pure */}
        <div className="relative min-w-0 flex items-center overflow-hidden" style={{ flex: "2 1 0%" }}>
          <button
            className="flex items-center hover:text-foreground transition-colors truncate"
            onClick={() => onSort("title")}
          >
            Title <SortIcon col="title" />
          </button>
          <ColResizeHandle onMouseDown={makeColResizeHandler("title", 80, 800)} />
        </div>
        {/* Resource — flex-1 (takes 1/3 of remaining space) */}
        <div className="relative min-w-0 hidden md:flex items-center overflow-hidden" style={{ flex: "1 1 0%" }}>
          <button
            className="flex items-center hover:text-foreground transition-colors truncate"
            onClick={() => onSort("resource")}
          >
            Resource <SortIcon col="resource" />
          </button>
          <ColResizeHandle onMouseDown={makeColResizeHandler("resource", 60, 300)} />
        </div>
        {/* Source */}
        <div className="relative shrink-0 hidden lg:flex items-center" style={{ width: colWidths.source }}>
          <span className="truncate">Source</span>
          <ColResizeHandle onMouseDown={makeColResizeHandler("source", 72, 200)} />
        </div>
        {/* Detected At */}
        <div className="relative shrink-0 hidden xl:flex items-center" style={{ width: colWidths.detectedAt }}>
          <button
            className="flex items-center hover:text-foreground transition-colors truncate"
            onClick={() => onSort("detectedAt")}
          >
            Detected At <SortIcon col="detectedAt" />
          </button>
        </div>
        {/* Space for View Details button — aligns with data row w-8 h-8 */}
        <div className="w-8 h-8 shrink-0" />
      </div>
      {/* Virtualized list */}
      <FixedSizeList
        height={resolvedHeight - 36}
        itemCount={findings.length}
        itemSize={ROW_HEIGHT}
        width={width}
        overscanCount={5}
        style={{ overflowY: "scroll" }}
      >
        {Row}
      </FixedSizeList>
    </div>
  );

  return (
    // without height prop AutoSizer auto-tracks parent height (responsive)
    // With height prop, fixed value is used (test/embed environment compatibility)
    <div style={height !== undefined ? { height } : { flex: 1, minHeight: 400 }}>
      {height !== undefined ? (
        // Fixed height: disableHeight literal (required by AutoSizer overload types)
        <AutoSizer disableHeight>{({ width }: { width: number }) => renderTable(width, height)}</AutoSizer>
      ) : (
        // Auto height: AutoSizer tracks both width and height from parent
        <AutoSizer>
          {({ width, height: autoHeight }: { width: number; height: number }) => renderTable(width, autoHeight || 400)}
        </AutoSizer>
      )}
    </div>
  );
};

// ============================================
//  Finding row
// ============================================

interface ColWidths {
  severity: number;
  type: number;
  title: number;
  resource: number;
  source: number;
  detectedAt: number;
}

interface FindingRowProps {
  finding: AnySecurityFinding;
  isEven: boolean;
  isSelected: boolean;
  onSelect: (f: AnySecurityFinding) => void;
  onOpenModal: (f: AnySecurityFinding) => void;
  onAiFix?: (f: AnySecurityFinding) => void; // ⋮ → modal direct
  colWidths: ColWidths;
}

const FindingRow: React.FC<FindingRowProps> = ({
  finding,
  isEven,
  isSelected,
  onSelect,
  onOpenModal,
  colWidths,
  onAiFix,
}) => {
  const isCve = finding.type === FindingType.CVE;
  const cve = isCve ? (finding as CveFinding) : null;
  const resourceLabel = finding.resource.namespace
    ? `${finding.resource.namespace}/${finding.resource.name}`
    : finding.resource.name;

  const detectedTime = (() => {
    try {
      const d = new Date(finding.detectedAt);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return "";
    }
  })();

  return (
    <div
      className={`flex items-center px-5 border-b text-sm ${isEven ? "bg-background" : "bg-muted/20"}`}
      style={{ height: ROW_HEIGHT }}
    >
      {/* Severity badge */}
      <div className="shrink-0" style={{ width: colWidths.severity }}>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            SEVERITY_COLOR[finding.severity]
          }`}
        >
          {SEVERITY_LABEL[finding.severity]}
        </span>
      </div>

      {/* Type */}
      <div className="shrink-0 text-xs text-muted-foreground" style={{ width: colWidths.type }}>
        {FINDING_TYPE_LABEL[finding.type]}
      </div>

      {/* Title */}
      {/* title attr for hover tooltip — lets user see full truncated CVE title */}
      <div className="min-w-0 flex flex-col justify-center gap-0.5 overflow-hidden" style={{ flex: "2 1 0%" }}>
        <span className="truncate font-medium text-xs leading-tight" title={finding.title}>
          {finding.title}
        </span>
        {cve && (
          <span className="text-xs text-muted-foreground">
            {cve.cveId}
            {cve.cvssScore !== undefined && <span className="ml-1.5 font-mono">CVSS {cve.cvssScore.toFixed(1)}</span>}
            {" · "}
            {cve.packageName} {cve.installedVersion}
            {cve.fixedVersion && (
              <span className="text-emerald-700/80 dark:text-emerald-500/80"> → {cve.fixedVersion}</span>
            )}
          </span>
        )}
      </div>

      {/* resource */}
      <div className="min-w-0 hidden md:flex items-center overflow-hidden" style={{ flex: "1 1 0%" }}>
        <span className="text-xs text-muted-foreground truncate block" title={resourceLabel}>
          {finding.resource.kind}/{resourceLabel}
        </span>
      </div>

      {/* Source */}
      <div className="shrink-0 hidden lg:flex items-center" style={{ width: colWidths.source }}>
        <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
          {SOURCE_LABEL[finding.source] ?? finding.source}
        </Badge>
      </div>

      {/* Detected At */}
      <div
        className="shrink-0 hidden xl:flex items-center text-xs text-muted-foreground"
        style={{ width: colWidths.detectedAt }}
      >
        {detectedTime}
      </div>

      {/* ⋮ click → fullscreen modal */}
      <div
        className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md transition-colors cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
        onClick={() => onOpenModal(finding)}
        title="View Details"
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <MoreVertical className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>View Details</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

// ============================================

interface FindingDetailModalProps {
  finding: AnySecurityFinding;
  open: boolean;
  onClose: () => void;
}

const FindingDetailModal: React.FC<FindingDetailModalProps> = ({ finding, open, onClose }) => {
  const isCve = finding.type === FindingType.CVE;
  const cve = isCve ? (finding as CveFinding) : null;
  const resourceLabel = finding.resource.namespace
    ? `${finding.resource.namespace}/${finding.resource.name}`
    : finding.resource.name;

  // Close with ESC key
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const [activeTab, setActiveTab] = useState<"overview" | "affected" | "rawlog" | "references">("overview");

  // Reset tab to overview on close (always starts at overview when reopened)
  React.useEffect(() => {
    if (!open) setActiveTab("overview");
  }, [open]);

  const hasAffected =
    (finding as any).affectedFields?.length > 0 ||
    (finding as any).affectedSpecFields?.length > 0 ||
    (finding as any).riskyPermissions?.length > 0;
  const hasReferences = finding.references && finding.references.length > 0;

  if (!open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      data-testid="finding-detail-modal"
    >
      {/* Background overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      {/* Modal panel */}
      <div
        className="relative z-10 w-full max-w-4xl max-h-[90vh] mx-4 flex flex-col overflow-hidden rounded-lg shadow-2xl border bg-background"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLOR[finding.severity]}`}
                >
                  {SEVERITY_LABEL[finding.severity]}
                </span>
                <Badge variant="outline" className="text-xs h-5 px-1.5 py-0">
                  {FINDING_TYPE_LABEL[finding.type]}
                </Badge>
                <Badge variant="outline" className="text-xs h-5 px-1.5 py-0">
                  {SOURCE_LABEL[finding.source] ?? finding.source}
                </Badge>
              </div>
              <div className="text-sm font-semibold leading-snug text-foreground">{finding.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                {finding.resource.kind}/{resourceLabel}
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-0 border-b px-6 shrink-0">
          {(
            [
              "overview",
              ...(hasAffected ? ["affected"] : []),
              "rawlog",
              ...(hasReferences ? ["references"] : []),
            ] as const
          ).map((tab) => {
            const labels: Record<string, string> = {
              overview: "Overview",
              affected: "Affected Fields",
              rawlog: "Raw Log",
              references: "References",
            };
            return (
              <button
                key={tab}
                className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab(tab as typeof activeTab)}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Overview tab */}
          {activeTab === "overview" &&
            (() => {
              const _overviewRaw = finding.rawLog as any;
              const _overviewControlId: string = _overviewRaw?.controlID ?? "";
              const _overviewMeta = _overviewControlId ? getKubescapeControlMeta(_overviewControlId) : undefined;
              // [7] description fallback: controlIds without meta only have raw path, so provide fallback text
              const _effectiveDescription = (() => {
                const desc = finding.description;
                if (desc && !desc.startsWith("rule-") && !desc.startsWith("Affected fields:")) return desc;
                if (_overviewMeta?.description) return _overviewMeta.description;
                if (desc) return desc; // show even if raw path
                if (_overviewControlId)
                  return `No description available for control ${_overviewControlId}. See raw log for details.`;
                return undefined;
              })();
              const _effectiveRemediation = finding.remediation ?? _overviewMeta?.remediation;
              const _effectiveThreatMatrix: string[] =
                (_overviewRaw?.threatMatrix?.length ? _overviewRaw.threatMatrix : null) ??
                _overviewMeta?.threatMatrix ??
                [];
              return (
                <div className="space-y-4">
                  {/* RBAC-specific description — based on riskyPermissions / affectedSpecFields */}
                  {finding.type === FindingType.RBAC &&
                    (() => {
                      const rbac = finding as RbacFinding;
                      const perms = rbac.riskyPermissions ?? [];
                      const specFields = (rbac as any).affectedSpecFields ?? [];
                      if (perms.length === 0 && specFields.length === 0) return null;
                      // [5] RBAC message severity branch
                      const rbacRiskMsg = (() => {
                        if (finding.severity === Severity.Critical || finding.severity === Severity.High) {
                          return "may allow privilege escalation or unauthorized access";
                        }
                        if (finding.severity === Severity.Medium) {
                          return "may allow unauthorized resource access";
                        }
                        return "grants elevated permissions that should be reviewed";
                      })();
                      // [6] Wildcard substitution: formatPerm is defined at module level
                      return (
                        <div className="rounded-md bg-orange-50 dark:bg-orange-950/20 border border-orange-400/25 dark:border-orange-800 px-4 py-3">
                          <div className="text-[10px] font-semibold uppercase tracking-widest text-orange-700/90 dark:text-orange-600/80 mb-2">
                            RBAC Risk Details
                          </div>
                          {perms.length > 0 && (
                            <div className="mb-2">
                              <div className="text-xs text-muted-foreground mb-1">
                                This role grants{" "}
                                <strong className="text-orange-700/90 dark:text-orange-600/80">
                                  {perms.length} risky permission{perms.length > 1 ? "s" : ""}
                                </strong>{" "}
                                that {rbacRiskMsg}.
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {perms.slice(0, 8).map((p, i) => (
                                  <span
                                    key={i}
                                    className="font-mono text-[10px] bg-orange-50 dark:bg-orange-900/40 text-orange-700/90 dark:text-orange-600/80 rounded px-1.5 py-0.5 border border-orange-400/25 dark:border-orange-600/30"
                                  >
                                    {formatPerm(p)}
                                  </span>
                                ))}
                                {perms.length > 8 && (
                                  <span className="text-[10px] text-muted-foreground self-center">
                                    +{perms.length - 8} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          {specFields.length > 0 && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">
                                <strong className="text-orange-700/90 dark:text-orange-600/80">
                                  {specFields.length} security-sensitive spec field{specFields.length > 1 ? "s" : ""}
                                </strong>{" "}
                                deviate from recommended values.
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {specFields.slice(0, 6).map((f: string, i: number) => (
                                  <span
                                    key={i}
                                    className="font-mono text-[10px] bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 rounded px-1.5 py-0.5 border border-yellow-400/25 dark:border-yellow-700"
                                  >
                                    {f}
                                  </span>
                                ))}
                                {specFields.length > 6 && (
                                  <span className="text-[10px] text-muted-foreground self-center">
                                    +{specFields.length - 6} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  {/* Threat Matrix (MITRE ATT&CK) */}
                  {(() => {
                    const threats: string[] = _effectiveThreatMatrix;
                    if (threats.length === 0) return null;
                    return (
                      <div className="rounded-md bg-destructive/5 dark:bg-destructive/10 border border-destructive/20 dark:border-destructive/30 px-4 py-3">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-destructive dark:text-destructive/80 mb-2">
                          Threat Context (MITRE ATT&amp;CK)
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {threats.map((t: string, i: number) => {
                            const [tactic, technique] = t.includes("::") ? t.split("::") : [t, ""];
                            return (
                              <div
                                key={i}
                                className="flex items-center gap-1 rounded-full bg-destructive/10 dark:bg-destructive/15 border border-destructive/20 dark:border-destructive/25 px-2.5 py-1"
                              >
                                <span className="text-[10px] text-destructive/80 font-medium">{tactic}</span>
                                {technique && (
                                  <>
                                    <span className="text-[10px] text-destructive/40">/</span>
                                    <span className="text-[10px] text-destructive font-semibold">{technique}</span>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  {_effectiveDescription && (
                    <div className="rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30 px-4 py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-red-700/80 dark:text-red-400/70 mb-2">
                        Why it&apos;s a risk
                      </div>
                      <div className="text-sm text-red-900/80 dark:text-red-100/80 leading-relaxed whitespace-pre-line">
                        {_effectiveDescription}
                      </div>
                    </div>
                  )}
                  {_effectiveRemediation && (
                    <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30 px-4 py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-blue-700/80 dark:text-blue-400/70 mb-2">
                        How to fix
                      </div>
                      <div className="text-sm text-blue-900/80 dark:text-blue-100/80 leading-relaxed">
                        {_effectiveRemediation}
                      </div>
                    </div>
                  )}
                  {/* Affected Resource Details from _k8sObject */}
                  {(() => {
                    const raw = finding.rawLog as any;
                    const k8sObj = raw?._k8sObject;
                    if (!k8sObj) return null;
                    const meta = k8sObj.metadata ?? {};
                    // Fallback to finding.resource when metadata is absent
                    const resolvedNamespace = meta.namespace || finding.resource.namespace;
                    const resolvedName = meta.name || finding.resource.name;
                    const rows: { label: string; value: string }[] = [];
                    if (k8sObj.kind || finding.resource.kind)
                      rows.push({ label: "Kind", value: k8sObj.kind ?? finding.resource.kind });
                    if (k8sObj.apiVersion) rows.push({ label: "API Version", value: k8sObj.apiVersion });
                    if (resolvedNamespace) rows.push({ label: "Namespace", value: resolvedNamespace });
                    if (resolvedName) rows.push({ label: "Name", value: resolvedName });
                    if (meta.uid) rows.push({ label: "UID", value: meta.uid });
                    if (rows.length === 0) return null;
                    return (
                      <div className="rounded-md border px-4 py-3">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                          Affected K8s Resource
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                          {rows.map((r) => (
                            <div key={r.label}>
                              <div className="text-[10px] text-muted-foreground">{r.label}</div>
                              <div className="font-mono text-xs mt-0.5 truncate" title={r.value}>
                                {r.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  {cve &&
                    (() => {
                      const raw = finding.rawLog as any;
                      const purl = raw?.PkgID ?? raw?.PURL ?? null;
                      const status = raw?.Status ?? null;
                      const dsName = raw?.DataSource?.Name ?? null;
                      const dsURL = raw?.DataSource?.URL ?? null;
                      return (
                        <div className="rounded-md border px-4 py-3">
                          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                            Vulnerability Details
                          </div>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                            <div>
                              <div className="text-[10px] text-muted-foreground">CVE ID</div>
                              <div className="font-mono text-xs mt-0.5">{cve.cveId}</div>
                            </div>
                            {cve.cvssScore !== undefined && (
                              <div>
                                <div className="text-[10px] text-muted-foreground">CVSS Score</div>
                                <div className="font-mono font-semibold text-xs mt-0.5">{cve.cvssScore.toFixed(1)}</div>
                              </div>
                            )}
                            {cve.cvssVector && (
                              <div className="col-span-2">
                                <div className="text-[10px] text-muted-foreground">CVSS Vector</div>
                                <div className="font-mono text-[10px] mt-0.5 break-all text-muted-foreground">
                                  {cve.cvssVector}
                                </div>
                              </div>
                            )}
                            <div>
                              <div className="text-[10px] text-muted-foreground">Package</div>
                              <div className="font-mono text-xs mt-0.5">{cve.packageName}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-muted-foreground">Installed</div>
                              <div className="font-mono text-xs mt-0.5">{cve.installedVersion}</div>
                            </div>
                            {cve.fixedVersion && (
                              <div>
                                <div className="text-[10px] text-muted-foreground">Fixed In</div>
                                <div className="font-mono text-xs text-emerald-700/80 dark:text-emerald-500/80 mt-0.5">
                                  {cve.fixedVersion}
                                </div>
                              </div>
                            )}
                            {status && (
                              <div>
                                <div className="text-[10px] text-muted-foreground">Status</div>
                                <div className="font-mono text-xs mt-0.5 capitalize">{status}</div>
                              </div>
                            )}
                            {cve.publishedDate && (
                              <div>
                                <div className="text-[10px] text-muted-foreground">Published</div>
                                <div className="font-mono text-xs mt-0.5">{cve.publishedDate.slice(0, 10)}</div>
                              </div>
                            )}
                            {purl && (
                              <div className="col-span-2">
                                <div className="text-[10px] text-muted-foreground">Package ID</div>
                                <div className="font-mono text-[10px] mt-0.5 break-all text-muted-foreground">
                                  {purl}
                                </div>
                              </div>
                            )}
                            {dsName && (
                              <div className="col-span-2">
                                <div className="text-[10px] text-muted-foreground">Data Source</div>
                                <div className="font-mono text-xs mt-0.5">
                                  {dsName}
                                  {dsURL && (
                                    <a
                                      href={dsURL}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="ml-2 text-slate-500 hover:underline text-[10px]"
                                    >
                                      ↗
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  {/* [4] Kubescape Control ID */}
                  {(() => {
                    const controlId = (finding.rawLog as any)?.controlID as string | undefined;
                    if (!controlId) return null;
                    return (
                      <div className="text-xs text-muted-foreground">
                        Control ID: <span className="font-mono">{controlId}</span>
                        <a
                          href={`https://hub.armosec.io/docs/${controlId.toLowerCase()}`}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 hover:underline"
                        >
                          ↗
                        </a>
                      </div>
                    );
                  })()}
                  {/* [8] detectedAt — fixed YYYY-MM-DD HH:mm format */}
                  <div className="text-xs text-muted-foreground">
                    Detected: {(() => {
                      const d = new Date(finding.detectedAt);
                      const pad = (n: number) => String(n).padStart(2, "0");
                      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                    })()}
                  </div>
                </div>
              );
            })()}

          {/* Affected Fields tab */}
          {activeTab === "affected" && (
            <div className="space-y-4">
              {(finding as any).affectedFields?.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    Failed Paths
                  </div>
                  <div className="flex flex-col gap-1">
                    {(finding as any).affectedFields.map((f: string, i: number) => (
                      <span
                        key={i}
                        className="font-mono text-xs bg-destructive/5 dark:bg-destructive/20 text-destructive dark:text-destructive/80 rounded px-2 py-1"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(finding as any).affectedSpecFields?.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    Spec Fields
                  </div>
                  <div className="flex flex-col gap-1">
                    {(finding as any).affectedSpecFields.map((f: string, i: number) => (
                      <span key={i} className="font-mono text-xs bg-muted rounded px-2 py-1">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(finding as any).riskyPermissions?.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    Risky Permissions
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(finding as any).riskyPermissions.map((p: string, i: number) => (
                      <span
                        key={i}
                        className="font-mono text-xs border border-orange-300 dark:border-orange-600/30 text-orange-700/90 dark:text-orange-600/80 rounded px-2 py-0.5"
                      >
                        {formatPerm(p)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Raw Log tab */}
          {activeTab === "rawlog" &&
            (finding.rawLog ? (
              <pre className="text-[11px] leading-relaxed bg-muted/50 rounded-md p-4 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(finding.rawLog, null, 2)}
              </pre>
            ) : (
              <div className="text-sm text-muted-foreground">No raw log available.</div>
            ))}

          {/* References tab */}
          {activeTab === "references" && hasReferences && (
            <div className="flex flex-col gap-2">
              {finding.references!.map((ref, i) => (
                <a
                  key={i}
                  href={ref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-600/80 dark:text-slate-400/80 hover:underline break-all"
                >
                  {ref}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render as Portal into document.body (inline render if document.body absent in test env)
  if (typeof document !== "undefined" && document.body) {
    return createPortal(modal, document.body);
  }
  return modal;
};
