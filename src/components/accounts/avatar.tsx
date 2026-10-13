export function Avatar({ name }: { name: string }) {
  return (
    <span className="account-avatar" aria-hidden="true">
      {Array.from(name.trim())[0]?.toUpperCase() ?? "B"}
    </span>
  );
}
