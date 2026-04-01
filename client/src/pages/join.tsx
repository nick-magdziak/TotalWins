import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Trophy, Users, LogIn, UserPlus, CheckCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Join() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [inviteCode, setInviteCode] = useState<string>("");
  const currentUser = getCurrentUser();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code") || "";
    setInviteCode(code);
  }, []);

  const { data: preview, isLoading, isError } = useQuery<{
    id: string;
    name: string;
    sport: string;
    maxPlayers: number;
    memberCount: number;
  }>({
    queryKey: ["/api/leagues/preview", inviteCode],
    queryFn: async () => {
      const res = await fetch(`/api/leagues/preview?code=${encodeURIComponent(inviteCode)}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Invalid invite code");
      }
      return res.json();
    },
    enabled: inviteCode.length > 0,
    retry: false,
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/leagues/join", {
        inviteCode,
        userId: currentUser!.id,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to join league");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Joined league!",
        description: `You're now a member of ${data.league.name}.`,
      });
      setTimeout(() => {
        window.location.href = "/standings";
      }, 800);
    },
    onError: (error: any) => {
      toast({
        title: "Could not join league",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  const sportEmoji: Record<string, string> = {
    NFL: "🏈",
    MLB: "⚾",
    NBA: "🏀",
    "WORLD_CUP": "⚽",
  };

  if (!inviteCode) {
    return (
      <div className="min-h-screen py-8 px-4 flex items-center justify-center">
        <Card className="bg-white rounded-xl retro-border shadow-2xl w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Trophy className="h-12 w-12 mx-auto text-retro-pink mb-4" />
            <h2 className="text-2xl font-bold retro-font text-retro-charcoal mb-2">INVALID LINK</h2>
            <p className="text-gray-600 mb-6">This invite link is missing a code. Ask your league admin for a fresh invitation.</p>
            <Link href="/">
              <Button className="bg-gradient-to-r from-retro-pink to-retro-purple text-white retro-font">
                Go Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen py-8 px-4 flex items-center justify-center">
        <Card className="bg-white rounded-xl retro-border shadow-2xl w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-retro-charcoal retro-font animate-pulse">LOADING LEAGUE INFO...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !preview) {
    return (
      <div className="min-h-screen py-8 px-4 flex items-center justify-center">
        <Card className="bg-white rounded-xl retro-border shadow-2xl w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Trophy className="h-12 w-12 mx-auto text-retro-pink mb-4" />
            <h2 className="text-2xl font-bold retro-font text-retro-charcoal mb-2">INVITE NOT FOUND</h2>
            <p className="text-gray-600 mb-6">This invite code is invalid or has expired. Ask your league admin for a new invitation.</p>
            <Link href="/">
              <Button className="bg-gradient-to-r from-retro-pink to-retro-purple text-white retro-font">
                Go Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const spotsLeft = preview.maxPlayers - preview.memberCount;
  const isFull = spotsLeft <= 0;

  return (
    <div className="min-h-screen py-8 px-4 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="bg-gradient-to-r from-retro-pink via-retro-purple to-retro-teal p-4 rounded-2xl retro-border">
            <div className="bg-retro-charcoal rounded-xl p-4 bg-opacity-80">
              <h2 className="text-retro-yellow text-2xl font-bold neon-glow retro-font">TOTAL WINS</h2>
              <p className="text-white text-sm font-bold">YOU'VE BEEN INVITED</p>
            </div>
          </div>
        </div>

        <Card className="bg-white rounded-xl retro-border shadow-2xl">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">{sportEmoji[preview.sport] || "🏆"}</div>
              <h3 className="text-2xl font-bold retro-font text-retro-charcoal">{preview.name}</h3>
              <p className="text-retro-purple font-bold">{preview.sport} League</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-600">
                <Users className="h-5 w-5" />
                <span className="font-bold">{preview.memberCount} / {preview.maxPlayers} players</span>
              </div>
              {isFull ? (
                <span className="text-red-600 font-bold text-sm">LEAGUE FULL</span>
              ) : (
                <span className="text-green-600 font-bold text-sm">{spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left</span>
              )}
            </div>

            {joinMutation.isSuccess ? (
              <div className="text-center py-4">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                <p className="font-bold retro-font text-retro-charcoal">JOINED! Redirecting...</p>
              </div>
            ) : currentUser ? (
              <div className="space-y-3">
                <p className="text-center text-gray-600 text-sm mb-4">
                  Joining as <strong>{currentUser.displayName}</strong>
                </p>
                <Button
                  onClick={() => joinMutation.mutate()}
                  disabled={isFull || joinMutation.isPending}
                  className="w-full bg-gradient-to-r from-retro-pink to-retro-purple text-white font-bold text-lg retro-font hover:scale-105 transform transition-all duration-200 neon-glow"
                >
                  {joinMutation.isPending ? "JOINING..." : isFull ? "LEAGUE FULL" : "JOIN LEAGUE"}
                </Button>
                <Link href="/standings">
                  <Button variant="ghost" className="w-full text-gray-500">
                    Cancel
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-center text-gray-600 text-sm mb-4">
                  Sign in or create an account to join this league.
                </p>
                <Link href={`/login?redirect=/join?code=${inviteCode}`}>
                  <Button className="w-full bg-gradient-to-r from-retro-teal to-retro-purple text-white font-bold retro-font">
                    <LogIn className="mr-2 h-5 w-5" />
                    LOG IN TO JOIN
                  </Button>
                </Link>
                <Link href={`/signup?invite=${inviteCode}`}>
                  <Button variant="outline" className="w-full border-2 border-retro-pink text-retro-pink font-bold retro-font hover:bg-retro-pink hover:text-white">
                    <UserPlus className="mr-2 h-5 w-5" />
                    CREATE ACCOUNT & JOIN
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
