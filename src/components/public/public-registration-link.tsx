import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { PUBLIC_REGISTRATION_ENABLED } from "@/lib/site-features";

type PublicRegistrationLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href?: string;
  children: ReactNode;
};

/** Renders a link to `/register` only when public registration is enabled. */
export function PublicRegistrationLink({
  href = "/register",
  children,
  ...rest
}: PublicRegistrationLinkProps) {
  if (!PUBLIC_REGISTRATION_ENABLED) return null;
  return (
    <Link href={href} {...rest}>
      {children}
    </Link>
  );
}
