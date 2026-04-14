/**
 * 🎯 목적: @skuberplus/storybook-shadcn 패키지의 TypeScript 타입 선언
 * 📝 주의사항: workspace 패키지이므로 런타임에는 webpack이 해결함
 * 🔄 변경이력: 2025-10-17 - 초기 생성 (Welcome 화면 DataTable 통합용)
 */

declare module "@skuberplus/storybook-shadcn" {
  import type * as React from "react";

  // Table 컴포넌트들
  export const Table: React.ForwardRefExoticComponent<
    React.HTMLAttributes<HTMLTableElement> & React.RefAttributes<HTMLTableElement>
  >;
  export const TableHeader: React.ForwardRefExoticComponent<
    React.HTMLAttributes<HTMLTableSectionElement> & React.RefAttributes<HTMLTableSectionElement>
  >;
  export const TableBody: React.ForwardRefExoticComponent<
    React.HTMLAttributes<HTMLTableSectionElement> & React.RefAttributes<HTMLTableSectionElement>
  >;
  export const TableFooter: React.ForwardRefExoticComponent<
    React.HTMLAttributes<HTMLTableSectionElement> & React.RefAttributes<HTMLTableSectionElement>
  >;
  export const TableRow: React.ForwardRefExoticComponent<
    React.HTMLAttributes<HTMLTableRowElement> & React.RefAttributes<HTMLTableRowElement>
  >;
  export const TableHead: React.ForwardRefExoticComponent<
    React.ThHTMLAttributes<HTMLTableCellElement> & React.RefAttributes<HTMLTableCellElement>
  >;
  export const TableCell: React.ForwardRefExoticComponent<
    React.TdHTMLAttributes<HTMLTableCellElement> & React.RefAttributes<HTMLTableCellElement>
  >;
  export const TableCaption: React.ForwardRefExoticComponent<
    React.HTMLAttributes<HTMLTableCaptionElement> & React.RefAttributes<HTMLTableCaptionElement>
  >;

  // Button 컴포넌트
  interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    size?: "default" | "sm" | "lg" | "icon";
    asChild?: boolean;
  }
  export const Button: React.FC<ButtonProps>;

  // Input 컴포넌트
  export const Input: React.ForwardRefExoticComponent<
    React.InputHTMLAttributes<HTMLInputElement> & React.RefAttributes<HTMLInputElement>
  >;

  // Checkbox 컴포넌트
  interface CheckboxProps {
    checked?: boolean | "indeterminate";
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
    className?: string;
    [key: string]: unknown;
  }
  export const Checkbox: React.FC<CheckboxProps>;

  // DropdownMenu 컴포넌트들
  export const DropdownMenu: React.FC<{ children: React.ReactNode }>;
  export const DropdownMenuTrigger: React.FC<{ asChild?: boolean; children: React.ReactNode }>;
  export const DropdownMenuContent: React.FC<{
    align?: "start" | "center" | "end";
    children: React.ReactNode;
  }>;
  export const DropdownMenuItem: React.FC<React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }>;
  export const DropdownMenuLabel: React.FC<{ children: React.ReactNode }>;
  export const DropdownMenuSeparator: React.FC<Record<string, unknown>>;
  export const DropdownMenuCheckboxItem: React.FC<{
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    children: React.ReactNode;
    className?: string;
  }>;

  // 유틸리티 함수
  export function cn(...inputs: (string | undefined | null | false)[]): string;
}
