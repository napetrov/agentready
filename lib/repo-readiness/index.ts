// Canonical entrypoint for the AgentReady local readiness scanner library.
export * from './local-readiness'
export * from './detectors/instruction-surface'
export { detectCapabilitySurfaces } from './detectors/capability-surfaces'
export { DEFAULT_PROTECTED_PATHS, detectCodeownersCoverageGaps, detectGovernance, detectProtectedPathCoverage } from './detectors/governance'
export { detectInstructionContradictions } from './detectors/instruction-contradictions'
export { detectHookExecutionRisks, detectSafetySignals } from './detectors/safety-signals'
