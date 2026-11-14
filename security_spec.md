# BNHS Library Portal Security Specification

## 1. Data Invariants
- All persistent collections enforce strict schema validation via standalone `isValid<Entity>(data)` helpers on both `create` and `update`.
- All single-document operations (`get`, `create`, `update`, `delete`) validate document IDs with `isValidId(id)` (`<= 128` chars, `^[a-zA-Z0-9_\-]+$`).
- All string fields enforce explicit `.size()` bounds to prevent resource exhaustion.
- PII (`email`) is strictly isolated in `/members_private/{memberId}`, readable only by the owning user or bootstrapped/registered admins (`blesstajale@gmail.com` with `email_verified == true`, or `/admins/{uid}`).
- Public catalog collections (`portal_settings`, `books`, `categories`, `digital_resources`, `borrow_records`, `waitlist_requests`, `members_public`, `asset_chunks`) contain no private email/phone PII so Preview and Live Published views can read shared catalog updates across browsers, while all writes require `isVerifiedUser()` (`request.auth != null && request.auth.token.email_verified == true`) and `isAdmin()` or ownership with immutable `ownerUid`.

## 2. Dirty Dozen Adversarial Payloads
1. Unauthenticated write (`request.auth == null`) to `/books/1` -> `PERMISSION_DENIED`
2. Unverified email write (`email_verified == false`) to `/portal_settings/main` -> `PERMISSION_DENIED`
3. Shadow field injection (`isVerified: true` or `extra: 1`) on `/books/1` -> `PERMISSION_DENIED`
4. Oversized document ID (`> 128` chars or special chars `../bad`) -> `PERMISSION_DENIED`
5. Identity spoofing (`ownerUid != request.auth.uid`) during creation -> `PERMISSION_DENIED`
6. Mutating immutable `ownerUid` during update -> `PERMISSION_DENIED`
7. Reading `/members_private/{id}` as unauthenticated user -> `PERMISSION_DENIED`
8. Reading `/members_private/{id}` as non-owner non-admin user -> `PERMISSION_DENIED`
9. Value poisoning (string passed for numeric `totalCopies` or `> maxLength` string) -> `PERMISSION_DENIED`
10. Privilege escalation writing `/admins/{uid}` as non-admin -> `PERMISSION_DENIED`
11. Missing required key on `create` -> `PERMISSION_DENIED`
12. Deleting `/books/1` when unauthenticated or non-owner/non-admin -> `PERMISSION_DENIED`
