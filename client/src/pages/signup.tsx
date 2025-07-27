import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Eye, EyeOff } from "lucide-react";
import { signup } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function Signup() {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    displayName: "",
    password: "",
    confirmPassword: "",
    gameNotifications: true,
    draftReminders: true,
    agreeToTerms: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const signupMutation = useMutation({
    mutationFn: async (userData: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      displayName: string;
    }) => {
      return signup(userData);
    },
    onSuccess: () => {
      toast({
        title: "Account created successfully!",
        description: "Welcome to the Wins Pool Championship Series.",
      });
      // Redirect to standings page after successful signup
      window.location.href = "/standings";
    },
    onError: (error: any) => {
      toast({
        title: "Signup failed",
        description: error.message || "Failed to create account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.displayName.trim()) {
      newErrors.displayName = "Display name is required";
    } else if (formData.displayName.length < 2) {
      newErrors.displayName = "Display name must be at least 2 characters";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = "You must agree to the Terms of Service";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    signupMutation.mutate({
      email: formData.email,
      password: formData.password,
      firstName: formData.firstName,
      lastName: formData.lastName,
      displayName: formData.displayName,
    });
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <section className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="bg-gradient-to-r from-retro-pink via-retro-purple to-retro-teal p-8 rounded-3xl retro-border">
              <div className="bg-retro-charcoal rounded-2xl p-6 bg-opacity-80">
                <h2 className="text-retro-yellow text-4xl md:text-6xl font-bold mb-4 neon-glow retro-font">
                  JOIN THE LEAGUE
                </h2>
                <p className="text-white text-xl md:text-2xl font-bold">CREATE YOUR CHAMPIONSHIP ACCOUNT</p>
              </div>
            </div>
          </div>

          <Card className="bg-white rounded-2xl retro-border shadow-2xl">
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="firstName" className="block text-retro-charcoal font-bold mb-2">
                      First Name
                    </Label>
                    <Input
                      id="firstName"
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange("firstName", e.target.value)}
                      className="w-full p-4 border-2 border-retro-pink rounded-lg focus:border-retro-purple focus:outline-none text-lg"
                      placeholder="Enter your first name"
                    />
                    {errors.firstName && (
                      <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="lastName" className="block text-retro-charcoal font-bold mb-2">
                      Last Name
                    </Label>
                    <Input
                      id="lastName"
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange("lastName", e.target.value)}
                      className="w-full p-4 border-2 border-retro-pink rounded-lg focus:border-retro-purple focus:outline-none text-lg"
                      placeholder="Enter your last name"
                    />
                    {errors.lastName && (
                      <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                    )}
                  </div>
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
                    className="w-full p-4 border-2 border-retro-pink rounded-lg focus:border-retro-purple focus:outline-none text-lg"
                    placeholder="your.email@example.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="displayName" className="block text-retro-charcoal font-bold mb-2">
                    Display Name
                  </Label>
                  <Input
                    id="displayName"
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => handleInputChange("displayName", e.target.value)}
                    className="w-full p-4 border-2 border-retro-pink rounded-lg focus:border-retro-purple focus:outline-none text-lg"
                    placeholder="Choose a display name"
                  />
                  {errors.displayName && (
                    <p className="mt-1 text-sm text-red-600">{errors.displayName}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="password" className="block text-retro-charcoal font-bold mb-2">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => handleInputChange("password", e.target.value)}
                      className="w-full p-4 border-2 border-retro-pink rounded-lg focus:border-retro-purple focus:outline-none text-lg pr-12"
                      placeholder="Create a secure password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-retro-charcoal hover:text-retro-purple"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </Button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="confirmPassword" className="block text-retro-charcoal font-bold mb-2">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                      className="w-full p-4 border-2 border-retro-pink rounded-lg focus:border-retro-purple focus:outline-none text-lg pr-12"
                      placeholder="Confirm your password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-retro-charcoal hover:text-retro-purple"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </Button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                  )}
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-bold text-retro-charcoal mb-2 retro-font">League Preferences</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="gameNotifications"
                        checked={formData.gameNotifications}
                        onCheckedChange={(checked) => handleInputChange("gameNotifications", !!checked)}
                        className="border-retro-pink data-[state=checked]:bg-retro-pink"
                      />
                      <Label htmlFor="gameNotifications" className="text-retro-charcoal">
                        Receive email notifications for game results
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="draftReminders"
                        checked={formData.draftReminders}
                        onCheckedChange={(checked) => handleInputChange("draftReminders", !!checked)}
                        className="border-retro-pink data-[state=checked]:bg-retro-pink"
                      />
                      <Label htmlFor="draftReminders" className="text-retro-charcoal">
                        Get draft reminders and league updates
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="agreeToTerms"
                        checked={formData.agreeToTerms}
                        onCheckedChange={(checked) => handleInputChange("agreeToTerms", !!checked)}
                        className="border-retro-pink data-[state=checked]:bg-retro-pink"
                      />
                      <Label htmlFor="agreeToTerms" className="text-retro-charcoal">
                        I agree to the Terms of Service and Privacy Policy
                      </Label>
                    </div>
                    {errors.agreeToTerms && (
                      <p className="mt-1 text-sm text-red-600">{errors.agreeToTerms}</p>
                    )}
                  </div>
                </div>
                
                <Button
                  type="submit"
                  disabled={signupMutation.isPending}
                  className="w-full bg-gradient-to-r from-retro-pink to-retro-purple text-white p-4 rounded-xl font-bold text-xl hover:scale-105 transform transition-all duration-200 neon-glow retro-font"
                >
                  <UserPlus className="mr-3 h-5 w-5" />
                  {signupMutation.isPending ? "CREATING ACCOUNT..." : "CREATE ACCOUNT & JOIN LEAGUE"}
                </Button>
              </form>
              
              <div className="mt-6 text-center">
                <p className="text-retro-charcoal">Already have an account?</p>
                <Link href="/login">
                  <Button
                    variant="ghost"
                    className="text-retro-purple font-bold hover:text-retro-pink transition-colors duration-200 retro-font"
                  >
                    Sign in here
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
