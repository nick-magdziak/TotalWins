import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Volleyball, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) setToken(t);
  }, []);

  const resetMutation = useMutation({
    mutationFn: async ({ token, password }: { token: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/reset-password", { token, password });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Reset failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => setLocation("/login"), 3000);
    },
    onError: (error: any) => {
      toast({
        title: "Reset failed",
        description: error.message || "The link may be invalid or expired.",
        variant: "destructive",
      });
    },
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!password) newErrors.password = "Password is required";
    else if (password.length < 6) newErrors.password = "Password must be at least 6 characters";
    if (!confirmPassword) newErrors.confirmPassword = "Please confirm your password";
    else if (password !== confirmPassword) newErrors.confirmPassword = "Passwords do not match";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    resetMutation.mutate({ token, password });
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center py-4 px-4">
        <div className="w-full max-w-sm mx-auto">
          <Card className="bg-white rounded-xl retro-border shadow-2xl">
            <CardContent className="p-6 text-center space-y-4">
              <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
              <h3 className="text-retro-purple text-lg font-bold retro-font">INVALID LINK</h3>
              <p className="text-retro-charcoal text-sm">
                This password reset link is missing or invalid. Please request a new one.
              </p>
              <Link href="/forgot-password">
                <Button className="w-full bg-gradient-to-r from-retro-pink to-retro-purple text-white font-bold retro-font">
                  REQUEST NEW LINK
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-4 px-4">
      <div className="w-full max-w-sm mx-auto">
        <div className="text-center mb-6">
          <div className="bg-gradient-to-r from-retro-teal to-retro-purple p-4 sm:p-6 rounded-2xl retro-border">
            <div className="bg-retro-charcoal rounded-xl p-4 bg-opacity-80">
              <Volleyball className="text-retro-yellow text-4xl neon-glow mx-auto mb-3" />
              <h2 className="text-retro-yellow text-2xl sm:text-3xl font-bold mb-2 neon-glow retro-font">
                TOTAL WINS
              </h2>
              <p className="text-white text-sm sm:text-base font-bold">NEW PASSWORD</p>
            </div>
          </div>
        </div>

        <Card className="bg-white rounded-xl retro-border shadow-2xl">
          <CardContent className="p-4 sm:p-6">
            {success ? (
              <div className="text-center space-y-4 py-4">
                <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                <h3 className="text-retro-purple text-lg font-bold retro-font">PASSWORD UPDATED</h3>
                <p className="text-retro-charcoal text-sm">
                  Your password has been changed. Redirecting you to sign in...
                </p>
                <Link href="/login">
                  <Button className="w-full bg-gradient-to-r from-retro-pink to-retro-purple text-white font-bold retro-font">
                    SIGN IN NOW
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="text-center mb-4">
                  <h3 className="text-retro-purple text-lg sm:text-xl font-bold retro-font">CHOOSE NEW PASSWORD</h3>
                  <p className="text-retro-charcoal opacity-75 mt-1 text-sm">
                    Enter and confirm your new password below.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="password" className="block text-retro-charcoal font-bold mb-2">
                      New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (errors.password) setErrors(prev => ({ ...prev, password: "" }));
                        }}
                        className="w-full p-3 border-2 border-retro-pink rounded-lg focus:border-retro-purple focus:outline-none text-base pr-12"
                        placeholder="At least 6 characters"
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
                    {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword" className="block text-retro-charcoal font-bold mb-2">
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: "" }));
                        }}
                        className="w-full p-3 border-2 border-retro-pink rounded-lg focus:border-retro-purple focus:outline-none text-base pr-12"
                        placeholder="Repeat your new password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-retro-charcoal hover:text-retro-purple"
                        onClick={() => setShowConfirm(!showConfirm)}
                      >
                        {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </Button>
                    </div>
                    {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
                  </div>

                  <Button
                    type="submit"
                    disabled={resetMutation.isPending}
                    className="w-full bg-gradient-to-r from-retro-pink to-retro-purple text-white p-4 rounded-xl font-bold text-xl hover:scale-105 transform transition-all duration-200 neon-glow retro-font"
                  >
                    {resetMutation.isPending ? "UPDATING..." : "SET NEW PASSWORD"}
                  </Button>
                </form>

                <div className="mt-4 text-center">
                  <Link href="/forgot-password">
                    <Button variant="ghost" className="text-retro-purple text-sm hover:text-retro-pink retro-font">
                      Request a new reset link
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
