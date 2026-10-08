# Repro: Next.js RSC/Flight drops one `Card asChild` from a list

Backs the fix in this PR (PMO `143c1bdd`, originally worked around in
nexus-portal commit `c31084c`). A Server Component page renders 30
`<Card asChild><Link>…</Link></Card>` items, each with a lucide-react icon
inside. In a Next.js **production, `output: 'standalone'`** build, one item
is missing from the served HTML — always the same index for a given build,
the RSC (Flight) payload has all 30, and the omission is a clean, well-formed
element removal (not truncated/corrupted markup).

`next dev` never reproduces it. `next start` does not either — you must run
the standalone `server.js` directly.

## Files

- `app/page.jsx` — the failing page. Imports `Card` from `@partrunner-ai/ui`
  (main entry). Set `REPRO_ASCHILD=0` at runtime to render the same tree
  without `asChild` (control: never drops).
- `app/local-card.jsx` — a verbatim, directive-free port of `Slot.tsx` +
  `Card.tsx`. Swapping the import in `page.jsx` to this file instead of the
  package never drops an item — this is what isolated the "use client"
  client-boundary crossing as the trigger, not `Slot`'s merge/cloneElement
  logic itself.
- `raw-react-test.mjs` — renders the identical tree with
  `react-dom/server`'s `renderToPipeableStream` directly, no Next.js
  involved. Never drops an item — rules out a React Fizz bug.

## Reproducing

```bash
mkdir -p /tmp/card-repro && cd /tmp/card-repro
cp <this-dir>/app/page.jsx app/  # plus app/layout.jsx (any minimal RootLayout)
npm init -y
npm install next@16.2.9 react@19.2.4 react-dom@19.2.4 @partrunner-ai/ui@^2.2.1 lucide-react@^0.460.0
echo '@partrunner-ai/ui:registry=https://registry.npmjs.org' > .npmrc
cat > next.config.js <<'EOF'
module.exports = { output: 'standalone' };
EOF
npx next build --webpack   # Turbopack mis-resolves file:/symlinked deps in some setups; not needed for the published package
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
PORT=3999 node .next/standalone/server.js &
curl -s http://localhost:3999/ | grep -o 'class="pr-card' | wc -l   # → 29, expected 30
```

Swap the `Card` import in `page.jsx` to `@partrunner-ai/ui/server` (this PR's
fix) and repeat — → 30, consistently, across repeated requests.

## Test matrix (measured, this session)

| Variant | asChild | Icon in child | Result |
|---|---|---|---|
| Main entry (`@partrunner-ai/ui`) | true | lucide-react | **29/30** |
| Main entry | false | lucide-react | 30/30 |
| `local-card.jsx` (no `"use client"`) | true | lucide-react | 30/30 |
| `@partrunner-ai/ui/server` (this PR) | true | lucide-react | **30/30** |
| Main entry | true | plain `<span>` | 30/30 |
| Main entry | true | plain forwardRef component | 30/30 |
| Main entry | true | inline `<svg>` forwardRef (not lucide) | 30/30 |
| `raw-react-test.mjs` (no Next.js) | true | lucide-react | 30/30 |
| Main entry, Next 16.3.5 / React 19.3.0 (latest stable) | true | lucide-react | 29/30 (not fixed upstream) |

Conclusion: the drop requires **both** `asChild` (Slot's cloneElement path)
**and** the component riding a `"use client"` bundle rendered from a Server
Component (i.e. crossing Next's RSC/Flight boundary). Neither alone
reproduces it. Not filed upstream as a Next.js issue yet.
