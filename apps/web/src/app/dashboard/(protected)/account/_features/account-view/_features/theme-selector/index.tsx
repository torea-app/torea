"use client";

import {
  RadioGroup,
  RadioGroupItem,
} from "@screenbase/ui/components/ui/radio-group";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useId, useState } from "react";

const themes = [
  { value: "light", label: "ライト", icon: SunIcon },
  { value: "dark", label: "ダーク", icon: MoonIcon },
  { value: "system", label: "システム", icon: MonitorIcon },
] as const;

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const id = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <RadioGroup value={theme} onValueChange={setTheme}>
      {themes.map(({ value, label, icon: Icon }) => {
        const itemId = `${id}-theme-${value}`;
        return (
          <div
            key={value}
            className="flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors has-data-checked:border-primary has-data-checked:bg-primary/5"
          >
            <RadioGroupItem value={value} id={itemId} />
            <Icon className="size-4 text-muted-foreground" />
            <label
              htmlFor={itemId}
              className="cursor-pointer font-medium text-sm"
            >
              {label}
            </label>
          </div>
        );
      })}
    </RadioGroup>
  );
}
