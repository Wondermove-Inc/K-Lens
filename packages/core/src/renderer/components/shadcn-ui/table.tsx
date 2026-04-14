import React from "react";
import { cn } from "@/lib/utils";

/**
 * 🎯 목적: Table 컴포넌트에 forwardRef 적용하여 React 18/19 호환성 제공
 * 📝 주의사항: HTML table 요소 사용, overflow wrapper div 포함
 * 🔄 변경이력: 2025-10-11 - React 18/19 dual support를 위한 forwardRef 추가
 */
const Table = React.forwardRef<HTMLTableElement, React.ComponentProps<"table">>(({ className, ...props }, ref) => {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table ref={ref} data-slot="table" className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
});
Table.displayName = "Table";

/**
 * 🎯 목적: TableHeader 컴포넌트에 forwardRef 적용하여 React 18/19 호환성 제공
 * 📝 주의사항: HTML thead 요소 사용
 * 🔄 변경이력: 2025-10-11 - React 18/19 dual support를 위한 forwardRef 추가
 */
const TableHeader = React.forwardRef<HTMLTableSectionElement, React.ComponentProps<"thead">>(
  ({ className, ...props }, ref) => {
    return <thead ref={ref} data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />;
  },
);
TableHeader.displayName = "TableHeader";

/**
 * 🎯 목적: TableBody 컴포넌트에 forwardRef 적용하여 React 18/19 호환성 제공
 * 📝 주의사항: HTML tbody 요소 사용
 * 🔄 변경이력: 2025-10-11 - React 18/19 dual support를 위한 forwardRef 추가
 */
const TableBody = React.forwardRef<HTMLTableSectionElement, React.ComponentProps<"tbody">>(
  ({ className, ...props }, ref) => {
    return (
      <tbody ref={ref} data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />
    );
  },
);
TableBody.displayName = "TableBody";

/**
 * 🎯 목적: TableFooter 컴포넌트에 forwardRef 적용하여 React 18/19 호환성 제공
 * 📝 주의사항: HTML tfoot 요소 사용
 * 🔄 변경이력: 2025-10-11 - React 18/19 dual support를 위한 forwardRef 추가
 */
const TableFooter = React.forwardRef<HTMLTableSectionElement, React.ComponentProps<"tfoot">>(
  ({ className, ...props }, ref) => {
    return (
      <tfoot
        ref={ref}
        data-slot="table-footer"
        className={cn("bg-muted/50 border-t font-medium [&>tr]:last:border-b-0", className)}
        {...props}
      />
    );
  },
);
TableFooter.displayName = "TableFooter";

/**
 * 🎯 목적: TableRow 컴포넌트에 forwardRef 적용하여 React 18/19 호환성 제공
 * 📝 주의사항: HTML tr 요소 사용
 * 🔄 변경이력: 2025-10-11 - React 18/19 dual support를 위한 forwardRef 추가
 */
const TableRow = React.forwardRef<HTMLTableRowElement, React.ComponentProps<"tr">>(({ className, ...props }, ref) => {
  return (
    <tr
      ref={ref}
      data-slot="table-row"
      className={cn("hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors", className)}
      {...props}
    />
  );
});
TableRow.displayName = "TableRow";

/**
 * 🎯 목적: TableHead 컴포넌트에 forwardRef 적용하여 React 18/19 호환성 제공
 * 📝 주의사항: HTML th 요소 사용
 * 🔄 변경이력: 2025-10-11 - React 18/19 dual support를 위한 forwardRef 추가
 */
const TableHead = React.forwardRef<HTMLTableCellElement, React.ComponentProps<"th">>(({ className, ...props }, ref) => {
  return (
    <th
      ref={ref}
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
});
TableHead.displayName = "TableHead";

/**
 * 🎯 목적: TableCell 컴포넌트에 forwardRef 적용하여 React 18/19 호환성 제공
 * 📝 주의사항: HTML td 요소 사용
 * 🔄 변경이력: 2025-10-11 - React 18/19 dual support를 위한 forwardRef 추가
 */
const TableCell = React.forwardRef<HTMLTableCellElement, React.ComponentProps<"td">>(({ className, ...props }, ref) => {
  return (
    <td
      ref={ref}
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
});
TableCell.displayName = "TableCell";

/**
 * 🎯 목적: TableCaption 컴포넌트에 forwardRef 적용하여 React 18/19 호환성 제공
 * 📝 주의사항: HTML caption 요소 사용
 * 🔄 변경이력: 2025-10-11 - React 18/19 dual support를 위한 forwardRef 추가
 */
const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.ComponentProps<"caption">>(
  ({ className, ...props }, ref) => {
    return (
      <caption
        ref={ref}
        data-slot="table-caption"
        className={cn("text-muted-foreground mt-4 text-sm", className)}
        {...props}
      />
    );
  },
);
TableCaption.displayName = "TableCaption";

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow };
