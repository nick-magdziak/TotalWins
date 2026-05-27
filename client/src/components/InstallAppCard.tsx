import { useEffect, useState } from "react";
import { Download, Share, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  canPromptInstall,
  isIOSDevice,
  isStandalone,
  subscribeToInstallChanges,
  triggerInstall,
} from "@/lib/pwaInstall";

export function InstallAppCard() {
  const [, force] = useState(0);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const unsub = subscribeToInstallChanges(() => force((n) => n + 1));
    const onInstalled = () => setInstalled(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      unsub();
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const iosMode = isIOSDevice();
  const canPrompt = canPromptInstall();
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isFirefox = /Firefox\//i.test(ua) || /FxiOS\//i.test(ua);
  const isFirefoxAndroid = isFirefox && /Android/i.test(ua);
  const isFirefoxDesktop = isFirefox && !isFirefoxAndroid && !/FxiOS/i.test(ua);

  return (
    <Card data-testid="install-app-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Install Total Wins
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {installed ? (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">Total Wins is installed on this device.</span>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Add Total Wins to your home screen for a faster, full-screen
              experience and more reliable push notifications.
            </p>

            {canPrompt && (
              <Button
                onClick={() => triggerInstall()}
                className="bg-retro-yellow text-retro-charcoal hover:bg-retro-yellow/90 font-bold"
                data-testid="install-app-card-install"
              >
                <Download className="h-4 w-4 mr-2" />
                Install App
              </Button>
            )}

            {!canPrompt && iosMode && (
              <div className="rounded-lg border border-muted bg-muted/30 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <Share className="h-4 w-4 mt-0.5 flex-shrink-0 text-retro-yellow" />
                  <div>
                    <p className="font-medium mb-1">On iPhone / iPad:</p>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>Tap the <strong>Share</strong> button at the bottom of Safari.</li>
                      <li>Choose <strong>Add to Home Screen</strong>.</li>
                      <li>Tap <strong>Add</strong>.</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

            {!canPrompt && !iosMode && isFirefoxDesktop && (
              <div className="rounded-lg border border-muted bg-muted/30 p-3 text-sm text-muted-foreground">
                <p className="mb-1">
                  <strong>Firefox on desktop doesn't support installing web apps.</strong>{" "}
                  To install Total Wins, try one of these instead:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <strong>Chrome, Edge, Brave or Opera (desktop):</strong>{" "}
                    open Total Wins and click the install icon on the right
                    edge of the address bar.
                  </li>
                  <li>
                    <strong>Phone:</strong> open Total Wins in Chrome (Android)
                    or Safari (iPhone) — you'll see an install or "Add to Home
                    Screen" option.
                  </li>
                </ul>
              </div>
            )}

            {!canPrompt && !iosMode && isFirefoxAndroid && (
              <div className="rounded-lg border border-muted bg-muted/30 p-3 text-sm text-muted-foreground">
                <p className="mb-1">
                  <strong>On Firefox for Android:</strong>
                </p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Tap the <strong>⋮</strong> menu in the top-right.</li>
                  <li>Choose <strong>Install</strong> (or <em>Add to Home screen</em>).</li>
                </ol>
                <p className="mt-2 text-xs">
                  For the best experience (reliable push notifications,
                  full-screen mode), we recommend Chrome on Android.
                </p>
              </div>
            )}

            {!canPrompt && !iosMode && !isFirefox && (
              <div className="rounded-lg border border-muted bg-muted/30 p-3 text-sm text-muted-foreground">
                <p className="mb-1">
                  Your browser doesn't show an install button right here, but
                  you can still install:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <strong>Chrome / Edge:</strong> open the browser menu and
                    look for <em>Install app</em> or <em>Add to Home screen</em>.
                  </li>
                  <li>
                    <strong>Desktop Chrome:</strong> click the install icon on
                    the right edge of the address bar.
                  </li>
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
