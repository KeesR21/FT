type Props = { className?: string };

/** Elementor `divider` */
export function KickstarDivider({ className = "" }: Props) {
  return <hr className={`ks-w-divider ${className}`.trim()} />;
}
