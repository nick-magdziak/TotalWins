import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Volleyball, ArrowLeft, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPassword() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const forgotMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", { email });
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    forgotMutation.mutate(email.trim());
  };

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
              <p className="text-white text-sm sm:text-base font-bold">RESET PASSWORD</p>
            </div>
          </div>
        </div>

        <Card className="bg-white rounded-xl retro-border shadow-2xl">
          <CardContent className="p-4 sm:p-6">
            {submitted ? (
              <div className="text-center space-y-4 py-4">
                <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                <h3 className="text-retro-purple text-lg font-bold retro-font">CHECK YOUR EMAIL</h3>
                <p className="text-retro-charcoal text-sm">
                  If that email address is registered, we have sent a password reset link. Check your inbox and follow the instructions.
                </p>
                <p className="text-retro-charcoal text-xs opacity-60">
                  The link expires in 1 hour. Check your spam folder if you do not see it.
                </p>
                <Link href="/login">
                  <Button className="w-full bg-gradient-to-r from-retro-pink to-retro-purple text-white font-bold retro-font mt-2">
                    BACK TO SIGN IN
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="text-center mb-4">
                  <h3 className="text-retro-purple text-lg sm:text-xl font-bold retro-font">FORGOT PASSWORD?</h3>
                  <p className="text-retro-charcoal opacity-75 mt-1 text-sm">
                    Enter your email and we will send you a reset link.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="email" className="block text-retro-charcoal font-bold mb-2">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full p-3 border-2 border-retro-pink rounded-lg focus:border-retro-purple focus:outline-none text-base"
                      placeholder="your.email@example.com"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={forgotMutation.isPending || !email.trim()}
                    className="w-full bg-gradient-to-r from-retro-pink to-retro-purple text-white p-4 rounded-xl font-bold text-xl hover:scale-105 transform transition-all duration-200 neon-glow retro-font"
                  >
                    {forgotMutation.isPending ? "SENDING..." : "SEND RESET LINK"}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <Link href="/login">
                    <Button variant="ghost" className="text-retro-purple font-bold hover:text-retro-pink transition-colors retro-font">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      BACK TO SIGN IN
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
