use axum::extract::ws::{Message, WebSocket};
use futures::{SinkExt, StreamExt};
use tokio::sync::{mpsc, oneshot};

use crate::state::{RoomCmd, ServerMsg};

// Tags
pub const TAG_UPDATE: u8 = 0x00;
pub const TAG_AWARENESS: u8 = 0x01;
pub const TAG_SNAPSHOT_REQ: u8 = 0x02;
pub const TAG_SNAPSHOT: u8 = 0x03;
pub const TAG_PINGPONG: u8 = 0x04;

#[tracing::instrument(skip(state, socket))]
pub async fn handle_socket(state: crate::state::AppState, doc_id: String, socket: WebSocket) {
    tracing::info!(%doc_id, "new websocket connection");
    // Get or create room
    let handle = state
        .rooms
        .entry(doc_id.clone())
        .or_insert_with(|| crate::room::spawn_room(doc_id.clone()))
        .clone();

    let (mut sink, mut stream) = socket.split();

    // Channel to receive messages from room
    let (server_tx, mut server_rx) = mpsc::channel::<ServerMsg>(64);
    let peer_id = rand::random::<u64>();

    // Join room
    if let Err(e) = handle
        .cmd_tx
        .send(RoomCmd::Join {
            peer_id,
            tx: server_tx.clone(),
        })
        .await
    {
        tracing::warn!("failed to join room: {}", e);
        return;
    }

    let mut sink_task = tokio::spawn(async move {
        while let Some(msg) = server_rx.recv().await {
            let frame = match msg {
                ServerMsg::Update(mut payload) => {
                    tracing::info!("ServerMsg::UPDATE");
                    let mut buf = Vec::with_capacity(1 + payload.len());
                    buf.push(TAG_UPDATE);
                    buf.append(&mut payload);
                    Message::Binary(buf.into())
                }
                ServerMsg::Awareness(mut payload) => {
                    tracing::info!("ServerMsg::AWARENESS");
                    let mut buf = Vec::with_capacity(1 + payload.len());
                    buf.push(TAG_AWARENESS);
                    buf.append(&mut payload);
                    Message::Binary(buf.into())
                }
                ServerMsg::Snapshot(mut payload) => {
                    tracing::info!("ServerMsg::SNAPSHOT");
                    let mut buf = Vec::with_capacity(1 + payload.len());
                    buf.push(TAG_SNAPSHOT);
                    buf.append(&mut payload);
                    Message::Binary(buf.into())
                }
                ServerMsg::PingPong => {
                    tracing::info!("ServerMsg::PINGPONG");
                    let mut buf = Vec::with_capacity(1);
                    buf.push(TAG_PINGPONG);
                    Message::Binary(buf.into())
                }
            };
            if sink.send(frame).await.is_err() {
                break;
            }
        }
    });

    // Immediately ask for a snapshot and push it to client
    let (tx, rx) = oneshot::channel();
    let _ = handle.cmd_tx.send(RoomCmd::Snapshot { peer_id, tx }).await;
    if let Ok(snapshot) = rx.await {
        let _ = server_tx.send(ServerMsg::Snapshot(snapshot)).await;
    }

    while let Some(Ok(msg)) = stream.next().await {
        match msg {
            Message::Binary(mut bytes) if !bytes.is_empty() => {
                let tag = bytes[0];
                let payload = bytes.split_off(1);
                match tag {
                    TAG_UPDATE => {
                        tracing::info!("Received UPDATE message");
                        let _ = handle
                            .cmd_tx
                            .send(RoomCmd::ClientUpdate {
                                peer_id,
                                bytes: payload.to_vec(),
                            })
                            .await;
                    }
                    TAG_AWARENESS => {
                        tracing::info!("Received AWARENESS message");
                        let _ = handle
                            .cmd_tx
                            .send(RoomCmd::ClientAwareness {
                                peer_id,
                                bytes: payload.to_vec(),
                            })
                            .await;
                    }
                    TAG_SNAPSHOT_REQ => {
                        tracing::info!("Received SNAPSHOT_REQ message");
                        let (tx, rx) = oneshot::channel();
                        let _ = handle.cmd_tx.send(RoomCmd::Snapshot { peer_id, tx }).await;
                        if let Ok(snapshot) = rx.await {
                            let _ = server_tx.send(ServerMsg::Snapshot(snapshot)).await;
                        }
                    }
                    other => {
                        tracing::warn!("unknown tag: {}", other);
                    }
                }
            }
            Message::Close(_) => break,
            Message::Ping(p) => {
                let _ = server_tx.send(ServerMsg::PingPong).await;
            }
            _ => {}
        }
    }

    // Cleanup
    let _ = handle.cmd_tx.send(RoomCmd::Leave { peer_id }).await;
    sink_task.abort();
}
