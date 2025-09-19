use codee::{Decoder, Encoder};
use leptos::prelude::*;

use std::sync::Arc;

// Tags
const TAG_UPDATE: u8 = 0x00;
const TAG_AWARENESS: u8 = 0x01;
const TAG_SNAPSHOT_REQ: u8 = 0x02;
const TAG_SNAPSHOT: u8 = 0x03;
const TAG_PINGPONG: u8 = 0x04;

#[derive(Debug, Clone)]
pub struct SocketMessage(u8, Vec<u8>);

#[derive(Clone)]
pub struct WebsocketContext {
    pub message: Signal<Option<SocketMessage>>,
    send: Arc<dyn Fn(&SocketMessage) + Send + Sync>, // use Arc to make it easily cloneable
}

impl WebsocketContext {
    pub fn new(
        message: Signal<Option<SocketMessage>>,
        send: Arc<dyn Fn(&SocketMessage) + Send + Sync>,
    ) -> Self {
        let message_clone = message.clone();
        Effect::new(move |_| match message_clone.get() {
            Some(msg) => match msg.0 {
                TAG_PINGPONG => {
                    log::info!("Received PINGPONG message");
                }
                TAG_UPDATE => {
                    log::info!("Received UPDATE message with {} bytes", msg.1.len());
                }
                TAG_AWARENESS => {
                    log::info!("Received AWARENESS message with {} bytes", msg.1.len());
                }
                TAG_SNAPSHOT_REQ => {
                    log::info!("Received SNAPSHOT_REQ message");
                }
                TAG_SNAPSHOT => {
                    log::info!("Received SNAPSHOT message with {} bytes", msg.1.len());
                }
                _ => {
                    log::warn!("Received unknown message tag: {}", msg.0);
                }
            },
            None => log::info!("No WebSocket message received"),
        });

        let s = Self { message, send };

        s.send_awareness();

        s
    }

    // create a method to avoid having to use parantheses around the field
    #[inline(always)]
    pub fn send(&self, message: SocketMessage) {
        (self.send)(&message)
    }

    #[inline(always)]
    pub fn send_awareness(&self) {
        self.send(SocketMessage(TAG_AWARENESS, vec![]));
    }
}

pub struct SocketCodec;

impl Decoder<SocketMessage> for SocketCodec {
    type Error = ();
    type Encoded = [u8];

    fn decode(val: &Self::Encoded) -> Result<SocketMessage, Self::Error> {
        let tag = val[0];
        let payload = val[1..].to_vec();

        Ok(SocketMessage(tag, payload))
    }
}

impl Encoder<SocketMessage> for SocketCodec {
    type Error = ();
    type Encoded = Vec<u8>;

    fn encode(val: &SocketMessage) -> Result<Self::Encoded, Self::Error> {
        let mut encoded = vec![val.0];
        encoded.extend_from_slice(&val.1);
        Ok(encoded)
    }
}
