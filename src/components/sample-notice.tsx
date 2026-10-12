import { InfoIcon } from "./icons";
import { sampleDisclaimer } from "@/lib/boots/data";
export function SampleNotice() {
  return (
    <aside className="sample-notice">
      <InfoIcon
        size={21}
        className="shrink-0 text-primary"
        aria-hidden="true"
      />
      <p>
        <strong className="text-foreground">A catalogue in the making.</strong>{" "}
        {sampleDisclaimer}
      </p>
    </aside>
  );
}
