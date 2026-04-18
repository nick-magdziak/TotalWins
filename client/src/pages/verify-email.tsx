import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { setCurrentUser } from "@/lib/auth";

type Status = "verifying" | "success" | "error" | "missing";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setStatus("missing");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest("POST", "/api/auth/verify-email", { token });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setErrorMessage(data.message || "Verification failed.");
          setStatus("error");
          return;
        }
        if (data.user) setCurrentUser(data.user);
        setStatus("success");
        setTimeout(() => setLocation("/standings"), 1500);
      } catch (err: any) {
        if (cancelled) return;
        setErrorMessage(err?.message || "Verification failed.");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center space-y-4">
          {status === "verifying" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <h1 className="text-2xl font-bold">Verifying your email...</h1>
              <p className="text-muted-foreground">Hang tight, this only takes a second.</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
              <h1 className="text-2xl font-bold">Email verified!</h1>
              <p className="text-muted-foreground">Redirecting you into the app...</p>
            </>
          )}
          {status === "error" && (
            <>
              <AlertCircle className="h-12 w-12 mx-auto text-red-500" />
              <h1 className="text-2xl font-bold">Verification failed</h1>
              <p className="text-muted-foreground">{errorMessage}</p>
              <div className="pt-2">
                <Link href="/profile">
                  <Button>Go to Profile</Button>
                </Link>
              </div>
            </>
          )}
          {status === "missing" && (
            <>
              <AlertCircle className="h-12 w-12 mx-auto text-red-500" />
              <h1 className="text-2xl font-bold">Missing verification token</h1>
              <p className="text-muted-foreground">
                The link is incomplete. Please use the button in your verification email.
              </p>
              <div className="pt-2">
                <Link href="/login">
                  <Button>Go to Login</Button>
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
