import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bell, Mail, User, Settings, Key, Shield, UserCog, Smartphone } from "lucide-react";
import { getCurrentUser, setCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type League } from "@shared/schema";
import { pushNotificationManager } from "@/lib/pushNotifications";

interface NotificationPreferences {
  draftNotifications: boolean;
  gameNotifications: boolean;
}

interface UserNotificationPreferences {
  draftNotifications: boolean;
  standingsNotifications: boolean;
}

interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface EmailChangeData {
  currentPassword: string;
  newEmail: string;
  confirmEmail: string;
}

export default function Profile() {
  const currentUser = getCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isEditing, setIsEditing] = useState(false);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [editData, setEditData] = useState({
    firstName: currentUser?.firstName || "",
    lastName: currentUser?.lastName || "",
    displayName: currentUser?.displayName || "",
  });
  const [passwordData, setPasswordData] = useState<PasswordChangeData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [emailData, setEmailData] = useState<EmailChangeData>({
    currentPassword: "",
    newEmail: "",
    confirmEmail: "",
  });

  // Push notification state
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [isPushSubscribing, setIsPushSubscribing] = useState(false);
  const [userNotificationPrefs, setUserNotificationPrefs] = useState<UserNotificationPreferences>({
    draftNotifications: currentUser?.draftNotifications ?? true,
    standingsNotifications: currentUser?.standingsNotifications ?? true,
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

  // Check push notification support and subscription status
  useEffect(() => {
    const checkPushNotifications = async () => {
      const isSupported = pushNotificationManager.isSupported();
      setIsPushSupported(isSupported);

      if (isSupported) {
        const isSubscribed = await pushNotificationManager.isSubscribed();
        setIsPushSubscribed(isSubscribed);
      }
    };

    checkPushNotifications();
  }, []);

  // Update user notification preferences in real-time
  useEffect(() => {
    if (currentUser) {
      setUserNotificationPrefs({
        draftNotifications: currentUser.draftNotifications ?? true,
        standingsNotifications: currentUser.standingsNotifications ?? true,
      });
    }
  }, [currentUser]);

  // Get league-specific notification preferences
  const { data: preferences, isLoading: preferencesLoading } = useQuery<NotificationPreferences>({
    queryKey: ["/api/leagues", selectedLeagueId, "members", currentUser?.id, "notification-preferences"],
    enabled: !!currentUser?.id && !!selectedLeagueId,
  });

  // Update league-specific notification preferences
  const updatePreferencesMutation = useMutation({
    mutationFn: async (newPreferences: Partial<NotificationPreferences>) => {
      if (!selectedLeagueId) {
        throw new Error("No league selected");
      }
      
      const response = await fetch(`/api/leagues/${selectedLeagueId}/members/${currentUser?.id}/notification-preferences`, {
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
        queryKey: ["/api/leagues", selectedLeagueId, "members", currentUser?.id, "notification-preferences"] 
      });
      toast({
        title: "Settings Updated",
        description: `Your notification preferences for this league have been saved.`,
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

  // Push notification mutations
  const updateUserNotificationsMutation = useMutation({
    mutationFn: async (preferences: Partial<UserNotificationPreferences>) => {
      const response = await apiRequest("PUT", `/api/users/${currentUser?.id}/notification-preferences`, preferences);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", currentUser?.id] });
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

  // Toggle push notifications
  const handlePushToggle = async (enabled: boolean) => {
    if (!isPushSupported) {
      toast({
        title: "Not Supported",
        description: "Push notifications are not supported in this browser.",
        variant: "destructive",
      });
      return;
    }

    setIsPushSubscribing(true);
    try {
      if (enabled) {
        await pushNotificationManager.subscribe();
        setIsPushSubscribed(true);
        toast({
          title: "Push Notifications Enabled",
          description: "You'll now receive push notifications for draft turns and standings changes.",
        });
      } else {
        await pushNotificationManager.unsubscribe();
        setIsPushSubscribed(false);
        toast({
          title: "Push Notifications Disabled",
          description: "You'll no longer receive push notifications.",
        });
      }
    } catch (error) {
      console.error("Error toggling push notifications:", error);
      toast({
        title: "Error",
        description: "Failed to update push notification settings.",
        variant: "destructive",
      });
    } finally {
      setIsPushSubscribing(false);
    }
  };

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: { firstName: string; lastName: string; displayName: string }) => {
      const response = await apiRequest("PUT", `/api/users/${currentUser?.id}/profile`, profileData);
      return response.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", currentUser?.id] });
      setCurrentUser(updatedUser);
      setIsEditing(false);
      toast({
        title: "Profile Updated",
        description: "Your profile information has been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile information.",
        variant: "destructive",
      });
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (passwordData: PasswordChangeData) => {
      const response = await apiRequest("PUT", `/api/users/${currentUser?.id}/password`, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      return response.json();
    },
    onSuccess: () => {
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setIsPasswordDialogOpen(false);
      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update password.",
        variant: "destructive",
      });
    },
  });

  // Change email mutation
  const changeEmailMutation = useMutation({
    mutationFn: async (emailData: EmailChangeData) => {
      const response = await apiRequest("PUT", `/api/users/${currentUser?.id}/email`, {
        currentPassword: emailData.currentPassword,
        newEmail: emailData.newEmail,
      });
      return response.json();
    },
    onSuccess: (updatedUser) => {
      setEmailData({ currentPassword: "", newEmail: "", confirmEmail: "" });
      setIsEmailDialogOpen(false);
      setCurrentUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: ["/api/users", currentUser?.id] });
      toast({
        title: "Email Updated",
        description: "Your email address has been changed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update email address.",
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
        credentials: "include",
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

  const testSendUpdatesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLeagueId) throw new Error("No league selected");
      const response = await fetch(`/api/leagues/${selectedLeagueId}/send-updates/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to send test update");
      return response.json();
    },
    onSuccess: (data: { sent: number }) => {
      if (data.sent === 0) {
        toast({
          title: "Email not delivered",
          description: "The test email could not be sent. Check your email configuration.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Test Update Sent",
          description: `A test standings update has been sent to ${currentUser?.email}`,
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send test update email.",
        variant: "destructive",
      });
    },
  });

  const handlePreferenceChange = (key: keyof NotificationPreferences, value: boolean) => {
    updatePreferencesMutation.mutate({ [key]: value });
  };

  const handleProfileSave = () => {
    if (!editData.firstName.trim() || !editData.lastName.trim() || !editData.displayName.trim()) {
      toast({
        title: "Validation Error",
        description: "All fields are required.",
        variant: "destructive",
      });
      return;
    }
    
    if (editData.displayName.length > 16) {
      toast({
        title: "Validation Error", 
        description: "Display name must be 16 characters or less.",
        variant: "destructive",
      });
      return;
    }

    updateProfileMutation.mutate(editData);
  };

  const handlePasswordChange = () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast({
        title: "Validation Error",
        description: "All password fields are required.",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Validation Error",
        description: "New password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Validation Error",
        description: "New passwords don't match.",
        variant: "destructive",
      });
      return;
    }

    changePasswordMutation.mutate(passwordData);
  };

  const handleEmailChange = () => {
    if (!emailData.currentPassword || !emailData.newEmail || !emailData.confirmEmail) {
      toast({
        title: "Validation Error",
        description: "All email fields are required.",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailData.newEmail)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    if (emailData.newEmail !== emailData.confirmEmail) {
      toast({
        title: "Validation Error",
        description: "Email addresses don't match.",
        variant: "destructive",
      });
      return;
    }

    if (emailData.newEmail === currentUser?.email) {
      toast({
        title: "Validation Error",
        description: "New email must be different from current email.",
        variant: "destructive",
      });
      return;
    }

    changeEmailMutation.mutate(emailData);
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
              <div className="flex items-center justify-between">
                <Label htmlFor="email">Email</Label>
                <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-xs">
                      <Mail className="h-3 w-3 mr-1" />
                      Change
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Change Email Address</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="currentPasswordEmail">Current Password</Label>
                        <Input
                          id="currentPasswordEmail"
                          type="password"
                          value={emailData.currentPassword}
                          onChange={(e) => setEmailData(prev => ({ ...prev, currentPassword: e.target.value }))}
                          placeholder="Enter your current password"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newEmail">New Email Address</Label>
                        <Input
                          id="newEmail"
                          type="email"
                          value={emailData.newEmail}
                          onChange={(e) => setEmailData(prev => ({ ...prev, newEmail: e.target.value }))}
                          placeholder="Enter your new email address"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmEmail">Confirm New Email</Label>
                        <Input
                          id="confirmEmail"
                          type="email"
                          value={emailData.confirmEmail}
                          onChange={(e) => setEmailData(prev => ({ ...prev, confirmEmail: e.target.value }))}
                          placeholder="Confirm your new email address"
                        />
                      </div>
                      <div className="flex gap-2 pt-4">
                        <Button 
                          onClick={handleEmailChange}
                          disabled={changeEmailMutation.isPending}
                          className="flex-1"
                        >
                          {changeEmailMutation.isPending ? "Updating..." : "Update Email"}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setIsEmailDialogOpen(false);
                            setEmailData({ currentPassword: "", newEmail: "", confirmEmail: "" });
                          }}
                          disabled={changeEmailMutation.isPending}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
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
                    onClick={handleProfileSave}
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
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

        {/* Account Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Account Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  value="••••••••"
                  disabled
                  className="bg-gray-50 dark:bg-gray-800"
                />
                <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Key className="h-4 w-4 mr-2" />
                      Change
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Change Password</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="currentPassword">Current Password</Label>
                        <Input
                          id="currentPassword"
                          type="password"
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                          placeholder="Enter current password"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                          placeholder="Enter new password (min 6 characters)"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                          placeholder="Confirm new password"
                        />
                      </div>
                      <div className="flex gap-2 pt-4">
                        <Button 
                          onClick={handlePasswordChange}
                          disabled={changePasswordMutation.isPending}
                        >
                          {changePasswordMutation.isPending ? "Updating..." : "Update Password"}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
                            setIsPasswordDialogOpen(false);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Account Type</Label>
              <div className="flex items-center gap-2">
                <UserCog className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {currentUser?.isAdmin ? "Administrator" : "Standard User"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Member Since</Label>
              <div className="text-sm text-muted-foreground">
                {currentUser?.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : "N/A"}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Notifications */}
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
                    Notification settings apply only to the selected league above
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testSendUpdatesMutation.mutate()}
                      disabled={testSendUpdatesMutation.isPending || !selectedLeagueId}
                    >
                      <Bell className="h-4 w-4 mr-2" />
                      {testSendUpdatesMutation.isPending ? "Sending..." : "Test Updates"}
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

        {/* Push Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Push Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isPushSupported ? (
              <div className="text-sm text-muted-foreground p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="h-4 w-4" />
                  <span className="font-medium">Browser Not Supported</span>
                </div>
                <p>Push notifications are not supported in this browser. Try using Chrome, Firefox, or Safari for the best experience.</p>
              </div>
            ) : (
              <>
                {/* Main Push Toggle */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-base font-medium">Enable Push Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive instant notifications for draft turns and standings changes
                      </p>
                    </div>
                    <Switch
                      checked={isPushSubscribed}
                      onCheckedChange={handlePushToggle}
                      disabled={isPushSubscribing}
                    />
                  </div>

                  {isPushSubscribed && (
                    <div className="space-y-4 pl-4 border-l-2 border-teal-300">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label className="text-sm font-medium">Draft Turn Notifications</Label>
                          <p className="text-xs text-muted-foreground">
                            Get notified when it's your turn to pick in any league
                          </p>
                        </div>
                        <Switch
                          checked={userNotificationPrefs.draftNotifications}
                          onCheckedChange={(checked) => {
                            const newPrefs = { ...userNotificationPrefs, draftNotifications: checked };
                            setUserNotificationPrefs(newPrefs);
                            updateUserNotificationsMutation.mutate({ draftNotifications: checked });
                          }}
                          disabled={updateUserNotificationsMutation.isPending}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label className="text-sm font-medium">Standings Change Notifications</Label>
                          <p className="text-xs text-muted-foreground">
                            Get notified when you move up or down in league standings
                          </p>
                        </div>
                        <Switch
                          checked={userNotificationPrefs.standingsNotifications}
                          onCheckedChange={(checked) => {
                            const newPrefs = { ...userNotificationPrefs, standingsNotifications: checked };
                            setUserNotificationPrefs(newPrefs);
                            updateUserNotificationsMutation.mutate({ standingsNotifications: checked });
                          }}
                          disabled={updateUserNotificationsMutation.isPending}
                        />
                      </div>

                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-start gap-2">
                          <Bell className="h-4 w-4 text-blue-500 mt-0.5" />
                          <div className="text-xs text-blue-700 dark:text-blue-300">
                            <p className="font-medium mb-1">Push notifications work when:</p>
                            <ul className="space-y-1 text-xs">
                              <li>• Your browser is open (even in background tabs)</li>
                              <li>• Your device allows notifications</li>
                              <li>• You're logged into Total Wins</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}