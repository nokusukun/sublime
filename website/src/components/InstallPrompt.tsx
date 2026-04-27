"use client";

import { useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setDeferredPrompt(null);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 bg-surface border border-border rounded-lg p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground mb-1">
            Install Sublime
          </p>
          <p className="text-xs text-muted leading-relaxed">
            Add to your home screen for quick access to the docs offline.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-muted hover:text-foreground transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleInstall}
          className="flex-1 text-sm font-medium px-3 py-1.5 bg-foreground text-background rounded-md hover:opacity-90 transition-opacity"
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="text-sm text-muted px-3 py-1.5 hover:text-foreground transition-colors"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
