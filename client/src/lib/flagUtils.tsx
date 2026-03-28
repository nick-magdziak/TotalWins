const isWindows = typeof navigator !== "undefined" && /Win/i.test(navigator.platform);

const TEAM_FLAG_CODES: Record<string, string> = {
  "wc-MEX": "mx",
  "wc-RSA": "za",
  "wc-KOR": "kr",
  "wc-CAN": "ca",
  "wc-SUI": "ch",
  "wc-QAT": "qa",
  "wc-BRA": "br",
  "wc-MAR": "ma",
  "wc-SCO": "gb-sct",
  "wc-HAI": "ht",
  "wc-USA": "us",
  "wc-PAR": "py",
  "wc-AUS": "au",
  "wc-GER": "de",
  "wc-ECU": "ec",
  "wc-CIV": "ci",
  "wc-CUW": "cw",
  "wc-NED": "nl",
  "wc-JPN": "jp",
  "wc-TUN": "tn",
  "wc-BEL": "be",
  "wc-IRN": "ir",
  "wc-EGY": "eg",
  "wc-NZL": "nz",
  "wc-ESP": "es",
  "wc-URU": "uy",
  "wc-KSA": "sa",
  "wc-CPV": "cv",
  "wc-FRA": "fr",
  "wc-SEN": "sn",
  "wc-NOR": "no",
  "wc-ARG": "ar",
  "wc-AUT": "at",
  "wc-ALG": "dz",
  "wc-JOR": "jo",
  "wc-POR": "pt",
  "wc-COL": "co",
  "wc-UZB": "uz",
  "wc-ENG": "gb-eng",
  "wc-CRO": "hr",
  "wc-GHA": "gh",
  "wc-PAN": "pa",
};

function getFlagUrl(teamId: string | undefined): string | null {
  if (!teamId) return null;
  const code = TEAM_FLAG_CODES[teamId];
  if (!code) return null;
  return `https://flagcdn.com/w20/${code}.png`;
}

interface FlagImageProps {
  teamId: string | undefined;
  emoji?: string | null;
  name?: string;
  size?: number;
  className?: string;
}

export function FlagImage({ teamId, emoji, name, size = 20, className = "" }: FlagImageProps) {
  if (!isWindows && emoji) {
    return <span className={`text-sm leading-none ${className}`}>{emoji}</span>;
  }

  const url = getFlagUrl(teamId);
  if (!url) {
    return <span className={`text-sm leading-none ${className}`}>🏳️</span>;
  }
  return (
    <img
      src={url}
      alt={name || teamId || "flag"}
      width={size}
      height={Math.round(size * 0.67)}
      className={`inline-block object-cover rounded-sm ${className}`}
      style={{ minWidth: size }}
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        target.style.display = "none";
      }}
    />
  );
}
