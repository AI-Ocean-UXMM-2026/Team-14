# Capture and review implementation

Migrations `202610220003_review.sql` and `202610220004_exceptions_admin_entry.sql` extend capture with these authenticated RPCs:

| RPC | Caller | Guard and result |
|---|---|---|
| `request_correction` | Owning active Teacher or school Admin | Expected source version, reason, explicit minute-precision timestamps, no allocation/pending request; creates history, advances session version and holds payroll |
| `review_correction` | School Admin | Expected version and unchanged request base; rejection requires reason; approval changes only effective times, completes capture, resets verification |
| `withdraw_correction` | Requester or school Admin | Pending only; effective times unchanged; terminal request retained |
| `verify_session` | School Admin | Complete, no pending correction; verification additionally requires resolved flags, assignment/coverage and overlap review; records reviewed version |
| `resolve_exception` | School Admin | Expected version, reason, no pending correction/allocation; retained resolution, verification resets Pending |
| `create_admin_session` | School Admin | Explicit completed start/end, reason, class in school; source/actor retained, starts Pending verification |

All functions derive school and ownership from database entities and caller membership. UUID inputs are locators, not authorization. Every mutation records its idempotency response and audit event in the same transaction. Authenticated clients cannot call the internal command or directly mutate tables.

## Versions and locking

Teacher parent row → session → correction/exception is the lock order. Every future session, rate, assignment and payroll write API must follow the same teacher lock protocol. Rate overlap validation already uses the parent row lock. Multi-teacher financial operations must lock teacher UUIDs in a stable order.

Creating a correction advances the session version by one, without rewriting original/effective times or erasing prior verification. Approval checks that source version is exactly request base + 1; any intervening source change makes it stale. A stale pending request can be withdrawn, then resubmitted after review. No silent overwrite is allowed.

An identical committed retry returns the stored result before version checks. Same-key altered input conflicts. A new operation against stale expected version conflicts. Authorization is rechecked before retries; deactivated users cannot retrieve old responses through a write RPC. A response lost to the network must be retried using the original form/key, without editing its inputs. On confirmed success the refreshed record provides a new version.

## Exceptions

New/changed payable times automatically flag assignment mismatch and overlapping sessions. Flags and previous resolutions are retained. Overlap does not hard-reject a session. Conflicting unlocked verified sessions return to Pending and get an audit event. Active approved allocations prevent changes to source sessions; new overlaps can flag an allocated source without changing its frozen financial snapshot. Future payroll must use allocation eligibility and frozen snapshots, never recalculate approved totals from mutable sources.

No six-hour threshold is applied (later backend pilot decision). Missing checkout remains incomplete until checkout or approved correction, never inferred from a class duration.

## Evidence and limitations

Local tests cover ownership/role denial, private-function permissions, invalid timestamps/reasons, duplicate pending requests, correction retries, approve/reject/withdraw histories, Admin self-verification, overlap and assignment exception resolution, immutable original times, lock rejection, and forced-audit-failure rollback. Docker PostgreSQL 17 tests exercise simultaneous capture, correction submission, competing correction decisions, and competing verification with separate connections.

The authenticated UI uses cookie-bound Supabase, fresh `getUser()` identity, active membership, and RLS. No privileged key is used. It has not been exercised against a hosted Supabase project. Auth invitations/recovery/refresh administration, exhaustive school boundary tests, production request limits/CSP, hosted payroll/payment validation and release gates remain outstanding. Payroll implementation is documented in PAYROLL_WORKFLOW.md. The existing demo remains fictional and independent; it is not a substitute for authenticated workflow validation.
