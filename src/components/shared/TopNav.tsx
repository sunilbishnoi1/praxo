import type { ReactElement } from "react";

import Link from "next/link";

import { Button } from "@/components/ui/button";

type NavItem = {
  label: string;
  href: string;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/" },
  { label: "Sessions", href: "/session/new" },
  { label: "Reports", href: "/reports" },
  { label: "Progress", href: "/progress" },
  { label: "Settings", href: "/settings" },
];

export function TopNav(): ReactElement {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface-overlay/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-page-x py-element">
        <div className="flex items-center gap-element">
          <div className="flex h-9 w-9 items-center justify-center rounded-button bg-brand-500 text-white">
            P
          </div>
          <span className="font-display text-subheading">Praxo</span>
          <nav
            aria-label="Primary"
            className="hidden items-center gap-element md:flex"
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                className="text-body text-foreground/70 transition-colors hover:text-foreground"
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-element">
          <Button size="sm" asChild>
            <Link href="/session/new">Start session</Link>
          </Button>
          <div className="flex h-9 w-9 items-center justify-center rounded-avatar bg-surface-raised text-caption text-foreground/70">
            SB
          </div>
        </div>
      </div>
    </header>
  );
}
