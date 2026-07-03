# Arranca Timeline

## 2026-06-28

- Initial project version created as a PWA for gasoline loans for app drivers.
- Mobile phone login, admin review, and pilot lending flow entered the repository.
- Basic Auth was added to protect the admin panel pages.
- Support for `FIREBASE_SERVICE_ACCOUNT_KEY` in Base64 format was added.
- Storage deploy target configuration was added.

## 2026-07-01

- KYC flow was simplified from video-based proof toward profile screenshot capture.
- TypeScript fixes were added around the simplified KYC flow.

## 2026-07-03

- Arranca was audited as a real ALE project candidate because it handles KYC, credit, admin actions, and capital state.
- The audit found critical risks:
  - tracked Firebase service account material in the repository,
  - missing backend authorization on critical API routes,
  - ownership bypass risk on loan and KYC resources,
  - capital accounting inconsistency around referral rewards.
- Backend hardening was applied:
  - verified Firebase ID token checks for user routes,
  - admin authorization checks for admin routes,
  - ownership enforcement for user resources,
  - correction of referral reward impact on available capital.
- User flow hardening was applied:
  - SMS verification no longer sends every user to KYC by default,
  - backend now resolves a navigable user state and `nextRoute`,
  - app startup, login, KYC, and loan-request screens now redirect according to real user/application state.
- The tracked Firebase credential file was removed from the working tree and added to ignore rules.
- Remaining manual incident response was identified: revoke and rotate the exposed Firebase credential.
