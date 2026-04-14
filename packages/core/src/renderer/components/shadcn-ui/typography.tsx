import React, { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

import type { JSX } from "react";

type TypographyVariant =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "p"
  | "blockquote"
  | "table"
  | "list"
  | "inlineCode"
  | "lead"
  | "large"
  | "small"
  | "muted";

interface TypographyProps extends HTMLAttributes<HTMLElement> {
  variant: TypographyVariant;
}

export const Typography = forwardRef<HTMLElement, TypographyProps>(
  ({ className, variant, children, ...props }, ref) => {
    const variantStyles = {
      h1: "scroll-m-20 text-4xl font-extrabold tracking-tight text-balance",
      h2: "scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0",
      h3: "scroll-m-20 text-2xl font-semibold tracking-tight",
      h4: "scroll-m-20 text-xl font-semibold tracking-tight",
      p: "leading-7 [&:not(:first-child)]:mt-6",
      blockquote: "mt-6 border-l-2 pl-6 italic",
      table: "",
      list: "my-6 ml-6 list-disc [&>li]:mt-2",
      inlineCode: "bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
      lead: "text-muted-foreground text-xl",
      large: "text-lg font-semibold",
      small: "text-sm leading-none font-medium",
      muted: "text-muted-foreground text-sm",
    };

    // Special handling for table
    if (variant === "table") {
      return (
        <div className="my-6 w-full overflow-y-auto">
          <table className="w-full" ref={ref as React.Ref<HTMLTableElement>}>
            <thead>
              <tr className="even:bg-muted m-0 border-t p-0">
                <th className="border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right">
                  King's Treasury
                </th>
                <th className="border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right">
                  People's happiness
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="even:bg-muted m-0 border-t p-0">
                <td className="border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right">
                  Empty
                </td>
                <td className="border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right">
                  Overflowing
                </td>
              </tr>
              <tr className="even:bg-muted m-0 border-t p-0">
                <td className="border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right">
                  Modest
                </td>
                <td className="border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right">
                  Satisfied
                </td>
              </tr>
              <tr className="even:bg-muted m-0 border-t p-0">
                <td className="border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right">
                  Full
                </td>
                <td className="border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right">
                  Ecstatic
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    // Map variants to HTML elements
    const elementMap: Record<TypographyVariant, keyof JSX.IntrinsicElements> = {
      h1: "h1",
      h2: "h2",
      h3: "h3",
      h4: "h4",
      p: "p",
      blockquote: "blockquote",
      table: "table",
      list: "ul",
      inlineCode: "code",
      lead: "p",
      large: "p",
      small: "p",
      muted: "p",
    };

    const Component = elementMap[variant] as React.ElementType;

    // Default children for specific variants
    const defaultChildren = {
      list: (
        <>
          <li>1st level of puns: 5 gold coins</li>
          <li>2nd level of jokes: 10 gold coins</li>
          <li>3rd level of one-liners : 20 gold coins</li>
        </>
      ),
      blockquote: (
        <>
          "After all," he said, "everyone enjoys a good joke, so it's only fair that they should pay for the privilege."
        </>
      ),
      p: "The king, seeing how much happier his subjects were, realized the error of his ways and repealed the joke tax.",
      inlineCode: "@radix-ui/react-alert-dialog",
      lead: "The joke tax was a preposterous idea that shook the very foundations of our society.",
      large: "The people rejoiced at the repeal.",
      small: "Fine print: No refunds on previously paid joke taxes.",
      muted: "This story is entirely fictional. Any resemblance to real tax policies is purely coincidental.",
    };

    return (
      <Component ref={ref} className={cn(variantStyles[variant], className)} {...props}>
        {children || defaultChildren[variant as keyof typeof defaultChildren] || children}
      </Component>
    );
  },
);
Typography.displayName = "Typography";

// Export individual components for backward compatibility
export const TypographyH1 = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h1
      ref={ref}
      className={cn("scroll-m-20 text-4xl font-extrabold tracking-tight text-balance", className)}
      {...props}
    />
  ),
);
TypographyH1.displayName = "TypographyH1";

export const TypographyH2 = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn("scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0", className)}
      {...props}
    />
  ),
);
TypographyH2.displayName = "TypographyH2";

export const TypographyH3 = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("scroll-m-20 text-2xl font-semibold tracking-tight", className)} {...props} />
  ),
);
TypographyH3.displayName = "TypographyH3";

export const TypographyH4 = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h4 ref={ref} className={cn("scroll-m-20 text-xl font-semibold tracking-tight", className)} {...props} />
  ),
);
TypographyH4.displayName = "TypographyH4";
