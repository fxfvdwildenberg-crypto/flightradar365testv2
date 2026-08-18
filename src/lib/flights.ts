import { airportByIcao, type Airport } from "./world";

export type FlightPlan = {
  id: string;
  user_id: string;
  callsign: string;
  airline: string | null;
  aircraft: string;
  dep_icao: string;
  arr_icao: string;
  alternate_icao: string | null;
  dep_time: string;
  arr_time: string;
  cruise_alt: number;
  cruise_speed: number;
  route: string | null;
  status: string;
  squawk: string;
  atc_status: string;
  atc_note: string | null;
};


export type FlightPhase = "scheduled" | "departing" | "enroute" | "arriving" | "arrived";

export type LiveFlight = {
  plan: FlightPlan;
  dep: Airport;
  arr: Airport;
  /** 0 before departure, 1 after arrival. */
  progress: number;
  phase: FlightPhase;
  x: number;
  y: number;
  heading: number;
  altitude: number;
  groundSpeed: number;
  minutesToDeparture: number;
  minutesToArrival: number;
};

const MIN = 60_000;

function easeClimb(p: number) {
  // Climb over the first 15%, cruise, descend over the last 20%.
  if (p <= 0.15) return p / 0.15;
  if (p >= 0.8) return Math.max(0, (1 - p) / 0.2);
  return 1;
}

export function computeFlight(plan: FlightPlan, now: number): LiveFlight | null {
  const dep = airportByIcao(plan.dep_icao);
  const arr = airportByIcao(plan.arr_icao);
  if (!dep || !arr) return null;

  const depMs = new Date(plan.dep_time).getTime();
  const arrMs = new Date(plan.arr_time).getTime();
  const total = Math.max(arrMs - depMs, MIN);
  const raw = (now - depMs) / total;
  const progress = Math.min(1, Math.max(0, raw));

  let phase: FlightPhase;
  if (raw <= 0) phase = "scheduled";
  else if (raw >= 1) phase = "arrived";
  else if (progress < 0.12) phase = "departing";
  else if (progress > 0.85) phase = "arriving";
  else phase = "enroute";

  // Slight great-circle-like bow so tracks don't look like plain rulers.
  const dx = arr.x - dep.x;
  const dy = arr.y - dep.y;
  const dist = Math.hypot(dx, dy) || 1;
  const bow = Math.min(dist * 0.08, 24);
  const nx = -dy / dist;
  const ny = dx / dist;
  const arc = Math.sin(progress * Math.PI) * bow;

  const x = dep.x + dx * progress + nx * arc;
  const y = dep.y + dy * progress + ny * arc;

  const step = 0.01;
  const p2 = Math.min(1, progress + step);
  const arc2 = Math.sin(p2 * Math.PI) * bow;
  const x2 = dep.x + dx * p2 + nx * arc2;
  const y2 = dep.y + dy * p2 + ny * arc2;
  const heading = (Math.atan2(y2 - y || dy, x2 - x || dx) * 180) / Math.PI + 90;

  const altitude =
    phase === "scheduled" || phase === "arrived"
      ? phase === "scheduled"
        ? dep.elevation
        : arr.elevation
      : Math.round(plan.cruise_alt * easeClimb(progress));

  // Ground speed mirrors the speed filed in the flight plan.
  const groundSpeed = Math.round(plan.cruise_speed);

  return {
    plan,
    dep,
    arr,
    progress,
    phase,
    x,
    y,
    heading,
    altitude,
    groundSpeed: phase === "scheduled" || phase === "arrived" ? 0 : groundSpeed,
    minutesToDeparture: Math.round((depMs - now) / MIN),
    minutesToArrival: Math.round((arrMs - now) / MIN),
  };
}

export function isVisibleOnRadar(f: LiveFlight, now: number): boolean {
  // Show active flights, plus flights within 30 min of pushback and 20 min
  // after landing (still parked at the gate, like FR24 does).
  const depMs = new Date(f.plan.dep_time).getTime();
  const arrMs = new Date(f.plan.arr_time).getTime();
  return now >= depMs - 30 * MIN && now <= arrMs + 20 * MIN;
}

export function formatHm(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function phaseLabel(phase: FlightPhase): string {
  switch (phase) {
    case "scheduled":
      return "Scheduled";
    case "departing":
      return "Departing";
    case "enroute":
      return "En route";
    case "arriving":
      return "Arriving";
    default:
      return "Arrived";
  }
}
