import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type NFLTeam } from "@shared/schema";
import { TEAM_ICONS } from "@/lib/constants";

interface TeamCardProps {
  team: NFLTeam;
  isAvailable: boolean;
  takenBy?: string;
  onSelect?: (teamId: string) => void;
  disabled?: boolean;
}

export default function TeamCard({ team, isAvailable, takenBy, onSelect, disabled }: TeamCardProps) {
  const teamIcon = TEAM_ICONS[team.abbreviation as keyof typeof TEAM_ICONS] || "🏈";

  const handleClick = () => {
    if (isAvailable && !disabled && onSelect) {
      onSelect(team.id);
    }
  };

  if (!isAvailable) {
    return (
      <div className="team-card-taken">
        <Button
          disabled
          className="w-full p-4 bg-gray-300 rounded-xl cursor-not-allowed opacity-50"
        >
          <div className="text-center">
            <div className="text-3xl mb-2">{teamIcon}</div>
            <div className="font-bold text-gray-600 retro-font">{team.city.toUpperCase()}</div>
            <div className="text-sm text-gray-600 opacity-75">{team.name}</div>
            <div className="text-xs mt-2">
              <Badge className="bg-retro-pink text-white">TAKEN - {takenBy}</Badge>
            </div>
          </div>
        </Button>
      </div>
    );
  }

  return (
    <div className="team-card-available">
      <Button
        onClick={handleClick}
        disabled={disabled}
        className="w-full p-4 bg-gradient-to-br from-retro-teal to-retro-lime rounded-xl hover:scale-105 transform transition-all duration-200 shadow-lg border-2 border-transparent hover:border-retro-yellow text-retro-charcoal"
      >
        <div className="text-center">
          <div className="text-3xl mb-2">{teamIcon}</div>
          <div className="font-bold retro-font">{team.city.toUpperCase()}</div>
          <div className="text-sm opacity-75">{team.name}</div>
          <div className="text-xs mt-2">
            <Badge className="bg-retro-charcoal text-white">
              {team.wins}-{team.losses}-{team.ties}
            </Badge>
          </div>
          <div className="text-xs mt-1">
            <Badge className="bg-retro-charcoal text-white">AVAILABLE</Badge>
          </div>
        </div>
      </Button>
    </div>
  );
}
