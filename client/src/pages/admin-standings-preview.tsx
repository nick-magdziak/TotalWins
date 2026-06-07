import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser } from "@/lib/auth";
import { Send, RefreshCw, ArrowLeft, BarChart2 } from "lucide-react";
import { Link } from "wouter";
import type { League } from "@shared/schema";

export default function AdminStandingsPreview() {
  const currentUser = getCurrentUser();
  const { toast } = useToast();
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [isSending, setIsSending] = useState(false);

  if (!currentUser?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-900 via-purple-900 to-blue-900">
        <Card className="bg-gray-900 border-gray-700 text-center p-8">
          <p className="text-red-400 font-bold">Super-admin access required.</p>
          <Link href="/super-admin">
            <Button className="mt-4 bg-retro-purple text-white">Back to Super Admin</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const { data: allLeagues = [] } = useQuery<League[]>({
    queryKey: ["/api/admin/leagues"],
    retry: 2,
  });

  const { data: imageData, isLoading: imageLoading, refetch: refetchImage, error: imageError } = useQuery<{ image: string; memberCount: number }>({
    queryKey: ["/api/leagues", selectedLeagueId, "standings-image"],
    queryFn: async () => {
      const res = await fetch(`/api/leagues/${selectedLeagueId}/standings-image?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? "Failed to load standings image");
      }
      return res.json();
    },
    enabled: !!selectedLeagueId,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  async function handleSendToDiscord() {
    if (!selectedLeagueId) return;
    setIsSending(true);
    try {
      const res = await fetch(`/api/leagues/${selectedLeagueId}/discord-standings-test`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Standings posted!", description: "Check your Discord channel." });
      } else {
        toast({ title: "Failed", description: data.message ?? "Could not post to Discord.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not post to Discord.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  }

  const selectedLeague = allLeagues.find((l: League) => l.id === selectedLeagueId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-900 via-purple-900 to-blue-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/super-admin">
            <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Super Admin
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-yellow-400" />
            <h1 className="text-2xl font-bold text-white retro-font">STANDINGS PREVIEW</h1>
          </div>
        </div>

        <Card className="bg-gray-900 border-gray-700 mb-4">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <label className="text-xs text-gray-400 block mb-1 font-bold">SELECT LEAGUE</label>
                <Select value={selectedLeagueId} onValueChange={setSelectedLeagueId}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                    <SelectValue placeholder={allLeagues.length === 0 ? "Loading leagues…" : "Pick a league…"} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    {allLeagues.map((l: League) => (
                      <SelectItem key={l.id} value={l.id} className="text-white hover:bg-gray-700">
                        {l.name}
                        <span className="ml-2 text-gray-400 text-xs">· {l.sport}</span>
                        {l.discordWebhookUrl && (
                          <span className="ml-1 text-teal-400 text-xs">· Discord ✓</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 shrink-0 mt-4 sm:mt-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-gray-300 hover:text-white"
                  onClick={() => refetchImage()}
                  disabled={!selectedLeagueId || imageLoading}
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${imageLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  className="bg-[#5865F2] hover:bg-[#4752C4] text-white"
                  onClick={handleSendToDiscord}
                  disabled={!selectedLeagueId || isSending || !selectedLeague?.discordWebhookUrl}
                  title={!selectedLeague?.discordWebhookUrl ? "No Discord webhook configured" : ""}
                >
                  <Send className="w-4 h-4 mr-1" />
                  {isSending ? "Sending…" : "Send to Discord"}
                </Button>
              </div>
            </div>

            {imageData && (
              <p className="mt-2 text-xs text-gray-400">
                {imageData.memberCount} players · {selectedLeague?.sport}
              </p>
            )}
            {!selectedLeague?.discordWebhookUrl && selectedLeagueId && (
              <p className="mt-2 text-xs text-yellow-500">No Discord webhook configured — preview only</p>
            )}
          </CardContent>
        </Card>

        {!selectedLeagueId && (
          <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-700 rounded-xl text-gray-500 text-sm">
            Select a league above to preview the standings image
          </div>
        )}

        {selectedLeagueId && imageLoading && (
          <div className="flex items-center justify-center h-64 bg-gray-900 rounded-xl text-gray-400 text-sm">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Generating standings image…
          </div>
        )}

        {selectedLeagueId && !imageLoading && imageError && (
          <div className="flex items-center justify-center h-32 bg-gray-900 rounded-xl text-red-400 text-sm">
            {(imageError as Error).message}
          </div>
        )}

        {imageData?.image && !imageLoading && (
          <div className="rounded-xl overflow-hidden border border-gray-700 shadow-2xl">
            <img
              src={imageData.image}
              alt="Standings"
              className="w-full block"
              style={{ imageRendering: "auto" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
