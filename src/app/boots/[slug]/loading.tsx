export default function BootDetailLoading() {
  return (
    <div
      className="shell section-space"
      role="status"
      aria-label="Loading boot details"
    >
      <span className="sr-only">Loading boot details…</span>
      <div className="skeleton h-8 w-40" />
      <div className="detail-layout">
        <div className="skeleton aspect-[1.2]" />
        <div>
          <div className="skeleton mb-5 h-6 w-36" />
          <div className="skeleton mb-8 h-32" />
          <div className="skeleton h-48" />
        </div>
      </div>
    </div>
  );
}
