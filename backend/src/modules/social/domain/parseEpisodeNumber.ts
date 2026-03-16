export function parseEpisodeNumber(episodeId: string | undefined | null): number | null {
  if (!episodeId) return null;

  const direct = parseInt(episodeId, 10);
  if (!isNaN(direct) && direct > 0) {
    return direct;
  }

  const episodeMatch = episodeId.match(/(?:episode|ep)[-_]?(\d+)/i);
  if (episodeMatch) {
    return parseInt(episodeMatch[1], 10);
  }

  const seasonEpisodeMatch = episodeId.match(/s\d+e(\d+)/i);
  if (seasonEpisodeMatch) {
    return parseInt(seasonEpisodeMatch[1], 10);
  }

  const anyNumber = episodeId.match(/(\d+)/);
  if (anyNumber) {
    return parseInt(anyNumber[1], 10);
  }

  return null;
}
