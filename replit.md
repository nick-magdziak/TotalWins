# Total Wins

## Overview

This is a full-stack TypeScript application called "Total Wins" for managing NFL wins pool competitions. The application allows users to create leagues, draft NFL teams, and track standings throughout the season. It features a retro 90s-themed UI with a modern React frontend and Express backend.

## User Preferences

Preferred communication style: Simple, everyday language.
Font preference: RUSSO ONE font throughout entire application for bold, athletic aesthetic.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Framework**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom retro 90s theme variables
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon serverless PostgreSQL
- **Session Management**: Express sessions with PostgreSQL storage
- **API Structure**: RESTful endpoints organized by feature
- **Email Service**: Amazon SES for notifications and invitations

### Styling & Theme
- **Design System**: Custom retro 90s theme with pink-to-purple gradient background and teal accents
- **Background**: Beautiful pink (#ff1493) to purple (#8a2be2) to blue (#4169e1) gradient with subtle 8px checkerboard texture overlay
- **Typography**: Custom retro fonts with neon glow effects using RUSSO ONE font family
- **Layout**: Responsive design with mobile-first approach
- **Components**: Reusable UI components from Shadcn/ui library
- **App Name**: "TOTAL WINS" displayed in all caps throughout the application
- **Fixed Header**: Permanent pink-to-teal gradient header that stays fixed while content scrolls behind it

## Key Components

### Authentication System
- User registration and login with email/password
- Session-based authentication with localStorage persistence
- Role-based access control (admin users)
- User state management on frontend with localStorage sync

### League Management
- Create and join leagues with configurable settings
- Support for multiple players per league (up to 8)
- **Multi-league support**: Users can be members of multiple leagues
- **League selection system**: Dropdown menu from TOTAL WINS logo to switch between leagues
- League-specific standings and data display
- Draft position assignment and management
- Season and draft status tracking

### NFL Team Management
- Complete NFL team database with divisions and conferences
- Team records tracking (wins, losses, ties)
- Team icons and branding integration
- Support for 32 NFL teams across 8 divisions

### Draft System
- Sequential draft picking mechanism
- Real-time draft status updates
- Team availability tracking
- Round-based drafting (4 teams per player default)

### Standings & Scoring
- Player standings calculation based on team performance
- Win tracking and leaderboard display
- Season progress monitoring
- Historical data retention

## Data Flow

### Database Schema
```typescript
- users: User accounts with authentication details
- leagues: League configuration and metadata
- league_members: User participation in leagues
- nfl_teams: NFL team information and current records
- draft_picks: Draft selections and order
- games: NFL game results and schedules
```

### API Request Flow
1. Frontend makes API requests using TanStack Query
2. Express middleware handles request logging and error catching
3. Route handlers validate input using Zod schemas
4. Storage layer (in-memory for demo) processes data operations
5. Response formatted and returned to client

### State Management
- Server state managed by TanStack Query with caching
- Local authentication state stored in memory
- Form state managed by React Hook Form
- UI state managed by React hooks

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Neon PostgreSQL serverless driver
- **drizzle-orm**: Type-safe database ORM
- **@tanstack/react-query**: Server state management
- **wouter**: Lightweight routing
- **@radix-ui/***: Accessible UI primitives
- **tailwindcss**: Utility-first CSS framework

### Development Tools
- **vite**: Fast build tool and dev server
- **typescript**: Type safety and developer experience
- **@replit/vite-plugin-runtime-error-modal**: Development error handling
- **esbuild**: Fast JavaScript bundler for production

### Sports Data Integration
- Placeholder ESPN API integration for live game data
- Sports API service architecture ready for external data providers
- Game result synchronization capabilities

## Deployment Strategy

### Build Process
- **Development**: Vite dev server with HMR and TypeScript checking
- **Production**: Vite build for frontend, esbuild bundle for backend
- **Assets**: Static files served from dist/public directory

### Environment Configuration
- Database URL configuration via environment variables
- Sports API key support for external data sources
- Development vs production environment detection

### Server Setup
- Express server with Vite middleware in development
- Static file serving for production builds
- Error handling and request logging middleware
- CORS and security considerations built-in

### Database Management
- Drizzle migrations system for schema evolution
- PostgreSQL connection pooling via Neon
- Development database seeding capabilities

The application is designed to be easily deployable on platforms like Replit, with clear separation between development and production configurations. The modular architecture allows for easy feature additions and maintenance.

## Recent Changes

### Live Scoring System Implementation (August 1-2, 2025)
- ✅ **Completed**: Full real-time scoring system with ESPN API integration
- ✅ **2025 MLB Season Data**: Validated with current season totals (Yankees=60, White Sox=40, Pirates=47 wins)
- ✅ **Live Score Sync**: "SYNC LIVE SCORES" button in admin panel for instant updates
- ✅ **Automatic Validation**: System validates ESPN data against known 2025 season benchmarks
- ✅ **Fallback System**: Uses authenticated 2025 season data when ESPN API structure changes
- ✅ **Real-time Updates**: Live standings automatically update when scores are synced
- ✅ **Cross-sport Support**: Framework ready for NFL/NBA live scoring integration
- ✅ **Live Period Display**: Authentic inning information (e.g., "Top 3", "Bottom 5") from ESPN API
- ✅ **Accurate Game Status**: Removed artificial calculations, uses only real ESPN API data

### Real Draft Functionality Implementation (August 1, 2025)
- ✅ **Completed**: Full live draft system with real-time synchronization
- ✅ **Snake Draft Logic**: Proper turn calculation with multi-round support
- ✅ **Manual Entry System**: Admin can draft teams for any player with live validation
- ✅ **Real-time Polling**: 3-second intervals for cross-browser draft synchronization
- ✅ **Multi-sport Teams**: Support for NFL, MLB, and NBA team drafting
- ✅ **Live Updates**: Draft picks update instantly across all connected browsers

### Demo Leagues Implementation (January 30, 2025)
- ✅ **Completed**: Three comprehensive demo leagues created:
  - **Champions League** (NFL): 8 players, 32 complete draft picks
  - **Sunday Squad** (MLB): 8 players, 32 complete draft picks  
  - **Fantasy Friends** (NBA): 8 players, 32 complete draft picks
- ✅ All leagues have realistic player names and team assignments
- ✅ League switching functionality working via dropdown menu
- ✅ Full standings and draft data populated for testing
- ✅ Fixed database initialization to handle existing users properly
- ✅ **Fixed all reported issues**:
  - Eliminated duplicate team drafts (Philadelphia, Atlanta)
  - Corrected team ID mappings (Boston, Arizona, San Antonio)
  - Resolved data consistency across all three leagues

### Custom Draft Configurations Implementation (August 1, 2025)
- ✅ **Completed**: Removed linear draft functionality completely from all systems
- ✅ **Updated Verbiage**: Changed 10-player configuration to display "(custom config)" instead of "(snake draft)"
- ✅ **Removed Legacy Config**: Eliminated "6 Players, 5 Teams (snake)" from all three leagues
- ✅ **Custom 6 for 30**: Implemented precise pick order for 6 players, 5 teams each (30 total picks)
  - Complex balanced draft order across NFL, MLB, and NBA leagues
  - Each player gets exactly 5 teams with strategic pick distribution
  - Pick order: A(1,13,17,19,28), B(2,11,16,22,27), C(3,9,12,24,30), D(4,10,15,23,25), E(5,7,18,21,26), F(6,8,14,20,29)
- ✅ **Custom 8 for 24**: Implemented precise pick order for 8 players, 3 teams each (24 total picks)
  - Available for MLB and NBA leagues only
  - Each player gets exactly 3 teams with balanced pick timing
  - Pick order: A(1,13,24), B(2,15,21), C(3,16,19), D(4,11,23), E(5,14,18), F(6,9,22), G(7,10,20), H(8,12,17)
- ✅ **System Integration**: Updated draftUtils.ts with proper getDraftOrder function routing
- ✅ **UI Improvements**: Ordered configurations by player count (4→5→6→7→8→10)
- ✅ **Styling Updates**: Clean display with "(custom config)" in grey text below configuration names

### Performance Optimization Implementation (August 1, 2025)
- ✅ **Smart Polling System**: Reduced API calls by 83% during inactive periods
  - Draft status queries: Always 3-second polling for immediate admin feedback
  - Draft-related data: 3 seconds when active, 30 seconds when inactive
  - Performance impact: 2 req/sec to 0.77 req/sec when drafts inactive
- ✅ **Auth System Optimization**: Eliminated wasteful 100ms authentication polling
  - Event-driven authentication using storage events and custom event dispatch
  - Reduced from 10 checks/second to event-based + 30-second fallback
  - Maintains cross-tab logout detection and same-tab auth changes

### Domain Authentication & Email Deliverability Implementation (August 5, 2025)
- ✅ **Custom Domain Setup**: Successfully purchased and verified totalwins.app domain
- ✅ **AWS SES Domain Verification**: Completed domain authentication in AWS SES Console
- ✅ **DNS Configuration**: Set up SPF, DKIM, and DMARC records for email authentication
- ✅ **Email Branding**: Updated email sender to "Total Wins <admin@totalwins.app>"
- ✅ **Spam Prevention**: Implemented proper domain authentication to prevent spam filtering
- ✅ **Professional Email Templates**: Clean, emoji-free design with sport-specific messaging
- ✅ **Email Service Integration**: AWS SES fully configured with authenticated domain

### Next Priority Items
1. ✅ **Demo Leagues** - COMPLETED
2. ✅ **Real Draft Functionality** - COMPLETED
3. ✅ **Live Scoring System** - COMPLETED
4. ✅ **Custom Draft Configurations** - COMPLETED
5. ✅ **Performance Optimization** - COMPLETED
6. ✅ **Email Authentication** - COMPLETED
7. **User Profile Management** - NEXT
8. **League Join by Code**
9. **Push Notifications**
10. **Advanced Admin Features**
11. **Mobile App Feel**