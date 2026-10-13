export function FeedSkeleton() {
  return (
    <div role="status" aria-label="Loading discussions" className="post-list">
      {[1, 2, 3].map((row) => (
        <div className="post-card" key={row} aria-hidden="true">
          <div className="skeleton h-5 w-1/3" />
          <div className="skeleton h-7 mt-6 w-3/4" />
          <div className="skeleton h-5 mt-4 w-full" />
        </div>
      ))}
    </div>
  );
}
