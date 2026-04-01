import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { LogIn, Eye, EyeOff, Volleyball } from "lucide-react";
import { login } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      return login(email, password);
    },
    onSuccess: () => {
      toast({
        title: "Welcome back!",
        description: "Successfully signed in to your account.",
      });
      // Respect ?redirect= param but only allow internal relative paths
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("redirect") || "";
      // Accept only paths that start with "/" and contain no protocol/host (no open-redirect)
      const redirect = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/standings";
      setTimeout(() => {
        window.location.href = redirect;
      }, 100);
    },
    onError: (error: any) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password. Please try again.",
        variant: "destructive",
      });
    },
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    loginMutation.mutate({
      email: formData.email,
      password: formData.password,
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
    <div className="min-h-screen flex items-center justify-center py-4 px-4">
      <div className="w-full max-w-sm mx-auto">
        <section>
          <div className="text-center mb-6">
            <div className="bg-gradient-to-r from-retro-teal to-retro-purple p-4 sm:p-6 rounded-2xl retro-border">
              <div className="bg-retro-charcoal rounded-xl p-4 bg-opacity-80">
                <Volleyball className="text-retro-yellow text-4xl neon-glow mx-auto mb-3" />
                <h2 className="text-retro-yellow text-2xl sm:text-3xl font-bold mb-2 neon-glow retro-font">
                  TOTAL WINS
                </h2>
                <p className="text-white text-sm sm:text-base font-bold">WELCOME BACK!</p>
              </div>
            </div>
          </div>

          <Card className="bg-white rounded-xl retro-border shadow-2xl">
            <CardContent className="p-4 sm:p-6">
              <div className="text-center mb-4">
                <h3 className="text-retro-purple text-lg sm:text-xl font-bold retro-font">SIGN IN</h3>
                <p className="text-retro-charcoal opacity-75 mt-1 text-sm">Enter your credentials</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email" className="block text-retro-charcoal font-bold mb-2">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className="w-full p-3 border-2 border-retro-pink rounded-lg focus:border-retro-purple focus:outline-none text-base"
                    placeholder="your.email@example.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email}</p>
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
                      className="w-full p-3 border-2 border-retro-pink rounded-lg focus:border-retro-purple focus:outline-none text-base pr-12"
                      placeholder="Enter your password"
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
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="rememberMe"
                      checked={formData.rememberMe}
                      onCheckedChange={(checked) => handleInputChange("rememberMe", !!checked)}
                      className="border-retro-pink data-[state=checked]:bg-retro-pink"
                    />
                    <Label htmlFor="rememberMe" className="text-retro-charcoal text-sm">
                      Remember me
                    </Label>
                  </div>
                  
                  <Link href="/forgot-password">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-retro-purple hover:text-retro-pink text-sm"
                    >
                      Forgot password?
                    </Button>
                  </Link>
                </div>
                
                <Button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="w-full bg-gradient-to-r from-retro-pink to-retro-purple text-white p-4 rounded-xl font-bold text-xl hover:scale-105 transform transition-all duration-200 neon-glow retro-font"
                >
                  <LogIn className="mr-3 h-5 w-5" />
                  {loginMutation.isPending ? "SIGNING IN..." : "SIGN IN TO LEAGUE"}
                </Button>
              </form>
              
              <div className="mt-6 text-center">
                <p className="text-retro-charcoal">Don't have an account yet?</p>
                <Link href="/signup">
                  <Button
                    variant="ghost"
                    className="text-retro-purple font-bold hover:text-retro-pink transition-colors duration-200 retro-font"
                  >
                    Create your championship account
                  </Button>
                </Link>
              </div>

              {/* Demo credentials info */}
              <div className="mt-6 p-4 bg-retro-cream rounded-lg border-l-4 border-retro-teal">
                <h4 className="font-bold text-retro-charcoal mb-2 text-sm retro-font">DEMO ACCESS</h4>
                <p className="text-retro-charcoal text-xs opacity-75">
                  For demonstration purposes, you can create a new account or use any existing credentials.
                  The app uses in-memory storage and will reset when the server restarts.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
