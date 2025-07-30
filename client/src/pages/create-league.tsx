import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getCurrentUser } from "@/lib/auth";
import { Trophy, Users, Calendar, Zap } from "lucide-react";

const createLeagueSchema = z.object({
  name: z.string().min(3, "League name must be at least 3 characters").max(50, "League name must be less than 50 characters"),
  sport: z.enum(["NFL", "MLB", "NBA"], { required_error: "Please select a sport" }),
  season: z.string().min(4, "Season is required"),
  teamsPerPlayer: z.coerce.number().min(2, "Minimum 2 teams per player").max(8, "Maximum 8 teams per player"),
  maxPlayers: z.coerce.number().min(2, "Minimum 2 players").max(12, "Maximum 12 players"),
  description: z.string().optional(),
});

type CreateLeagueForm = z.infer<typeof createLeagueSchema>;

export default function CreateLeague() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentUser = getCurrentUser();

  const form = useForm<CreateLeagueForm>({
    resolver: zodResolver(createLeagueSchema),
    defaultValues: {
      name: "",
      sport: undefined,
      season: new Date().getFullYear().toString(),
      teamsPerPlayer: 4,
      maxPlayers: 8,
      description: "",
    },
  });

  const createLeagueMutation = useMutation({
    mutationFn: async (data: CreateLeagueForm) => {
      const leagueData = {
        ...data,
        createdBy: currentUser?.id,
        draftStatus: "pending",
        seasonStatus: "preseason",
      };
      return await apiRequest("/api/leagues", {
        method: "POST",
        body: JSON.stringify(leagueData),
      });
    },
    onSuccess: (newLeague) => {
      toast({
        title: "League Created!",
        description: `${newLeague.name} has been created successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users", currentUser?.id, "leagues"] });
      setLocation(`/draft?league=${newLeague.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create league",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateLeagueForm) => {
    createLeagueMutation.mutate(data);
  };

  const getSportDefaults = (sport: string) => {
    switch (sport) {
      case "NFL":
        return {
          season: "2024-25",
          teamsPerPlayer: 4,
          maxPlayers: 8,
          description: "Draft your favorite NFL teams and compete for the most wins this season!"
        };
      case "MLB":
        return {
          season: "2024",
          teamsPerPlayer: 4,
          maxPlayers: 8,
          description: "Pick your MLB teams and track wins throughout the baseball season!"
        };
      case "NBA":
        return {
          season: "2024-25",
          teamsPerPlayer: 4,
          maxPlayers: 8,
          description: "Choose your NBA teams and compete for the championship!"
        };
      default:
        return {};
    }
  };

  const handleSportChange = (sport: string) => {
    const defaults = getSportDefaults(sport);
    form.setValue("sport", sport as "NFL" | "MLB" | "NBA");
    if (defaults.season) form.setValue("season", defaults.season);
    if (defaults.teamsPerPlayer) form.setValue("teamsPerPlayer", defaults.teamsPerPlayer);
    if (defaults.maxPlayers) form.setValue("maxPlayers", defaults.maxPlayers);
    if (defaults.description && !form.getValues("description")) {
      form.setValue("description", defaults.description);
    }
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-bold mb-2">Please Log In</h2>
            <p className="text-gray-600 mb-4">You need to be logged in to create a league.</p>
            <Button onClick={() => setLocation("/login")}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Hero Section */}
      <div className="text-center mb-8">
        <div className="bg-gradient-to-r from-retro-purple to-retro-pink p-6 rounded-2xl retro-border mb-6">
          <div className="bg-retro-charcoal rounded-xl p-4 bg-opacity-80">
            <h1 className="text-retro-yellow text-3xl md:text-4xl font-bold mb-3 neon-glow retro-font">
              CREATE A LEAGUE
            </h1>
            <p className="text-white text-lg font-medium">
              Start your own sports wins pool and invite friends to compete!
            </p>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <Card className="bg-white rounded-2xl retro-border shadow-xl">
        <CardHeader className="bg-gradient-to-r from-retro-teal to-retro-lime text-white rounded-t-2xl">
          <CardTitle className="text-2xl font-bold retro-font flex items-center gap-2">
            <Trophy className="w-6 h-6" />
            LEAGUE SETUP
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* League Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-retro-purple font-bold retro-font">
                      League Name *
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your league name..."
                        className="retro-border"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Choose a memorable name for your league (3-50 characters)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Sport Selection */}
              <FormField
                control={form.control}
                name="sport"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-retro-purple font-bold retro-font">
                      Sport *
                    </FormLabel>
                    <Select onValueChange={handleSportChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="retro-border">
                          <SelectValue placeholder="Select a sport" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="NFL">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-retro-orange rounded-full"></div>
                            NFL - National Football League
                          </div>
                        </SelectItem>
                        <SelectItem value="MLB">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-retro-lime rounded-full"></div>
                            MLB - Major League Baseball
                          </div>
                        </SelectItem>
                        <SelectItem value="NBA">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-retro-pink rounded-full"></div>
                            NBA - National Basketball Association
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose which sport your league will track
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Season */}
              <FormField
                control={form.control}
                name="season"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-retro-purple font-bold retro-font flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Season *
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 2024-25"
                        className="retro-border"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The season year for your league
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid md:grid-cols-2 gap-4">
                {/* Teams Per Player */}
                <FormField
                  control={form.control}
                  name="teamsPerPlayer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-retro-purple font-bold retro-font flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Teams Per Player *
                      </FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger className="retro-border">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[2, 3, 4, 5, 6, 7, 8].map((num) => (
                            <SelectItem key={num} value={num.toString()}>
                              {num} teams
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        How many teams each player drafts
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Max Players */}
                <FormField
                  control={form.control}
                  name="maxPlayers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-retro-purple font-bold retro-font flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Max Players *
                      </FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger className="retro-border">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                            <SelectItem key={num} value={num.toString()}>
                              {num} players
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Maximum number of players
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-retro-purple font-bold retro-font">
                      Description (Optional)
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tell other players about your league..."
                        className="retro-border resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Add a description to help players understand your league
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/")}
                  className="flex-1 retro-border"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createLeagueMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-retro-teal to-retro-lime hover:from-retro-lime hover:to-retro-teal text-white font-bold retro-font"
                >
                  {createLeagueMutation.isPending ? "Creating..." : "Create League"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Info Cards */}
      <div className="grid md:grid-cols-3 gap-4 mt-8">
        <Card className="bg-retro-cream retro-border">
          <CardContent className="p-4 text-center">
            <Trophy className="w-8 h-8 text-retro-orange mx-auto mb-2" />
            <h3 className="font-bold retro-font text-retro-purple">Draft Teams</h3>
            <p className="text-sm text-retro-charcoal">
              Players take turns picking their favorite teams
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-retro-cream retro-border">
          <CardContent className="p-4 text-center">
            <Zap className="w-8 h-8 text-retro-lime mx-auto mb-2" />
            <h3 className="font-bold retro-font text-retro-purple">Track Wins</h3>
            <p className="text-sm text-retro-charcoal">
              Earn points as your teams win games
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-retro-cream retro-border">
          <CardContent className="p-4 text-center">
            <Users className="w-8 h-8 text-retro-pink mx-auto mb-2" />
            <h3 className="font-bold retro-font text-retro-purple">Compete</h3>
            <p className="text-sm text-retro-charcoal">
              See who has the most wins at season end
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}