import logo from "@/assets/atc365-logo.png";
import { cn } from "@/lib/utils";

/** The ATC365 brand mark. Every place the product is named uses this. */
export function Logo({ className, alt = "ATC365" }: { className?: string; alt?: string }) {
  return (
    <img
      src={logo}
      alt={alt}
      className={cn("h-8 w-auto select-none object-contain", className)}
      draggable={false}
    />
  );
}
