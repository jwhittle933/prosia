use std::collections::HashMap;

use tokio::sync::mpsc;
use yrs::{
    doc,
    types::text,
    updates::{decoder::Decode, encoder::Encode},
    Any, Array, ArrayPrelim, Doc, GetString, ReadTxn, Text, Transact,
};

use crate::{
    peers::Peers,
    state::{RoomCmd, RoomHandle},
};

use shared::server::ServerReply;

#[tracing::instrument]
pub fn spawn_room(doc_id: String) -> RoomHandle {
    tracing::info!(%doc_id, "spawning room");
    let (cmd_tx, mut cmd_rx) = mpsc::channel::<RoomCmd>(128);

    tokio::spawn(async move {
        let doc_id = doc_id.clone();
        let doc = yrs::Doc::new();
        let text = doc.get_or_insert_text(doc_id.as_str());

        let mut peers = Peers::new();

        let apply_update = |bytes: &[u8]| {
            let _ = bytes; // placeholder

            let mut txn = doc.transact_mut();
            text.insert(&mut txn, 0, "Hello from peer!");
        };

        let encode_snapshot = || -> Vec<u8> {
            let txn = doc.transact();
            let s = text.get_string(&txn);
            tracing::info!(%doc_id, "encoding snapshot: {}", s);

            s.into_bytes()
        };

        while let Some(cmd) = cmd_rx.recv().await {
            match cmd {
                RoomCmd::Join { peer_id, tx } => {
                    tracing::info!(%doc_id, %peer_id, "peer joined");
                    let _ = tx.try_send(ServerReply::Join {
                        id: peer_id,
                        peers: peers.ids(),
                    });

                    peers.add(peer_id, tx);
                }
                RoomCmd::Leave { peer_id } => {
                    peers.remove(&peer_id);
                    tracing::info!(%doc_id, %peer_id, "peer left");
                }
                RoomCmd::ClientUpdate { peer_id, bytes } => {
                    apply_update(&bytes);
                    peers.notify(peer_id, ServerReply::Update(bytes.clone()));
                }
                RoomCmd::ClientAwareness { peer_id, bytes } => {
                    peers.notify(peer_id, ServerReply::Awareness(bytes.clone()));
                }
                RoomCmd::Snapshot { peer_id: _, tx } => {
                    let snap = encode_snapshot();
                    let _ = tx.send(snap);
                }
            }
        }
    });

    RoomHandle::new(cmd_tx)
}
