import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  Eye,
  Heart,
  MessageSquare,
  Plane,
  Radio,
  TriangleAlert,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SIDE_VIEW } from "@/lib/aircraft";
import { airlineBadge, useAirlines } from "@/lib/airlines";
import { formatHm, phaseLabel, type LiveFlight } from "@/lib/flights";
import { isEmergencySquawk, squawkInfo } from "@/lib/squawk";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

type AcarsRow = {
  id: string;
  label: string;
  body: string;
  sender_name: string;
  sender_role: string;
  created_at: string;
};

/** Pick a stable card accent per flight so the deck feels colourful but not random. */
const ACCENTS = ["deck-violet", "deck-gold", "deck-blue", "deck-olive"] as const;

function accentFor(flight: LiveFlight, emergency: boolean) {
  if (emergency) return "deck-red";
  let h = 0;
  for (const ch of flight.plan.callsign) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return ACCENTS[h % ACCENTS.length];
}

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
  const squawk = flight.plan.squawk;
  const emergency = isEmergencySquawk(squawk);
  const info = squawkInfo(squawk);
  const accent = accentFor(flight, emergency);

  const eta =
    flight.phase === "scheduled"
      ? `Departs in ${Math.max(flight.minutesToDeparture, 0)} min`
      : flight.phase === "arrived"
        ? "Arrived"
        : `Lands in ${Math.max(flight.minutesToArrival, 0)} min`;

  const { data: messages = [] } = useQuery({
    queryKey: ["acars", flight.plan.id],
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acars_messages")
        .select("id,label,body,sender_name,sender_role,created_at")
        .eq("flight_plan_id", flight.plan.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as AcarsRow[];
    },
  });

  const latest = messages[0];
  const pct = Math.round(flight.progress * 100);

  const { data: airlines = [] } = useAirlines();
  const airline =
    airlines.find((a) => a.name.toLowerCase() === (flight.plan.airline ?? "").toLowerCase()) ?? null;

  return (
    <div className="animate-fade-rise absolute inset-x-0 bottom-0 z-30 max-h-[82vh] rounded-t-3xl border border-border bg-card/95 backdrop-blur-xl">
      <div className="flex justify-center pt-2.5 pb-1">
        <span className="sheet-grab" />
      </div>

      <ScrollArea className="max-h-[76vh]">
        <div className="space-y-3 px-3 pb-6">
          {/* Hero card */}
          <section className={cn("deck-card relative p-4", accent)}>
            {aircraftImage && (
              <img
                src={aircraftImage}
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 size-full object-cover opacity-20 mix-blend-overlay"
                loading="lazy"
              />
            )}

            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="deck-ink-soft font-display text-[11px] tracking-console">
                  {phaseLabel(flight.phase)} · {pct}%
                </p>
                <h2 className="deck-ink font-display text-4xl leading-none font-bold">
                  {flight.plan.callsign}
                </h2>
                <p className="deck-ink-soft mt-1.5 truncate font-mono text-sm">
                  {flight.dep.icao} → {flight.arr.icao} · {flight.plan.aircraft}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="deck-chip flex items-center gap-1 rounded-full px-2 py-1 font-mono text-[11px]">
                  <Eye className="size-3.5" /> {viewers}
                </span>
                {canFavorite && (
                  <button
                    onClick={onToggleFavorite}
                    aria-label={isFavorite ? "Remove favourite" : "Add favourite"}
                    className="deck-chip flex size-8 items-center justify-center rounded-full"
                  >
                    <Heart className={cn("size-4", isFavorite && "fill-current")} />
                  </button>
                )}
                <button
                  onClick={onClose}
                  aria-label="Close flight panel"
                  className="deck-chip flex size-8 items-center justify-center rounded-full"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Dispatch / ACARS message box */}
            <div className="deck-note relative mt-4 px-3 py-2.5">
              <div className="deck-ink-soft flex items-center gap-1.5 font-display text-[10px] tracking-console">
                <MessageSquare className="size-3" />
                {latest ? `${latest.label} · ${latest.sender_name}` : "Dispatch"}
              </div>
              <p className="deck-ink mt-1 font-mono text-[13px] leading-snug break-words">
                {latest?.body ??
                  flight.plan.atc_note ??
                  `${flight.plan.callsign}, cleared as filed via ${flight.plan.route?.trim() || "DCT"}.`}
              </p>
            </div>

            {/* Timeline */}
            <div className="relative mt-4">
              <div className="deck-ink flex items-end justify-between font-mono text-sm">
                <span>{formatHm(flight.plan.dep_time)}</span>
                <span>{formatHm(flight.plan.arr_time)}</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-[oklch(0.15_0.02_260/0.4)]">
                <div
                  className="h-full rounded-full bg-[var(--deck-ink)] transition-[width] duration-700"
                  style={{ width: `${Math.min(Math.max(pct, 2), 100)}%` }}
                />
              </div>
              <div className="deck-ink-soft mt-1 flex justify-between text-[11px]">
                <span className="truncate">{flight.dep.name}</span>
                <span className="truncate text-right">{flight.arr.name}</span>
              </div>
            </div>
          </section>

          {emergency && info && (
            <section className="flex items-start gap-2 rounded-xl border border-destructive/70 bg-destructive/15 px-3 py-2.5">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <div className="font-display text-sm text-destructive">
                  SQUAWK {squawk} — {info.label}
                </div>
                <p className="text-xs text-muted-foreground">{info.description}</p>
              </div>
            </section>
          )}

          {/* Live figures */}
          <section className="grid grid-cols-4 overflow-hidden rounded-xl border border-border bg-secondary/40">
            {[
              ["ALT", `${flight.altitude.toLocaleString()} ft`],
              ["GS", `${flight.groundSpeed} kt`],
              ["HDG", `${Math.round((flight.heading + 360) % 360)}°`],
              ["SQK", squawk || "—"],
            ].map(([k, v]) => (
              <div key={k} className="px-2 py-3 text-center not-last:border-r not-last:border-border">
                <div className="font-display text-[10px] tracking-console text-muted-foreground">{k}</div>
                <div
                  className={cn(
                    "mt-0.5 font-mono text-sm",
                    k === "SQK" && emergency ? "text-destructive" : "text-foreground",
                  )}
                >
                  {v}
                </div>
              </div>
            ))}
          </section>

          <Accordion type="multiple" className="space-y-2">
            <Section value="aircraft" icon={<Plane className="size-4" />} title="Aircraft">
              <LiveryPlane
                name={flight.plan.airline || "Private"}
                logo={airline?.logo_url ?? null}
                tag={airline ? airlineBadge(airline) : (flight.plan.airline || "PVT").slice(0, 3).toUpperCase()}
              />
              {aircraftImage && (
                <img
                  src={aircraftImage}
                  alt={`${flight.plan.aircraft} in game`}
                  className="mb-3 h-36 w-full rounded-lg object-cover"
                  loading="lazy"
                />
              )}
              <Rows
                rows={[
                  ["Type", flight.plan.aircraft],
                  ["Airline", flight.plan.airline || "—"],
                  [
                    "Cruise",
                    `FL${String(Math.round(flight.plan.cruise_alt / 100)).padStart(3, "0")} · ${flight.plan.cruise_speed} kt`,
                  ],
                  ["ATC", flight.plan.atc_status],
                ]}
              />
            </Section>

            <Section
              value="acars"
              icon={<MessageSquare className="size-4" />}
              title={`ACARS messages${messages.length ? ` · ${messages.length}` : ""}`}
            >
              {messages.length === 0 ? (
                <p className="text-xs text-muted-foreground">No datalink traffic for this flight yet.</p>
              ) : (
                <ul className="space-y-2">
                  {messages.map((m) => (
                    <li key={m.id} className="rounded-lg border border-border bg-secondary/50 px-3 py-2">
                      <div className="flex items-center justify-between font-display text-[10px] tracking-console text-muted-foreground">
                        <span>
                          {m.label} · {m.sender_name}
                        </span>
                        <span className="font-mono">
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[13px] break-words text-foreground">{m.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section
              value="dep"
              icon={<Radio className="size-4" />}
              title={`${flight.dep.icao} departure`}
            >
              <Rows
                rows={[
                  ["Airport", flight.dep.name],
                  ["Off blocks", formatHm(flight.plan.dep_time)],
                  ["Route", flight.plan.route?.trim() || "DCT"],
                ]}
              />
            </Section>

            <Section
              value="arr"
              icon={<Radio className="size-4" />}
              title={`${flight.arr.icao} arrival`}
            >
              <Rows
                rows={[
                  ["Airport", flight.arr.name],
                  ["On blocks", formatHm(flight.plan.arr_time)],
                  ["Alternate", flight.plan.alternate_icao || "—"],
                  ["Status", eta],
                ]}
              />
            </Section>
          </Accordion>

          <Button variant="secondary" className="w-full gap-2 rounded-xl" onClick={onClose}>
            <ChevronDown className="size-4" /> Back to map
          </Button>
        </div>
      </ScrollArea>
    </div>
  );
}

function Section({
  value,
  icon,
  title,
  children,
}: {
  value: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem
      value={value}
      className="overflow-hidden rounded-xl border border-border bg-secondary/30 px-3 last:border-b"
    >
      <AccordionTrigger className="py-3 font-display text-sm tracking-console hover:no-underline">
        <span className="flex items-center gap-2 text-foreground">
          <span className="text-primary">{icon}</span>
          {title}
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-3">{children}</AccordionContent>
    </AccordionItem>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="space-y-1.5">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-3">
          <dt className="font-display text-[11px] tracking-console text-muted-foreground">{k}</dt>
          <dd className="max-w-[62%] text-right font-mono text-[13px] break-words text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
