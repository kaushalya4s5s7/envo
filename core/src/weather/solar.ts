import { cloudPercentToFraction } from '../utils';

/**
 * Solar geometry and cloud de rating. Pure trigonometry, no vendor coupling.
 *
 * FortyGuard returns `solar_irradiance.clear_sky.dni`, explicitly clear sky and
 * as a single value per location rather than per timestamp. So two steps are
 * mandatory before any tint decision: project the beam onto the facade the sun
 * is actually hitting, then de rate it for the cloud that is actually there.
 * Skipping the second step tints a west facade on an overcast day.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export interface SolarPosition {
  /** Degrees above the horizon. Negative when the sun is down. */
  altitudeDeg: number;
  /** Compass bearing of the sun, degrees clockwise from north. */
  azimuthDeg: number;
}

/**
 * NOAA low precision algorithm. Accurate to a fraction of a degree, which is far
 * inside the resolution any tint decision cares about.
 */
export function solarPosition(at: Date, site: { lat: number; lon: number }): SolarPosition {
  const dayMs = 86_400_000;
  const daysSinceEpoch = at.getTime() / dayMs - 0.5 + 2440588 - 2451545;

  const meanAnomaly = (357.5291 + 0.98560028 * daysSinceEpoch) * RAD;
  const centre =
    (1.9148 * Math.sin(meanAnomaly) +
      0.02 * Math.sin(2 * meanAnomaly) +
      0.0003 * Math.sin(3 * meanAnomaly)) * RAD;
  const eclipticLongitude = meanAnomaly + centre + 102.9372 * RAD + Math.PI;

  const obliquity = 23.4397 * RAD;
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLongitude),
    Math.cos(eclipticLongitude),
  );

  const siderealTime = (280.16 + 360.9856235 * daysSinceEpoch) * RAD + site.lon * RAD;
  const hourAngle = siderealTime - rightAscension;
  const lat = site.lat * RAD;

  const altitude = Math.asin(
    Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle),
  );
  // Measured from north, clockwise, so it lines up with facade azimuths.
  const azimuth = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(lat) - Math.tan(declination) * Math.cos(lat),
  );

  return {
    altitudeDeg: altitude * DEG,
    azimuthDeg: (azimuth * DEG + 180 + 360) % 360,
  };
}

/**
 * Direct beam landing on a vertical facade, W/m².
 *
 * Zero when the sun is below the horizon or behind the wall. This is why total
 * irradiance is the wrong number: a west facade at 16:00 under high DNI is a
 * furnace, while the same total as mostly diffuse on an overcast day is not.
 */
export function beamOnFacade(dniWm2: number, facadeAzimuthDeg: number, sun: SolarPosition): number {
  if (sun.altitudeDeg <= 0) return 0;

  const relative = Math.abs(((sun.azimuthDeg - facadeAzimuthDeg + 540) % 360) - 180);
  if (relative >= 90) return 0;                       // sun is behind the facade

  const incidence = Math.cos(sun.altitudeDeg * RAD) * Math.cos(relative * RAD);
  return Math.max(0, dniWm2 * incidence);
}

/**
 * De rate clear sky irradiance for observed cloud cover.
 *
 * Direct beam collapses far faster than total irradiance under cloud, because
 * cloud converts beam into diffuse rather than destroying it.
 */
export function derateForCloud(beamWm2: number, cloudCoverPercent: number): number {
  const fraction = cloudPercentToFraction(cloudCoverPercent);
  return beamWm2 * (1 - 0.9 * Math.pow(fraction, 1.4));
}
