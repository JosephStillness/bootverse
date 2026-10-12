import { InfoIcon } from "./icons";
export function SampleNotice() {
  return (
    <aside className="sample-notice">
      <InfoIcon size={19} aria-hidden="true" />
      <p>
        <strong>Sample catalogue.</strong> All configurations are unverified.
        Concept artwork does not depict the listed boots.
      </p>
    </aside>
  );
}
