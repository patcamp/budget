# app/

Next.js App Router root. Three files, all minimal by design — this app does not use server components or server actions; everything is fetched client-side.

- `layout.tsx` — root HTML shell + `<head>` metadata. No providers, no fonts config beyond defaults.
- `page.tsx` — the only data-fetching code in the app. On mount, fires three parallel Supabase queries (`pay_periods`, `categories` filtered to `archived=false`, `expenses`) and holds them in `useState`. Exposes `loadAll` as `onRefresh` down to `Dashboard` so any mutation elsewhere in the tree can trigger a full refetch rather than patching local state. Also owns a `view` toggle (`"period" | "overview"`) that switches between `Dashboard` (single period, mutations) and `Overview` (multi-period averages, read-only) — both consume the same three fetched arrays, no extra queries needed.
- `globals.css` — global resets/base styles only; component-level styling is inline (see root CLAUDE.md).

## Things to preserve if you touch `page.tsx`

- Loading and error states are handled here, not in `Dashboard` — keep that split if you add new top-level queries.
- The error message intentionally surfaces the raw Supabase error plus a hint about missing env vars / unrun schema, since this is the most common failure mode for a fresh setup. Don't replace it with a generic "something went wrong."
- `categories` is always queried with `.eq("archived", false)` — there's no UI for un-archiving, so don't drop this filter without adding one.
