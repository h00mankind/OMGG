"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { ViewerPickerDialog } from "@/components/viewer-picker-dialog";
import { useViewer } from "@/lib/viewer";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { viewer } = useViewer();
  const [manualOpen, setManualOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // The playground page renders without any global chrome.
  if (pathname?.startsWith("/playground")) {
    return <>{children}</>;
  }

  // First-visit prompt: open until the viewer picks someone or dismisses it.
  // Derived from state alone — no useEffect needed.
  const open = manualOpen || (!viewer && !dismissed);

  const close = () => {
    setManualOpen(false);
    setDismissed(true);
  };

  return (
    <div className="min-h-full">
      <AppSidebar onOpenViewerPicker={() => setManualOpen(true)} />
      <main className="lg:pl-64">{children}</main>

      <ViewerPickerDialog open={open} onClose={close} forced={!viewer} />
    </div>
  );
}
