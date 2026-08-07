# Production-Grade Engineering Standards & Security Guidelines

## Core Philosophy
We are building a **high-security, enterprise production-grade application**. All code must be designed, written, and reviewed with production standards in mind. Shortcuts, mock leakages, debug backdoors, or incomplete edge-case handling are strictly prohibited.

---

## 1. Security & Zero Secret Leakage
- **No OTP/Secret Leaks**: Sensitive secrets (OTPs, TOTP secrets, reset tokens, API keys, passwords, hashes) must **NEVER** be returned in HTTP response payloads, rendered in UI modals/badges, or printed to client-side logs.
- **Secure Secret Delivery**: Verification secrets and OTPs must only be delivered via secure out-of-band channels (such as verified transactional email or SMS providers).
- **Least Privilege Access**: Endpoints and actions must enforce granular permission checks. Root-only privileges must be hard-guarded against escalation.
- **Atomic Transactions**: Multi-step state changes (such as user creation + permission seeding + email queueing + audit logging) must execute inside ACID database transactions (`BEGIN ... COMMIT`) to prevent partial state corruption on failure.

---

## 2. Production Code Quality & Architectural Integrity
- **No Stubs or Fake Fallbacks**: Features must be fully integrated end-to-end with real services, error handlers, and database constraints. Do not output placeholder stubs or temporary UI bypasses.
- **End-to-End Edge Case Handling**: Always handle all operational scenarios, including:
  - Network timeouts and service unavailability
  - Concurrency conflicts and unique constraint violations
  - Rate limiting, token expiry, and invalid state transitions
  - Graceful UI feedback and clear, non-technical user messaging
- **Defensive Error Handling**: Catch and handle errors at API boundaries. Sanitize error messages returned to clients so internal database structures or stack traces are not exposed to untrusted users.
- **Auditing & Traceability**: High-impact operational actions (role changes, deletions, strikes, status transitions) must record immutable audit logs with actor attribution.
