import type { PropsWithChildren } from "react";

type SanitizedProps = Record<string, unknown>;

const sanitizeProps = (props: Record<string, unknown>): SanitizedProps => {
  const allowedKeys = new Set([
    "className",
    "style",
    "id",
    "role",
    "tabIndex",
    "type",
    "href",
    "title",
    "value",
    "name",
    "htmlFor",
    "onClick",
    "onChange",
    "onSubmit",
    "onClose",
    "disabled",
    "checked",
    "open",
  ]);

  return Object.fromEntries(
    Object.entries(props).filter(([key]) => {
      if (allowedKeys.has(key)) {
        return true;
      }

      if (key.startsWith("data-") || key.startsWith("aria-")) {
        return true;
      }

      return false;
    }),
  );
};

const registerRadixPrimitiveMock = (moduleName: string) => {
  try {
    require.resolve(moduleName);
  } catch {
    return;
  }

  jest.mock(moduleName, () => {
    const React = require("react") as typeof import("react");

    const Primitive = React.forwardRef<any, any>(({ children, ...props }, ref) =>
      React.createElement("div", { ref, "data-mock": `${moduleName}`, ...sanitizeProps(props) }, children),
    );

    Primitive.displayName = `Mock${moduleName}`;

    return new Proxy(
      {
        __esModule: true,
        default: Primitive,
      },
      {
        get(target, property: string) {
          if (property in target) {
            return (target as Record<string, unknown>)[property];
          }

          if (property === "$$typeof") {
            return undefined;
          }

          return Primitive;
        },
      },
    );
  });
};

[
  "@radix-ui/react-context-menu",
  "@radix-ui/react-dialog",
  "@radix-ui/react-hover-card",
  "@radix-ui/react-menubar",
  "@radix-ui/react-navigation-menu",
  "@radix-ui/react-tabs",
  "@radix-ui/react-select",
  "@radix-ui/react-scroll-area",
  "@radix-ui/react-progress",
  "@radix-ui/react-slider",
  "@radix-ui/react-toggle",
  "@radix-ui/react-toggle-group",
  "@radix-ui/react-switch",
  "@radix-ui/react-alert-dialog",
  "@radix-ui/react-sheet",
  "@radix-ui/react-drawer",
  "@radix-ui/react-label",
  "@radix-ui/react-accordion",
  "@radix-ui/react-aspect-ratio",
].forEach(registerRadixPrimitiveMock);

const createDivComponent = (React: typeof import("react"), displayName: string) => {
  const Component = React.forwardRef<HTMLDivElement, any>(({ children, asChild: _asChild, ...props }, ref) =>
    React.createElement("div", { ref, "data-mock": displayName, ...sanitizeProps(props) }, children),
  );

  Component.displayName = `Mock${displayName}`;

  return Component;
};

const createSpanComponent = (React: typeof import("react"), displayName: string) => {
  const Component = React.forwardRef<HTMLSpanElement, any>(({ children, ...props }, ref) =>
    React.createElement("span", { ref, "data-mock": displayName, ...sanitizeProps(props) }, children),
  );

  Component.displayName = `Mock${displayName}`;

  return Component;
};

const createButtonLikeComponent = (React: typeof import("react"), displayName: string) => {
  const Component = React.forwardRef<HTMLDivElement, any>(({ asChild, children, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        ...props,
        ref,
        "data-mock": displayName,
      });
    }

    return React.createElement(
      "div",
      {
        ref,
        role: "button",
        tabIndex: 0,
        "data-mock": displayName,
        ...sanitizeProps(props),
      },
      children,
    );
  });

  Component.displayName = `Mock${displayName}`;

  return Component;
};

jest.mock("../renderer/components/shadcn-ui/dropdown-menu", () => {
  const React = require("react") as typeof import("react");

  const div = (name: string) => createDivComponent(React, name);

  return {
    __esModule: true,
    DropdownMenu: ({ children, ...props }: PropsWithChildren) =>
      React.createElement("div", { "data-mock": "DropdownMenu", ...sanitizeProps(props) }, children),
    DropdownMenuPortal: ({ children }: PropsWithChildren) => React.createElement(React.Fragment, null, children),
    DropdownMenuTrigger: createButtonLikeComponent(React, "DropdownMenuTrigger"),
    DropdownMenuContent: div("DropdownMenuContent"),
    DropdownMenuGroup: div("DropdownMenuGroup"),
    DropdownMenuItem: div("DropdownMenuItem"),
    DropdownMenuCheckboxItem: div("DropdownMenuCheckboxItem"),
    DropdownMenuRadioGroup: div("DropdownMenuRadioGroup"),
    DropdownMenuRadioItem: div("DropdownMenuRadioItem"),
    DropdownMenuLabel: div("DropdownMenuLabel"),
    DropdownMenuSeparator: div("DropdownMenuSeparator"),
    DropdownMenuShortcut: createSpanComponent(React, "DropdownMenuShortcut"),
    DropdownMenuSub: ({ children, ...props }: PropsWithChildren) =>
      React.createElement("div", { "data-mock": "DropdownMenuSub", ...sanitizeProps(props) }, children),
    DropdownMenuSubTrigger: createButtonLikeComponent(React, "DropdownMenuSubTrigger"),
    DropdownMenuSubContent: div("DropdownMenuSubContent"),
  };
});

jest.mock("../renderer/components/shadcn-ui/tooltip", () => {
  const React = require("react") as typeof import("react");
  const div = (name: string) => createDivComponent(React, name);

  return {
    __esModule: true,
    Tooltip: ({ children, ...props }: PropsWithChildren) =>
      React.createElement("div", { "data-mock": "Tooltip", ...sanitizeProps(props) }, children),
    TooltipProvider: ({ children, ...props }: PropsWithChildren) =>
      React.createElement("div", { "data-mock": "TooltipProvider", ...sanitizeProps(props) }, children),
    TooltipTrigger: createButtonLikeComponent(React, "TooltipTrigger"),
    TooltipContent: div("TooltipContent"),
  };
});

jest.mock("../renderer/components/shadcn-ui/avatar", () => {
  const React = require("react") as typeof import("react");
  const div = (name: string) => createDivComponent(React, name);

  return {
    __esModule: true,
    Avatar: div("Avatar"),
    AvatarImage: div("AvatarImage"),
    AvatarFallback: div("AvatarFallback"),
  };
});

jest.mock("../renderer/components/shadcn-ui/collapsible", () => {
  const React = require("react") as typeof import("react");
  const div = (name: string) => createDivComponent(React, name);

  return {
    __esModule: true,
    Collapsible: ({ children, ...props }: PropsWithChildren) =>
      React.createElement("div", { "data-mock": "Collapsible", ...sanitizeProps(props) }, children),
    CollapsibleTrigger: createButtonLikeComponent(React, "CollapsibleTrigger"),
    CollapsibleContent: div("CollapsibleContent"),
  };
});

jest.mock("@skuberplus/storybook-shadcn/src/components/ui/collapsible", () => {
  const React = jest.requireActual("react") as typeof import("react");

  const CollapsibleContext = React.createContext<{ open: boolean; toggle: () => void }>({
    open: false,
    toggle: () => {},
  });

  const Collapsible = ({
    children,
    open = false,
    onOpenChange,
    ...props
  }: PropsWithChildren & { open?: boolean; onOpenChange?: (v: boolean) => void }) => {
    const toggle = React.useCallback(() => onOpenChange?.(!open), [open, onOpenChange]);

    return React.createElement(
      CollapsibleContext.Provider,
      { value: { open, toggle } },
      React.createElement("div", { "data-mock": "Collapsible", ...sanitizeProps(props) }, children),
    );
  };

  const CollapsibleTrigger = ({ children, asChild, ...props }: PropsWithChildren & { asChild?: boolean }) => {
    const { toggle } = React.useContext(CollapsibleContext);

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, { onClick: toggle });
    }

    return React.createElement("button", { ...sanitizeProps(props), onClick: toggle }, children);
  };

  const CollapsibleContent = ({ children, ...props }: PropsWithChildren) => {
    const { open } = React.useContext(CollapsibleContext);

    return open
      ? React.createElement("div", { "data-mock": "CollapsibleContent", ...sanitizeProps(props) }, children)
      : null;
  };

  return { __esModule: true, Collapsible, CollapsibleTrigger, CollapsibleContent };
});

jest.mock("../renderer/components/shadcn-ui/popover", () => {
  const React = require("react") as typeof import("react");
  const div = (name: string) => createDivComponent(React, name);

  return {
    __esModule: true,
    Popover: ({ children, ...props }: PropsWithChildren) =>
      React.createElement("div", { "data-mock": "Popover", ...sanitizeProps(props) }, children),
    PopoverTrigger: createButtonLikeComponent(React, "PopoverTrigger"),
    PopoverContent: div("PopoverContent"),
    PopoverAnchor: div("PopoverAnchor"),
  };
});

jest.mock("../renderer/components/shadcn-ui/hotbar", () => {
  const React = require("react") as typeof import("react");
  const div = (name: string) => createDivComponent(React, name);

  return {
    __esModule: true,
    Hotbar: div("Hotbar"),
  };
});

jest.mock("../renderer/components/shadcn-ui/sidebar", () => {
  const React = require("react") as typeof import("react");

  type SidebarContextValue = {
    state: "expanded" | "collapsed";
    open: boolean;
    setOpen: (value: boolean) => void;
    isMobile: boolean;
    openMobile: boolean;
    setOpenMobile: (value: boolean) => void;
    toggleSidebar: () => void;
  };

  const defaultContext: SidebarContextValue = {
    state: "expanded",
    open: true,
    setOpen: () => {},
    isMobile: false,
    openMobile: false,
    setOpenMobile: () => {},
    toggleSidebar: () => {},
  };

  const SidebarContext = React.createContext<SidebarContextValue>(defaultContext);
  const useSidebar = () => React.useContext(SidebarContext);

  const div = (name: string) => createDivComponent(React, name);
  const button = (name: string) => createButtonLikeComponent(React, name);

  const SidebarProvider = React.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) =>
    React.createElement(
      SidebarContext.Provider,
      { value: defaultContext },
      React.createElement("div", { ref, "data-mock": "SidebarProvider", ...sanitizeProps(props) }, children),
    ),
  );
  SidebarProvider.displayName = "MockSidebarProvider";

  const SidebarMenu = React.forwardRef<HTMLUListElement, any>(({ children, ...props }, ref) =>
    React.createElement("ul", { ref, "data-mock": "SidebarMenu", ...sanitizeProps(props) }, children),
  );
  SidebarMenu.displayName = "MockSidebarMenu";

  const SidebarMenuItem = React.forwardRef<HTMLLIElement, any>(({ children, ...props }, ref) =>
    React.createElement("li", { ref, "data-mock": "SidebarMenuItem", ...sanitizeProps(props) }, children),
  );
  SidebarMenuItem.displayName = "MockSidebarMenuItem";

  const SidebarMenuSubItem = React.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) =>
    React.createElement("div", { ref, "data-mock": "SidebarMenuSubItem", ...sanitizeProps(props) }, children),
  );
  SidebarMenuSubItem.displayName = "MockSidebarMenuSubItem";

  const SidebarInput = React.forwardRef<HTMLInputElement, any>(({ children, ...props }, ref) =>
    React.createElement("input", { ref, "data-mock": "SidebarInput", ...sanitizeProps(props) }, children),
  );
  SidebarInput.displayName = "MockSidebarInput";

  const SidebarMenuBadge = createSpanComponent(React, "SidebarMenuBadge");

  return {
    __esModule: true,
    SidebarProvider,
    Sidebar: div("Sidebar"),
    SidebarContent: div("SidebarContent"),
    SidebarFooter: div("SidebarFooter"),
    SidebarGroup: div("SidebarGroup"),
    SidebarGroupAction: button("SidebarGroupAction"),
    SidebarGroupContent: div("SidebarGroupContent"),
    SidebarGroupLabel: div("SidebarGroupLabel"),
    SidebarHeader: div("SidebarHeader"),
    SidebarInput,
    SidebarInset: div("SidebarInset"),
    SidebarMenu,
    SidebarMenuAction: button("SidebarMenuAction"),
    SidebarMenuBadge,
    SidebarMenuButton: button("SidebarMenuButton"),
    SidebarMenuItem,
    SidebarMenuSkeleton: div("SidebarMenuSkeleton"),
    SidebarMenuSub: div("SidebarMenuSub"),
    SidebarMenuSubButton: button("SidebarMenuSubButton"),
    SidebarMenuSubItem,
    SidebarProviderDefaultContext: defaultContext,
    SidebarRail: div("SidebarRail"),
    SidebarSeparator: div("SidebarSeparator"),
    SidebarTrigger: button("SidebarTrigger"),
    useSidebar,
  };
});

jest.mock("@radix-ui/react-slot", () => {
  const React = require("react") as typeof import("react");

  const Slot = React.forwardRef<any, any>(({ children, ...props }, ref) => {
    if (React.isValidElement(children)) {
      return React.cloneElement(children, { ...sanitizeProps(props) });
    }

    return React.createElement("div", { ref, ...sanitizeProps(props) }, children);
  });
  Slot.displayName = "MockRadixSlot";

  return {
    __esModule: true,
    Slot,
    Root: Slot,
    Slottable: Slot,
    createSlot: () => Slot,
    createSlottable: () => Slot,
  };
});

jest.mock("@radix-ui/react-context", () => {
  const React = require("react") as typeof import("react");

  const createContext = (_name: string, defaultValue: unknown) => {
    const Context = React.createContext(defaultValue);

    const Provider = ({ children, ...value }: PropsWithChildren<Record<string, unknown>>) =>
      React.createElement(Context.Provider, { value, children });

    const useContextValue = () => React.useContext(Context);

    return [Provider, useContextValue] as const;
  };

  const createContextScope = () => {
    const useScope = () => ({});
    const createScope = () => useScope;
    (createScope as { scopeName?: string }).scopeName = "MockScope";

    return [createContext, createScope] as const;
  };

  return {
    __esModule: true,
    createContext,
    createContextScope,
  };
});

jest.mock("@radix-ui/react-use-controllable-state", () => {
  const React = require("react") as typeof import("react");

  const useControllableState = ({
    prop,
    defaultProp,
    onChange,
  }: {
    prop?: unknown;
    defaultProp?: unknown;
    onChange?: (value: unknown) => void;
  }) => {
    const [value, setValue] = React.useState(prop ?? defaultProp);

    const setValueSafe = (next: unknown) => {
      setValue((current: unknown) => {
        const resolved = typeof next === "function" ? (next as (prev: unknown) => unknown)(current) : next;
        onChange?.(resolved);

        return resolved;
      });
    };

    return [value, setValueSafe] as const;
  };

  const useControllableStateReducer = <T, A>(options: { initial?: T }, reducer: (state: T, action: A) => T) =>
    React.useReducer(reducer, (options.initial ?? null) as T);

  return {
    __esModule: true,
    useControllableState,
    useControllableStateReducer,
  };
});
jest.mock("../renderer/components/layout/main-layout", () => {
  const React = require("react") as typeof import("react");

  type MainLayoutProps = PropsWithChildren<{
    sidebar?: React.ReactNode;
    hotbar?: React.ReactNode;
    footer?: React.ReactNode;
  }>;

  const MainLayout = ({ sidebar = null, hotbar = null, footer = null, children }: MainLayoutProps) =>
    React.createElement(
      "div",
      { "data-mock": "MainLayout" },
      React.createElement("div", { "data-mock": "MainLayoutSidebar" }, sidebar ?? null),
      React.createElement("div", { "data-mock": "MainLayoutHotbar" }, hotbar ?? null),
      React.createElement("div", { "data-mock": "MainLayoutContent" }, children ?? null),
      footer ? React.createElement("div", { "data-mock": "MainLayoutFooter" }, footer) : null,
    );

  return {
    __esModule: true,
    MainLayout,
  };
});
