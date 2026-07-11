/**
 * Parses a TTL string (e.g. "15m", "7d", "1h", "3600s") into milliseconds.
 * Supported units: s (seconds), m (minutes), h (hours), d (days).
 *
 * @author Saulo Santos
 * @date 11/07/2026
 * @throws Error if the format is invalid
 */
export function parseTtlToMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) {
    throw new Error(`Invalid TTL format: "${ttl}". Expected format: <number><s|m|h|d>`);
  }
  const amount = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * multipliers[unit];
}
