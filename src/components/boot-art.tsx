import Image from "next/image";
import { cn } from "@/lib/utils";
export function BootArt({
  hero = false,
  className,
}: {
  hero?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("boot-art", hero && "hero-art", className)}>
      <Image
        src="/images/boot-concept.png"
        alt="Unbranded lime football boot concept illustration, not a photograph of a listed product"
        fill
        sizes={
          hero
            ? "(max-width: 768px) 100vw, 60vw"
            : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        }
        priority={hero}
        loading={hero ? "eager" : "lazy"}
        className="object-cover"
      />
    </div>
  );
}
