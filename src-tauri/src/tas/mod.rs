//! Tag-Aware Scheduling (TAS) module.
//!
//! Provides post-processing over the SM-20/FSRS scheduler:
//! 1. Prerequisite gating — block items whose tag prerequisites are immature
//! 2. Interference jitter — separate items sharing high-coherence tags
//! 3. Queue assembly — build the annotated, sorted queue

pub mod maturity;
pub mod circular;
pub mod gating;
pub mod jitter;
pub mod queue_assembly;
