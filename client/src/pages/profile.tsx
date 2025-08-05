import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Mail, User, Settings } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type League } from "@shared/schema";

interface NotificationPreferences {
  draftNotifications: boolean;
  gameNotifications: boolean;
}

export default function Profile() {
  const currentUser = getCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isEditing, setIsEditing] = useState(false);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [editData, setEditData] = useState({
    firstName: currentUser?.firstName || "",
    lastName: currentUser?.lastName || "",
    displayName: currentUser?.displayName || "",
  });

  // Get user's leagues
  const { data: userLeagues } = useQuery<League[]>({
    queryKey: ["/api/users", currentUser?.id, "leagues"],
    enabled: !!currentUser?.id,
  });

  // Set default league when leagues are loaded
  useEffect(() => {
    if (userLeagues && userLeagues.length > 0 && !selectedLeagueId) {
      setSelectedLeagueId(userLeagues[0].id);
    }
  }, [userLeagues, selectedLeagueId]);

  // Get notification preferences
  const { data: preferences, isLoading: preferencesLoading } = useQuery<NotificationPreferences>({
    queryKey: ["/api/users", currentUser?.id, "notification-preferences"],
    enabled: !!currentUser?.id,
  });

  // Update notification preferences
  const updatePreferencesMutation = useMutation({
    mutationFn: async (newPreferences: Partial<NotificationPreferences>) => {
      const response = await fetch(`/api/users/${currentUser?.id}/notification-preferences`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newPreferences),
      });
      if (!response.ok) {
        throw new Error("Failed to update preferences");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/users", currentUser?.id, "notification-preferences"] 
      });
      toast({
        title: "Settings Updated",
        description: "Your notification preferences have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update notification preferences.",
        variant: "destructive",
      });
    },
  });

  // Test email functionality
  const testEmailMutation = useMutation({
    mutationFn: async (type: "invitation" | "draft" | "game") => {
      const response = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          email: currentUser?.email,
          leagueId: selectedLeagueId,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to send test email");
      }
      return response.json();
    },
    onSuccess: (_, type) => {
      toast({
        title: "Test Email Sent",
        description: `A test ${type} email has been sent to ${currentUser?.email}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send test email.",
        variant: "destructive",
      });
    },
  });

  const handlePreferenceChange = (key: keyof NotificationPreferences, value: boolean) => {
    updatePreferencesMutation.mutate({ [key]: value });
  };

  if (!currentUser) {
    return <div>Please log in to view your profile.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-500 to-teal-400 bg-clip-text text-transparent mb-2">
          PROFILE SETTINGS
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your account preferences and notifications
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={currentUser.email}
                disabled
                className="bg-gray-50 dark:bg-gray-800"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={editData.firstName}
                disabled={!isEditing}
                onChange={(e) => setEditData(prev => ({ ...prev, firstName: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={editData.lastName}
                disabled={!isEditing}
                onChange={(e) => setEditData(prev => ({ ...prev, lastName: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={editData.displayName}
                disabled={!isEditing}
                onChange={(e) => setEditData(prev => ({ ...prev, displayName: e.target.value }))}
              />
            </div>

            <div className="flex gap-2 pt-4">
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)} variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              ) : (
                <>
                  <Button 
                    onClick={() => {
                      // TODO: Implement profile update
                      setIsEditing(false);
                      toast({
                        title: "Profile Updated",
                        description: "Your profile information has been saved.",
                      });
                    }}
                  >
                    Save Changes
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsEditing(false);
                      setEditData({
                        firstName: currentUser?.firstName || "",
                        lastName: currentUser?.lastName || "",
                        displayName: currentUser?.displayName || "",
                      });
                    }}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Email Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {preferencesLoading ? (
              <div>Loading preferences...</div>
            ) : (
              <>
                {/* League Selector */}
                <div className="space-y-2">
                  <Label htmlFor="league-select" className="text-base">
                    League
                  </Label>
                  <Select value={selectedLeagueId} onValueChange={setSelectedLeagueId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a league..." />
                    </SelectTrigger>
                    <SelectContent>
                      {userLeagues?.map((league) => (
                        <SelectItem key={league.id} value={league.id}>
                          {league.name} ({league.sport?.toUpperCase()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Email notifications will be sent for the selected league
                  </p>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="draft-notifications" className="text-base">
                        Draft Notifications
                      </Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Get notified when it's your turn to draft
                      </p>
                    </div>
                    <Switch
                      id="draft-notifications"
                      checked={preferences?.draftNotifications ?? true}
                      onCheckedChange={(checked) => handlePreferenceChange("draftNotifications", checked)}
                      disabled={updatePreferencesMutation.isPending}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="game-notifications" className="text-base">
                        Game Updates
                      </Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Get notified when your teams win or lose
                      </p>
                    </div>
                    <Switch
                      id="game-notifications"
                      checked={preferences?.gameNotifications ?? false}
                      onCheckedChange={(checked) => handlePreferenceChange("gameNotifications", checked)}
                      disabled={updatePreferencesMutation.isPending}
                    />
                  </div>
                </div>

                <Separator />

                {/* Test Email Buttons */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Test Email Notifications
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testEmailMutation.mutate("invitation")}
                      disabled={testEmailMutation.isPending}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Test Invitation
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testEmailMutation.mutate("draft")}
                      disabled={testEmailMutation.isPending}
                    >
                      <Bell className="h-4 w-4 mr-2" />
                      Test Draft
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testEmailMutation.mutate("game")}
                      disabled={testEmailMutation.isPending}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Test Game
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Test emails will be sent to {currentUser.email}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}