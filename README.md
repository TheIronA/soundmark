# Soundmark

A personal geotagged media archive built around a single simple unit: a
**moment** — one photo paired with a short sound, tied to a location and a
time. Capture is one gesture (photo → record sound → save); browsing is
tap-to-hear (tap a photo to play its sound inline, like a living photo).

Built on the [with-supabase](https://github.com/vercel/next.js/tree/canary/examples/with-supabase)
Next.js starter: App Router, TypeScript, Tailwind, shadcn/ui, Supabase for
auth + database + storage, MapLibre GL for the map.

## Core interaction

- **Capture** (`/app/new`): pick or take a photo → you're immediately prompted
  to record a short sound → save. Title/note are optional and secondary.
  Location and time are read from the photo's EXIF when available, with live
  geolocation as a fallback.
- **Tap-to-hear**: on the timeline (`/app/timeline`) and map (`/app/map`),
  tapping a photo plays its attached sound inline — no navigation.
- **A year ago today**: the home screen surfaces any moment from this calendar
  day in a past year, queried on load (the retention hook — no scheduler yet).

## Data model

Two tables (see [`supabase/migrations/`](supabase/migrations)):

- **`entries`** — the place-moment: `title`, `note`, `lat`, `lng`,
  `place_label`, `recorded_at`, `created_at`.
- **`media`** — items attached to an entry: `media_type` (`audio` | `photo`),
  `storage_path`, `thumbnail_path`, `duration_sec`, `size_bytes`.

The schema is one-entry-to-many-media (flexible for the future), but the
product currently treats a moment as **exactly one photo + one sound**.

Row Level Security scopes every row (and every storage object) to its owner.

### Storage is backend-agnostic

`media.storage_path` holds a plain object path, **not** a Supabase URL. All
knowledge that media lives in Supabase Storage is isolated in
[`lib/storage.ts`](lib/storage.ts). Swapping the backend later (Drive, S3, …)
means reimplementing that module only — no schema change.

## Setup

1. **Create a Supabase project** and copy its API details into `.env.local`
   (see [`.env.example`](.env.example)):

   ```
   NEXT_PUBLIC_SUPABASE_URL=…
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=…
   ```

2. **Apply the schema.** Run the SQL in [`supabase/migrations/`](supabase/migrations)
   in order — via the Supabase SQL editor, or `supabase db push` with the
   Supabase CLI. This creates the tables, RLS policies, and the private
   `media` storage bucket.

3. **Install and run:**

   ```bash
   npm install
   npm run dev
   ```

### Dev-only auth bypass

To preview the UI without a live Supabase session, set
`NEXT_PUBLIC_DEV_BYPASS_AUTH=true` in `.env.local`. This skips the auth guard
and renders the app shell with empty data. **Never enable this in production** —
it disables the auth redirect (data access still requires a real session and
RLS).

## Scope

In: auth, capture, map, timeline, playback, "a year ago today".
Out for now: video, Drive/BYOS storage, sharing, transcription, notifications,
multi-device sync, payments.
