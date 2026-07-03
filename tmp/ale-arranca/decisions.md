# Arranca Decisions

Last updated: 2026-07-03

## 2026-07-03 - Preserve Arranca In ALE

Decision: track Arranca as a first-class ALE project.

Why:

- It handles credit, KYC, admin actions, and financial state.
- It already carries paid-risk signals: security exposure, identity handling, and capital accounting.
- Future work on this project should not restart from zero or repeat the same backend trust mistakes.

Status: vigente

## 2026-07-03 - Backend Must Be The Single Source Of Truth

Decision: Arranca business operations must be authorized and validated in backend routes, not trusted from frontend-provided identifiers or page-level protection alone.

Why:

- The initial implementation trusted `usuarioId` and resource identifiers from the client.
- Admin page protection alone did not secure admin API routes.
- Credit, KYC, and capital operations are too sensitive for client-trust assumptions.

Status: vigente
