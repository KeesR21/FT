type Props = { height?: number; className?: string };

/** Elementor `spacer` */
export function KickstarSpacer({ height = 40, className = "" }: Props) {
  return <div className={`ks-w-spacer ${className}`.trim()} style={{ height }} aria-hidden />;
}
