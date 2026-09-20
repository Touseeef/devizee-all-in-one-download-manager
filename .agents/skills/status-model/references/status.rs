// src-tauri/src/status.rs
//
// The single source of truth for task status on the Rust side.
// Every variant here must have a matching case in references/status.ts —
// see the status-model SKILL.md for the rule.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Scheduled,
    Queued,
    Starting,
    FetchingMetadata,
    Downloading,
    Muxing,
    Verifying,
    Completed,
    Error,
    Cancelled,
    Interrupted,
    Missing,
}

impl TaskStatus {
    /// Terminal states: once reached, the task will not transition again
    /// without an explicit user action (e.g. re-download creates a NEW task,
    /// it doesn't un-terminate this one).
    pub fn is_terminal(&self) -> bool {
        matches!(
            self,
            TaskStatus::Completed | TaskStatus::Error | TaskStatus::Cancelled | TaskStatus::Missing
        )
    }
}

/// Closed set of error codes — never surface raw stderr/stack traces to
/// the frontend. Extend this enum (and error-message.ts) together.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    Network,
    AgeRestricted,
    Unavailable,
    DiskFull,
    VerificationFailed,
    SpawnFailed,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressEvent {
    #[serde(rename = "taskId")]
    pub task_id: String,
    pub status: TaskStatus,
    /// None for indeterminate states (starting, muxing, verifying, etc).
    /// Some(0.0..=100.0) only for `downloading`.
    pub percent: Option<f32>,
    pub speed: Option<String>,
    pub eta: Option<String>,
    /// Only present when status == Error.
    #[serde(rename = "errorCode", skip_serializing_if = "Option::is_none")]
    pub error_code: Option<ErrorCode>,
}
