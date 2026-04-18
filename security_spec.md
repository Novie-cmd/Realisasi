# Security Specification for budget-realization

## Data Invariants
1. **Relational Integrity**: 
   - Every `Anggaran` must belong to an existing `skpdId`.
   - Every `Realisasi` must belong to an existing `anggaranId`.
2. **Type Safety**: 
   - `pagu` and `nilai` must be positive numbers.
   - `kode` and `id` fields must strictly follow alphanumerical patterns.
3. **Identity**:
   - Only authenticated users with verified emails can perform write operations.
   - Users can only read/write their own profiles in `/users/{userId}`.

## The Dirty Dozen (Test Payloads)
1. **P1 (Anonymous Write)**: Attempting to create an SKPD without being logged in. (Expected: DENIED)
2. **P2 (Unverified Write)**: Authenticated but `email_verified: false` attempting to import data. (Expected: DENIED)
3. **P3 (Shadow Field)**: Adding `isVerified: true` to an SKPD document. (Expected: DENIED)
4. **P4 (Negative Budget)**: Creating an Anggaran with `pagu: -1000`. (Expected: DENIED)
5. **P5 (String as Number)**: Creating a Realisasi with `nilai: "1000"`. (Expected: DENIED)
6. **P6 (Massive ID)**: Injecting a 2KB string as a document ID. (Expected: DENIED)
7. **P7 (Profile Hijack)**: User A attempting to write to `users/userB`. (Expected: DENIED)
8. **P8 (Orphaned Budget)**: Creating an Anggaran with a `skpdId` that doesn't exist. (Expected: DENIED)
9. **P9 (Orphaned Realisasi)**: Creating a Realisasi with an `anggaranId` that doesn't exist. (Expected: DENIED)
10. **P10 (Immutable Field)**: Attempting to change `createdAt` on an update. (Expected: DENIED)
11. **P11 (Non-Alphanumeric ID)**: Using `!!!hacker!!!` as a SKPD kode. (Expected: DENIED)
12. **P12 (Blanket Read)**: Attempting to list all users without specific relational checks. (Expected: DENIED)
