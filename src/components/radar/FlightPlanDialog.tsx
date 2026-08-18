import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AIRPORTS } from "@/lib/world";
import { aircraftInfo } from "@/lib/aircraft";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function localInput(offsetMinutes: number) {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function FlightPlanDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    callsign: "",
    airline: "",
    aircraft: "Airbus A320",
    dep_icao: "IRFD",
    arr_icao: "IPPH",
    dep_time: localInput(10),
    arr_time: localInput(45),
    cruise_fl: "350",
    cruise_speed: "450",
    route: "",
  });

  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));

  /** Typing a known aircraft prefills its typical cruise level and speed. */
  const pickAircraft = (name: string) => {
    const info = aircraftInfo(name);
    setForm((f) => ({
      ...f,
      aircraft: name,
      cruise_fl: info ? String(info.fl) : f.cruise_fl,
      cruise_speed: info ? String(info.speed) : f.cruise_speed,
    }));
  };


  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.callsign.trim()) throw new Error("Callsign is required");
      if (form.dep_icao === form.arr_icao) throw new Error("Departure and arrival must differ");
      const { error } = await supabase.from("flight_plans").insert({
        user_id: userId,
        callsign: form.callsign.trim(),
        airline: form.airline.trim() || null,
        aircraft: form.aircraft,
        dep_icao: form.dep_icao,
        arr_icao: form.arr_icao,
        dep_time: new Date(form.dep_time).toISOString(),
        arr_time: new Date(form.arr_time).toISOString(),
        cruise_alt: (Number(form.cruise_fl) || 350) * 100,
        cruise_speed: Number(form.cruise_speed) || 450,

        route: form.route.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flight_plans"] });
      toast.success("Flight plan filed — your aircraft will appear on radar at pushback time");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const airportSelect = (key: "dep_icao" | "arr_icao", label: string) => (
    <div className="space-y-1.5">
      <Label className="font-display text-[11px] tracking-console text-muted-foreground">{label}</Label>
      <Select value={form[key]} onValueChange={(v) => set(key, v)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent className="max-h-72">
          {AIRPORTS.map((a) => (
            <SelectItem key={a.icao} value={a.icao}>
              <span className="font-mono">{a.icao}</span> — {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">File flight plan</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-display text-[11px] tracking-console text-muted-foreground">Callsign</Label>
              <Input
                value={form.callsign}
                placeholder="BAW4723"
                className="font-mono uppercase"
                onChange={(e) => set("callsign", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-display text-[11px] tracking-console text-muted-foreground">Airline</Label>
              <Input value={form.airline} placeholder="British Airways" onChange={(e) => set("airline", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="font-display text-[11px] tracking-console text-muted-foreground">Aircraft type</Label>
            <Input
              value={form.aircraft}
              placeholder="Boeing 737-800"
              className="font-mono"
              onChange={(e) => pickAircraft(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {airportSelect("dep_icao", "Departure airport")}
            {airportSelect("arr_icao", "Arrival airport")}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-display text-[11px] tracking-console text-muted-foreground">Departure</Label>
              <Input type="datetime-local" value={form.dep_time} onChange={(e) => set("dep_time", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-display text-[11px] tracking-console text-muted-foreground">Arrival</Label>
              <Input type="datetime-local" value={form.arr_time} onChange={(e) => set("arr_time", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-display text-[11px] tracking-console text-muted-foreground">
                Cruise level (FL{String(Number(form.cruise_fl) || 0).padStart(3, "0")})
              </Label>
              <Input
                type="number"
                step={10}
                min={10}
                max={600}
                value={form.cruise_fl}
                className="font-mono"
                onChange={(e) => set("cruise_fl", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-display text-[11px] tracking-console text-muted-foreground">Cruise speed (kt)</Label>
              <Input
                type="number"
                step={5}
                value={form.cruise_speed}
                className="font-mono"
                onChange={(e) => set("cruise_speed", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="font-display text-[11px] tracking-console text-muted-foreground">Route</Label>
            <Input value={form.route} placeholder="DCT ALPHA DCT" className="font-mono" onChange={(e) => set("route", e.target.value)} />
          </div>
        </div>


        <DialogFooter>
          <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Filing…" : "File flight plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
