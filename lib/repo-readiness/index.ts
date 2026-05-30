// Canonical entrypoint for the AgentReady local readiness scanner library.
export * from './local-readiness'
export * from './detectors/instruction-surface'
export { detectCapabilitySurfaces } from './detectors/capability-surfaces'
export { detectSafetySignals } from './detectors/safety-signals'
