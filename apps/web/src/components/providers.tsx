"use client";

import { Toaster } from "@torea/ui/components/ui/sonner";
import { TooltipProvider } from "@torea/ui/components/ui/tooltip";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { ThemeProvider } from "./theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <NuqsAdapter>
        <TooltipProvider>
          {children}
          <Toaster richColors />
        </TooltipProvider>
      </NuqsAdapter>
    </ThemeProvider>
  );
}
