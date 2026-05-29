import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PUBLIC_REGISTRATION_ENABLED } from "@/lib/site-features";

export const metadata: Metadata = {
  title: "Register",
  description:
    "Register your child at FTPR Lions Football Academy. Complete the application form and await admin approval."
};

export default async function RegisterLayout({ children }: { children: ReactNode }) {
  if (!PUBLIC_REGISTRATION_ENABLED) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    if (!pathname.startsWith("/register/unavailable")) {
      redirect("/register/unavailable");
    }
  }
  return <>{children}</>;
}
