#[tokio::main]
async fn main() {
    server::start().await;
}

mod server {
    use axum::{
        extract::{
            ws::{Message, WebSocket, WebSocketUpgrade},
            Path, State,
        },
        response::IntoResponse,
        routing::get,
        Router,
    };
    use dashmap::DashMap;
    use futures::{SinkExt, StreamExt};
    use std::{collections::HashMap, sync::Arc};
    use tokio::sync::{mpsc, oneshot};
    use tracing::{error, info, warn};

    // Tags
    const TAG_UPDATE: u8 = 0x00;
    const TAG_AWARENESS: u8 = 0x01;
    const TAG_SNAPSHOT_REQ: u8 = 0x02;
    const TAG_SNAPSHOT: u8 = 0x03;
    const TAG_PINGPONG: u8 = 0x04;

    // Room registry
    #[derive(Clone)]
    struct AppState {
        rooms: Arc<DashMap<String, RoomHandle>>,
    }

    #[derive(Clone)]
    struct RoomHandle {
        cmd_tx: mpsc::Sender<RoomCmd>,
        doc: yrs::Doc,
    }

    #[derive(Debug)]
    enum RoomCmd {
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
    enum ServerMsg {
        Update(Vec<u8>),    // TAG_UPDATE + payload
        Awareness(Vec<u8>), // TAG_AWARENESS + payload
        Snapshot(Vec<u8>),  // TAG_SNAPSHOT + payload
        PingPong,
    }

    async fn ws_handler(
        State(state): State<AppState>,
        Path(doc_id): Path<String>,
        ws: WebSocketUpgrade,
    ) -> impl IntoResponse {
        ws.on_upgrade(move |socket| handle_socket(state, doc_id, socket))
    }

    async fn handle_socket(state: AppState, doc_id: String, socket: WebSocket) {
        // Get or create room
        let handle = state
            .rooms
            .entry(doc_id.clone())
            .or_insert_with(|| spawn_room(doc_id.clone()))
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
            warn!("failed to join room: {}", e);
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
                            warn!("unknown tag: {}", other);
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

    fn spawn_room(doc_id: String) -> RoomHandle {
        let (cmd_tx, mut cmd_rx) = mpsc::channel::<RoomCmd>(128);
        let doc = yrs::Doc::new();

        tokio::spawn(async move {
            // yrs Doc lives inside this task
            // let doc = yrs::Doc::new(); // TODO: initialize yrs Doc
            // Optional: load snapshot from disk and apply

            // Awareness bookkeeping (server-side pass-through)
            let mut peers: HashMap<u64, mpsc::Sender<ServerMsg>> = HashMap::new();

            // Helper closures for yrs integration
            let mut apply_update = |bytes: &[u8]| {
                // TODO: Use yrs decoder to apply update:
                // let mut txn = doc.transact_mut(); yrs::updates::decoder::decode_update and apply
                // yrs::updates::apply_updates(&mut txn, vec![bytes.to_vec()]);
                let _ = bytes; // placeholder
            };

            let mut encode_snapshot = || -> Vec<u8> {
                // TODO: Encode full doc state as update from empty:
                // let txn = doc.transact();
                // yrs::updates::encoder::encode_state_as_update_v1(&txn, &[])
                Vec::new()
            };

            while let Some(cmd) = cmd_rx.recv().await {
                match cmd {
                    RoomCmd::Join { peer_id, tx } => {
                        peers.insert(peer_id, tx);
                        tracing::info!(%doc_id, %peer_id, "peer joined");
                    }
                    RoomCmd::Leave { peer_id } => {
                        peers.remove(&peer_id);
                        tracing::info!(%doc_id, %peer_id, "peer left");
                    }
                    RoomCmd::ClientUpdate { peer_id, bytes } => {
                        apply_update(&bytes);
                        for (&pid, tx) in peers.iter() {
                            if pid == peer_id {
                                continue;
                            }

                            let _ = tx.try_send(ServerMsg::Update(bytes.clone()));
                        }
                    }
                    RoomCmd::ClientAwareness { peer_id, bytes } => {
                        for (&pid, tx) in peers.iter() {
                            if pid == peer_id {
                                continue;
                            }
                            let _ = tx.try_send(ServerMsg::Awareness(bytes.clone()));
                        }
                    }
                    RoomCmd::Snapshot { peer_id: _, tx } => {
                        let snap = encode_snapshot();
                        let _ = tx.send(snap);
                    }
                }
            }
        });

        RoomHandle { cmd_tx, doc }
    }

    pub async fn start() {
        // Init logging
        tracing_subscriber::fmt()
            .with_target(false)
            .compact()
            .init();

        let mut map = DashMap::new();
        let handle = spawn_room("lobby".to_string());

        map.insert("lobby".to_string(), handle);
        let state = AppState {
            rooms: Arc::new(map),
        };

        let app = Router::new()
            .route("/ws/{doc_id}", get(ws_handler))
            .with_state(state);

        info!("server listening on 3001");
        let listener = tokio::net::TcpListener::bind("0.0.0.0:3001").await.unwrap();
        axum::serve(listener, app.into_make_service())
            .await
            .unwrap();
    }
}
