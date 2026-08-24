import { z } from 'zod';

export const Facade = z.object({
  id: z.string().min(1),
  /** Compass bearing the facade points toward, degrees clockwise from north. */
  azimuthDeg: z.number().min(0).lt(360),
  /** Glazed area, m². */
  glazedAreaM2: z.number().positive(),
  /** Whether this facade has a controllable tint or shade. */
  tintable: z.boolean(),
});
export type Facade = z.infer<typeof Facade>;

export const Building = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Binds the building to one cell of the segment grid. */
  segmentId: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  floorAreaM2: z.number().positive(),
  /**
   * The setpoint this building actually holds when nothing is intervening, °F.
   *
   * **Read from the building, never assumed.** Driving a DOE medium office to our
   * own 72 °F constant, where it runs 75.2 °F, cost 2.08× the energy of leaving
   * it alone. In a real deployment this is read from the BMS during the shadow
   * phase. docs/decisions/platform/sandbox-findings.md
   */
  nominalSetpointF: z.number(),
  /**
   * Hours of thermal coast at design load. Higher means pre cooling buys more.
   * Modeled, not measured.
   */
  thermalMassHours: z.number().positive(),
  facades: z.array(Facade).min(1),
});
export type Building = z.infer<typeof Building>;
