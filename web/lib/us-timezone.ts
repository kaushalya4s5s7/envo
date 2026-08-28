/**
 * Coordinate to IANA timezone, contiguous US plus Alaska and Hawaii.
 *
 * Longitude bands, not a shapefile. Zone borders follow county lines, so a
 * building within roughly 100 km of a boundary can resolve to the neighbouring
 * zone — and the Arizona exception below is handled because it is large and
 * common, not because the list is complete.
 *
 * The consequence of a miss is that every hour in the brief shifts by one, so
 * the resolved zone is shown to the user on the confirmation step rather than
 * applied silently. A real deployment replaces this with a tz shapefile lookup.
 */
export function usTimezone(lat: number, lon: number): string {
  if (lon < -141) return 'America/Anchorage';
  if (lat < 23 && lon < -150) return 'Pacific/Honolulu';
  if (lat > 51 && lon < -130) return 'America/Anchorage';
  // Arizona observes no daylight saving, so it parts from Denver for half the year.
  if (lat > 31 && lat < 37.1 && lon > -115 && lon < -109) return 'America/Phoenix';
  if (lon < -114) return 'America/Los_Angeles';
  if (lon < -101.5) return 'America/Denver';
  if (lon < -87) return 'America/Chicago';
  return 'America/New_York';
}
