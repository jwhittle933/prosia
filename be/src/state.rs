use std::sync::Arc;

use axum::extract::ws::Message;
use dashmap::DashMap;
use tokio::sync::{mpsc, oneshot};

pub mod consts {
    // Tags
    pub const TAG_UPDATE: u8 = 0x00;
    pub const TAG_AWARENESS: u8 = 0x01;
    pub const TAG_SNAPSHOT_REQ: u8 = 0x02;
    pub const TAG_SNAPSHOT: u8 = 0x03;
    pub const TAG_PINGPONG: u8 = 0x04;
    pub const TAG_JOIN: u8 = 0x05;
    pub const TAG_ERROR: u8 = 0x11;
}

// Room registry
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

/// ServerReply represents the output of the server processing
/// a client message. The reply is converted into a WebSocket Message
/// and sent back to the client.
#[derive(Debug)]
pub(crate) enum ServerReply {
    Update(Vec<u8>), // TAG_UPDATE + payload
    Join(ServerReplyJoin),
    Awareness(Vec<u8>), // TAG_AWARENESS + payload
    Snapshot(Vec<u8>),  // TAG_SNAPSHOT + payload
    PingPong,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ServerReplyJoin {
    pub id: u64,
    pub peers: Vec<u64>,
}

impl Into<Message> for ServerReply {
    fn into(self) -> Message {
        match self {
            ServerReply::Join(join) => {
                let mut buf = Vec::with_capacity(1 + 8 + join.peers.len() * 8);
                match serde_json::to_vec(&join) {
                    Err(e) => {
                        tracing::error!("failed to serialize join message: {}", e);
                        buf.push(consts::TAG_ERROR);
                        buf.extend(e.to_string().into_bytes());
                        Message::Binary(buf.into())
                    }
                    Ok(body) => {
                        buf.push(consts::TAG_JOIN);
                        buf.extend(body);

                        Message::Binary(buf.into())
                    }
                }
            }
            ServerReply::Update(mut payload) => {
                let mut buf = Vec::with_capacity(1 + payload.len());
                buf.push(consts::TAG_UPDATE);
                buf.append(&mut payload);
                Message::Binary(buf.into())
            }
            ServerReply::Awareness(mut payload) => {
                let mut buf = Vec::with_capacity(1 + payload.len());
                buf.push(consts::TAG_AWARENESS);
                buf.append(&mut payload);
                Message::Binary(buf.into())
            }
            ServerReply::Snapshot(mut payload) => {
                let mut buf = Vec::with_capacity(1 + payload.len());
                buf.push(consts::TAG_SNAPSHOT);
                buf.append(&mut payload);
                Message::Binary(buf.into())
            }
            ServerReply::PingPong => Message::Binary(vec![consts::TAG_PINGPONG].into()),
        }
    }
}
