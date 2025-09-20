use std::collections::HashMap;

use tokio::sync::mpsc;

use shared::server::ServerReply;

pub struct Peers {
    pub peers: HashMap<u64, mpsc::Sender<ServerReply>>,
}

impl Peers {
    pub fn new() -> Self {
        Self {
            peers: HashMap::new(),
        }
    }

    pub fn notify(&self, from: u64, reply: ServerReply) {
        for (peer_id, tx) in &self.peers {
            if *peer_id == from {
                continue;
            }

            let _ = tx.try_send(reply.clone());
        }
    }

    pub fn ids(&self) -> Vec<u64> {
        self.peers.keys().cloned().collect()
    }

    pub fn add(&mut self, peer_id: u64, tx: mpsc::Sender<ServerReply>) {
        self.peers.insert(peer_id, tx);
    }

    pub fn remove(&mut self, peer_id: &u64) {
        self.peers.remove(peer_id);
    }
}
