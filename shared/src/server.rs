#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum ServerRequest {}

/// ServerReply represents the output of the server processing
/// a client message. The reply is converted into a WebSocket Message
/// and sent back to the client.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum ServerReply {
    Update(Vec<u8>), // TAG_UPDATE + payload
    Join { id: u64, peers: Vec<u64> },
    Awareness(Vec<u8>), // TAG_AWARENESS + payload
    Snapshot(Vec<u8>),  // TAG_SNAPSHOT + payload
    PingPong,
}
