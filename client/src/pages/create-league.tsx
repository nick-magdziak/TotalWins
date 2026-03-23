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
import { Trophy, Users, Calendar, Zap, Shuffle, Settings, Globe } from "lucide-react";
import { DRAFT_CONFIGURATIONS, type DraftConfiguration } from "@shared/draftConfig";

const createLeagueSchema = z.object({
  name: z.string().min(3, "League name must be at least 3 characters").max(50, "League name must be less than 50 characters"),
  sport: z.enum(["NFL", "MLB", "NBA", "WORLD_CUP"], { required_error: "Please select a sport" }),
  season: z.string().min(4, "Season is required"),
  draftConfiguration: z.string().min(1, "Please select a draft configuration"),
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
      season: new Date().getFullYear().toString(), // Will be updated when sport is selected
      draftConfiguration: "",
      description: "",
    },
  });

  const selectedSport = form.watch("sport");

  const createLeagueMutation = useMutation({
    mutationFn: async (data: CreateLeagueForm) => {
      const leagueData = {
        ...data,
        createdBy: currentUser?.id,
        draftStatus: "pending",
        seasonStatus: "pre_season",
      };
      
      const response = await fetch("/api/leagues", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(leagueData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create league");
      }
      
      return await response.json();
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
    const defaultConfig = DRAFT_CONFIGURATIONS[sport]?.[0];
    const currentYear = new Date().getFullYear();
    
    // Determine season format based on sport and current month
    const currentMonth = new Date().getMonth() + 1; // 1-12
    let season: string;
    
    switch (sport) {
      case "NFL":
      case "NBA":
        // These sports span across two calendar years (e.g., 2024-25)
        // NFL season starts in September, NBA in October
        if ((sport === "NFL" && currentMonth >= 9) || (sport === "NBA" && currentMonth >= 10)) {
          season = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
        } else {
          season = `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
        }
        break;
      case "MLB":
        // MLB season is within a single calendar year
        season = currentYear.toString();
        break;
      default:
        season = currentYear.toString();
    }
    
    switch (sport) {
      case "NFL":
        return {
          season,
          draftConfiguration: defaultConfig?.key || "",
          description: "Draft your favorite NFL teams and compete for the most wins this season!"
        };
      case "MLB":
        return {
          season,
          draftConfiguration: defaultConfig?.key || "",
          description: "Pick your MLB teams and track wins throughout the baseball season!"
        };
      case "NBA":
        return {
          season,
          draftConfiguration: defaultConfig?.key || "",
          description: "Choose your NBA teams and compete for the championship!"
        };
      case "WORLD_CUP":
        return {
          season: "2026",
          draftConfiguration: defaultConfig?.key || "",
          description: "Draft national teams and earn points as they advance through the 2026 FIFA World Cup (June 11 – July 19, 2026)!"
        };
      default:
        return { season };
    }
  };

  const handleSportChange = (sport: string) => {
    const defaults = getSportDefaults(sport);
    form.setValue("sport", sport as "NFL" | "MLB" | "NBA" | "WORLD_CUP");
    if (defaults.season) form.setValue("season", defaults.season);
    if (defaults.draftConfiguration) form.setValue("draftConfiguration", defaults.draftConfiguration);
    if (defaults.description && !form.getValues("description")) {
      form.setValue("description", defaults.description);
    }
    // Clear validation errors for draftConfiguration when sport changes
    form.clearErrors("draftConfiguration");
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
                        <SelectItem value="WORLD_CUP">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            World Cup 2026 - FIFA World Cup
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
                        className="retro-border bg-gray-50"
                        readOnly
                        disabled
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

              {/* Draft Configuration */}
              <FormField
                control={form.control}
                name="draftConfiguration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-retro-purple font-bold retro-font flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      Draft Configuration *
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="retro-border">
                          <SelectValue placeholder="Select draft configuration" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {selectedSport && DRAFT_CONFIGURATIONS[selectedSport]?.map((config) => (
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
                        {!selectedSport && (
                          <SelectItem value="no-sport-selected" disabled>
                            Select a sport first
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose the number of players and teams per player configuration. You will be able to change this after you create the league.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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