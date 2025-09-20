use axum::extract::ws::{Message, WebSocket};
use futures::{SinkExt, StreamExt};
use tokio::sync::{mpsc, oneshot};

use crate::state::{consts::*, RoomCmd, ServerReply};

#[tracing::instrument(skip(state, socket))]
pub async fn handle_connect(state: crate::state::AppState, doc_id: String, socket: WebSocket) {
    tracing::info!(%doc_id, "new websocket connection");
    // Get or create room
    let handle = state
        .rooms
        .entry(doc_id.clone())
        .or_insert_with(|| crate::room::spawn_room(doc_id.clone()))
        .clone();

    let (mut sink, mut stream) = socket.split();

    // Channel to receive messages from room
    let (server_tx, mut server_rx) = mpsc::channel::<ServerReply>(64);
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
        tracing::error!("failed to join room: {}", e);
        return;
    }

    // Socket reply sink
    let sink_task = tokio::spawn(async move {
        while let Some(msg) = server_rx.recv().await {
            if sink.send(msg.into()).await.is_err() {
                break;
            }
        }
    });

    let (tx, rx) = oneshot::channel();
    let _ = handle.cmd_tx.send(RoomCmd::Snapshot { peer_id, tx }).await;
    if let Ok(snapshot) = rx.await {
        let _ = server_tx.send(ServerReply::Snapshot(snapshot)).await;
    }

    // Main socket rx loop
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
                            let _ = server_tx.send(ServerReply::Snapshot(snapshot)).await;
                        }
                    }
                    other => {
                        tracing::warn!("unknown tag: {}", other);
                    }
                }
            }
            Message::Close(_) => break,
            Message::Ping(_) => {
                let _ = server_tx.send(ServerReply::PingPong).await;
            }
            _ => {}
        }
    }

    // Cleanup
    let _ = handle.cmd_tx.send(RoomCmd::Leave { peer_id }).await;
    tracing::info!(%doc_id, %peer_id, "websocket disconnected");
    sink_task.abort();
}
