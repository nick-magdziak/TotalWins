import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Menu, Trophy, Users, User, Settings, LogOut, ChevronDown, Plus, MessageSquare, MoreHorizontal } from "lucide-react";
import { getCurrentUser, logout, AUTH_STORAGE_KEY } from "@/lib/auth";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { type League, type DraftStatus } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { useRealtimeInvitations } from "@/hooks/use-realtime";
import totalWinsLogo from "@assets/TotalWinsLogo_PureYellow.png";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [currentLeagueId, setCurrentLeagueId] = useState<string>("");

  // Listen for auth state changes
  useEffect(() => {
    const checkAuth = () => {
      setCurrentUser(getCurrentUser());
    };
    
    // Check initially
    checkAuth();
    
    // Listen for storage events (logout from other tabs, etc.)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === AUTH_STORAGE_KEY || e.key === null) {
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

  // Pending invitations for badge — pushed instantly via websocket when an
  // admin sends an invite. We keep a slow background poll as a safety net in
  // case the socket is disconnected (e.g. flaky network, sleeping tab).
  useRealtimeInvitations(!!currentUser?.id);
  const { data: pendingInvitations } = useQuery<Array<{ league: League; member: any }>>({
    queryKey: ["/api/users/pending-invitations"],
    enabled: !!currentUser?.id,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const pendingCount = pendingInvitations?.length ?? 0;

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
    // Set default league when leagues are loaded and none is selected yet
    if (!currentLeagueId && userLeagues && userLeagues.length > 0) {
      setCurrentLeagueId(userLeagues[0].id);
    }
  }, [userLeagues, currentLeagueId]);

  // Show Admin for global admins OR league creators (anyone who created the current league)
  const isLeagueAdmin = currentUser?.isAdmin || 
                        currentLeague?.createdBy === currentUser?.id;

  // Always derive the effective league ID from the resolved currentLeague, never from the raw state default
  const effectiveLeagueId = currentLeague?.id ?? "";

  // Poll the current league's draft status so we can flag the DRAFT nav item
  // when it's the logged-in user's turn to pick.
  const { data: draftStatus } = useQuery<DraftStatus>({
    queryKey: ["/api/leagues", effectiveLeagueId, "draft", "status"],
    enabled: !!effectiveLeagueId && !!currentUser?.id,
    refetchInterval: 3000,
  });
  const isUserTurn = !!draftStatus?.isActive
    && !draftStatus?.isPaused
    && !!currentUser?.displayName
    && draftStatus?.currentPlayer === currentUser.displayName;

  // League-specific navigation items with current league context
  const leagueNavItems = [
    { path: `/standings?league=${effectiveLeagueId}`, label: "STANDINGS", icon: Trophy, showTurnBadge: false },
    { path: `/draft?league=${effectiveLeagueId}`, label: "DRAFT", icon: Users, showTurnBadge: isUserTurn },
    ...(isLeagueAdmin ? [{ path: `/admin?league=${effectiveLeagueId}`, label: "ADMIN", icon: Settings, showTurnBadge: false }] : []),
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

  const publicRoutes = ["/login", "/signup", "/forgot-password", "/reset-password", "/join"];
  const locationPath = location.split("?")[0];
  if (!currentUser && !publicRoutes.includes(locationPath)) {
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

  if (publicRoutes.includes(locationPath)) {
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
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-wider retro-font">
                        TOTAL WINS
                      </h1>
                      <span className="bg-retro-yellow text-retro-charcoal text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded retro-font tracking-wider leading-none">
                        BETA
                      </span>
                    </div>
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
                        // Full reload so every page (which reads the league
                        // from window.location.search) picks up the change.
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
                          {league.sport === 'WORLD_CUP' ? 'WORLD CUP' : league.sport} • {league.season}
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
          
          {/* Desktop Navigation
              Progressive overflow: at md (768+) we show only league items inline
              and collapse general items + Feedback + Logout into a "MORE" dropdown.
              At lg (1024+) we promote Create League + Profile to inline buttons.
              At xl (1280+) we show every item inline and hide the MORE menu.
              This guarantees every action is always reachable, no matter the width. */}
          <nav className="hidden md:flex items-center space-x-2 lg:space-x-3 xl:space-x-6">
            {/* League-specific items (always inline at md+) */}
            {leagueNavItems.map((item) => {
              const currentPath = location.split('?')[0];
              const itemPath = item.path.split('?')[0];
              const isActive = currentPath === itemPath;
              return (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant="ghost"
                    className={`nav-btn relative ${isActive ? "active" : ""}`}
                  >
                    {item.label}
                    {item.showTurnBadge && (
                      <Badge
                        variant="destructive"
                        className="ml-2 h-5 min-w-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center"
                        data-testid="badge-draft-turn-desktop"
                      >
                        1
                      </Badge>
                    )}
                  </Button>
                </Link>
              );
            })}

            {/* General items: visible only at lg+ inline */}
            {generalNavItems.map((item) => {
              const currentPath = location.split('?')[0];
              const itemPath = item.path.split('?')[0];
              const isActive = currentPath === itemPath;
              const showBadge = item.path === "/profile" && pendingCount > 0;
              return (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant="ghost"
                    className={`nav-btn relative hidden lg:inline-flex ${isActive ? "active" : ""}`}
                    data-testid={item.path === "/profile" ? "nav-profile" : undefined}
                  >
                    {item.label}
                    {showBadge && (
                      <Badge
                        variant="destructive"
                        className="ml-2 h-5 min-w-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center"
                        data-testid="badge-pending-invitations-desktop"
                      >
                        {pendingCount}
                      </Badge>
                    )}
                  </Button>
                </Link>
              );
            })}

            {/* Feedback + Logout: visible only at xl+ inline */}
            <a
              href="mailto:admin@totalwins.app?subject=Total%20Wins%20Beta%20Feedback"
              className="nav-btn text-retro-yellow hover:bg-retro-yellow hover:text-retro-charcoal hidden xl:inline-flex items-center px-3 rounded-lg transition-colors"
              data-testid="link-feedback-desktop"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              FEEDBACK
            </a>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="nav-btn text-retro-orange hover:bg-retro-orange hover:text-white hidden xl:inline-flex"
            >
              <LogOut className="w-4 h-4 mr-2" />
              LOGOUT
            </Button>

            {/* MORE overflow menu — visible md → xl-1, contains items hidden at the
                current breakpoint so nothing is ever truly off-screen. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="nav-btn xl:hidden text-white relative"
                  data-testid="nav-more"
                  aria-label="More navigation options"
                >
                  <MoreHorizontal className="w-4 h-4 mr-2" />
                  MORE
                  {pendingCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="ml-2 h-5 min-w-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center lg:hidden"
                      data-testid="badge-pending-invitations-more"
                    >
                      {pendingCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-white border-2 border-retro-teal">
                {/* Create League + Profile: only listed at md → lg-1 (already inline at lg+) */}
                {generalNavItems.map((item) => {
                  const Icon = item.icon;
                  const showBadge = item.path === "/profile" && pendingCount > 0;
                  return (
                    <DropdownMenuItem
                      key={item.path}
                      asChild
                      className="lg:hidden p-0"
                    >
                      <Link href={item.path}>
                        <div className="flex items-center gap-2 px-3 py-2 cursor-pointer w-full retro-font text-retro-charcoal">
                          <Icon className="w-4 h-4" />
                          <span className="font-bold">{item.label}</span>
                          {showBadge && (
                            <Badge
                              variant="destructive"
                              className="ml-auto h-5 min-w-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center"
                            >
                              {pendingCount}
                            </Badge>
                          )}
                        </div>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
                {/* Feedback + Logout: always in MORE while it's visible (md → xl-1) */}
                <DropdownMenuItem asChild className="p-0">
                  <a
                    href="mailto:admin@totalwins.app?subject=Total%20Wins%20Beta%20Feedback"
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer w-full retro-font text-retro-charcoal"
                    data-testid="link-feedback-more"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span className="font-bold">FEEDBACK</span>
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="px-3 py-2 cursor-pointer retro-font text-retro-charcoal font-bold"
                  data-testid="button-logout-more"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  LOGOUT
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                  <span className="bg-retro-yellow text-retro-charcoal text-[10px] font-bold px-1.5 py-0.5 rounded retro-font tracking-wider leading-none">
                    BETA
                  </span>
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
                            {item.showTurnBadge && (
                              <Badge
                                variant="destructive"
                                className="ml-auto h-5 min-w-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center"
                                data-testid="badge-draft-turn-mobile"
                              >
                                1
                              </Badge>
                            )}
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
                      const showBadge = item.path === "/profile" && pendingCount > 0;
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
                            {showBadge && (
                              <Badge
                                variant="destructive"
                                className="ml-auto h-5 min-w-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center"
                                data-testid="badge-pending-invitations-mobile"
                              >
                                {pendingCount}
                              </Badge>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                    
                    {/* Feedback link */}
                    <a
                      href="mailto:admin@totalwins.app?subject=Total%20Wins%20Beta%20Feedback"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer w-full text-left text-retro-cream hover:bg-retro-teal/20 hover:text-retro-yellow"
                      data-testid="link-feedback-mobile"
                    >
                      <MessageSquare className="w-5 h-5" />
                      <span className="font-medium retro-font">FEEDBACK</span>
                    </a>

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
      <footer className="bg-black text-white py-6 mt-16">
        <div className="container mx-auto text-center">
          {/* Reserved space for future links */}
        </div>
      </footer>
    </div>
  );
}
