import { useSyncExternalStore } from "react";

export type ServerPeopleRow = { name: string; href: string };

// Same gate as routes/tonight.tsx: false on the server AND on the hydration
// render (React uses the server snapshot), true right after.
const emptySubscribe = () => () => {};
export function useHydrated(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

// Plain server-rendered list of profile links for a people list page. Shown
// only before hydration; the real client page replaces it afterwards.
export default function ServerPeopleList({
  heading,
  intro,
  rows,
}: {
  heading: string;
  intro?: string;
  rows: ServerPeopleRow[];
}) {
  return (
    <main className="px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">{heading}</h1>
      {intro ? <p className="text-sm mb-3">{intro}</p> : null}
      {rows.length === 0 ? (
        <p className="text-sm">No profiles listed yet.</p>
      ) : (
        <ul className="text-sm space-y-1">
          {rows.map((r) => (
            <li key={r.href}>
              <a href={r.href}>{r.name}</a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
