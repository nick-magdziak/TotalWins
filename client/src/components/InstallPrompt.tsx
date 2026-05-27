import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "tw_install_dismissed_at";
const DISMISS_DAYS = 7;

function isDismissedRecently(): boolean {
  if (typeof localStorage === "undefined") return false;
  const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
  return !!at && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPad on iOS 13+ reports as Mac; check touchpoints to disambiguate.
  const iPadOS =
    /Macintosh/.test(ua) && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOS;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [iosMode, setIosMode] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setInstalled(true);
      return;
    }

    if (isDismissedRecently()) return;

    // iOS Safari never fires beforeinstallprompt, so surface a manual
    // "Add to Home Screen" hint on iOS only.
    if (detectIOS()) {
      setIosMode(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      // Re-check dismiss TTL inside the handler so a late or duplicate
      // event after dismissal can't pop the banner back up.
      if (isDismissedRecently()) return;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setIosMode(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;
  if (!deferredPrompt && !iosMode) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "dismissed") {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      }
    } catch {
      // ignore — browser may have already consumed the prompt
    } finally {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDeferredPrompt(null);
    setIosMode(false);
    setShowIOSHelp(false);
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
        {iosMode ? (
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
      {iosMode && showIOSHelp && (
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
