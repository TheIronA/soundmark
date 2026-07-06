"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/app/timeline", label: "Timeline" },
  { href: "/app/map", label: "Map" },
  { href: "/app/new", label: "New" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 sm:gap-4">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "whitespace-nowrap rounded-neo px-2 py-1.5 text-sm font-medium transition-colors sm:px-3",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/10 hover:text-accent",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
