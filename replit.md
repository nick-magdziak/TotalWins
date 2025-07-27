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
- **Typography**: Custom retro fonts with neon glow effects
- **Layout**: Responsive design with mobile-first approach
- **Components**: Reusable UI components from Shadcn/ui library
- **App Name**: "TOTAL WINS" displayed in all caps throughout the application

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