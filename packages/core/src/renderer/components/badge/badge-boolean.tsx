import React from "react";
import { Badge } from "../shadcn-ui/badge";

export interface BadgeBooleanProps {
  value?: boolean;
}

export function getBooleanText(value?: boolean) {
  if (value === true) return "True";
  if (value === false) return "False";
  return "-";
}

export function getBooleanVariant(value?: boolean): "default" | "destructive" | "outline" {
  if (value === true) return "default";
  if (value === false) return "destructive";
  return "outline";
}

export function BadgeBoolean({ value }: BadgeBooleanProps) {
  return <Badge variant={getBooleanVariant(value)}>{getBooleanText(value)}</Badge>;
}
