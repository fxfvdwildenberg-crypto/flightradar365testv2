import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ExternalLink,
  Map as MapIcon,
  Pencil,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Radio,
  Settings2,
  Square,
  Volume2,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { airportByIcao } from "@/lib/world";
import { formatHm, phaseLabel, type LiveFlight } from "@/lib/flights";
import {
  POSITIONS,
  atisReport,
  atisSpokenText,
  speakAtis,
  stopAtisSpeech,
  type Atis,
  type AtcSession,
} from "@/lib/atc";
import { chartsFor } from "@/lib/charts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function AirportPanel({
  icao,
  flights,
  sessions = [],
  onClose,
  onEditAtis,
  onEditAirport,
  onGoOnline,
  canEditAtis,
  isAdmin = false,
  onSelectFlight,
}: {
  icao: string;
  flights: LiveFlight[];
  sessions?: AtcSession[];
  onClose: () => void;
  onEditAtis: () => void;
  onEditAirport?: (() => void) | undefined;
  onGoOnline?: (() => void) | undefined;
  canEditAtis: boolean;
  isAdmin?: boolean;
  onSelectFlight: (id: string) => void;
}) {
  const airport = airportByIcao(icao);
  const [speaking, setSpeaking] = useState(false);

  const { data: atis } = useQuery({
    queryKey: ["atis", icao],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atis")
        .select("*")
        .eq("airport_icao", icao)
        .eq("active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Atis | null;
    },
  });

  if (!airport) return null;

  const departures = flights.filter((f) => f.plan.dep_icao === icao);
  const arrivals = flights.filter((f) => f.plan.arr_icao === icao);

  const toggleSpeech = () => {
    if (speaking) {
      stopAtisSpeech();
      setSpeaking(false);
      return;
    }
    if (!atis) return;
    const ok = speakAtis(atisSpokenText(atis, airport.name));
    setSpeaking(ok);
  };

  return (
    <div className="deck-surface animate-deck-in absolute inset-x-0 bottom-0 z-30 max-h-[82dvh] overflow-hidden rounded-t-3xl">
      <div className="flex justify-center pt-2.5 pb-1">
        <span className="sheet-grab" />
      </div>
      <div className="deck-hairline flex items-start justify-between gap-3 px-4 pt-2 pb-3">
        <div className="min-w-0">
          <h2 className="font-display text-2xl leading-none font-semibold text-primary text-glow">
            {airport.name}
          </h2>
          <div className="mt-2 flex items-center gap-2 font-mono text-sm text-foreground">
            {airport.icao}
            {airport.iata ? ` / ${airport.iata}` : ""}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })} LT
            {"  •  "}Elev {airport.elevation} ft{"  •  "}RWY{" "}
            {String(Math.round(airport.runway / 10)).padStart(2, "0")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isAdmin && onEditAirport && (
            <Button variant="ghost" size="icon" onClick={onEditAirport} aria-label="Edit airport">
              <Settings2 className="size-5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close airport panel">
            <X className="size-5" />
          </Button>
        </div>
      </div>

      {/* Online ATC strip */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2.5">
        {POSITIONS.map((p) => {
          const s = sessions.find((x) => x.position === p.key);
          return (
            <span
              key={p.key}
              title={
                s
                  ? `${p.label}: ${s.roblox_username ?? "unknown"}${s.discord_username ? ` (${s.discord_username})` : ""}`
                  : `${p.label} offline`
              }
              className={cn(
                "flex size-7 items-center justify-center rounded font-display text-sm font-bold",
                s ? "bg-[#2ecc71] text-[#04121f]" : "bg-secondary text-muted-foreground",
              )}
            >
              {p.short}
            </span>
          );
        })}
        {atis && (
          <span className="flex size-7 items-center justify-center rounded bg-primary font-display text-sm font-bold text-primary-foreground">
            {atis.letter}
          </span>
        )}
        {canEditAtis && onGoOnline && (
          <Button size="sm" variant="secondary" className="ml-auto h-7" onClick={onGoOnline}>
            Go online
          </Button>
        )}
      </div>

      <Tabs defaultValue="atis" className="w-full">
        <TabsList className="grid w-full grid-cols-5 rounded-none border-b border-border bg-transparent p-0">
          {[
            ["atis", <Radio key="i" className="mr-1.5 size-4" />, "ATIS"],
            ["charts", <MapIcon key="i" className="mr-1.5 size-4" />, "Charts"],
            ["info", <Plane key="i" className="mr-1.5 size-4" />, "Info"],
            ["dep", <PlaneTakeoff key="i" className="mr-1.5 size-4" />, "Dep"],
            ["arr", <PlaneLanding key="i" className="mr-1.5 size-4" />, "Arr"],

          ].map(([value, icon, label]) => (
            <TabsTrigger
              key={value as string}
              value={value as string}
              className="rounded-none py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"
            >
              {icon as React.ReactNode} {label as string}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="deck-fade-y max-h-[52dvh] overflow-x-hidden overflow-y-auto overscroll-contain">
          <TabsContent value="atis" className="m-0 p-4">
            {atis ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-md bg-primary font-display text-2xl font-bold text-primary-foreground">
                    {atis.letter}
                  </div>
                  <div className="flex-1">
                    <div className="font-display tracking-console text-xs text-muted-foreground">
                      Information {atis.letter}
                    </div>
                    <div className="text-sm text-foreground">Updated {formatHm(atis.updated_at)} Z</div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={toggleSpeech}>
                    {speaking ? (
                      <>
                        <Square className="mr-1.5 size-4" /> Stop
                      </>
                    ) : (
                      <>
                        <Volume2 className="mr-1.5 size-4" /> Listen
                      </>
                    )}
                  </Button>
                </div>
                <pre className="rounded-md border border-border bg-secondary/50 p-3 font-mono text-[12px] leading-relaxed break-words whitespace-pre-wrap text-foreground">
                  {atisReport(atis, airport.name)}
                </pre>

              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No ATIS published for {airport.icao}.
              </p>
            )}
            {canEditAtis && (
              <Button className="mt-4 w-full" variant="secondary" onClick={onEditAtis}>
                <Pencil className="mr-2 size-4" />
                {atis ? "Update ATIS" : "Publish ATIS"}
              </Button>
            )}
          </TabsContent>

          <TabsContent value="charts" className="m-0 space-y-3 p-4">
            {chartsFor(airport.icao).map((chart) =>
              chart.kind === "image" ? (
                <figure key={chart.key} className="space-y-2">
                  <img
                    src={chart.url}
                    alt={`${airport.name} ground chart`}
                    className="w-full rounded-lg border border-border bg-secondary/40"
                    loading="lazy"
                  />
                  <figcaption className="font-mono text-[11px] text-muted-foreground">
                    {chart.label}
                  </figcaption>
                </figure>
              ) : (
                <Button
                  key={chart.key}
                  asChild
                  variant="secondary"
                  className="w-full justify-start gap-2"
                >
                  <a href={chart.url} target="_blank" rel="noreferrer noopener">
                    <ExternalLink className="size-4" /> {chart.label}
                  </a>
                </Button>
              ),
            )}
          </TabsContent>

          <TabsContent value="info" className="m-0 space-y-3 p-4">

            {airport.image_url && (
              <img
                src={airport.image_url}
                alt={`${airport.name} seen in game`}
                className="h-40 w-full rounded-lg object-cover"
                loading="lazy"
              />
            )}
            <p className="text-sm text-foreground">
              {airport.info?.trim() || "No airport information published yet."}
            </p>
            <div className="space-y-2">
              <div className="font-display text-[11px] tracking-console text-muted-foreground">
                Controllers online
              </div>
              {sessions.length ? (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {sessions.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                      <Badge variant="secondary" className="font-mono text-[10px] uppercase">
                        {s.position}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-foreground">
                          {s.roblox_username ?? "Unknown pilot"}
                        </div>
                        <div className="truncate font-mono text-[11px] text-muted-foreground">
                          {s.discord_username ?? "no discord"}
                        </div>
                      </div>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        since {formatHm(s.started_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No ATC online at this airport.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="dep" className="m-0">
            <FlightRows list={departures} mode="dep" onSelectFlight={onSelectFlight} />
          </TabsContent>
          <TabsContent value="arr" className="m-0">
            <FlightRows list={arrivals} mode="arr" onSelectFlight={onSelectFlight} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function FlightRows({
  list,
  mode,
  onSelectFlight,
}: {
  list: LiveFlight[];
  mode: "dep" | "arr";
  onSelectFlight: (id: string) => void;
}) {
  if (!list.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No {mode === "dep" ? "departures" : "arrivals"} scheduled.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {list.map((f) => (
        <li key={f.plan.id}>
          <button
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
            onClick={() => onSelectFlight(f.plan.id)}
          >
            <div className="w-14 shrink-0 font-mono text-sm text-primary">
              {formatHm(mode === "dep" ? f.plan.dep_time : f.plan.arr_time)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-base font-semibold text-foreground">
                {mode === "dep" ? f.arr.name : f.dep.name}
              </div>
              <div className="truncate font-mono text-xs text-muted-foreground">
                {f.plan.callsign} · {f.plan.aircraft}
              </div>
            </div>
            <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
              {phaseLabel(f.phase)}
            </Badge>
            <Plane className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </li>
      ))}
    </ul>
  );
}
