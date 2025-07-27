import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Trophy, Users, User, Settings, LogOut, Volleyball } from "lucide-react";
import { getCurrentUser, isAdmin, logout } from "@/lib/auth";
import { useState } from "react";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const currentUser = getCurrentUser();
  const isUserAdmin = isAdmin();

  const navItems = [
    { path: "/standings", label: "STANDINGS", icon: Trophy },
    { path: "/draft", label: "DRAFT", icon: Users },
    { path: "/profile", label: "PROFILE", icon: User },
    ...(isUserAdmin ? [{ path: "/admin", label: "ADMIN", icon: Settings }] : []),
  ];

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  if (!currentUser && location !== "/signup" && location !== "/login") {
    return (
      <div className="min-h-screen bg-retro-cream flex items-center justify-center">
        <div className="text-center">
          <div className="bg-gradient-to-r from-retro-pink via-retro-purple to-retro-teal p-8 rounded-3xl retro-border mb-8">
            <h1 className="text-retro-yellow text-4xl md:text-6xl font-bold mb-4 neon-glow retro-font">
              WINS POOL '24
            </h1>
            <p className="text-white text-xl font-bold">Please sign in to continue</p>
          </div>
          <div className="space-x-4">
            <Link href="/login">
              <Button className="bg-retro-pink hover:bg-retro-purple text-white font-bold px-8 py-3 rounded-xl">
                SIGN IN
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="outline" className="border-retro-pink text-retro-pink hover:bg-retro-pink hover:text-white font-bold px-8 py-3 rounded-xl">
                SIGN UP
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (location === "/signup" || location === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-retro-cream">
      {/* Header */}
      <header className="bg-gradient-to-r from-retro-pink via-retro-purple to-retro-teal p-4 sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Volleyball className="text-retro-yellow text-3xl neon-glow" />
            <h1 className="text-white text-2xl md:text-4xl font-bold tracking-wider retro-font">
              WINS POOL '24
            </h1>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-6">
            {navItems.map((item) => {
              const isActive = location === item.path;
              return (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant="ghost"
                    className={`nav-btn ${isActive ? "active" : ""}`}
                  >
                    {item.label}
                  </Button>
                </Link>
              );
            })}
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="nav-btn text-retro-orange hover:bg-retro-orange hover:text-white"
            >
              <LogOut className="w-4 h-4 mr-2" />
              LOGOUT
            </Button>
          </nav>

          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" className="md:hidden text-white">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-retro-charcoal text-white">
              <div className="flex flex-col space-y-4 mt-8">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.path;
                  return (
                    <Link key={item.path} href={item.path}>
                      <Button
                        variant="ghost"
                        className={`w-full justify-start ${
                          isActive ? "bg-retro-yellow text-retro-charcoal" : "text-white hover:bg-retro-purple"
                        }`}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Icon className="w-4 h-4 mr-3" />
                        {item.label}
                      </Button>
                    </Link>
                  );
                })}
                <Button
                  variant="ghost"
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full justify-start text-retro-orange hover:bg-retro-orange hover:text-white"
                >
                  <LogOut className="w-4 h-4 mr-3" />
                  LOGOUT
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-retro-charcoal text-white p-8 mt-16">
        <div className="container mx-auto text-center">
          <div className="checkered-bg h-4 mb-6 rounded-full opacity-50"></div>
          <p className="text-lg font-bold mb-2 retro-font">WINS POOL CHAMPIONSHIP SERIES</p>
          <p className="opacity-75">Bringing the excitement of 90s sports culture to modern fantasy leagues</p>
        </div>
      </footer>
    </div>
  );
}
