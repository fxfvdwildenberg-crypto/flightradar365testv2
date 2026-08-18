import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Crosshair, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ISLANDS } from "@/lib/world";
import type { AirportRow } from "@/lib/airports";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const EMPTY: AirportRow = {
  icao: "",
  iata: "",
  name: "",
  island: "greater-rockford",
  x: 500,
  y: 500,
  runway: 0,
  elevation: 0,
  major: false,
  info: "",
  image_url: "",
};

/** Admin console: manage airports and per-aircraft in-game photos. */
export function AdminDialog({
  open,
  onOpenChange,
  initialIcao,
  pendingPoint,
  onRequestPlace,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialIcao?: string | null;
  pendingPoint?: { x: number; y: number } | null;
  onRequestPlace?: (() => void) | undefined;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(initialIcao ?? null);

  const { data: airports = [] } = useQuery({
    queryKey: ["admin_airports"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("airports").select("*").order("icao");
      if (error) throw error;
      return data as AirportRow[];
    },
  });

  const current = useMemo(
    () => airports.find((a) => a.icao === editing) ?? null,
    [airports, editing],
  );


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="font-display text-xl tracking-console text-primary">
            Admin console
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="airports">
          <TabsList className="mx-4 mt-3 grid grid-cols-2">
            <TabsTrigger value="airports">Airports</TabsTrigger>
            <TabsTrigger value="aircraft">Aircraft photos</TabsTrigger>
          </TabsList>

          <TabsContent value="airports" className="m-0">
            <ScrollArea className="max-h-[64vh]">
              <div className="space-y-4 p-4">
                <AirportForm
                  key={`${current?.icao ?? "new"}-${pendingPoint ? `${pendingPoint.x},${pendingPoint.y}` : ""}`}
                  initial={
                    pendingPoint
                      ? { ...(current ?? EMPTY), x: pendingPoint.x, y: pendingPoint.y }
                      : (current ?? EMPTY)
                  }
                  isNew={!current}
                  onRequestPlace={onRequestPlace}
                  onDone={() => {
                    qc.invalidateQueries({ queryKey: ["admin_airports"] });
                    qc.invalidateQueries({ queryKey: ["airports"] });
                    setEditing(null);
                  }}
                />


                <div className="border-t border-border pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-display text-[11px] tracking-console text-muted-foreground">
                      {airports.length} airports
                    </span>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>
                      <Plus className="mr-1 size-4" /> New
                    </Button>
                  </div>
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {airports.map((a) => (
                      <li key={a.icao} className="flex items-center gap-2 px-3 py-2">
                        <button
                          className="min-w-0 flex-1 text-left"
                          onClick={() => setEditing(a.icao)}
                        >
                          <div className="truncate text-sm text-foreground">{a.name}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {a.icao} · {a.island} · {Math.round(a.x)},{Math.round(a.y)}
                          </div>
                        </button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete ${a.icao}`}
                          onClick={async () => {
                            const { error } = await supabase
                              .from("airports")
                              .delete()
                              .eq("icao", a.icao);
                            if (error) {
                              toast.error(error.message);
                              return;
                            }
                            toast.success(`${a.icao} removed`);
                            qc.invalidateQueries({ queryKey: ["admin_airports"] });
                            qc.invalidateQueries({ queryKey: ["airports"] });
                          }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="aircraft" className="m-0">
            <ScrollArea className="max-h-[64vh]">
              <AircraftImages />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function AirportForm({
  initial,
  isNew,
  onDone,
  onRequestPlace,
}: {
  initial: AirportRow;
  isNew: boolean;
  onDone: () => void;
  onRequestPlace?: (() => void) | undefined;
}) {

  const [f, setF] = useState<AirportRow>(initial);
  const set = <K extends keyof AirportRow>(k: K, v: AirportRow[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      if (!f.icao.trim() || !f.name.trim()) throw new Error("ICAO and name are required");
      const { error } = await supabase.from("airports").upsert({
        icao: f.icao.trim().toUpperCase(),
        iata: f.iata?.trim() || null,
        name: f.name.trim(),
        island: f.island,
        x: Number(f.x),
        y: Number(f.y),
        runway: Number(f.runway),
        elevation: Number(f.elevation),
        major: f.major,
        info: f.info?.trim() || null,
        image_url: f.image_url?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isNew ? "Airport added" : "Airport updated");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3 rounded-md border border-border bg-secondary/40 p-3">
      <div className="font-display text-[11px] tracking-console text-muted-foreground">
        {isNew ? "Add airport" : `Edit ${initial.icao}`}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="ICAO" value={f.icao} onChange={(v) => set("icao", v.toUpperCase())} />
        <Field label="IATA" value={f.iata ?? ""} onChange={(v) => set("iata", v.toUpperCase())} />
      </div>
      <Field label="Name" value={f.name} onChange={(v) => set("name", v)} />
      <div className="space-y-1.5">
        <Label className="font-display text-[11px] tracking-console text-muted-foreground">
          Island
        </Label>
        <Select value={f.island} onValueChange={(v) => set("island", v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ISLANDS.map((i) => (
              <SelectItem key={i.slug} value={i.slug}>
                {i.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Field label="X" value={String(f.x)} onChange={(v) => set("x", Number(v) || 0)} />
        <Field label="Y" value={String(f.y)} onChange={(v) => set("y", Number(v) || 0)} />
        <Field label="RWY°" value={String(f.runway)} onChange={(v) => set("runway", Number(v) || 0)} />
        <Field
          label="Elev"
          value={String(f.elevation)}
          onChange={(v) => set("elevation", Number(v) || 0)}
        />
      </div>
      {onRequestPlace && (
        <Button variant="secondary" className="w-full gap-2" onClick={onRequestPlace}>
          <Crosshair className="size-4" /> Pick position on map
        </Button>
      )}

      <Field
        label="Airport photo URL"
        value={f.image_url ?? ""}
        onChange={(v) => set("image_url", v)}
      />
      <div className="space-y-1.5">
        <Label className="font-display text-[11px] tracking-console text-muted-foreground">
          Info shown on the radar panel
        </Label>
        <Textarea
          rows={3}
          value={f.info ?? ""}
          onChange={(e) => set("info", e.target.value)}
          placeholder="Runways, frequencies, procedures…"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={!!f.major}
          onChange={(e) => set("major", e.target.checked)}
        />
        Major airport (visible on the world view)
      </label>
      <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
        {isNew ? "Add airport" : "Save changes"}
      </Button>
    </div>
  );
}

function AircraftImages() {
  const qc = useQueryClient();
  const [aircraft, setAircraft] = useState("");
  const [url, setUrl] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["admin_aircraft_images"],
    queryFn: async () => {
      const { data, error } = await supabase.from("aircraft_images").select("*").order("aircraft");
      if (error) throw error;
      return data as { aircraft: string; image_url: string }[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin_aircraft_images"] });
    qc.invalidateQueries({ queryKey: ["aircraft_images"] });
  };

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-3 rounded-md border border-border bg-secondary/40 p-3">
        <Field label="Aircraft type" value={aircraft} onChange={(v) => setAircraft(v.toUpperCase())} />
        <Field label="In-game photo URL" value={url} onChange={setUrl} />
        <Button
          className="w-full"
          onClick={async () => {
            if (!aircraft.trim() || !url.trim()) {
              toast.error("Type and URL are required");
              return;
            }
            const { error } = await supabase
              .from("aircraft_images")
              .upsert({ aircraft: aircraft.trim().toUpperCase(), image_url: url.trim() });
            if (error) {
              toast.error(error.message);
              return;
            }
            toast.success(`${aircraft} photo saved`);
            setAircraft("");
            setUrl("");
            refresh();
          }}
        >
          Save aircraft photo
        </Button>
      </div>

      <ul className="divide-y divide-border rounded-md border border-border">
        {rows.map((r) => (
          <li key={r.aircraft} className="flex items-center gap-3 px-3 py-2">
            <img
              src={r.image_url}
              alt={`${r.aircraft} in game`}
              className="h-10 w-16 rounded object-cover"
              loading="lazy"
            />
            <span className="flex-1 font-mono text-sm text-foreground">{r.aircraft}</span>
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Delete ${r.aircraft}`}
              onClick={async () => {
                const { error } = await supabase
                  .from("aircraft_images")
                  .delete()
                  .eq("aircraft", r.aircraft);
                if (error) {
                  toast.error(error.message);
                  return;
                }
                refresh();
              }}
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </li>
        ))}
        {!rows.length && (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            No aircraft photos yet.
          </li>
        )}
      </ul>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="font-display text-[11px] tracking-console text-muted-foreground">
        {label}
      </Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
