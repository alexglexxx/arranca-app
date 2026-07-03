# Arranca Current State

Last updated: 2026-07-03

Workspace path:

- `/home/alexglex/arranca-app`

## Product Shape

- Pilot microcredit app for app drivers.
- Base loan amount is `200 MXN`.
- Payment terms, due windows, and referral rewards live in shared TypeScript business rules.
- Frontend is mobile-first and built as a PWA.

## Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Firebase Auth (phone)
- Firestore
- Firebase Storage
- Firebase Admin SDK

## Working

- Production build passes with `npm run build`.
- Loan, KYC, admin review, payment confirmation, and referral flows exist in one codebase.
- Firestore client access is intentionally blocked; business logic is centralized in API routes.
- Storage rules restrict uploads to the authenticated user's own folder path.
- User navigation now resolves from backend-derived state at login/startup instead of always forcing KYC after SMS verification.

## Current Security State

- On 2026-07-03, the project was audited and found to have critical backend authorization gaps.
- A tracked Firebase service account file existed in the repository and was removed from the working tree, but the exposed credential still requires manual rotation outside the repo.
- Backend hardening was applied so critical API routes now require either:
  - verified Firebase ID tokens for end-user operations, or
  - admin credentials for admin-only operations.
- Ownership checks were added so users cannot operate on another user's KYC, profile, or loan resources through direct API calls.
- The payment confirmation flow was corrected so referral rewards no longer create an accounting inconsistency in available capital.

## Open Risks

- The exposed Firebase service account must still be revoked and rotated manually in Firebase/GCP.
- The repository history may still contain the credential if the history is not rewritten or the repo already reached a remote.
- Admin authentication still depends on Basic Auth credentials rather than a stronger admin identity system.
- `npm run lint` is not yet operational as a non-interactive guardrail.
- Capital adjustment logic still needs stricter validation and accounting invariants.

## Current Need

- Complete incident response for the exposed Firebase credential.
- Strengthen financial controls around capital updates and admin audit logging.
- Add tests around authorization, ownership, and payment/referral accounting.
- Validate the corrected login/session/onboarding flow with real Firebase users.
- Preserve architecture discipline: one backend authority, no client-trusted business operations.
