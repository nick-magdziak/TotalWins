import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { UserCog, Volleyball, Save, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getCurrentUser } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type League } from "@shared/schema";

export default function Profile() {
  const currentUser = getCurrentUser();
  const { toast } = useToast();
  const [currentLeagueId, setCurrentLeagueId] = useState<string>("demo-league-1");
  
  const [formData, setFormData] = useState({
    displayName: currentUser?.displayName || "",
    email: currentUser?.email || "",
    notifications: currentUser?.notifications ?? true,
  });

  // Fetch user's leagues
  const { data: userLeagues } = useQuery<League[]>({
    queryKey: ["/api/users", currentUser?.id, "leagues"],
    enabled: !!currentUser?.id,
  });

  // Get current league info
  const currentLeague = userLeagues?.find(league => league.id === currentLeagueId) || 
                       userLeagues?.[0]; // Fallback to first league

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<typeof formData>) => {
      if (!currentUser) throw new Error("No user logged in");
      return apiRequest("PATCH", `/api/users/${currentUser.id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Profile updated!",
        description: "Your profile has been successfully updated.",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!currentUser) {
    return (
      <div className="text-center py-12">
        <p className="text-retro-charcoal text-xl">Please log in to view your profile.</p>
      </div>
    );
  }

  // Mock data for user's teams and stats
  const userTeams = [
    { id: "BAL", name: "Ravens", city: "Baltimore", wins: 12 },
    { id: "MIA", name: "Dolphins", city: "Miami", wins: 8 },
    { id: "IND", name: "Colts", city: "Indianapolis", wins: 8 },
    { id: "WAS", name: "Commanders", city: "Washington", wins: 12 },
  ];
  
  const totalWins = userTeams.reduce((sum, team) => sum + team.wins, 0);

  return (
    <>
      {/* Hero Section */}
      <section className="text-center mb-12">
        <div className="bg-gradient-to-r from-retro-lime to-retro-teal p-8 rounded-3xl retro-border">
          <div className="bg-retro-charcoal rounded-2xl p-6 bg-opacity-80">
            <h2 className="text-retro-yellow text-4xl md:text-6xl font-bold mb-4 neon-glow retro-font">
              {currentLeague?.name?.toUpperCase() || "SUNDAY SQUAD"}
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
                  <div className="text-sm text-retro-charcoal opacity-75">Current Rank</div>
                  <div className="text-2xl font-bold text-retro-purple retro-font">1st Place</div>
                </div>
                <div className="bg-retro-cream p-3 rounded-lg">
                  <div className="text-sm text-retro-charcoal opacity-75">Total Wins</div>
                  <div className="text-2xl font-bold text-retro-pink retro-font">{totalWins}</div>
                </div>
                <div className="bg-retro-cream p-3 rounded-lg">
                  <div className="text-sm text-retro-charcoal opacity-75">Leagues Joined</div>
                  <div className="text-2xl font-bold text-retro-teal retro-font">{userLeagues?.length || 0}</div>
                </div>
                
                {/* League Selector */}
                {userLeagues && userLeagues.length > 1 && (
                  <div className="bg-retro-cream p-3 rounded-lg">
                    <div className="text-sm text-retro-charcoal opacity-75 mb-2">Current League</div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full border-retro-purple text-retro-purple hover:bg-retro-purple hover:text-white font-bold py-2 rounded-lg retro-font">
                          {currentLeague?.name || "Select League"}
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center" className="w-full bg-white border-2 border-retro-purple">
                        {userLeagues.map((league) => (
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
                )}
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
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="displayName" className="block text-retro-charcoal font-bold mb-2">
                    Display Name
                  </Label>
                  <Input
                    id="displayName"
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => handleInputChange("displayName", e.target.value)}
                    className="w-full p-3 border-2 border-retro-pink rounded-lg focus:border-retro-purple focus:outline-none"
                  />
                </div>
                
                <div>
                  <Label htmlFor="email" className="block text-retro-charcoal font-bold mb-2">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className="w-full p-3 border-2 border-retro-pink rounded-lg focus:border-retro-purple focus:outline-none"
                  />
                </div>
                
                <div>
                  <Label className="block text-retro-charcoal font-bold mb-2">
                    Notification Preferences
                  </Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="notifications"
                        checked={formData.notifications}
                        onCheckedChange={(checked) => handleInputChange("notifications", !!checked)}
                        className="border-retro-pink data-[state=checked]:bg-retro-pink"
                      />
                      <Label htmlFor="notifications" className="text-retro-charcoal">
                        Game results notifications
                      </Label>
                    </div>
                  </div>
                </div>
                
                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="bg-gradient-to-r from-retro-pink to-retro-purple text-white px-6 py-3 rounded-full font-bold hover:scale-105 transform transition-all duration-200 neon-glow retro-font"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {updateProfileMutation.isPending ? "UPDATING..." : "UPDATE PROFILE"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* My Teams */}
          <Card className="bg-gradient-to-br from-retro-teal to-retro-lime rounded-2xl text-white shadow-xl">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-4 retro-font">
                <Volleyball className="inline mr-2" />
                MY CHAMPIONSHIP ROSTER
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {userTeams.map((team) => (
                  <div key={team.id} className="bg-white bg-opacity-20 p-4 rounded-xl text-center">
                    <div className="text-2xl mb-2">🏈</div>
                    <div className="font-bold retro-font">{team.city.toUpperCase()}</div>
                    <div className="text-sm opacity-75">{team.name}</div>
                    <div className="text-sm mt-2">
                      <Badge className="bg-retro-charcoal text-white">
                        {team.wins} wins
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 text-center">
                <div className="text-3xl font-bold retro-font">TOTAL: {totalWins} WINS</div>
                <div className="text-sm opacity-75">Championship Performance</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
