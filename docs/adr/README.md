# Architecture Decision Records

This directory contains proposed architecture decisions for AgentReady.

All ADRs in this directory are `Proposed`: they describe intended direction, not
approved implementation. They should be accepted in order because later ADRs
depend on the canonical contract and rollout rules in ADR 0000.

- [ADR 0000: Canonical Report Contract and Rollout](0000-canonical-report-contract-and-rollout.md)
- [ADR 0001: Deterministic Repository Evidence Model](0001-deterministic-repository-evidence-model.md)
- [ADR 0002: Classify Document Roles Instead of Requiring Fixed Document Names](0002-document-role-classification-not-fixed-document-names.md)
- [ADR 0003: Repository Topology and Architecture Signals](0003-repository-topology-and-architecture-signals.md)
- [ADR 0004: Explainable Design-State Reporting](0004-explainable-design-state-reporting.md)

Acceptance rule: an ADR is implementation-ready only when its schema changes,
default severities, rollout phase, and compatibility impact are explicit.
