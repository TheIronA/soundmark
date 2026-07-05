"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Laptop },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

const ThemeSwitcher = () => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const activeIndex = Math.max(
    0,
    OPTIONS.findIndex((option) => option.value === theme),
  );

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="relative grid grid-cols-3 w-28 rounded-neo border-3 border-border bg-secondary p-0.5"
    >
      <div
        className="absolute inset-y-0.5 left-0.5 w-1/3 rounded-neo bg-accent shadow-neo-sm transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
        aria-hidden
      />
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const isActive = value === theme;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "relative z-10 flex h-7 items-center justify-center rounded-neo transition-colors",
              isActive
                ? "text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
};

export { ThemeSwitcher };

