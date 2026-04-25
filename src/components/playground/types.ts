import type { ReactNode } from "react";

export type Control =
  | { key: string; label: string; type: "text"; placeholder?: string }
  | {
      key: string;
      label: string;
      type: "number";
      min?: number;
      max?: number;
      step?: number;
    }
  | {
      key: string;
      label: string;
      type: "select";
      options: { label: string; value: string }[];
    }
  | { key: string; label: string; type: "boolean" }
  | {
      key: string;
      label: string;
      type: "slider";
      min: number;
      max: number;
      step?: number;
    };

export type Helpers = {
  notify: (label: string) => void;
};

export type RegistryEntry = {
  id: string;
  label: string;
  group: "Cards" | "Rows" | "Bits" | "Sidebar" | "Primitives";
  defaultProps: Record<string, unknown>;
  controls: Control[];
  render: (props: Record<string, unknown>, helpers: Helpers) => ReactNode;
  /** Optional wider stage when the component needs space (sidebar, page header). */
  fullBleed?: boolean;
};

export type Tokens = {
  primary: string;
  surface: string;
  surface2: string;
  fontDisplay: boolean;
};

export const DEFAULT_TOKENS: Tokens = {
  primary: "#8b1c25",
  surface: "#1c1a23",
  surface2: "#26242e",
  fontDisplay: true,
};
