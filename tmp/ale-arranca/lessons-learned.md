# Arranca Lessons Learned

Last updated: 2026-07-03

## 2026-07-03 - Page protection is not backend authorization

Protecting `/admin` pages with Basic Auth is not enough if the real business operations live in `/api/*` routes that do not enforce the same authorization.

In Arranca, critical admin and user operations were initially reachable through direct API calls without sufficient backend identity checks. The fix direction is explicit:

- verify Firebase ID tokens for user routes,
- enforce admin authorization on admin routes,
- derive ownership from verified identity,
- never trust `usuarioId` or resource ownership from client input alone.

Future agents should treat page access control and backend authorization as separate layers.

## 2026-07-03 - Service account credentials must never live in the repo

A Firebase service account file existed inside the project repository and was tracked by Git history.

This is not a formatting issue or a cleanup detail. It is an incident.

Future agents must:

- keep service account material only in secrets or local env storage,
- add explicit ignore rules for local credential files,
- verify whether the credential reached remote history,
- require key rotation if exposure happened.

## 2026-07-03 - Referral rewards can silently corrupt capital accounting

The payment confirmation flow originally updated referral reward state and capital availability in a way that could leave capital accounting inconsistent.

In lending systems, small reward logic can still break financial truth if it is applied outside a single coherent capital update model.

Future agents should validate:

- how capital moves,
- when rewards are recognized,
- which invariant defines available capital,
- and whether all branches of a transaction preserve that invariant.

## 2026-07-03 - User state must be resolved before onboarding

If the system waits until the final loan request to discover that a user already has KYC or an existing application, the UX is already broken.

In Arranca, a returning user could log in successfully and still be sent through KYC, profile capture, and questionnaire screens again before the backend finally reported that a request already existed.

The correction pattern is:

- resolve user state immediately after SMS verification,
- resolve user state again on app startup when a Firebase session already exists,
- redirect from KYC and loan-request screens if the user no longer belongs there,
- and keep one backend-derived `nextRoute` as the source of truth.
