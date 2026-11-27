---
'@partrunner-ai/ui': minor
---

Add the `@partrunner-ai/ui/server` entry for Next Server Components.

The main entry is one `"use client"` bundle, so from a Server Component every part is a
Client Component and its props cross the RSC boundary. A component function prop such as
`icon={Truck}` on `StatTile` or `EmptyState` cannot cross it, and Next can drop one
`Card asChild` from a list on the Flight path.

The new entry has no `"use client"` directive and exports only parts with no hooks:
`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `Slot`,
`StatTileGrid`, and server variants of `StatTile` and `EmptyState`. In the server
variants `icon` is an element (`icon={<Truck />}`). They share one markup function with
the client components, so the HTML and the classes are the same.

Existing imports from `@partrunner-ai/ui` do not change. Builds on #34.
