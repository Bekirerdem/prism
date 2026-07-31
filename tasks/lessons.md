# Prism — lessons

## Frontend visual design = Bekir's call, never solo
- 2026-06-03: Built a full spectral/cinematic/3D landing solo from a one-line brief
  ("cinematic, animated, 3D, explain the project"). Bekir was disappointed — it didn't
  match his taste.
- **Why:** a one-line aesthetic brief is NOT a spec. Going deep on visual taste without
  detailed direction misses the mark and wastes effort.
- **How to apply:** freeze frontend *visual* polish until Bekir is present with detailed
  direction. Until then stay in backend / contract / infra / docs. When a vague design ask
  comes, get references/specifics or build a tiny low-risk draft and get sign-off BEFORE
  building the full thing. The product logic (contract, dashboard data, demo flow) is
  taste-independent and safe to keep improving.
- Matches the standing pattern: visual design is Bekir (+ Gemini); Claude holds the
  backend/infra line until a spec arrives.

## Docs are authored pages, not wrapped includes — and verify CONTENT, not status
- 2026-07-31: Shipped a docs site whose reference pages were `@include`s of repo-root
  markdown. Two failures stacked: (1) `vercel --cwd web` uploads ONLY web/ — the include
  sources didn't exist in Vercel's build, VitePress silently dropped them, every page
  rendered as a bare H1; (2) live verification checked HTTP 200 + sidebar, not page
  content, so "boş sayfalar" shipped as "verified". Bekir caught it.
- **Why:** build-time file reads outside the deploy root are invisible landmines; and a
  200 response proves routing, not content.
- **How to apply:** anything the Vercel build consumes must live under web/. Docs pages
  are real authored content (Verglas bar: 34-127 lines each), never thin wrappers.
  Live checks must assert rendered text length/keywords on EVERY page, not fetch status.
