# Project State

Last updated: 2026-07-03

## FoodSPV

FoodSPV is one of Alex's core product systems. It appears in the workspace as `foodspv` and `foodspv-2.0`, with Next/React/Firebase signals. ALE should track both historical and current decisions so work does not restart from zero.

Known foundational lesson:

- Do not mix legacy architectures with modern architectures.
- Case: Firebase Hosting + Functions proxy + manual `.next` copies.
- Rule: one architecture, one pipeline, one source of truth.

Current need:

- Clarify which folder is canonical for future work.
- Record architecture, deploy surface, data model, and open risks.

## MomOS

MomOS is the human-centered operations system. Its key insight is that operations should not reduce people to resources or attendance events.

Foundational discovery:

- MomOS must not administer resources.
- MomOS must understand people.
- Human Memory Engine / Relationship Memory is now a core concept.

Current need:

- Develop Human Memory Engine / Relationship Memory.
- Preserve human context before interpreting anomalies.
- Encode the mother rule: never treat a human anomaly as automatic absence without reviewing pattern, context, and relationship memory.

## Legion

Legion is Alex's agent/mission system and includes memory and CLI signals. It is connected to the need for Codex continuity and agent behavior that improves over time.

Foundational rule:

- Codex must read memory before working.
- Codex must update memory after working.
- Codex must not behave like a new member every session.

Current need:

- Keep documenting Codex Memory System rules.
- Ensure agents read memory before work and update memory after work.

## Serie

Serie is Alex's narrative/lore area. The workspace includes `serie` and `serie-engine`. The engine appears to support episode generation and cinematic/animatic workflows.

Current need:

- Separate lore memory from generation mechanics.
- Preserve story decisions, canon, characters, timelines, and visual rules.

## ALE

ALE is the external memory infrastructure for Alex.

Current state:

- Active project.
- Foundation completed.
- Initial memory in construction.
- v1 structure created as Markdown-first memory.
- TASK-002 populated foundational principles, relationship-memory discovery, master timeline, and project lessons.
- TASK-003 created Criterio Engine v1 with reusable decision criteria.
- TASK-004 completed Knowledge Graph v1.
- TASK-005 completed Advisor Engine v1.
- Advisor Engine v1 completado.
- Mission Engine v1 agregado.
- TASK-006 added Recall Engine v1.
- Estado: Recall Engine v1 agregado.
- TASK-007 added Agent Startup Protocol v1.
- Estado: Startup Protocol v1 activo.
- Scripts exist for creating entries and regenerating handoff.
- No app, database, embeddings, or AI layer.

New capability:

- Explicit relationships between projects, principles, criteria, discoveries and lessons.
- ALE can now express how project experience becomes lessons, principles, criteria and behavior.
- Emitir recomendaciones basadas en conocimiento acumulado.
- ALE can now convert accumulated knowledge into structured reusable recommendations.
- Convertir consejo en accion estructurada.
- ALE can now generate actionable missions from accumulated knowledge and advisor recommendations.
- Nueva capacidad: Recuperacion local de memoria persistente por busqueda textual.
- Nueva capacidad: Context verification.

Next need:

- Version in Git.
- Start recording real entries as work happens.
- Enrich each project folder with concrete state from project triage.
- Apply active criteria during project decisions and update criteria when repeated judgment patterns emerge.
- Keep the Knowledge Graph updated when a new memory creates a durable relationship.
- Use advisors only when recommendations are backed by existing experience, criteria, principles, and relationships.
- Use Mission Engine when a recommendation needs a concrete next action, expected result, and verification.
- Use Recall Engine to find relevant memory quickly before work, handoff, or updates.
- Run Startup Protocol before beginning agent work.

## InteriorLab

InteriorLab is Alex's interior design workspace for floorplan upload, scale calibration, wall drawing, furniture/material placement, and automatic 3D preview.

Foundational debugging lesson:

- Do not validate iPhone file inputs through a tunnel over `next dev`.
- The dev server can produce HMR/WebSocket issues (`_next/webpack-hmr`, Unauthorized, malformed HTTP response) where the UI renders but React events are unreliable.
- Validate mobile upload flows with `npm run build`, `npm run start`, and `cloudflared tunnel --url http://localhost:3000`.
- Before blaming JPG/PNG/HEIC, FileReader, Safari, iPhone, canvas, or React state, test an isolated `/upload-test` route in production.

Current need:

- Keep wall drawing mobile-first: two taps, visible preview, larger touch targets, snap to nearby vertices, horizontal/vertical snap, undo last wall, finish drawing.
- Preserve automatic 3D updates whenever a wall is created.

## Arranca

Arranca is a pilot PWA for short-term gasoline loans for app drivers. The workspace exists at `/home/alexglex/arranca-app`.

Current state:

- Active project.
- Next.js 14 + TypeScript + Firebase Auth + Firestore + Storage + Admin SDK.
- Product flow includes phone login, KYC uploads, loan request, manual admin review, payment confirmation, and referral rewards.
- Business logic is centralized in API routes; Firestore client access is intentionally blocked by rules.
- Production build passes.

Current risk:

- A Firebase service account was exposed inside the repository and must still be revoked and rotated manually.
- The project originally trusted client identifiers and did not enforce enough backend authorization on critical API routes.
- Admin auth still depends on Basic Auth rather than a stronger admin identity system.
- Capital adjustment logic and audit logging still need stronger controls.

Current need:

- Complete incident response for the exposed credential.
- Preserve backend-as-source-of-truth discipline for KYC, lending, and capital operations.
- Add tests and stronger accounting validation before further product expansion.
