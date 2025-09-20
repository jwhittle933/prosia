use std::sync::Arc;

use dashmap::DashMap;
use tokio::sync::{mpsc, oneshot};

// Room registry
#[derive(Clone)]
pub(crate) struct AppState {
    pub(crate) rooms: Arc<DashMap<String, RoomHandle>>,
}

#[derive(Clone)]
pub(crate) struct RoomHandle {
    pub(crate) cmd_tx: mpsc::Sender<RoomCmd>,
    doc: yrs::Doc,
}

impl RoomHandle {
    pub(crate) fn new(cmd_tx: mpsc::Sender<RoomCmd>, doc: yrs::Doc) -> Self {
        Self { cmd_tx, doc }
    }
}

#[derive(Debug)]
pub(crate) enum RoomCmd {
    Join {
        peer_id: u64,
        tx: mpsc::Sender<ServerMsg>,
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

#[derive(Debug)]
pub(crate) enum ServerMsg {
    Update(Vec<u8>),    // TAG_UPDATE + payload
    Awareness(Vec<u8>), // TAG_AWARENESS + payload
    Snapshot(Vec<u8>),  // TAG_SNAPSHOT + payload
    PingPong,
}
