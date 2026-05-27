import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  canPromptInstall,
  isIOSDevice,
  isStandalone,
  subscribeToInstallChanges,
  triggerInstall,
} from "@/lib/pwaInstall";

const DISMISS_KEY = "tw_install_dismissed_permanent";

function isPermanentlyDismissed(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(DISMISS_KEY) === "1";
}

export function InstallPrompt() {
  const [, force] = useState(0);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    if (isPermanentlyDismissed()) {
      setDismissed(true);
      return;
    }
    const unsub = subscribeToInstallChanges(() => force((n) => n + 1));
    const onInstalled = () => setInstalled(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      unsub();
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || dismissed) return null;

  const iosMode = isIOSDevice();
  const canPrompt = canPromptInstall();
  // Only render when we actually have something to offer.
  if (!canPrompt && !iosMode) return null;

  const handleInstall = async () => {
    const outcome = await triggerInstall();
    if (outcome === "dismissed") {
      // User said "no" to the native dialog — treat that as permanent too.
      localStorage.setItem(DISMISS_KEY, "1");
      setDismissed(true);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-[60] mx-auto max-w-md rounded-xl border-2 border-retro-yellow bg-retro-charcoal/95 p-3 shadow-2xl backdrop-blur-sm md:left-auto md:right-4"
      role="dialog"
      aria-label="Install Total Wins"
      data-testid="install-prompt"
    >
      <div className="flex items-center gap-3">
        <img
          src="/total-wins-icon.png"
          alt=""
          className="h-10 w-10 flex-shrink-0 rounded-lg"
        />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-white text-sm leading-tight">
            Install Total Wins
          </div>
          <div className="text-xs text-white/70 leading-tight mt-0.5">
            Faster launch, reliable notifications
          </div>
        </div>
        {iosMode && !canPrompt ? (
          <Button
            size="sm"
            onClick={() => setShowIOSHelp((v) => !v)}
            className="bg-retro-yellow text-retro-charcoal hover:bg-retro-yellow/90 font-bold"
            data-testid="install-prompt-ios-how"
          >
            How
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleInstall}
            className="bg-retro-yellow text-retro-charcoal hover:bg-retro-yellow/90 font-bold"
            data-testid="install-prompt-accept"
          >
            <Download className="h-4 w-4 mr-1" />
            Install
          </Button>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          className="text-white/60 hover:text-white text-xl leading-none px-1"
          aria-label="Dismiss install prompt"
          data-testid="install-prompt-dismiss"
        >
          ×
        </button>
      </div>
      {iosMode && !canPrompt && showIOSHelp && (
        <div className="mt-3 pt-3 border-t border-white/15 text-xs text-white/85 leading-relaxed">
          <div className="flex items-start gap-2">
            <Share className="h-4 w-4 mt-0.5 flex-shrink-0 text-retro-yellow" />
            <div>
              In Safari: tap the <strong>Share</strong> button at the bottom of
              the screen, then choose <strong>Add to Home Screen</strong>.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
