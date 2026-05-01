import type { KickstarHeadingTag } from "@/components/kickstar/types";

type Props = {
  title: string;
  as?: KickstarHeadingTag;
  align?: "left" | "center" | "right";
  className?: string;
};

/** Elementor core `heading` widget */
export function KickstarNativeHeading({ title, as: Tag = "h3", align = "left", className = "" }: Props) {
  return (
    <Tag className={`ks-w-native-heading ks-w-native-heading--${align} ${className}`.trim()}>{title}</Tag>
  );
}
