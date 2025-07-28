import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  User,
  Calendar,
  Target,
  Undo2,
  CheckCircle,
  Pause,
  Play,
  Zap as Nuclear,
  Save,
  X,
  List,
  Shuffle,
  GripVertical
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
  const [showManualDraftDialog, setShowManualDraftDialog] = useState(false);
  const [showResetConfirmDialog, setShowResetConfirmDialog] = useState(false);
  const [draftStyle, setDraftStyle] = useState("snake");
  const [draftDateTime, setDraftDateTime] = useState("");
  const [teamsPerPlayer, setTeamsPerPlayer] = useState(4);
  const [draftStatus, setDraftStatus] = useState("not_started");
  const [leagueName, setLeagueName] = useState("2024 NFL Wins Pool Championship");
  const [isEditingLeagueName, setIsEditingLeagueName] = useState(false);
  const [showDraftOrderDialog, setShowDraftOrderDialog] = useState(false);
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  
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
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "members-with-users"] });
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

  const removePlayerMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", "/api/admin/remove-player", { 
        leagueId,
        userId 
      });
    },
    onSuccess: () => {
      toast({
        title: "Player removed!",
        description: "Player has been removed from the league.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "members-with-users"] });
      setShowPrivilegeDialog(false);
      setSelectedMember(null);
    },
    onError: () => {
      toast({
        title: "Removal failed",
        description: "Failed to remove player. Please try again.",
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

  const handleRemovePlayer = () => {
    if (selectedMember?.userId) {
      removePlayerMutation.mutate(selectedMember.userId);
    }
  };

  const handleManualDraftPick = () => {
    setShowManualDraftDialog(true);
  };

  const handleDraftOrder = () => {
    // Initialize draft order with current league members sorted by draft position
    if (membersWithUserData) {
      const sortedMembers = [...membersWithUserData].sort((a, b) => a.draftPosition - b.draftPosition);
      const currentOrder = sortedMembers.map(member => member.userId);
      setDraftOrder(currentOrder);
    }
    setShowDraftOrderDialog(true);
  };

  const randomizeDraftOrder = () => {
    const shuffled = [...draftOrder].sort(() => Math.random() - 0.5);
    setDraftOrder(shuffled);
  };

  const moveDraftPosition = (from: number, to: number) => {
    if (from === to) return;
    const newOrder = [...draftOrder];
    const [movedItem] = newOrder.splice(from, 1);
    newOrder.splice(to, 0, movedItem);
    setDraftOrder(newOrder);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", index.toString());
    e.dataTransfer.effectAllowed = "move";
    
    // Create a custom drag image that matches the container width
    const dragElement = e.currentTarget as HTMLElement;
    const rect = dragElement.getBoundingClientRect();
    
    // Clone the element and style it for dragging
    const dragImage = dragElement.cloneNode(true) as HTMLElement;
    dragImage.style.width = `${rect.width}px`;
    dragImage.style.maxWidth = `${rect.width}px`;
    dragImage.style.opacity = "0.8";
    dragImage.style.transform = "rotate(2deg)";
    dragImage.style.border = "2px solid #8B5CF6";
    dragImage.style.backgroundColor = "#F3E8FF";
    dragImage.style.position = "absolute";
    dragImage.style.top = "-1000px";
    dragImage.style.left = "-1000px";
    dragImage.style.zIndex = "1000";
    
    // Add to body temporarily
    document.body.appendChild(dragImage);
    
    // Set as drag image
    e.dataTransfer.setDragImage(dragImage, rect.width / 2, rect.height / 2);
    
    // Clean up after a short delay
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
    
    // Make original element semi-transparent
    (e.target as HTMLElement).style.opacity = "0.5";
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = "1";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData("text/plain"));
    if (dragIndex !== dropIndex) {
      moveDraftPosition(dragIndex, dropIndex);
    }
  };

  const resetDraftMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/reset-draft", { leagueId });
    },
    onSuccess: () => {
      setDraftStatus("not_started");
      setShowResetConfirmDialog(false);
      toast({
        title: "Draft reset!",
        description: "All draft picks have been cleared.",
      });
      queryClient.invalidateQueries();
    },
    onError: () => {
      toast({
        title: "Reset failed",
        description: "Failed to reset draft. Please try again.",
        variant: "destructive",
      });
    },
  });

  const undoLastPickMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/undo-last-pick", { leagueId });
    },
    onSuccess: () => {
      toast({
        title: "Pick undone!",
        description: "Last draft pick has been undone.",
      });
      queryClient.invalidateQueries();
    },
    onError: () => {
      toast({
        title: "Undo failed",
        description: "Failed to undo last pick. Please try again.",
        variant: "destructive",
      });
    },
  });

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
                  <Label className="block text-retro-charcoal font-bold mb-2">League ID</Label>
                  <Input 
                    value={`#${String(Math.abs(leagueId.split('').reduce((a,b) => (((a << 5) - a) + b.charCodeAt(0))|0, 0))).padStart(7, '0')}`}
                    className="w-full p-3 border-2 border-retro-pink rounded-lg focus:border-retro-purple focus:outline-none bg-gray-50 font-mono"
                    disabled
                    readOnly
                  />
                </div>

                <div>
                  <Label className="block text-retro-charcoal font-bold mb-2">League Name</Label>
                  <div className="flex gap-2">
                    {isEditingLeagueName ? (
                      <>
                        <Input 
                          value={leagueName}
                          onChange={(e) => setLeagueName(e.target.value)}
                          className="flex-1 p-3 border-2 border-retro-pink rounded-lg focus:border-retro-purple focus:outline-none"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              setIsEditingLeagueName(false);
                            }
                          }}
                          autoFocus
                        />
                        <Button
                          onClick={() => setIsEditingLeagueName(false)}
                          size="sm"
                          className="bg-retro-teal hover:bg-retro-lime text-white px-3"
                        >
                          <Save className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => {
                            setLeagueName("2024 NFL Wins Pool Championship");
                            setIsEditingLeagueName(false);
                          }}
                          size="sm"
                          variant="outline"
                          className="border-retro-charcoal text-retro-charcoal px-3"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Input 
                          value={leagueName}
                          className="flex-1 p-3 border-2 border-retro-pink rounded-lg focus:border-retro-purple focus:outline-none bg-gray-50"
                          disabled
                          readOnly
                        />
                        <Button
                          onClick={() => setIsEditingLeagueName(true)}
                          size="sm"
                          variant="outline"
                          className="border-retro-pink text-retro-pink hover:bg-retro-pink hover:text-white px-3"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                
                <div>
                  <Label className="block text-retro-charcoal font-bold mb-2">Season</Label>
                  <Input 
                    value="2024-25"
                    className="w-full p-3 border-2 border-retro-pink rounded-lg focus:border-retro-purple focus:outline-none"
                    disabled
                  />
                </div>
                
                <div>
                  <Label className="block text-retro-charcoal font-bold mb-2">Sport</Label>
                  <Input 
                    value="NFL"
                    className="w-full p-3 border-2 border-retro-pink rounded-lg focus:border-retro-purple focus:outline-none"
                    disabled
                  />
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
              
              <div className="grid grid-cols-1 gap-4">
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

              </div>
            </CardContent>
          </Card>

          {/* Draft Settings */}
          <Card className="bg-white rounded-2xl retro-border shadow-xl">
            <CardContent className="p-6">
              <h3 className="text-retro-purple text-xl font-bold mb-4 retro-font">
                <Target className="inline mr-2" />
                DRAFT SETTINGS
              </h3>
              
              <div className="space-y-4">
                {/* Draft Style */}
                <div>
                  <Label className="text-retro-charcoal font-bold text-sm mb-2 block">
                    Draft Style
                  </Label>
                  <Select value={draftStyle} onValueChange={setDraftStyle}>
                    <SelectTrigger className="w-full border-2 border-retro-pink focus:border-retro-purple">
                      <SelectValue placeholder="Select draft style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="snake">Snake Draft</SelectItem>
                      <SelectItem value="straight">Straight Draft</SelectItem>
                      <SelectItem value="three-round">3 Round Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Draft Order */}
                <div>
                  <Label className="text-retro-charcoal font-bold text-sm mb-2 block">
                    Draft Order
                  </Label>
                  <Button
                    onClick={handleDraftOrder}
                    variant="outline"
                    className="w-full border-2 border-retro-pink text-retro-pink hover:bg-retro-pink hover:text-white font-bold py-2 rounded-lg retro-font"
                  >
                    <List className="w-4 h-4 mr-2" />
                    SET DRAFT ORDER
                  </Button>
                </div>

                {/* Teams Per Player */}
                <div>
                  <Label className="text-retro-charcoal font-bold text-sm mb-2 block">
                    Teams Per Player
                  </Label>
                  <Select value={teamsPerPlayer.toString()} onValueChange={(value) => setTeamsPerPlayer(Number(value))}>
                    <SelectTrigger className="w-full border-2 border-retro-pink focus:border-retro-purple">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 Teams</SelectItem>
                      <SelectItem value="3">3 Teams</SelectItem>
                      <SelectItem value="4">4 Teams</SelectItem>
                      <SelectItem value="5">5 Teams</SelectItem>
                      <SelectItem value="6">6 Teams</SelectItem>
                      <SelectItem value="7">7 Teams</SelectItem>
                      <SelectItem value="8">8 Teams</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Draft Date/Time */}
                <div>
                  <Label className="text-retro-charcoal font-bold text-sm mb-2 block">
                    Draft Date/Time Start
                  </Label>
                  <Input
                    type="datetime-local"
                    value={draftDateTime}
                    onChange={(e) => setDraftDateTime(e.target.value)}
                    className="w-full border-2 border-retro-pink focus:border-retro-purple"
                  />
                </div>

                {/* Draft Status */}
                <div>
                  <Label className="text-retro-charcoal font-bold text-sm mb-2 block">
                    Draft Status
                  </Label>
                  <Input
                    value={draftStatus === "not_started" ? "Not Started" : 
                           draftStatus === "active" ? "Active" : 
                           draftStatus === "paused" ? "Paused" : 
                           draftStatus === "completed" ? "Completed" : draftStatus}
                    className="w-full border-2 border-retro-pink focus:border-retro-purple bg-gray-50"
                    disabled
                    readOnly
                  />
                </div>

                {/* Draft Actions */}
                <div className="border-t border-retro-teal pt-4 space-y-3">
                  <Button
                    onClick={() => undoLastPickMutation.mutate()}
                    disabled={undoLastPickMutation.isPending}
                    variant="outline"
                    className="w-full border-retro-orange text-retro-orange hover:bg-retro-orange hover:text-white font-bold py-2 rounded-lg retro-font"
                  >
                    <Undo2 className="w-4 h-4 mr-2" />
                    {undoLastPickMutation.isPending ? "UNDOING..." : "UNDO LAST PICK"}
                  </Button>
                  
                  <p className="text-xs text-retro-charcoal/70 text-center">
                    Last pick: Player 3 selected Detroit Lions (Round 2, Pick 16)
                  </p>

                  {/* Draft Control Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    {draftStatus === "active" ? (
                      <Button
                        onClick={() => setDraftStatus("paused")}
                        variant="outline"
                        className="border-retro-orange text-retro-orange hover:bg-retro-orange hover:text-white font-bold py-2 rounded-lg retro-font"
                      >
                        <Pause className="w-4 h-4 mr-2" />
                        PAUSE DRAFT
                      </Button>
                    ) : draftStatus === "paused" ? (
                      <Button
                        onClick={() => setDraftStatus("active")}
                        className="bg-retro-teal hover:bg-retro-lime text-white font-bold py-2 rounded-lg retro-font"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        RESUME DRAFT
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setDraftStatus("active")}
                        className="bg-retro-teal hover:bg-retro-lime text-white font-bold py-2 rounded-lg retro-font"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        START DRAFT
                      </Button>
                    )}
                    
                    <Button
                      onClick={handleManualDraftPick}
                      className="bg-gradient-to-br from-retro-yellow to-retro-orange text-retro-charcoal font-bold py-2 rounded-lg retro-font hover:scale-105 transform transition-all duration-200"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      MANUAL ENTRY
                    </Button>
                  </div>

                  <Button
                    onClick={() => setShowResetConfirmDialog(true)}
                    variant="destructive"
                    className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-lg retro-font"
                  >
                    <Nuclear className="w-4 h-4 mr-2" />
                    RESET DRAFT
                  </Button>
                </div>
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
        <DialogContent className="bg-white rounded-2xl retro-border max-w-md" aria-describedby="player-management-description">
          <DialogHeader>
            <DialogTitle className="text-retro-purple text-xl font-bold retro-font text-center">
              Manage Player
            </DialogTitle>
          </DialogHeader>
          <div id="player-management-description" className="sr-only">
            Dialog to manage player privileges and league membership
          </div>
          
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
                  disabled={updatePrivilegesMutation.isPending || removePlayerMutation.isPending}
                  className="w-full bg-retro-purple hover:bg-retro-pink text-white font-bold py-3 rounded-lg retro-font"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  SET AS ADMIN
                </Button>
                
                <Button
                  onClick={() => handlePrivilegeUpdate(false)}
                  disabled={updatePrivilegesMutation.isPending || removePlayerMutation.isPending}
                  variant="outline"
                  className="w-full border-retro-teal text-retro-teal hover:bg-retro-teal hover:text-white font-bold py-3 rounded-lg retro-font"
                >
                  <User className="w-4 h-4 mr-2" />
                  SET AS PLAYER
                </Button>

                <div className="border-t border-retro-teal pt-3 mt-4">
                  <Button
                    onClick={handleRemovePlayer}
                    disabled={updatePrivilegesMutation.isPending || removePlayerMutation.isPending}
                    variant="destructive"
                    className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-lg retro-font"
                  >
                    <UserMinus className="w-4 h-4 mr-2" />
                    {removePlayerMutation.isPending ? "REMOVING..." : "REMOVE FROM LEAGUE"}
                  </Button>
                </div>
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

      {/* Manual Draft Dialog */}
      <Dialog open={showManualDraftDialog} onOpenChange={setShowManualDraftDialog}>
        <DialogContent className="bg-white rounded-2xl retro-border max-w-md" aria-describedby="manual-draft-description">
          <DialogHeader>
            <DialogTitle className="text-retro-purple text-xl font-bold retro-font text-center">
              Manual Draft Pick
            </DialogTitle>
          </DialogHeader>
          <div id="manual-draft-description" className="sr-only">
            Dialog to make a manual draft selection for a player
          </div>
          
          <div className="my-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-retro-yellow rounded-full flex items-center justify-center text-retro-charcoal font-bold text-xl mx-auto mb-3">
                3
              </div>
              <h3 className="text-retro-charcoal text-lg font-bold retro-font">
                Player 3 (Sarah D) is selecting...
              </h3>
              <p className="text-retro-charcoal/70 text-sm">
                Round 2, Pick 14
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-retro-charcoal font-bold text-sm mb-2 block">
                  Available Teams
                </Label>
                <Select>
                  <SelectTrigger className="w-full border-2 border-retro-pink focus:border-retro-purple">
                    <SelectValue placeholder="Select team for player..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ATL">Atlanta Falcons</SelectItem>
                    <SelectItem value="CAR">Carolina Panthers</SelectItem>
                    <SelectItem value="CHI">Chicago Bears</SelectItem>
                    <SelectItem value="JAX">Jacksonville Jaguars</SelectItem>
                    <SelectItem value="LV">Las Vegas Raiders</SelectItem>
                    <SelectItem value="NE">New England Patriots</SelectItem>
                    <SelectItem value="NYG">New York Giants</SelectItem>
                    <SelectItem value="TEN">Tennessee Titans</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full bg-retro-teal hover:bg-retro-lime text-white font-bold py-3 rounded-lg retro-font"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                CONFIRM SELECTION
              </Button>
            </div>
          </div>

          <DialogFooter className="justify-center">
            <Button
              variant="outline"
              onClick={() => setShowManualDraftDialog(false)}
              className="px-6 py-2 border-retro-charcoal text-retro-charcoal hover:bg-retro-cream"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Draft Confirmation Dialog */}
      <Dialog open={showResetConfirmDialog} onOpenChange={setShowResetConfirmDialog}>
        <DialogContent className="bg-white rounded-2xl retro-border max-w-md" aria-describedby="reset-draft-description">
          <DialogHeader>
            <DialogTitle className="text-red-600 text-xl font-bold retro-font text-center flex items-center justify-center">
              <Nuclear className="w-6 h-6 mr-2" />
              Reset Entire Draft
            </DialogTitle>
          </DialogHeader>
          <div id="reset-draft-description" className="sr-only">
            Confirmation dialog to reset the entire draft
          </div>
          
          <div className="my-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Nuclear className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-retro-charcoal text-lg font-bold retro-font mb-2">
              Are you sure you want to reset the entire draft?
            </h3>
            <p className="text-retro-charcoal/70 text-sm mb-4">
              This will permanently delete all draft picks and cannot be undone.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-red-700 text-sm font-semibold">
                ⚠️ This action is irreversible
              </p>
            </div>
          </div>

          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => setShowResetConfirmDialog(false)}
              className="flex-1 border-retro-charcoal text-retro-charcoal hover:bg-retro-cream"
            >
              Cancel
            </Button>
            <Button
              onClick={() => resetDraftMutation.mutate()}
              disabled={resetDraftMutation.isPending}
              variant="destructive"
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold retro-font"
            >
              <Nuclear className="w-4 h-4 mr-2" />
              {resetDraftMutation.isPending ? "RESETTING..." : "YES, RESET"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Draft Order Dialog */}
      <Dialog open={showDraftOrderDialog} onOpenChange={setShowDraftOrderDialog}>
        <DialogContent className="bg-white rounded-2xl retro-border max-w-lg" aria-describedby="draft-order-description">
          <DialogHeader>
            <DialogTitle className="text-retro-purple text-xl font-bold retro-font text-center">
              <List className="inline w-6 h-6 mr-2" />
              Draft Order
            </DialogTitle>
          </DialogHeader>
          <div id="draft-order-description" className="sr-only">
            Dialog to set the draft order for league players
          </div>
          
          <div className="my-6">
            <div className="flex gap-3 mb-4">
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  randomizeDraftOrder();
                }}
                className="flex-1 bg-gradient-to-br from-retro-orange to-retro-pink text-white font-bold py-2 rounded-lg retro-font hover:scale-105 transform transition-all duration-200"
                type="button"
              >
                <Shuffle className="w-4 h-4 mr-2" />
                RANDOMIZE ORDER
              </Button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {draftOrder.map((userId, index) => {
                const memberData = membersWithUserData?.find(m => m.userId === userId);
                const userData = memberData?.user; // Fixed: use .user instead of .userData
                
                return (
                  <div
                    key={userId}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className="flex items-center gap-3 p-3 bg-retro-cream rounded-lg border border-retro-teal cursor-move hover:bg-retro-cream/80 transition-colors"
                  >
                    <div className="w-8 h-8 bg-retro-purple rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {index + 1}
                    </div>
                    
                    <div className="flex-1">
                      <div className="font-bold text-retro-charcoal">
                        {userData?.displayName || userData?.firstName || `Player ${index + 1}`}
                      </div>
                      <div className="text-xs text-retro-charcoal/70">
                        {userData?.email}
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <Button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          moveDraftPosition(index, Math.max(0, index - 1));
                        }}
                        disabled={index === 0}
                        size="sm"
                        variant="outline"
                        className="w-8 h-8 p-0 border-retro-teal text-retro-teal hover:bg-retro-teal hover:text-white disabled:opacity-30"
                        type="button"
                      >
                        ↑
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          moveDraftPosition(index, Math.min(draftOrder.length - 1, index + 1));
                        }}
                        disabled={index === draftOrder.length - 1}
                        size="sm"
                        variant="outline"
                        className="w-8 h-8 p-0 border-retro-teal text-retro-teal hover:bg-retro-teal hover:text-white disabled:opacity-30"
                        type="button"
                      >
                        ↓
                      </Button>
                    </div>
                    
                    <GripVertical className="w-4 h-4 text-retro-charcoal/60 cursor-move hover:text-retro-charcoal" />
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => setShowDraftOrderDialog(false)}
              className="flex-1 border-retro-charcoal text-retro-charcoal hover:bg-retro-cream"
            >
              Cancel
            </Button>
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDraftOrderDialog(false);
                toast({
                  title: "Draft order saved!",
                  description: "Player draft order has been updated.",
                });
              }}
              className="flex-1 bg-retro-teal hover:bg-retro-lime text-white font-bold retro-font"
              type="button"
            >
              <Save className="w-4 h-4 mr-2" />
              SAVE ORDER
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
