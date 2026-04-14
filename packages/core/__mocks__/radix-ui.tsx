/**
 * radix-ui barrel import 모킹
 *
 * 🎯 목적: Jest 테스트 시 radix-ui barrel import의 ESM 문제 해결
 *
 * 문제: radix-ui 패키지가 @radix-ui/react-toolbar를 로드할 때
 * createToggleGroupScope 함수를 찾지 못하는 ESM 호환성 문제 발생
 *
 * 해결: 각 컴포넌트를 개별 @radix-ui 패키지에서 직접 re-export
 */
import * as React from "react";

// Accordion
export * as Accordion from "@radix-ui/react-accordion";
// AlertDialog
export * as AlertDialog from "@radix-ui/react-alert-dialog";
// AspectRatio
export * as AspectRatio from "@radix-ui/react-aspect-ratio";
// Avatar
export * as Avatar from "@radix-ui/react-avatar";
// Checkbox
export * as Checkbox from "@radix-ui/react-checkbox";
// Collapsible
export * as Collapsible from "@radix-ui/react-collapsible";
// ContextMenu
export * as ContextMenu from "@radix-ui/react-context-menu";
// Dialog
export * as Dialog from "@radix-ui/react-dialog";
// DropdownMenu
export * as DropdownMenu from "@radix-ui/react-dropdown-menu";
// HoverCard
export * as HoverCard from "@radix-ui/react-hover-card";
// Label
export * as Label from "@radix-ui/react-label";
// Menubar
export * as Menubar from "@radix-ui/react-menubar";
// NavigationMenu
export * as NavigationMenu from "@radix-ui/react-navigation-menu";
// Popover
export * as Popover from "@radix-ui/react-popover";
// Progress
export * as Progress from "@radix-ui/react-progress";
// RadioGroup
export * as RadioGroup from "@radix-ui/react-radio-group";
// ScrollArea
export * as ScrollArea from "@radix-ui/react-scroll-area";
// Select
export * as Select from "@radix-ui/react-select";
// Separator
export * as Separator from "@radix-ui/react-separator";
// Slider
export * as Slider from "@radix-ui/react-slider";
// Slot
export { Slot } from "@radix-ui/react-slot";
// Switch
export * as Switch from "@radix-ui/react-switch";
// Tabs
export * as Tabs from "@radix-ui/react-tabs";
// Toggle
export * as Toggle from "@radix-ui/react-toggle";
// ToggleGroup
export * as ToggleGroup from "@radix-ui/react-toggle-group";
// Tooltip
export * as Tooltip from "@radix-ui/react-tooltip";
