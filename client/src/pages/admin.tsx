import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  GripVertical,
  Trophy
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type LeagueMember, type League, type DraftStatus } from "@shared/schema";
import { DRAFT_CONFIGURATIONS, getDraftConfigByKey, type DraftConfiguration } from "@shared/draftConfig";

export default function Admin() {
  const currentUser = getCurrentUser();
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [selectedMember, setSelectedMember] = useState<LeagueMember | null>(null);
  const [showPrivilegeDialog, setShowPrivilegeDialog] = useState(false);
  const [showManualDraftDialog, setShowManualDraftDialog] = useState(false);
  const [showResetConfirmDialog, setShowResetConfirmDialog] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [draftConfiguration, setDraftConfiguration] = useState("");
  const [draftDateTime, setDraftDateTime] = useState("");
  const [updateMessage, setUpdateMessage] = useState("");
  const [showSendUpdatesDialog, setShowSendUpdatesDialog] = useState(false);
  const [leagueName, setLeagueName] = useState("2024 NFL Wins Pool Championship");
  const [isEditingLeagueName, setIsEditingLeagueName] = useState(false);
  const [showDraftOrderDialog, setShowDraftOrderDialog] = useState(false);
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [showRolloverDialog, setShowRolloverDialog] = useState(false);
  const [newSeasonLabel, setNewSeasonLabel] = useState("");
  const [rolloverMemberIds, setRolloverMemberIds] = useState<string[]>([]);
  
  // Get league ID from URL params or default to first league
  const urlParams = new URLSearchParams(window.location.search);
  const urlLeagueId = urlParams.get('league');
  
  const { data: userLeagues, isLoading: leaguesLoading } = useQuery<League[]>({
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

  const { data: draftStatus } = useQuery<DraftStatus>({
    queryKey: ["/api/leagues", leagueId, "draft", "status"],
    enabled: !!leagueId,
    refetchInterval: 3000, // Poll every 3 seconds for real-time updates
  });

  const { data: seasonGameStatus } = useQuery<{
    totalGames: number;
    completedGames: number;
    pendingGames: number;
    isComplete: boolean;
  }>({
    queryKey: ["/api/leagues", leagueId, "season-complete"],
    queryFn: () => fetch(`/api/leagues/${leagueId}/season-complete`).then(r => r.json()),
    enabled: !!leagueId,
    refetchInterval: 60000, // Refresh every minute
  });

  // Get last draft pick for display
  const { data: lastPick } = useQuery({
    queryKey: ["/api/leagues", leagueId, "draft", "last-pick"],
    queryFn: async () => {
      const picks = await fetch(`/api/leagues/${leagueId}/draft/picks`).then(r => r.json());
      if (picks.length === 0) return null;
      
      const lastPick = picks[picks.length - 1];
      const user = await fetch(`/api/users/${lastPick.userId}`).then(r => r.json());
      
      // Get team name based on sport
      let team;
      switch (currentLeague?.sport) {
        case 'MLB':
          team = await fetch(`/api/mlb/teams`).then(r => r.json()).then((teams: any[]) => teams.find((t: any) => t.id === lastPick.teamId));
          break;
        case 'NBA':
          team = await fetch(`/api/nba/teams`).then(r => r.json()).then((teams: any[]) => teams.find((t: any) => t.id === lastPick.teamId));
          break;
        case 'WORLD_CUP':
          team = await fetch(`/api/world-cup/teams`).then(r => r.json()).then((teams: any[]) => teams.find((t: any) => t.id === lastPick.teamId));
          break;
        default:
          team = await fetch(`/api/nfl/teams`).then(r => r.json()).then((teams: any[]) => teams.find((t: any) => t.id === lastPick.teamId));
      }
      
      const teamName = team
        ? (currentLeague?.sport === 'WORLD_CUP' ? team.name : `${team.city} ${team.name}`)
        : 'Unknown Team';
      
      return {
        playerName: user.displayName,
        teamName,
        round: lastPick.round,
        pickNumber: lastPick.pickNumber
      };
    },
    enabled: !!leagueId && !!currentLeague,
    refetchInterval: draftStatus?.isActive ? 3000 : 30000, // 3s when active, 30s when inactive
  });

  // Get current draft pick info for Manual Entry dialog
  const { data: currentPickInfo } = useQuery({
    queryKey: ["/api/leagues", leagueId, "draft", "current-pick"],
    queryFn: async () => {
      if (!draftStatus?.isActive || !membersWithUserData) return null;
      
      const picks = await fetch(`/api/leagues/${leagueId}/draft/picks`).then(r => r.json());
      const nextPickNumber = picks.length + 1;
      const round = Math.ceil(nextPickNumber / membersWithUserData.length);
      
      // Calculate whose turn it is based on snake draft
      // Use a large fallback for null positions so unpositioned players sort last
      const playersInOrder = [...membersWithUserData].sort(
        (a, b) => (a.draftPosition ?? 9999) - (b.draftPosition ?? 9999)
      );
      const isOddRound = round % 2 === 1;
      const positionInRound = ((nextPickNumber - 1) % membersWithUserData.length) + 1;
      
      const currentPlayerIndex = isOddRound 
        ? positionInRound - 1 
        : membersWithUserData.length - positionInRound;
      
      const currentPlayer = playersInOrder[currentPlayerIndex];
      
      return {
        player: currentPlayer,
        round,
        pickNumber: nextPickNumber,
        position: positionInRound
      };
    },
    enabled: !!leagueId && !!draftStatus?.isActive && !!membersWithUserData,
    refetchInterval: draftStatus?.isActive ? 3000 : false, // Only poll when draft is active
  });

  // Get available teams for Manual Entry dialog
  const { data: availableTeams } = useQuery({
    queryKey: ["/api/leagues", leagueId, "draft", "available-teams"],
    queryFn: async () => {
      if (!currentLeague?.sport) return [];
      
      const [teams, picks] = await Promise.all([
        fetch(`/api/${currentLeague.sport.toLowerCase()}/teams`).then(r => r.json()),
        fetch(`/api/leagues/${leagueId}/draft/picks`).then(r => r.json())
      ]);
      
      const draftedTeamIds = new Set(picks.map((pick: any) => pick.teamId));
      return teams.filter((team: any) => !draftedTeamIds.has(team.id));
    },
    enabled: !!leagueId && !!currentLeague?.sport,
    refetchInterval: draftStatus?.isActive ? 3000 : 30000, // 3s when active, 30s when inactive
  });

  // League analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery<{
    gamesProcessed: number;
    totalGames: number;
    players: Array<{ userId: string; displayName: string; currentWins: number; maxPossibleWins: number }>;
  }>({
    queryKey: ["/api/leagues", leagueId, "analytics"],
    queryFn: () => fetch(`/api/leagues/${leagueId}/analytics`).then(r => r.json()),
    enabled: !!leagueId,
    refetchInterval: 60000,
  });

  // Manual draft pick mutation
  const manualDraftPickMutation = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      const picks = await fetch(`/api/leagues/${leagueId}/draft/picks`).then(r => r.json());
      const pickNumber = picks.length + 1;
      const round = Math.ceil(pickNumber / (membersWithUserData?.length || 8));
      
      return apiRequest("POST", `/api/leagues/${leagueId}/draft/picks`, {
        userId,
        teamId,
        pickNumber,
        round,
        sport: currentLeague?.sport || 'NFL',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "draft"] });
      setShowManualDraftDialog(false);
      setSelectedTeamId("");
      toast({
        title: "Manual pick successful!",
        description: "The draft pick has been recorded.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Manual pick failed",
        description: error.message || "Failed to record draft pick. Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveDraftOrderMutation = useMutation({
    mutationFn: async (orderedUserIds: string[]) => {
      return apiRequest("POST", "/api/admin/save-draft-order", { leagueId, orderedUserIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "members-with-users"] });
      setShowDraftOrderDialog(false);
      toast({
        title: "Draft order saved!",
        description: "Player draft order has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to save draft order",
        description: "Please try again.",
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

  const saveDraftDateTimeMutation = useMutation({
    mutationFn: async (dateTimeStr: string) => {
      return apiRequest("PATCH", `/api/leagues/${leagueId}`, {
        draftScheduledAt: dateTimeStr ? new Date(dateTimeStr).toISOString() : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", currentUser?.id, "leagues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId] });
      toast({
        title: "Draft date saved!",
        description: "The scheduled draft date/time has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Save failed",
        description: "Failed to save the draft date/time. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateDraftConfigMutation = useMutation({
    mutationFn: async (newDraftConfiguration: string) => {
      return apiRequest("PATCH", `/api/leagues/${leagueId}`, {
        draftConfiguration: newDraftConfiguration
      });
    },
    onSuccess: () => {
      toast({
        title: "Draft configuration updated!",
        description: "The league's draft configuration has been changed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", currentUser?.id, "leagues"] });
      setDraftConfiguration(""); // Reset the form
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update draft configuration. Please try again.",
        variant: "destructive",
      });
    },
  });

  const syncLiveScoresMutation = useMutation({
    mutationFn: async () => {
      if (currentLeague?.sport === 'WORLD_CUP') {
        return apiRequest("POST", "/api/admin/sync-world-cup", {});
      }
      return apiRequest("POST", "/api/admin/sync-live-scores", {});
    },
    onSuccess: (data: any) => {
      const sport = currentLeague?.sport || 'MLB';
      toast({
        title: "Live Scores Synced!",
        description: sport === 'WORLD_CUP'
          ? "World Cup match scores updated from ESPN."
          : sport === 'NBA'
          ? "NBA standings updated with latest game data."
          : sport === 'NFL'
          ? "NFL standings updated with latest game data."
          : "Updated with current MLB season data.",
      });
      queryClient.invalidateQueries();
    },
    onError: () => {
      toast({
        title: "Sync failed",
        description: "Failed to sync live scores. Please try again.",
        variant: "destructive",
      });
    },
  });

  const sendUpdatesMutation = useMutation({
    mutationFn: async ({ leagueId, message }: { leagueId: string; message: string }) => {
      const response = await apiRequest("POST", `/api/leagues/${leagueId}/send-updates`, { message });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as any).message || "Failed to send updates");
      }
      return response.json();
    },
    onSuccess: (data: { sent: number }) => {
      toast({
        title: "Updates sent!",
        description: data.sent > 0
          ? `League update emailed to ${data.sent} player${data.sent !== 1 ? 's' : ''}.`
          : "No players with verified emails found.",
      });
      setUpdateMessage("");
      setShowSendUpdatesDialog(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to send updates",
        description: err.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    },
  });

  const invitePlayerMutation = useMutation({
    mutationFn: async ({ email, name }: { email: string; name: string }) => {
      const response = await fetch("/api/email/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          name,
          leagueId: leagueId,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to send invitation");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation sent!",
        description: `Invitation email sent to ${inviteEmail}`,
      });
      setInviteEmail("");
      setInviteName("");
    },
    onError: () => {
      toast({
        title: "Invitation failed",
        description: "Failed to send invitation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async ({ email, name }: { email: string; name: string }) => {
      const response = await fetch("/api/email/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, leagueId }),
      });
      if (!response.ok) throw new Error("Failed to send invite");
      return response.json();
    },
    onSuccess: (_, { name }) => {
      toast({
        title: "Invite sent!",
        description: `Invitation email sent to ${name}.`,
      });
      setShowPrivilegeDialog(false);
      setSelectedMember(null);
    },
    onError: () => {
      toast({
        title: "Invite failed",
        description: "Could not send the invitation email. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addPlayerNoInviteMutation = useMutation({
    mutationFn: async ({ email, name }: { email: string; name: string }) => {
      const response = await fetch("/api/admin/add-player-no-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, leagueId }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to add player");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Player added!",
        description: `${inviteName} has been added. You can send their invite later.`,
      });
      setInviteEmail("");
      setInviteName("");
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "members-with-users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add player",
        description: error.message || "Please try again.",
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

  const rolloverMutation = useMutation({
    mutationFn: async ({ newSeason, memberUserIds }: { newSeason: string; memberUserIds: string[] }) => {
      const response = await apiRequest("POST", `/api/leagues/${leagueId}/rollover`, { newSeason, memberUserIds });
      if (!response.ok) {
        const err: { message?: string } = await response.json().catch(() => ({}));
        throw new Error(err.message || "Rollover failed");
      }
      return response.json() as Promise<League>;
    },
    onSuccess: (newLeague: League) => {
      toast({
        title: "New season created!",
        description: `${newLeague.name} — ${newLeague.season} is ready. ${rolloverMemberIds.length} member${rolloverMemberIds.length !== 1 ? 's' : ''} carried over.`,
      });
      setShowRolloverDialog(false);
      setNewSeasonLabel("");
      setRolloverMemberIds([]);
      // Navigate to the new league's admin page
      window.location.href = `/admin?league=${newLeague.id}`;
    },
    onError: (err: Error) => {
      toast({
        title: "Rollover failed",
        description: err.message || "Could not create the new season. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleInvitePlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteEmail.trim() && inviteName.trim()) {
      invitePlayerMutation.mutate({ 
        email: inviteEmail.trim(), 
        name: inviteName.trim() 
      });
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
    setSelectedTeamId(""); // Clear previous selection
    setShowManualDraftDialog(true);
  };

  const handleDraftOrder = () => {
    // Initialize draft order with current league members sorted by draft position
    if (membersWithUserData) {
      const sortedMembers = [...membersWithUserData].sort(
        (a, b) => (a.draftPosition ?? 9999) - (b.draftPosition ?? 9999)
      );
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
    dragImage.style.fontFamily = "'RUSSO ONE', 'Arial Black', sans-serif";
    dragImage.style.fontWeight = "bold";
    
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

  const startDraftMutation = useMutation({
    mutationFn: async () => {
      // Validate player count matches draft configuration
      if (currentLeague?.draftConfiguration) {
        const config = getDraftConfigByKey(currentLeague.draftConfiguration);
        if (config) {
          const expectedPlayerCount = config.players;
          const actualPlayerCount = membersWithUserData?.length || 0;
          
          if (expectedPlayerCount !== actualPlayerCount) {
            throw new Error(
              `Player count mismatch: Expected ${expectedPlayerCount} players for "${config.label}" but found ${actualPlayerCount} players in league. Please adjust the player count or change the draft configuration.`
            );
          }
        }
      }
      
      return apiRequest("POST", `/api/leagues/${leagueId}/draft/start`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "draft"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId] });
      toast({
        title: "Draft Started!",
        description: "The draft is now active. Players can begin drafting!",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Could not start the draft. Please try again.";
      
      // Check if it's a player count mismatch error
      if (errorMessage.includes("Player count mismatch")) {
        toast({
          title: "Failed to start draft",
          description: "Make sure the player count in the draft configuration matches the player count of the league.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to start draft", 
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
  });

  const pauseDraftMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/leagues/${leagueId}/draft/pause`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "draft"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", currentUser?.id, "leagues"] });
      toast({ title: "Draft Paused", description: "The draft is now paused. No picks can be made." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to pause draft.", variant: "destructive" });
    },
  });

  const resumeDraftMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/leagues/${leagueId}/draft/resume`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "draft"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", currentUser?.id, "leagues"] });
      toast({ title: "Draft Resumed", description: "The draft is now active. Players can make picks!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to resume draft.", variant: "destructive" });
    },
  });

  // League update mutation
  const updateLeagueMutation = useMutation({
    mutationFn: async (updates: { name?: string }) => {
      const response = await fetch(`/api/leagues/${leagueId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        throw new Error('Failed to update league');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "League updated!",
        description: "League name has been updated successfully.",
      });
      // Invalidate relevant queries to refresh all screens
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", currentUser?.id, "leagues"] });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update league. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update local state when currentLeague changes
  useEffect(() => {
    if (currentLeague?.name && currentLeague.name !== leagueName) {
      setLeagueName(currentLeague.name);
    }
  }, [currentLeague?.name]);

  // Pre-populate draft date/time from saved league value
  useEffect(() => {
    if (currentLeague?.draftScheduledAt) {
      const d = new Date(currentLeague.draftScheduledAt);
      // datetime-local expects "YYYY-MM-DDTHH:MM"
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setDraftDateTime(local);
    }
  }, [currentLeague?.draftScheduledAt]);

  const handleExportData = async () => {
    try {
      const response = await fetch(`/api/leagues/${leagueId}/export`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      a.download = match ? match[1] : "league_standings.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Export downloaded!",
        description: "League standings have been exported as a CSV file.",
      });
    } catch {
      toast({
        title: "Export failed",
        description: "Failed to export league data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "export":
        handleExportData();
        break;
      case "updates":
        setShowSendUpdatesDialog(true);
        break;
    }
  };

  const isLeagueAdmin = currentUser?.isAdmin || currentLeague?.createdBy === currentUser?.id;

  // Wait for league data to load before checking admin access
  if (!currentUser || (userLeagues !== undefined && !isLeagueAdmin)) {
    return (
      <div className="text-center py-12">
        <div className="bg-retro-cream p-8 rounded-2xl retro-border inline-block">
          <h2 className="text-retro-purple text-2xl font-bold mb-4 retro-font">ACCESS DENIED</h2>
          <p className="text-retro-charcoal">You don't have admin privileges for this league.</p>
        </div>
      </div>
    );
  }

  const getSeasonPeriodLabel = (sport?: string) => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    switch(sport) {
      case 'WORLD_CUP': {
        if (year < 2026 || (year === 2026 && month < 6)) return 'STARTS JUNE 11, 2026';
        if (year === 2026 && month >= 6 && month <= 7) return 'TOURNAMENT LIVE';
        return 'TOURNAMENT COMPLETE';
      }
      case 'NFL': {
        const seasonStartYear = month >= 9 ? year : year - 1;
        const seasonStart = new Date(seasonStartYear, 8, 4);
        while (seasonStart.getDay() !== 4) seasonStart.setDate(seasonStart.getDate() + 1);
        const seasonEnd = new Date(seasonStart);
        seasonEnd.setDate(seasonEnd.getDate() + 18 * 7);
        if (now < seasonStart) {
          const nextStart = new Date(year, 8, 4);
          while (nextStart.getDay() !== 4) nextStart.setDate(nextStart.getDate() + 1);
          const mo = nextStart.toLocaleString('en-US', { month: 'short' }).toUpperCase();
          return `STARTS ${mo} ${nextStart.getDate()}, ${year}`;
        }
        if (now > seasonEnd) return 'SEASON COMPLETE';
        const diffDays = Math.ceil((now.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));
        const currentWeek = Math.min(Math.max(1, Math.ceil(diffDays / 7)), 18);
        return `WEEK ${currentWeek} LIVE`;
      }
      case 'MLB': {
        const mlbStart = new Date(year, 2, 27);
        const mlbEnd = new Date(year, 8, 28);
        if (now < mlbStart) return `STARTS MAR 27, ${year}`;
        if (now > mlbEnd) return 'SEASON COMPLETE';
        return 'SEASON ACTIVE';
      }
      case 'NBA': {
        const nbaSeasonYear = month >= 10 ? year : year - 1;
        const nbaStart = new Date(nbaSeasonYear, 9, 23);
        const nbaEnd = new Date(nbaSeasonYear + 1, 3, 13);
        if (now < nbaStart) return `STARTS OCT 23, ${nbaSeasonYear}`;
        if (now > nbaEnd) return 'SEASON COMPLETE';
        return 'SEASON ACTIVE';
      }
      default: return 'SEASON ACTIVE';
    }
  };

  const formatDraftDate = (draftScheduledAt?: string | Date | null) => {
    if (!draftScheduledAt) return null;
    const d = new Date(draftScheduledAt);
    const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const day = d.getDate();
    const time = d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `DRAFT ${month} ${day} · ${time}`;
  };

  const getDraftStatusLabel = (status?: string, sport?: string) => {
    if (status === 'active') return 'DRAFT IN PROGRESS';
    if (status === 'completed') return getSeasonPeriodLabel(sport);
    return 'DRAFT NOT STARTED';
  };

  const getDraftStatusClass = (status?: string) => {
    if (status === 'active') return 'bg-orange-500 text-white animate-pulse';
    if (status === 'completed') return 'bg-retro-teal text-white';
    return 'bg-gray-500 text-white';
  };

  const getTealBadgeLabel = (status?: string, sport?: string, draftScheduledAt?: string | Date | null) => {
    if (status === 'completed') return null;
    if (status !== 'active' && draftScheduledAt) return formatDraftDate(draftScheduledAt);
    return getSeasonPeriodLabel(sport);
  };

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
              {currentLeague?.sport === 'WORLD_CUP' ? 'WORLD CUP' : (currentLeague?.sport || "NFL")} • {currentLeague?.season || "2024-25"} • ADMIN
            </p>
            <div className="mt-3 flex flex-row items-center justify-center gap-3">
              <Badge className={`px-3 py-1 rounded-full font-bold text-xs ${getDraftStatusClass(currentLeague?.draftStatus)}`}>
                {getDraftStatusLabel(currentLeague?.draftStatus, currentLeague?.sport)}
              </Badge>
              {getTealBadgeLabel(currentLeague?.draftStatus, currentLeague?.sport, currentLeague?.draftScheduledAt) && (
                <Badge className="bg-retro-teal text-white px-3 py-1 rounded-full font-bold text-xs">
                  {getTealBadgeLabel(currentLeague?.draftStatus, currentLeague?.sport, currentLeague?.draftScheduledAt)}
                </Badge>
              )}
            </div>
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
                              updateLeagueMutation.mutate({ name: leagueName });
                              setIsEditingLeagueName(false);
                            }
                          }}
                          autoFocus
                        />
                        <Button
                          onClick={() => {
                            updateLeagueMutation.mutate({ name: leagueName });
                            setIsEditingLeagueName(false);
                          }}
                          size="sm"
                          className="bg-retro-teal hover:bg-retro-lime text-white px-3"
                          disabled={updateLeagueMutation.isPending}
                        >
                          <Save className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => {
                            setLeagueName(currentLeague?.name || "2024 NFL Wins Pool Championship");
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
                    value={currentLeague?.season || "2024-25"}
                    className="w-full p-3 border-2 border-retro-pink rounded-lg focus:border-retro-purple focus:outline-none"
                    disabled
                  />
                </div>
                
                <div>
                  <Label className="block text-retro-charcoal font-bold mb-2">Sport</Label>
                  <Input 
                    value={currentLeague?.sport === 'WORLD_CUP' ? 'WORLD CUP' : (currentLeague?.sport || "NFL")}
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
                        <Badge className={memberData.invitationStatus === "pending" ? "bg-orange-500 text-white" : "bg-retro-teal text-white"}>
                          {memberData.invitationStatus === "pending" ? "PENDING" : "ACTIVE"}
                        </Badge>
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
                    type="text"
                    placeholder="Enter player name..."
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="w-full p-3 rounded-lg border-2 border-retro-pink focus:border-retro-purple text-retro-charcoal"
                  />
                  <Input
                    type="email"
                    placeholder="Enter email address..."
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full p-3 rounded-lg border-2 border-retro-pink focus:border-retro-purple text-retro-charcoal"
                  />
                  <Button
                    type="submit"
                    disabled={invitePlayerMutation.isPending || addPlayerNoInviteMutation.isPending || !inviteEmail.trim() || !inviteName.trim()}
                    className="w-full bg-retro-yellow text-retro-charcoal px-4 py-3 rounded-lg font-bold hover:scale-105 transform transition-all duration-200 retro-font hover:bg-retro-lime"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    {invitePlayerMutation.isPending ? "SENDING..." : "INVITE PLAYER"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      if (inviteEmail.trim() && inviteName.trim()) {
                        addPlayerNoInviteMutation.mutate({ email: inviteEmail.trim(), name: inviteName.trim() });
                      }
                    }}
                    disabled={addPlayerNoInviteMutation.isPending || invitePlayerMutation.isPending || !inviteEmail.trim() || !inviteName.trim()}
                    className="w-full bg-retro-purple text-white px-4 py-3 rounded-lg font-bold hover:scale-105 transform transition-all duration-200 retro-font hover:opacity-90"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    {addPlayerNoInviteMutation.isPending ? "ADDING..." : "ADD & INVITE LATER"}
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
                  onClick={() => syncLiveScoresMutation.mutate()}
                  disabled={syncLiveScoresMutation.isPending}
                  className="bg-gradient-to-br from-retro-pink to-retro-purple text-white p-4 rounded-xl font-bold text-center hover:scale-105 transform transition-all duration-200 retro-font shadow-lg"
                >
                  <Trophy className={`w-6 h-6 mb-2 mx-auto block ${syncLiveScoresMutation.isPending ? 'animate-pulse' : ''}`} />
                  {syncLiveScoresMutation.isPending ? "SYNCING LIVE..." : "SYNC LIVE SCORES"}
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
                {/* Current Draft Configuration */}
                <div>
                  <Label className="text-retro-charcoal font-bold text-sm mb-2 block">
                    Current Draft Configuration
                  </Label>
                  {currentLeague?.draftConfiguration ? (
                    (() => {
                      const config = getDraftConfigByKey(currentLeague.draftConfiguration);
                      return config ? (
                        <div className="w-full border-2 border-retro-pink rounded-lg p-3 bg-gray-50">
                          <div className="font-medium text-retro-purple">{config.label}</div>
                          {config.draftStyle.startsWith('custom') ? (
                            <div className="text-sm text-gray-500">(custom config)</div>
                          ) : (
                            <div className="text-sm text-gray-600">(snake draft)</div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full border-2 border-retro-pink rounded-lg p-3 bg-gray-50 text-gray-500">
                          Unknown configuration: {currentLeague.draftConfiguration}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="w-full border-2 border-retro-pink rounded-lg p-3 bg-gray-50 text-gray-500">
                      No draft configuration set
                    </div>
                  )}
                </div>

                {/* Update Draft Configuration */}
                <div>
                  <Label className="text-retro-charcoal font-bold text-sm mb-2 block">
                    Update Draft Configuration
                  </Label>
                  <Select value={draftConfiguration} onValueChange={setDraftConfiguration}>
                    <SelectTrigger className="w-full border-2 border-retro-pink focus:border-retro-purple">
                      <SelectValue placeholder="Select new configuration" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentLeague?.sport && DRAFT_CONFIGURATIONS[currentLeague.sport]?.map((config) => (
                        <SelectItem key={config.key} value={config.key}>
                          <div className="flex flex-col">
                            <span className="font-medium">{config.label}</span>
                            {config.draftStyle.startsWith('custom') ? (
                              <span className="text-sm text-gray-500">(custom config)</span>
                            ) : (
                              <span className="text-sm text-gray-600">(snake draft)</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {draftConfiguration && draftConfiguration !== currentLeague?.draftConfiguration && (
                    <Button
                      onClick={() => updateDraftConfigMutation.mutate(draftConfiguration)}
                      disabled={updateDraftConfigMutation.isPending}
                      className="w-full bg-gradient-to-br from-retro-purple to-retro-pink text-white font-bold py-2 rounded-lg retro-font mt-2"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {updateDraftConfigMutation.isPending ? "UPDATING..." : "UPDATE DRAFT CONFIG"}
                    </Button>
                  )}
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

                {/* Draft Date/Time */}
                <div>
                  <Label className="text-retro-charcoal font-bold text-sm mb-2 block">
                    Draft Date/Time Start
                  </Label>
                  <Input
                    type="datetime-local"
                    value={draftDateTime}
                    onChange={(e) => setDraftDateTime(e.target.value)}
                    onBlur={(e) => {
                      if (e.target.value) saveDraftDateTimeMutation.mutate(e.target.value);
                    }}
                    className="w-full border-2 border-retro-pink focus:border-retro-purple"
                  />
                  {saveDraftDateTimeMutation.isPending && (
                    <p className="text-xs text-retro-teal mt-1 retro-font">Saving...</p>
                  )}
                </div>

                {/* Draft Status */}
                <div>
                  <Label className="text-retro-charcoal font-bold text-sm mb-2 block">
                    Draft Status
                  </Label>
                  <Input
                    value={draftStatus?.isPaused
                      ? "Paused"
                      : draftStatus?.isActive 
                      ? "In Progress" 
                      : currentLeague?.draftStatus === "completed" 
                        ? "Completed" 
                        : "Not Started"}
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
                    {lastPick 
                      ? `Last pick: ${lastPick.playerName} selected ${lastPick.teamName} (Round ${lastPick.round}, Pick ${lastPick.pickNumber})`
                      : "Last Pick: none"
                    }
                  </p>

                  {/* Draft Control Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    {currentLeague?.draftStatus === "active" ? (
                      <Button
                        onClick={() => pauseDraftMutation.mutate()}
                        disabled={pauseDraftMutation.isPending}
                        variant="outline"
                        className="border-retro-orange text-retro-orange hover:bg-retro-orange hover:text-white font-bold py-2 rounded-lg retro-font"
                      >
                        <Pause className="w-4 h-4 mr-2" />
                        {pauseDraftMutation.isPending ? "PAUSING..." : "PAUSE DRAFT"}
                      </Button>
                    ) : currentLeague?.draftStatus === "paused" ? (
                      <Button
                        onClick={() => resumeDraftMutation.mutate()}
                        disabled={resumeDraftMutation.isPending}
                        className="bg-retro-teal hover:bg-retro-lime text-white font-bold py-2 rounded-lg retro-font"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        {resumeDraftMutation.isPending ? "RESUMING..." : "RESUME DRAFT"}
                      </Button>
                    ) : currentLeague?.draftStatus === "pending" ? (
                      <Button
                        onClick={() => startDraftMutation.mutate()}
                        disabled={startDraftMutation.isPending}
                        className="bg-retro-teal hover:bg-retro-lime text-white font-bold py-2 rounded-lg retro-font"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        {startDraftMutation.isPending ? "STARTING..." : "START DRAFT"}
                      </Button>
                    ) : (
                      <Button
                        disabled
                        variant="outline"
                        className="border-gray-400 text-gray-400 font-bold py-2 rounded-lg retro-font opacity-50 cursor-not-allowed"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        DRAFT COMPLETE
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

                {/* Season Rollover */}
                <div className="border-t border-gray-200 pt-4">
                  <Label className="text-retro-charcoal font-bold text-sm mb-2 block">
                    Season Management
                  </Label>
                  <Button
                    onClick={() => {
                      // Try to derive next season from current league season string
                      const currentSeason = currentLeague?.season ?? "";
                      let defaultSeason = "";
                      // Pattern "YYYY-YY" or "YYYY-YYYY" → increment both years
                      const dashMatch = currentSeason.match(/^(\d{4})-(\d{2,4})$/);
                      if (dashMatch) {
                        const startYr = parseInt(dashMatch[1], 10) + 1;
                        const endSuffix = String(startYr + 1).slice(-dashMatch[2].length);
                        defaultSeason = `${startYr}-${endSuffix}`;
                      } else {
                        // Pattern "YYYY" → increment
                        const yearMatch = currentSeason.match(/^(\d{4})$/);
                        if (yearMatch) {
                          defaultSeason = String(parseInt(yearMatch[1], 10) + 1);
                        } else {
                          // Fallback to date-based heuristic
                          const sport = currentLeague?.sport || 'NFL';
                          const now = new Date();
                          const yr = now.getFullYear();
                          defaultSeason = (sport === 'NFL' || sport === 'NBA')
                            ? `${yr}-${String(yr + 1).slice(-2)}`
                            : String(yr + 1);
                        }
                      }
                      setNewSeasonLabel(defaultSeason);
                      // Pre-check all current members
                      const allIds = (membersWithUserData ?? []).map((m: LeagueMember & { user?: { id?: string } }) => m.userId ?? "").filter(Boolean);
                      setRolloverMemberIds(allIds);
                      setShowRolloverDialog(true);
                    }}
                    disabled={!seasonGameStatus?.isComplete}
                    variant="outline"
                    className="w-full border-2 border-retro-purple text-retro-purple hover:bg-retro-purple hover:text-white font-bold py-2 rounded-lg retro-font disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-retro-purple"
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    START NEW SEASON
                  </Button>
                  {seasonGameStatus && !seasonGameStatus.isComplete ? (
                    <p className="text-xs text-amber-600 mt-1 text-center font-medium">
                      {seasonGameStatus.pendingGames} game{seasonGameStatus.pendingGames !== 1 ? 's' : ''} still pending — available when all games are complete
                    </p>
                  ) : seasonGameStatus?.isComplete ? (
                    <p className="text-xs text-green-600 mt-1 text-center font-medium">
                      All {seasonGameStatus.completedGames} games complete — ready to start a new season
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1 text-center">
                      Available when all season games are processed
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* League Analytics */}
          <Card className="bg-white rounded-2xl retro-border shadow-xl">
            <CardContent className="p-6">
              <h3 className="text-retro-purple text-xl font-bold mb-4 retro-font">
                <BarChart3 className="inline mr-2" />
                LEAGUE ANALYTICS
              </h3>
              
              <div className="space-y-4">
                {/* Games Processed Tile */}
                <div className="bg-retro-cream p-4 rounded-lg retro-border">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-retro-charcoal retro-font">Games Processed</span>
                    {analyticsLoading ? (
                      <span className="font-bold text-retro-purple retro-font animate-pulse">—/—</span>
                    ) : (
                      <span className="font-bold text-retro-purple retro-font">
                        {analytics?.gamesProcessed ?? 0}/{analytics?.totalGames ?? 0}
                      </span>
                    )}
                  </div>
                  <div className="w-full bg-retro-pink bg-opacity-20 rounded-full h-2">
                    <div
                      className="bg-retro-lime h-2 rounded-full transition-all duration-500"
                      style={{
                        width: analytics && analytics.totalGames > 0
                          ? `${Math.round((analytics.gamesProcessed / analytics.totalGames) * 100)}%`
                          : '0%'
                      }}
                    />
                  </div>
                </div>

                {/* Player Standings Tile */}
                <div className="bg-retro-cream rounded-lg retro-border overflow-hidden">
                  <div className="grid grid-cols-3 gap-0 px-4 py-2 border-b border-retro-purple/20">
                    <span className="text-xs text-retro-charcoal/60 retro-font font-bold">PLAYER</span>
                    <span className="text-xs text-retro-charcoal/60 retro-font font-bold text-center">
                      {currentLeague?.sport === 'WORLD_CUP' ? 'PTS' : 'WINS'}
                    </span>
                    <span className="text-xs text-retro-charcoal/60 retro-font font-bold text-right">
                      {currentLeague?.sport === 'WORLD_CUP' ? 'MAX PTS' : 'MAX'}
                    </span>
                  </div>
                  {analyticsLoading ? (
                    <div className="space-y-2 p-4">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-5 bg-retro-purple/10 rounded animate-pulse" />
                      ))}
                    </div>
                  ) : analytics?.players && analytics.players.length > 0 ? (
                    <div className="divide-y divide-retro-purple/10">
                      {analytics.players.map((player, idx) => (
                        <div key={player.userId} className="grid grid-cols-3 gap-0 px-4 py-2.5 items-center">
                          <span className="text-sm text-retro-charcoal retro-font truncate pr-2">
                            {player.displayName}
                          </span>
                          <span className="text-sm font-bold text-retro-purple retro-font text-center">
                            {player.currentWins}
                          </span>
                          <span className="text-sm text-retro-charcoal/50 retro-font text-right">
                            {player.maxPossibleWins}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-retro-charcoal/50 retro-font">
                      No player data available
                    </div>
                  )}
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
                <p className="text-retro-charcoal/60 text-sm">
                  {membersWithUserData?.find(m => m.id === selectedMember.id)?.user?.email || "No email available"}
                </p>
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

                {(() => {
                  const memberData = membersWithUserData?.find(m => m.id === selectedMember.id);
                  const email = memberData?.user?.email;
                  const name = memberData?.user?.displayName;
                  if (!email || !name) return null;
                  return (
                    <Button
                      onClick={() => resendInviteMutation.mutate({ email, name })}
                      disabled={resendInviteMutation.isPending || updatePrivilegesMutation.isPending || removePlayerMutation.isPending}
                      className="w-full bg-retro-yellow text-retro-charcoal hover:bg-retro-lime font-bold py-3 rounded-lg retro-font"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      {resendInviteMutation.isPending ? "SENDING..." : "RESEND INVITE"}
                    </Button>
                  );
                })()}

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
                {currentPickInfo?.position || "?"}
              </div>
              <h3 className="text-retro-charcoal text-lg font-bold retro-font">
                {currentPickInfo?.player?.user?.displayName 
                  ? `${currentPickInfo.player.user.displayName} is selecting...`
                  : "Waiting for draft to start..."
                }
              </h3>
              <p className="text-retro-charcoal/70 text-sm">
                {currentPickInfo 
                  ? `Round ${currentPickInfo.round}, Pick ${currentPickInfo.pickNumber}`
                  : "Draft not active"
                }
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-retro-charcoal font-bold text-sm mb-2 block">
                  Available Teams
                </Label>
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger className="w-full border-2 border-retro-pink focus:border-retro-purple">
                    <SelectValue placeholder="Select team for player..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTeams?.map((team: any) => (
                      <SelectItem key={team.id} value={team.id}>
                        {currentLeague?.sport === 'WORLD_CUP' ? team.name : `${team.city} ${team.name}`}
                      </SelectItem>
                    ))}
                    {(!availableTeams || availableTeams.length === 0) && (
                      <SelectItem value="no-teams" disabled>
                        No teams available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full bg-retro-teal hover:bg-retro-lime text-white font-bold py-3 rounded-lg retro-font"
                onClick={() => {
                  if (selectedTeamId && currentPickInfo?.player?.userId) {
                    manualDraftPickMutation.mutate({
                      teamId: selectedTeamId,
                      userId: currentPickInfo.player.userId
                    });
                  }
                }}
                disabled={!selectedTeamId || manualDraftPickMutation.isPending}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {manualDraftPickMutation.isPending ? "CONFIRMING..." : "CONFIRM SELECTION"}
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
                saveDraftOrderMutation.mutate(draftOrder);
              }}
              disabled={saveDraftOrderMutation.isPending}
              className="flex-1 bg-retro-teal hover:bg-retro-lime text-white font-bold retro-font"
              type="button"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveDraftOrderMutation.isPending ? "SAVING..." : "SAVE ORDER"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start New Season Dialog */}
      <Dialog open={showRolloverDialog} onOpenChange={(open) => {
        setShowRolloverDialog(open);
        if (!open) { setNewSeasonLabel(""); setRolloverMemberIds([]); }
      }}>
        <DialogContent className="bg-white rounded-2xl retro-border max-w-md" aria-describedby="rollover-description">
          <DialogHeader>
            <DialogTitle className="text-retro-purple text-xl font-bold retro-font text-center">
              START NEW SEASON
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2" id="rollover-description">
            <p className="text-sm text-gray-600">
              This creates a fresh <strong>{currentLeague?.name}</strong> season.
              Existing season data is preserved. Wins reset to zero; draft positions reset.
            </p>

            {/* View-only: current season info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Current Season
                </Label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 retro-font">
                  {currentLeague?.season || "—"}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  League Type
                </Label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 retro-font">
                  {currentLeague?.sport === 'WORLD_CUP' ? 'World Cup' : (currentLeague?.sport || "NFL")}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                New Season Label
              </Label>
              <Input
                value={newSeasonLabel}
                onChange={(e) => setNewSeasonLabel(e.target.value)}
                placeholder="e.g. 2026-27"
                className="border-2 border-retro-purple focus:border-retro-pink"
                autoFocus
              />
            </div>

            {/* Member carryover checkboxes */}
            {membersWithUserData && membersWithUserData.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Members to Carry Over
                  </Label>
                  <button
                    type="button"
                    className="text-xs text-retro-purple hover:underline"
                    onClick={() => {
                      const allIds = membersWithUserData.map((m: LeagueMember & { user?: { id?: string; displayName?: string } }) => m.userId ?? "").filter(Boolean);
                      setRolloverMemberIds(rolloverMemberIds.length === allIds.length ? [] : allIds);
                    }}
                  >
                    {rolloverMemberIds.length === membersWithUserData.length ? "Deselect all" : "Select all"}
                  </button>
                </div>
                <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                  {membersWithUserData.map((m: LeagueMember & { user?: { displayName?: string } }) => {
                    const uid = m.userId ?? "";
                    const checked = rolloverMemberIds.includes(uid);
                    const isCreator = uid === currentLeague?.createdBy;
                    return (
                      <label key={uid} className={`flex items-center gap-3 px-3 py-2 ${isCreator ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:bg-gray-50'}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isCreator}
                          onChange={() => {
                            if (!isCreator) {
                              setRolloverMemberIds(prev =>
                                checked ? prev.filter(id => id !== uid) : [...prev, uid]
                              );
                            }
                          }}
                          className="accent-retro-purple"
                        />
                        <span className="text-sm font-medium">{m.user?.displayName || uid}</span>
                        {isCreator && <span className="text-xs text-gray-400 ml-auto">(creator)</span>}
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400">{rolloverMemberIds.length} of {membersWithUserData.length} members selected</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowRolloverDialog(false);
                setNewSeasonLabel("");
                setRolloverMemberIds([]);
              }}
              disabled={rolloverMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newSeasonLabel.trim()) {
                  rolloverMutation.mutate({ newSeason: newSeasonLabel.trim(), memberUserIds: rolloverMemberIds });
                }
              }}
              disabled={rolloverMutation.isPending || !newSeasonLabel.trim() || rolloverMemberIds.length === 0}
              className="bg-gradient-to-r from-retro-purple to-retro-pink text-white font-bold retro-font"
            >
              <Trophy className={`w-4 h-4 mr-2 ${rolloverMutation.isPending ? 'animate-pulse' : ''}`} />
              {rolloverMutation.isPending ? "CREATING..." : "CREATE SEASON"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Updates Dialog */}
      <Dialog open={showSendUpdatesDialog} onOpenChange={(open) => {
        setShowSendUpdatesDialog(open);
        if (!open) setUpdateMessage("");
      }}>
        <DialogContent className="bg-white rounded-2xl retro-border max-w-md" aria-describedby="send-updates-description">
          <DialogHeader>
            <DialogTitle className="text-retro-purple text-xl font-bold retro-font text-center">
              SEND LEAGUE UPDATE
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2" id="send-updates-description">
            <p className="text-sm text-gray-600">
              This will email the current standings to all league members. You can include an optional message below.
            </p>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Message (optional)
              </Label>
              <Textarea
                value={updateMessage}
                onChange={(e) => setUpdateMessage(e.target.value)}
                placeholder="Add a note for your league players..."
                className="resize-none h-28"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowSendUpdatesDialog(false);
                setUpdateMessage("");
              }}
              disabled={sendUpdatesMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (leagueId) {
                  sendUpdatesMutation.mutate({ leagueId, message: updateMessage });
                }
              }}
              disabled={sendUpdatesMutation.isPending}
              className="bg-gradient-to-r from-retro-purple to-retro-pink text-white font-bold retro-font"
            >
              <Bell className={`w-4 h-4 mr-2 ${sendUpdatesMutation.isPending ? 'animate-pulse' : ''}`} />
              {sendUpdatesMutation.isPending ? "SENDING..." : "SEND"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
