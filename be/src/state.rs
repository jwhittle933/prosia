use std::sync::Arc;

use axum::extract::ws::Message;
use dashmap::DashMap;
use tokio::sync::{mpsc, oneshot};

use shared::server::ServerReply;

#[derive(Clone)]
pub(crate) struct AppState {
    pub(crate) rooms: Arc<DashMap<String, RoomHandle>>,
}

#[derive(Clone)]
pub(crate) struct RoomHandle {
    pub(crate) cmd_tx: mpsc::Sender<RoomCmd>,
}

impl RoomHandle {
    pub(crate) fn new(cmd_tx: mpsc::Sender<RoomCmd>) -> Self {
        Self { cmd_tx }
    }
}

#[derive(Debug)]
pub(crate) enum RoomCmd {
    Join {
        peer_id: u64,
        tx: mpsc::Sender<ServerReply>,
    },
    Leave {
        peer_id: u64,
    },
    ClientUpdate {
        peer_id: u64,
        bytes: Vec<u8>,
    },
    ClientAwareness {
        peer_id: u64,
        bytes: Vec<u8>,
    },
    Snapshot {
        peer_id: u64,
        tx: oneshot::Sender<Vec<u8>>,
    },
}

pub fn into_message(r: ServerReply) -> Message {
    match serde_json::to_vec(&r) {
        Err(e) => {
            tracing::error!("failed to serialize join message: {}", e);
            Message::Binary(r#"""{"error": "failed to serialize message"}"""#.into())
        }
        Ok(body) => Message::Binary(body.into()),
    }
}
