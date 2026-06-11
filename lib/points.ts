export function calculatePoints(
  voteHome: number,
  voteAway: number,
  actualHome: number,
  actualAway: number,
): number {
  if (
    voteHome == null ||
    voteAway == null ||
    actualHome == null ||
    actualAway == null
  )
    return 0;

  if (voteHome === actualHome && voteAway === actualAway) return 5;
  if (
    (voteHome > voteAway && actualHome > actualAway) ||
    (voteHome < voteAway && actualHome < actualAway) ||
    (voteHome === voteAway && actualHome === actualAway)
  )
    return 3;
  return 0;
}

export function formatStage(match: {
  stage: string;
  group_name?: string | null;
}): string {
  if (match.group_name) return `Grupo ${match.group_name}`;
  const map: Record<string, string> = {
    GROUP_STAGE: 'Fase de Grupos',
    LAST_32: '32 avos',
    ROUND_OF_16: 'Oitavas',
    QUARTER_FINALS: 'Quartas',
    SEMI_FINALS: 'Semi',
    FINAL: 'Final',
    THIRD_PLACE: '3º Lugar',
  };
  return map[match.stage] || match.stage || '';
}

export function canVote(matchDatetime: string): boolean {
  const now = new Date();
  const target = new Date(matchDatetime);
  const diffMin = (target.getTime() - now.getTime()) / 60000;
  return diffMin > 20;
}

export function formatCountdown(isoString: string): string {
  const now = new Date();
  const target = new Date(isoString);
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return 'Iniciando...';

  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hrs = Math.floor(min / 60);
  const days = Math.floor(hrs / 24);

  if (days > 0) return `${days}d ${hrs % 24}h ${min % 60}min`;
  if (hrs > 0) return `${hrs}h ${min % 60}min`;
  if (min > 0) return `${min}min`;
  return '< 1min';
}
