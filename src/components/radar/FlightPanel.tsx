import { Eye, Heart, TriangleAlert, X } from "lucide-react";
import { formatHm, phaseLabel, type LiveFlight } from "@/lib/flights";
import { isEmergencySquawk, squawkInfo } from "@/lib/squawk";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function FlightPanel({
  flight,
  aircraftImage,
  viewers = 0,
  isFavorite = false,
  canFavorite = false,
  onToggleFavorite,
  onClose,
}: {
  flight: LiveFlight;
  aircraftImage?: string | null;
  viewers?: number;
  isFavorite?: boolean;
  canFavorite?: boolean;
  onToggleFavorite?: (() => void) | undefined;
  onClose: () => void;
}) {
  const eta =
    flight.phase === "scheduled"
      ? `Departs in ${Math.max(flight.minutesToDeparture, 0)} min`
      : flight.phase === "arrived"
        ? "Arrived"
        : `Lands in ${Math.max(flight.minutesToArrival, 0)} min`;

  const squawk = flight.plan.squawk;
  const emergency = isEmergencySquawk(squawk);
  const info = squawkInfo(squawk);

  return (
    <div className="panel animate-fade-rise absolute inset-x-0 bottom-0 z-30 max-h-[74vh] overflow-hidden rounded-t-2xl">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <h2
            className={cn(
              "font-display text-2xl leading-none font-bold text-glow",
              emergency ? "text-destructive" : "text-primary",
            )}
          >
            {flight.plan.callsign}
          </h2>
          <p className="mt-1.5 truncate text-sm text-muted-foreground">
            {flight.plan.airline ? `${flight.plan.airline} · ` : ""}
            {flight.plan.aircraft}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="flex items-center gap-1 rounded-full border border-border bg-secondary/60 px-2 py-1 font-mono text-[11px] text-muted-foreground">
            <Eye className="size-3.5" /> {viewers}
          </span>
          {canFavorite && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleFavorite}
              aria-label={isFavorite ? "Remove favourite" : "Add favourite"}
            >
              <Heart className={cn("size-5", isFavorite && "fill-primary text-primary")} />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close flight panel">
            <X className="size-5" />
          </Button>
        </div>
      </div>

      {emergency && info && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-md border border-destructive/70 bg-destructive/15 px-3 py-2">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <div className="font-display text-sm text-destructive">
              SQUAWK {squawk} — {info.label}
            </div>
            <p className="text-xs text-muted-foreground">{info.description}</p>
          </div>
        </div>
      )}

      <ScrollArea className="max-h-[58vh]">
        {aircraftImage && (
          <img
            src={aircraftImage}
            alt={`${flight.plan.aircraft} in game`}
            className="mt-3 h-40 w-full object-cover"
            loading="lazy"
          />
        )}

        <div className="mt-4 flex items-center gap-3 px-4">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-lg text-foreground">{flight.dep.icao}</div>
            <div className="truncate text-xs text-muted-foreground">{flight.dep.name}</div>
            <div className="truncate font-mono text-xs text-primary">
              {formatHm(flight.plan.dep_time)}
            </div>
          </div>
          <div className="flex-[2]">
            <Progress value={flight.progress * 100} className="h-1.5" />
            <div className="mt-1.5 text-center font-display text-[11px] tracking-console text-primary">
              {phaseLabel(flight.phase)}
            </div>
          </div>
          <div className="min-w-0 flex-1 text-right">
            <div className="font-mono text-lg text-foreground">{flight.arr.icao}</div>
            <div className="truncate text-xs text-muted-foreground">{flight.arr.name}</div>
            <div className="truncate font-mono text-xs text-primary">
              {formatHm(flight.plan.arr_time)}
            </div>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-4 divide-x divide-border border-t border-border">
          {[
            ["ALT", `${flight.altitude.toLocaleString()} ft`],
            ["GS", `${flight.groundSpeed} kt`],
            ["HDG", `${Math.round((flight.heading + 360) % 360)}°`],
            ["SQK", squawk || "—"],
          ].map(([k, v]) => (
            <div key={k} className="px-2 py-3 text-center">
              <dt className="font-display text-[10px] tracking-console text-muted-foreground">{k}</dt>
              <dd className={cn("mt-0.5 font-mono text-sm", k === "SQK" && emergency ? "text-destructive" : "text-foreground")}>
                {v}
              </dd>
            </div>
          ))}
        </dl>

        {/* Filed flight plan */}
        <dl className="grid grid-cols-2 gap-2 border-t border-border p-4">
          {[
            ["Callsign", flight.plan.callsign],
            ["Aircraft", flight.plan.aircraft],
            ["From", flight.dep.icao],
            ["To", flight.arr.icao],
            ["Alternate", flight.plan.alternate_icao || "—"],
            [
              "Cruise",
              `FL${String(Math.round(flight.plan.cruise_alt / 100)).padStart(3, "0")} · ${flight.plan.cruise_speed} kt`,
            ],
            ["Airline", flight.plan.airline || "—"],
            ["ATC", flight.plan.atc_status],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md border border-border bg-secondary/50 px-3 py-2">
              <dt className="font-display text-[10px] tracking-console text-muted-foreground">{k}</dt>
              <dd className="truncate font-mono text-sm text-foreground">{v}</dd>
            </div>
          ))}
          <div className="col-span-2 rounded-md border border-border bg-secondary/50 px-3 py-2">
            <dt className="font-display text-[10px] tracking-console text-muted-foreground">Route</dt>
            <dd className="font-mono text-sm break-words text-foreground">
              {flight.plan.route?.trim() || "DCT"}
            </dd>
          </div>
          {flight.plan.atc_note && (
            <div className="col-span-2 rounded-md border border-border bg-secondary/50 px-3 py-2">
              <dt className="font-display text-[10px] tracking-console text-muted-foreground">ATC note</dt>
              <dd className="text-sm break-words text-foreground">{flight.plan.atc_note}</dd>
            </div>
          )}
        </dl>

        <p className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">{eta}</p>
      </ScrollArea>
    </div>
  );
}
