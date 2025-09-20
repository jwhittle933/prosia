use std::collections::HashMap;

use tokio::sync::mpsc;

use crate::state::{RoomCmd, RoomHandle, ServerMsg};

#[tracing::instrument]
pub fn spawn_room(doc_id: String) -> RoomHandle {
    tracing::info!(%doc_id, "spawning room");
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

    RoomHandle::new(cmd_tx, doc)
}
