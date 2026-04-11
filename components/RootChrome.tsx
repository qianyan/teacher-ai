"use client";

import { ThemeToggle } from "@/components/ThemeToggle";
import type { ReactNode } from "react";

/** Global chrome (theme toggle); header/shell extended in later commits. */
export function RootChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="root-chrome-tools" aria-hidden={false}>
        <ThemeToggle />
      </div>
      {children}
    </>
  );
}
