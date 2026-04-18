import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AUTH_STORAGE_KEY, type AuthUser } from "@/lib/auth";

function readUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export default function VerifyEmailBanner() {
  const { toast } = useToast();
  const [user, setUser] = useState<AuthUser | null>(() => readUser());

  useEffect(() => {
    const handler = () => setUser(readUser());
    window.addEventListener("authStateChanged", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("authStateChanged", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const resendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/resend-verification", {});
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to resend email");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Verification email sent",
        description: data.message || "Check your inbox for the verification link.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Could not resend",
        description: err?.message || "Please try again in a few minutes.",
        variant: "destructive",
      });
    },
  });

  if (!user || user.verifiedAt) return null;

  return (
    <div className="bg-yellow-100 border-b border-yellow-300 text-yellow-900 px-4 py-3">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>
            Please verify your email to create or join leagues. Check your inbox for the verification link.
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => resendMutation.mutate()}
          disabled={resendMutation.isPending}
          data-testid="button-resend-verification"
        >
          {resendMutation.isPending ? "Sending..." : "Resend verification email"}
        </Button>
      </div>
    </div>
  );
}
