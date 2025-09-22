use codee::{Decoder, Encoder};
use leptos::prelude::*;

use std::sync::Arc;

use shared::server::{ServerReply, ServerRequest};

#[derive(Clone)]
pub struct WebsocketContext {
    pub message: Signal<Option<ServerReply>>,
    send: Arc<dyn Fn(&ServerRequest) + Send + Sync>,
}

impl WebsocketContext {
    pub fn new(
        message: Signal<Option<ServerReply>>,
        send: Arc<dyn Fn(&ServerRequest) + Send + Sync>,
    ) -> Self {
        let message_clone = message.clone();
        Effect::new(move |_| match message_clone.get() {
            Some(msg) => match msg {
                ServerReply::PingPong => {
                    log::info!("Received PINGPONG message");
                }
                ServerReply::Update(payload) => {
                    log::info!("Received UPDATE message with {} bytes", payload.len());
                }
                ServerReply::Awareness(payload) => {
                    log::info!("Received AWARENESS message with {} bytes", payload.len());
                }
                ServerReply::Snapshot(payload) => {
                    log::info!("Received SNAPSHOT message with {} bytes", payload.len());
                }
                ServerReply::Join { id, peers } => {
                    log::info!(
                        "Received JOIN message with id: {} and {} peers",
                        id,
                        peers.len()
                    );
                }
            },
            None => log::info!("No WebSocket message received"),
        });

        let s = Self { message, send };

        s.send_awareness();

        s
    }

    #[inline(always)]
    pub fn send(&self, message: ServerRequest) {
        (self.send)(&message)
    }

    #[inline(always)]
    pub fn send_awareness(&self) {
        //
    }
}

pub struct SocketCodec;

impl Decoder<ServerReply> for SocketCodec {
    type Error = ();
    type Encoded = [u8];

    fn decode(val: &Self::Encoded) -> Result<ServerReply, Self::Error> {
        Ok(serde_json::from_slice::<ServerReply>(&val).map_err(|_| ())?)
    }
}

impl Encoder<ServerRequest> for SocketCodec {
    type Error = ();
    type Encoded = Vec<u8>;

    fn encode(val: &ServerRequest) -> Result<Self::Encoded, Self::Error> {
        Ok(serde_json::to_vec(val).map_err(|_| ())?)
    }
}
