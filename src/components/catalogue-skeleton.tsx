export function CatalogueSkeleton() {
  return (
    <div role="status" aria-label="Loading catalogue">
      <span className="sr-only">Loading catalogue…</span>
      <div className="skeleton mb-7 h-52" />
      <div className="boot-grid">
        {[1, 2, 3].map((id) => (
          <div key={id} className="skeleton h-[400px]" />
        ))}
      </div>
    </div>
  );
}
