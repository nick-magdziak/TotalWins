import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { Trophy, Users, LogIn, UserPlus, CheckCircle, Search } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface LeaguePreview {
  id: string;
  name: string;
  sport: string;
  maxPlayers: number;
  memberCount: number;
}

export default function Join() {
  const { toast } = useToast();
  const currentUser = getCurrentUser();

  // Initialise from URL ?code= if present
  const [codeInput, setCodeInput] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("code") || "";
  });
  // The code we actually use to query (only set when user wants to look up)
  const [activeCode, setActiveCode] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("code") || "";
  });

  const { data: preview, isLoading, isError, error } = useQuery<LeaguePreview>({
    queryKey: ["/api/leagues/preview", activeCode],
    queryFn: async () => {
      const res = await fetch(`/api/leagues/preview?code=${encodeURIComponent(activeCode)}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Invalid invite code");
      }
      return res.json();
    },
    enabled: activeCode.length > 0,
    retry: false,
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/leagues/join", {
        inviteCode: activeCode,
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
        window.location.href = `/standings?league=${data.league.id}`;
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

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = codeInput.trim().toUpperCase();
    if (!trimmed) return;
    setActiveCode(trimmed);
  };

  const sportEmoji: Record<string, string> = {
    NFL: "🏈",
    MLB: "⚾",
    NBA: "🏀",
    WORLD_CUP: "⚽",
  };

  const isFull = preview ? preview.memberCount >= preview.maxPlayers : false;
  const spotsLeft = preview ? preview.maxPlayers - preview.memberCount : 0;

  return (
    <div className="min-h-screen py-8 px-4 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="bg-gradient-to-r from-retro-pink via-retro-purple to-retro-teal p-4 rounded-2xl retro-border">
            <div className="bg-retro-charcoal rounded-xl p-4 bg-opacity-80">
              <h2 className="text-retro-yellow text-2xl font-bold neon-glow retro-font">TOTAL WINS</h2>
              <p className="text-white text-sm font-bold">JOIN A LEAGUE</p>
            </div>
          </div>
        </div>

        <Card className="bg-white rounded-xl retro-border shadow-2xl">
          <CardContent className="p-6 space-y-6">

            {/* Code input — always visible */}
            <form onSubmit={handleLookup}>
              <Label className="block text-retro-charcoal font-bold mb-2 retro-font">
                INVITE CODE
              </Label>
              <div className="flex gap-2">
                <Input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="Enter code (e.g. ABC12345)"
                  className="flex-1 border-2 border-retro-pink focus:border-retro-purple uppercase font-mono text-lg"
                  maxLength={16}
                />
                <Button
                  type="submit"
                  disabled={!codeInput.trim() || isLoading}
                  className="bg-gradient-to-r from-retro-pink to-retro-purple text-white retro-font"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </form>

            {/* Loading state */}
            {isLoading && (
              <p className="text-center text-retro-charcoal retro-font animate-pulse text-sm">
                LOOKING UP LEAGUE...
              </p>
            )}

            {/* Error state */}
            {isError && activeCode && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <Trophy className="h-8 w-8 mx-auto text-red-400 mb-2" />
                <p className="text-red-700 font-bold text-sm">
                  {(error as Error)?.message || "Invalid invite code"}
                </p>
                <p className="text-red-500 text-xs mt-1">Check the code and try again, or ask your league admin for a new link.</p>
              </div>
            )}

            {/* League preview */}
            {preview && (
              <>
                <div className="border-2 border-retro-teal rounded-xl p-4 text-center">
                  <div className="text-4xl mb-2">{sportEmoji[preview.sport] || "🏆"}</div>
                  <h3 className="text-xl font-bold retro-font text-retro-charcoal">{preview.name}</h3>
                  <p className="text-retro-purple font-bold text-sm">{preview.sport} League</p>
                  <div className="mt-3 flex items-center justify-center gap-4">
                    <div className="flex items-center gap-1 text-gray-600 text-sm">
                      <Users className="h-4 w-4" />
                      <span className="font-bold">{preview.memberCount} / {preview.maxPlayers}</span>
                    </div>
                    {isFull ? (
                      <span className="text-red-600 font-bold text-xs bg-red-50 px-2 py-1 rounded">FULL</span>
                    ) : (
                      <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded">
                        {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} open
                      </span>
                    )}
                  </div>
                </div>

                {joinMutation.isSuccess ? (
                  <div className="text-center py-2">
                    <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" />
                    <p className="font-bold retro-font text-retro-charcoal">JOINED! Redirecting...</p>
                  </div>
                ) : currentUser ? (
                  <div className="space-y-2">
                    <p className="text-center text-gray-500 text-sm">
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
                      <Button variant="ghost" className="w-full text-gray-400 text-sm">Cancel</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-center text-gray-600 text-sm">
                      Sign in or create an account to join this league.
                    </p>
                    <Link href={`/login?redirect=/join?code=${activeCode}`}>
                      <Button className="w-full bg-gradient-to-r from-retro-teal to-retro-purple text-white font-bold retro-font">
                        <LogIn className="mr-2 h-5 w-5" />
                        LOG IN TO JOIN
                      </Button>
                    </Link>
                    <Link href={`/signup?invite=${activeCode}`}>
                      <Button variant="outline" className="w-full border-2 border-retro-pink text-retro-pink font-bold retro-font hover:bg-retro-pink hover:text-white">
                        <UserPlus className="mr-2 h-5 w-5" />
                        CREATE ACCOUNT & JOIN
                      </Button>
                    </Link>
                  </div>
                )}
              </>
            )}

            {/* Empty state when no code entered yet */}
            {!activeCode && !isLoading && (
              <p className="text-center text-gray-400 text-sm">
                Enter the invite code from your league invitation to get started.
              </p>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
