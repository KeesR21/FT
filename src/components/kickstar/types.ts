export type TextAlign = "left" | "center" | "right";

export type KickstarHeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

/** ElementsKit pattern: "Plain text {{highlighted segment}}" — double braces = accent box */
export type ElementsKitTitle = string;

export interface CounterItem {
  end: number;
  suffix: string;
  title: string;
  numberVariant?: "default" | "accent";
}
