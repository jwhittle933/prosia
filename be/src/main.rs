use std::sync::Arc;

use axum::{
    extract::{ws::WebSocketUpgrade, Path, State},
    response::IntoResponse,
    routing::get,
    Router,
};
use dashmap::DashMap;

mod room;
mod socket;
mod state;

async fn ws_handler(
    State(state): State<state::AppState>,
    Path(doc_id): Path<String>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| socket::handle_connect(state, doc_id, socket))
}

#[tokio::main]
async fn main() {
    // Init logging
    tracing_subscriber::fmt()
        .with_target(false)
        .compact()
        .init();

    let mut map = DashMap::new();
    let handle = room::spawn_room("lobby".to_string());

    map.insert("lobby".to_string(), handle);
    let state = state::AppState {
        rooms: Arc::new(map),
    };

    let app = Router::new()
        .route("/ws/{doc_id}", get(ws_handler))
        .with_state(state);

    tracing::info!("server listening on 3001");
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001").await.unwrap();
    axum::serve(listener, app.into_make_service())
        .await
        .unwrap();
}
