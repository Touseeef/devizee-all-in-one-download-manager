use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DownloadStatus {
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
