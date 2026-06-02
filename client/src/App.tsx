import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import Standings from "@/pages/standings";
import Draft from "@/pages/draft";
import Profile from "@/pages/profile";
import Admin from "@/pages/admin";
import SuperAdmin from "@/pages/super-admin";
import Signup from "@/pages/signup";
import Login from "@/pages/login";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import VerifyEmail from "@/pages/verify-email";
import CreateLeague from "@/pages/create-league";
import Join from "@/pages/join";
import NotFound from "@/pages/not-found";
import VerifyEmailBanner from "@/components/VerifyEmailBanner";
import { InstallPrompt } from "@/components/InstallPrompt";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Standings} />
      <Route path="/standings" component={Standings} />
      <Route path="/draft" component={Draft} />
      <Route path="/create-league" component={CreateLeague} />
      <Route path="/profile" component={Profile} />
      <Route path="/admin" component={Admin} />
      <Route path="/super-admin" component={SuperAdmin} />
      <Route path="/signup" component={Signup} />
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/join" component={Join} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Layout>
          <VerifyEmailBanner />
          <Router />
        </Layout>
        <InstallPrompt />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
