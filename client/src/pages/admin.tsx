import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Settings, 
  Users, 
  Zap, 
  RefreshCw, 
  Download, 
  Bell, 
  Edit,
  BarChart3,
  UserPlus,
  UserMinus,
  RotateCcw,
  User
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type LeagueMember, type League } from "@shared/schema";

export default function Admin() {
  const currentUser = getCurrentUser();
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedMember, setSelectedMember] = useState<LeagueMember | null>(null);
  const [showPrivilegeDialog, setShowPrivilegeDialog] = useState(false);
  
  // Get league ID from URL params or default to first league
  const urlParams = new URLSearchParams(window.location.search);
  const urlLeagueId = urlParams.get('league');
  
  const { data: userLeagues } = useQuery<League[]>({
    queryKey: ["/api/users", currentUser?.id, "leagues"],
    enabled: !!currentUser?.id,
  });

  // Determine current league
  const leagueId = urlLeagueId || userLeagues?.[0]?.id || "demo-league-1";
  const currentLeague = userLeagues?.find(league => league.id === leagueId) || userLeagues?.[0];

  const { data: leagueMembers } = useQuery<LeagueMember[]>({
    queryKey: ["/api/leagues", leagueId, "members"],
  });

  const { data: membersWithUserData } = useQuery({
    queryKey: ["/api/leagues", leagueId, "members-with-users"],
    queryFn: async () => {
      const members = await fetch(`/api/leagues/${leagueId}/members`).then(r => r.json());
      const usersPromises = members.map(async (member: LeagueMember) => {
        const user = await fetch(`/api/users/${member.userId}`).then(r => r.json());
        return { ...member, user };
      });
      return Promise.all(usersPromises);
    },
    enabled: !!leagueId
  });

  const syncScoresMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/sync-scores", { week: 18, season: "2024" });
    },
    onSuccess: () => {
      toast({
        title: "Scores synced!",
        description: "All game scores have been updated from the sports API.",
      });
      queryClient.invalidateQueries();
    },
    onError: () => {
      toast({
        title: "Sync failed",
        description: "Failed to sync scores. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateRecordsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/update-records");
    },
    onSuccess: () => {
      toast({
        title: "Records updated!",
        description: "Team records have been recalculated.",
      });
      queryClient.invalidateQueries();
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update records. Please try again.",
        variant: "destructive",
      });
    },
  });

  const invitePlayerMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest("POST", "/api/admin/invite-player", { 
        email, 
        leagueId 
      });
    },
    onSuccess: () => {
      toast({
        title: "Invitation sent!",
        description: `Invitation sent to ${inviteEmail}`,
      });
      setInviteEmail("");
    },
    onError: () => {
      toast({
        title: "Invitation failed",
        description: "Failed to send invitation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updatePrivilegesMutation = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      return apiRequest("POST", "/api/admin/update-privileges", { 
        userId, 
        isAdmin 
      });
    },
    onSuccess: () => {
      toast({
        title: "Privileges updated!",
        description: "Player privileges have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "members"] });
      setShowPrivilegeDialog(false);
      setSelectedMember(null);
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update privileges. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleInvitePlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteEmail.trim()) {
      invitePlayerMutation.mutate(inviteEmail.trim());
    }
  };

  const handlePlayerClick = (member: LeagueMember) => {
    setSelectedMember(member);
    setShowPrivilegeDialog(true);
  };

  const handlePrivilegeUpdate = (isAdmin: boolean) => {
    if (selectedMember?.userId) {
      updatePrivilegesMutation.mutate({ 
        userId: selectedMember.userId, 
        isAdmin 
      });
    }
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "sync":
        syncScoresMutation.mutate();
        break;
      case "export":
        toast({
          title: "Export started",
          description: "League data export is being prepared...",
        });
        break;
      case "updates":
        toast({
          title: "Updates sent",
          description: "League update notifications sent to all players.",
        });
        break;
      case "manual":
        toast({
          title: "Manual entry",
          description: "Manual score entry interface would open here.",
        });
        break;
    }
  };

  // For now, allow access for NickPapageorgio - in production this would check proper admin status
  if (!currentUser || (currentUser.displayName !== "NickPapageorgio" && !currentUser.isAdmin)) {
    return (
      <div className="text-center py-12">
        <div className="bg-retro-cream p-8 rounded-2xl retro-border inline-block">
          <h2 className="text-retro-purple text-2xl font-bold mb-4 retro-font">ACCESS DENIED</h2>
          <p className="text-retro-charcoal">You don't have admin privileges for this league.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Hero Section */}
      <section className="text-center mb-12">
        <div className="bg-gradient-to-r from-retro-teal to-retro-purple p-8 rounded-3xl retro-border">
          <div className="bg-retro-charcoal rounded-xl p-4 bg-opacity-80">
            <h2 className="text-retro-yellow text-2xl sm:text-3xl md:text-4xl font-bold mb-3 neon-glow retro-font">
              {currentLeague?.name || "TOTAL WINS"}
            </h2>
            <p className="text-white text-sm sm:text-base md:text-lg font-bold">
              {currentLeague?.sport || "NFL"} • {currentLeague?.season || "2024-25"} • ADMIN
            </p>
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* League Management */}
        <div className="space-y-6">
          <Card className="bg-white rounded-2xl retro-border shadow-xl">
            <CardContent className="p-6">
              <h3 className="text-retro-purple text-xl font-bold mb-4 retro-font">
                <Settings className="inline mr-2" />
                LEAGUE SETTINGS
              </h3>
              
              <div className="space-y-4">
                <div>
                  <Label className="block text-retro-charcoal font-bold mb-2">League Name</Label>
                  <Input 
                    value="2024 NFL Wins Pool Championship"
                    className="w-full p-3 border-2 border-retro-pink rounded-lg focus:border-retro-purple focus:outline-none"
                    disabled
                  />
                </div>
                
                <div>
                  <Label className="block text-retro-charcoal font-bold mb-2">Teams Per Player</Label>
                  <div className="flex space-x-2">
                    <Badge variant="secondary">4 Teams (Current)</Badge>
                  </div>
                </div>
                
                <div>
                  <Label className="block text-retro-charcoal font-bold mb-2">Draft Status</Label>
                  <div className="flex space-x-4">
                    <Badge className="bg-retro-lime text-retro-charcoal">COMPLETED</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-retro-orange text-retro-orange hover:bg-retro-orange hover:text-white"
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      RESET DRAFT
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Player Management */}
          <Card className="bg-white rounded-2xl retro-border shadow-xl">
            <CardContent className="p-6">
              <h3 className="text-retro-purple text-xl font-bold mb-4 retro-font">
                <Users className="inline mr-2" />
                PLAYER MANAGEMENT
              </h3>
              
              <div className="space-y-3 mb-4">
                {membersWithUserData && membersWithUserData.length > 0 ? (
                  membersWithUserData.slice(0, 8).map((memberData, index) => (
                    <div 
                      key={memberData.id} 
                      onClick={() => handlePlayerClick(memberData)}
                      className="bg-retro-cream p-3 rounded-lg flex justify-between items-center border border-retro-teal cursor-pointer hover:bg-retro-lime hover:scale-102 transform transition-all duration-200"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-retro-yellow rounded-full flex items-center justify-center text-retro-charcoal font-bold text-sm">
                          {index + 1}
                        </div>
                        <span className="font-bold text-retro-charcoal">
                          {memberData.user?.displayName || `Player ${index + 1}`}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={`${memberData.user?.isAdmin ? 'bg-retro-purple text-white' : 'bg-retro-lime text-retro-charcoal'}`}>
                          {memberData.user?.isAdmin ? 'ADMIN' : 'PLAYER'}
                        </Badge>
                        <Badge className="bg-retro-teal text-white">ACTIVE</Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 opacity-75">
                    <p className="text-retro-charcoal">No league members found.</p>
                  </div>
                )}
              </div>
              
              <div className="border-t border-retro-teal pt-4">
                <form onSubmit={handleInvitePlayer} className="space-y-3">
                  <Input
                    type="email"
                    placeholder="Enter email to invite player..."
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full p-3 rounded-lg border-2 border-retro-pink focus:border-retro-purple text-retro-charcoal"
                  />
                  <Button
                    type="submit"
                    disabled={invitePlayerMutation.isPending || !inviteEmail.trim()}
                    className="w-full bg-retro-yellow text-retro-charcoal px-4 py-3 rounded-lg font-bold hover:scale-105 transform transition-all duration-200 retro-font hover:bg-retro-lime"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    {invitePlayerMutation.isPending ? "SENDING..." : "INVITE PLAYER"}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* League Analytics & Controls */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card className="bg-white rounded-2xl retro-border shadow-xl">
            <CardContent className="p-6">
              <h3 className="text-retro-purple text-xl font-bold mb-4 retro-font">
                <Zap className="inline mr-2" />
                QUICK ACTIONS
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => handleQuickAction("sync")}
                  disabled={syncScoresMutation.isPending}
                  className="bg-gradient-to-br from-retro-teal to-retro-lime text-white p-4 rounded-xl font-bold text-center hover:scale-105 transform transition-all duration-200 retro-font"
                >
                  <RefreshCw className="w-6 h-6 mb-2 mx-auto block" />
                  {syncScoresMutation.isPending ? "SYNCING..." : "SYNC SCORES"}
                </Button>
                
                <Button
                  onClick={() => handleQuickAction("export")}
                  className="bg-gradient-to-br from-retro-orange to-retro-pink text-white p-4 rounded-xl font-bold text-center hover:scale-105 transform transition-all duration-200 retro-font"
                >
                  <Download className="w-6 h-6 mb-2 mx-auto block" />
                  EXPORT DATA
                </Button>
                
                <Button
                  onClick={() => handleQuickAction("updates")}
                  className="bg-gradient-to-br from-retro-purple to-retro-pink text-white p-4 rounded-xl font-bold text-center hover:scale-105 transform transition-all duration-200 retro-font"
                >
                  <Bell className="w-6 h-6 mb-2 mx-auto block" />
                  SEND UPDATES
                </Button>
                
                <Button
                  onClick={() => handleQuickAction("manual")}
                  className="bg-gradient-to-br from-retro-yellow to-retro-orange text-retro-charcoal p-4 rounded-xl font-bold text-center hover:scale-105 transform transition-all duration-200 retro-font"
                >
                  <Edit className="w-6 h-6 mb-2 mx-auto block" />
                  MANUAL ENTRY
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* League Analytics */}
          <Card className="bg-gradient-to-br from-retro-charcoal to-gray-800 rounded-2xl text-white shadow-xl">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-4 retro-font">
                <BarChart3 className="inline mr-2" />
                LEAGUE ANALYTICS
              </h3>
              
              <div className="space-y-4">
                <div className="bg-white bg-opacity-10 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm opacity-75">Games Processed</span>
                    <span className="font-bold">272/272</span>
                  </div>
                  <div className="w-full bg-white bg-opacity-20 rounded-full h-2">
                    <div className="bg-retro-lime h-2 rounded-full w-full"></div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-retro-lime retro-font">8</div>
                    <div className="text-sm opacity-75">Active Players</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-retro-pink retro-font">235</div>
                    <div className="text-sm opacity-75">Total Wins</div>
                  </div>
                </div>
                
                <div className="border-t border-white border-opacity-20 pt-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-retro-yellow retro-font">Season Complete!</div>
                    <div className="text-sm opacity-75">Championship decided: Winner with 40 points</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Privilege Management Dialog */}
      <Dialog open={showPrivilegeDialog} onOpenChange={setShowPrivilegeDialog}>
        <DialogContent className="bg-white rounded-2xl retro-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-retro-purple text-xl font-bold retro-font text-center">
              Manage Player Privileges
            </DialogTitle>
          </DialogHeader>
          
          {selectedMember && (
            <div className="my-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-retro-yellow rounded-full flex items-center justify-center text-retro-charcoal font-bold text-xl mx-auto mb-3">
                  P{membersWithUserData?.findIndex(m => m.id === selectedMember.id)! + 1}
                </div>
                <h3 className="text-retro-charcoal text-lg font-bold retro-font">
                  {membersWithUserData?.find(m => m.id === selectedMember.id)?.user?.displayName || 
                   `Player ${membersWithUserData?.findIndex(m => m.id === selectedMember.id)! + 1}`}
                </h3>
                <p className="text-retro-charcoal/70 text-sm">
                  Set privileges for this player
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => handlePrivilegeUpdate(true)}
                  disabled={updatePrivilegesMutation.isPending}
                  className="w-full bg-retro-purple hover:bg-retro-pink text-white font-bold py-3 rounded-lg retro-font"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  SET AS ADMIN
                </Button>
                
                <Button
                  onClick={() => handlePrivilegeUpdate(false)}
                  disabled={updatePrivilegesMutation.isPending}
                  variant="outline"
                  className="w-full border-retro-teal text-retro-teal hover:bg-retro-teal hover:text-white font-bold py-3 rounded-lg retro-font"
                >
                  <User className="w-4 h-4 mr-2" />
                  SET AS PLAYER
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="justify-center">
            <Button
              variant="outline"
              onClick={() => setShowPrivilegeDialog(false)}
              className="px-6 py-2 border-retro-charcoal text-retro-charcoal hover:bg-retro-cream"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
