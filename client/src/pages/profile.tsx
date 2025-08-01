import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { UserCog, Save, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getCurrentUser } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type League } from "@shared/schema";

export default function Profile() {
  const currentUser = getCurrentUser();
  const { toast } = useToast();
  const [currentLeagueId, setCurrentLeagueId] = useState<string>("demo-league-1");
  
  // Account-level form data
  const [accountData, setAccountData] = useState({
    accountEmail: currentUser?.email || "",
  });

  // League-specific form data  
  const [leagueData, setLeagueData] = useState({
    displayName: currentUser?.displayName || "",
    notificationEmail: currentUser?.email || "",
    gameNotifications: currentUser?.notifications ?? true,
    draftNotifications: true, // Default to true for new setting
  });

  // Fetch user's leagues
  const { data: userLeagues } = useQuery<League[]>({
    queryKey: ["/api/users", currentUser?.id, "leagues"],
    enabled: !!currentUser?.id,
  });

  // Get current league info
  const currentLeague = userLeagues?.find(league => league.id === currentLeagueId) || 
                       userLeagues?.[0]; // Fallback to first league

  // Account-level updates
  const updateAccountMutation = useMutation({
    mutationFn: async (updates: Partial<typeof accountData>) => {
      if (!currentUser) throw new Error("No user logged in");
      return apiRequest("PATCH", `/api/users/${currentUser.id}`, { email: updates.accountEmail });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Account updated!",
        description: "Your account settings have been successfully updated.",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update account settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  // League-specific updates
  const updateLeagueProfileMutation = useMutation({
    mutationFn: async (updates: Partial<typeof leagueData>) => {
      if (!currentUser) throw new Error("No user logged in");
      // TODO: Implement league-specific profile updates when backend supports it
      return apiRequest("PATCH", `/api/users/${currentUser.id}`, {
        displayName: updates.displayName,
        // For now, store notifications globally - can be made league-specific later
        notifications: updates.gameNotifications,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "League profile updated!",
        description: "Your league-specific settings have been successfully updated.",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update league profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateAccountMutation.mutate(accountData);
  };

  const handleLeagueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateLeagueProfileMutation.mutate(leagueData);
  };

  const handleAccountChange = (field: keyof typeof accountData, value: string) => {
    setAccountData(prev => ({ ...prev, [field]: value }));
  };

  const handleLeagueChange = (field: keyof typeof leagueData, value: string | boolean) => {
    setLeagueData(prev => ({ ...prev, [field]: value }));
  };

  const handleChangePassword = () => {
    toast({
      title: "Change Password",
      description: "Password change functionality will be implemented soon!",
    });
  };

  if (!currentUser) {
    return (
      <div className="text-center py-12">
        <p className="text-retro-charcoal text-xl">Please log in to view your profile.</p>
      </div>
    );
  }



  return (
    <>
      {/* Hero Section */}
      <section className="text-center mb-12">
        <div className="bg-gradient-to-r from-retro-lime to-retro-teal p-8 rounded-3xl retro-border">
          <div className="bg-retro-charcoal rounded-2xl p-6 bg-opacity-80">
            <h2 className="text-retro-yellow text-4xl md:text-6xl font-bold mb-4 neon-glow retro-font">
              TOTAL WINS
            </h2>
            <p className="text-white text-xl md:text-2xl font-bold">PROFILE SETTINGS</p>
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Player Info Card */}
        <div className="lg:col-span-1">
          <Card className="bg-white rounded-2xl retro-border text-center shadow-xl">
            <CardContent className="p-6">
              <div className="w-24 h-24 bg-gradient-to-br from-retro-pink to-retro-purple rounded-full mx-auto mb-4 flex items-center justify-center text-white text-3xl font-bold retro-font">
                {currentUser.displayName.charAt(0).toUpperCase()}
              </div>
              <h3 className="text-2xl font-bold text-retro-charcoal mb-2 retro-font">
                {currentUser.displayName}
              </h3>
              <p className="text-retro-charcoal opacity-75 mb-4">{currentUser.email}</p>
              
              <div className="space-y-3">
                <div className="bg-retro-cream p-3 rounded-lg">
                  <div className="text-sm text-retro-charcoal opacity-75">Total Wins</div>
                  <div className="text-2xl font-bold text-retro-pink retro-font">40</div>
                </div>
                <div className="bg-retro-cream p-3 rounded-lg">
                  <div className="text-sm text-retro-charcoal opacity-75">Leagues Joined</div>
                  <div className="text-2xl font-bold text-retro-teal retro-font">{userLeagues?.length || 0}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profile Management */}
        <div className="lg:col-span-2 space-y-6">
          {/* Account Settings */}
          <Card className="bg-white rounded-2xl retro-border shadow-xl">
            <CardContent className="p-6">
              <h3 className="text-retro-purple text-xl font-bold mb-4 retro-font">
                <UserCog className="inline mr-2" />
                ACCOUNT SETTINGS
              </h3>
              
              <form onSubmit={handleAccountSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="accountEmail" className="block text-retro-charcoal font-bold mb-2">
                    Account Email
                  </Label>
                  <Input
                    id="accountEmail"
                    type="email"
                    value={accountData.accountEmail}
                    onChange={(e) => handleAccountChange("accountEmail", e.target.value)}
                    className="w-full p-3 border-2 border-retro-pink rounded-lg focus:border-retro-purple focus:outline-none"
                    placeholder="Your login email for Total Wins"
                  />
                </div>
                
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={updateAccountMutation.isPending}
                    className="bg-gradient-to-r from-retro-pink to-retro-purple text-white px-6 py-3 rounded-lg font-bold hover:scale-105 transform transition-all duration-200 retro-font"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {updateAccountMutation.isPending ? "UPDATING..." : "UPDATE EMAIL"}
                  </Button>
                  
                  <Button
                    type="button"
                    onClick={handleChangePassword}
                    variant="outline"
                    className="border-retro-orange text-retro-orange hover:bg-retro-orange hover:text-white font-bold px-6 py-3 rounded-lg retro-font"
                  >
                    CHANGE PASSWORD
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* League Settings */}
          <Card className="bg-white rounded-2xl retro-border shadow-xl">
            <CardContent className="p-6">
              <h3 className="text-retro-purple text-xl font-bold mb-4 retro-font">
                <UserCog className="inline mr-2" />
                LEAGUE SETTINGS
              </h3>
              
              {/* League Selector */}
              <div className="mb-6">
                <Label className="block text-retro-charcoal font-bold mb-2">
                  Select League to Edit
                </Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full border-retro-purple text-retro-purple hover:bg-retro-purple hover:text-white font-bold py-3 px-4 rounded-lg retro-font justify-between">
                      {currentLeague?.name || "Select League"}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-full bg-white border-2 border-retro-purple">
                    {userLeagues && userLeagues.map((league) => (
                      <DropdownMenuItem
                        key={league.id}
                        onClick={() => setCurrentLeagueId(league.id)}
                        className={`p-3 cursor-pointer hover:bg-retro-cream ${
                          league.id === currentLeagueId ? "bg-retro-lime/20" : ""
                        }`}
                      >
                        <div>
                          <div className="font-bold text-retro-charcoal retro-font">
                            {league.name}
                          </div>
                          <div className="text-sm text-retro-charcoal/70">
                            {league.sport} • {league.season}
                          </div>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <form onSubmit={handleLeagueSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="displayName" className="block text-retro-charcoal font-bold mb-2">
                    Display Name
                  </Label>
                  <Input
                    id="displayName"
                    type="text"
                    value={leagueData.displayName}
                    onChange={(e) => handleLeagueChange("displayName", e.target.value)}
                    className="w-full p-3 border-2 border-retro-pink rounded-lg focus:border-retro-purple focus:outline-none"
                    placeholder="Your display name in this league"
                  />
                </div>
                
                <div>
                  <Label htmlFor="notificationEmail" className="block text-retro-charcoal font-bold mb-2">
                    Notification Email
                  </Label>
                  <Input
                    id="notificationEmail"
                    type="email"
                    value={leagueData.notificationEmail}
                    onChange={(e) => handleLeagueChange("notificationEmail", e.target.value)}
                    className="w-full p-3 border-2 border-retro-pink rounded-lg focus:border-retro-purple focus:outline-none"
                    placeholder="Email for league notifications"
                  />
                </div>
                
                <div>
                  <Label className="block text-retro-charcoal font-bold mb-2">
                    Notification Preferences
                  </Label>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="gameNotifications"
                        checked={leagueData.gameNotifications}
                        onCheckedChange={(checked) => handleLeagueChange("gameNotifications", !!checked)}
                        className="border-retro-pink data-[state=checked]:bg-retro-pink"
                      />
                      <Label htmlFor="gameNotifications" className="text-retro-charcoal">
                        Game results notifications
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="draftNotifications"
                        checked={leagueData.draftNotifications}
                        onCheckedChange={(checked) => handleLeagueChange("draftNotifications", !!checked)}
                        className="border-retro-pink data-[state=checked]:bg-retro-pink"
                      />
                      <Label htmlFor="draftNotifications" className="text-retro-charcoal">
                        Draft notifications
                      </Label>
                    </div>
                  </div>
                </div>
                
                <Button
                  type="submit"
                  disabled={updateLeagueProfileMutation.isPending}
                  className="bg-gradient-to-r from-retro-teal to-retro-lime text-white px-6 py-3 rounded-lg font-bold hover:scale-105 transform transition-all duration-200 retro-font"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {updateLeagueProfileMutation.isPending ? "UPDATING..." : "UPDATE LEAGUE PROFILE"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
