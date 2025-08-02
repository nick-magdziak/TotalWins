import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Menu, Trophy, Users, User, Settings, LogOut, ChevronDown, Plus } from "lucide-react";
import { getCurrentUser, isAdmin, logout } from "@/lib/auth";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { type League } from "@shared/schema";
import totalWinsLogo from "@assets/TotalWinsLogo - Transparent_1753759057781.png";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [currentLeagueId, setCurrentLeagueId] = useState<string>("demo-league-1");
  const isUserAdmin = isAdmin();

  // Listen for auth state changes
  useEffect(() => {
    const checkAuth = () => {
      setCurrentUser(getCurrentUser());
    };
    
    // Check initially
    checkAuth();
    
    // Listen for storage events (logout from other tabs, etc.)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'currentUser' || e.key === null) {
        checkAuth();
      }
    };
    
    // Listen for custom auth events (login/logout in same tab)
    const handleAuthChange = () => {
      checkAuth();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('authStateChanged', handleAuthChange);
    
    // Fallback check every 30 seconds (much less frequent)
    const interval = setInterval(checkAuth, 30000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('authStateChanged', handleAuthChange);
      clearInterval(interval);
    };
  }, []);

  // Fetch user's leagues
  const { data: userLeagues } = useQuery<League[]>({
    queryKey: ["/api/users", currentUser?.id, "leagues"],
    enabled: !!currentUser?.id,
  });

  // Get league ID from URL params or use stored league
  const urlParams = new URLSearchParams(window.location.search);
  const urlLeagueId = urlParams.get('league');
  
  // Update currentLeagueId when URL changes
  useEffect(() => {
    if (urlLeagueId && urlLeagueId !== currentLeagueId) {
      setCurrentLeagueId(urlLeagueId);
    }
  }, [urlLeagueId]);

  // Get current league info
  const currentLeague = userLeagues?.find(league => league.id === currentLeagueId) || 
                       userLeagues?.[0]; // Fallback to first league

  useEffect(() => {
    // Set default league when leagues are loaded
    if (userLeagues && userLeagues.length > 0 && !currentLeague) {
      setCurrentLeagueId(userLeagues[0].id);
    }
  }, [userLeagues, currentLeague]);

  // League-specific navigation items with current league context
  const leagueNavItems = [
    { path: `/standings?league=${currentLeagueId}`, label: "STANDINGS", icon: Trophy },
    { path: `/draft?league=${currentLeagueId}`, label: "DRAFT", icon: Users },
    ...(isUserAdmin || currentUser?.displayName === "NickPapageorgio" ? [{ path: `/admin?league=${currentLeagueId}`, label: "ADMIN", icon: Settings }] : []),
  ];

  // General navigation items (not league-specific)
  const generalNavItems = [
    { path: "/create-league", label: "CREATE LEAGUE", icon: Plus },
    { path: "/profile", label: "PROFILE", icon: User },
  ];

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  if (!currentUser && location !== "/signup" && location !== "/login") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="bg-gradient-to-r from-retro-pink via-retro-purple to-retro-teal p-8 rounded-3xl retro-border mb-8">
            <h1 className="text-retro-yellow text-4xl md:text-6xl font-bold mb-4 neon-glow retro-font">
              TOTAL WINS
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
    <div className="min-h-screen">
      {/* Fixed Header with Solid Background */}
      <header className="p-3 fixed top-0 left-0 right-0 z-50 shadow-lg" style={{
        background: 'linear-gradient(to right, #FF1493, #8A2BE2, #20B2AA)',
        opacity: 1
      }}>
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <img 
              src={totalWinsLogo} 
              alt="Total Wins Logo" 
              className="w-8 h-8 sm:w-10 sm:h-10 object-contain filter drop-shadow-lg"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-white hover:bg-white/10 p-2 rounded-lg">
                  <div className="text-left">
                    <h1 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-wider retro-font">
                      TOTAL WINS
                    </h1>
                    {currentLeague && (
                      <div className="text-xs sm:text-sm opacity-75 -mt-1">
                        {currentLeague.name}
                      </div>
                    )}
                  </div>
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 bg-white border-2 border-retro-teal">
                {userLeagues && userLeagues.length > 0 ? (
                  userLeagues.map((league) => (
                    <DropdownMenuItem
                      key={league.id}
                      onClick={() => {
                        setCurrentLeagueId(league.id);
                        // Update URL to reflect league change for all pages
                        const currentPath = location.split('?')[0];
                        window.location.href = `${currentPath}?league=${league.id}`;
                      }}
                      className={`p-3 cursor-pointer hover:bg-retro-cream ${
                        league.id === currentLeagueId ? "bg-retro-lime/20" : ""
                      }`}
                    >
                      <div>
                        <div className="font-bold text-retro-charcoal retro-font">
                          {league.name}
                        </div>
                        <div className="text-sm text-retro-charcoal/70">
                          {league.sport} • {league.season}
                        </div>
                        {league.id === currentLeagueId && (
                          <div className="text-xs text-retro-teal font-bold mt-1">
                            Current League
                          </div>
                        )}
                      </div>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled className="p-3">
                    <div className="text-sm text-gray-500">
                      No leagues found
                    </div>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-6">
            {[...leagueNavItems, ...generalNavItems].map((item) => {
              // Check if current location matches the item path (handle query parameters)
              const currentPath = location.split('?')[0];
              const itemPath = item.path.split('?')[0];
              const isActive = currentPath === itemPath;
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
            <SheetContent side="right" className="bg-retro-charcoal text-white w-64">
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 p-4 border-b border-retro-teal/30">
                  <img src={totalWinsLogo} alt="Total Wins" className="w-8 h-8" />
                  <span className="text-retro-yellow font-bold text-lg retro-font">TOTAL WINS</span>
                </div>
                
                <nav className="flex-1 p-4">
                  {/* League-specific items */}
                  <div className="space-y-2 mb-4">
                    {leagueNavItems.map((item) => {
                      const Icon = item.icon;
                      // Check if current location matches the item path (handle query parameters)
                      const currentPath = location.split('?')[0];
                      const itemPath = item.path.split('?')[0];
                      const isActive = currentPath === itemPath;
                      return (
                        <Link key={item.path} href={item.path}>
                          <div
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer ${
                              isActive 
                                ? 'bg-gradient-to-r from-retro-teal to-retro-lime text-white' 
                                : 'text-retro-cream hover:bg-retro-teal/20 hover:text-retro-yellow'
                            }`}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <Icon className="w-5 h-5" />
                            <span className="font-medium retro-font">{item.label}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>

                  {/* White divider line */}
                  <div className="border-t-2 border-white mb-4"></div>

                  {/* General items */}
                  <div className="space-y-2">
                    {generalNavItems.map((item) => {
                      const Icon = item.icon;
                      // Check if current location matches the item path (handle query parameters)
                      const currentPath = location.split('?')[0];
                      const itemPath = item.path.split('?')[0];
                      const isActive = currentPath === itemPath;
                      return (
                        <Link key={item.path} href={item.path}>
                          <div
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer ${
                              isActive 
                                ? 'bg-gradient-to-r from-retro-teal to-retro-lime text-white' 
                                : 'text-retro-cream hover:bg-retro-teal/20 hover:text-retro-yellow'
                            }`}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <Icon className="w-5 h-5" />
                            <span className="font-medium retro-font">{item.label}</span>
                          </div>
                        </Link>
                      );
                    })}
                    
                    {/* Logout button */}
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer w-full text-left text-retro-cream hover:bg-retro-teal/20 hover:text-retro-yellow"
                    >
                      <LogOut className="w-5 h-5" />
                      <span className="font-medium retro-font">LOGOUT</span>
                    </button>
                  </div>
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 pt-24">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-retro-charcoal text-white p-8 mt-16">
        <div className="container mx-auto text-center">
          <div className="checkered-bg h-4 mb-6 rounded-full opacity-50"></div>
          {/* Reserved space for future features */}
        </div>
      </footer>
    </div>
  );
}
