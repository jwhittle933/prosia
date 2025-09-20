use std::sync::Arc;

use leptos::prelude::*;
use leptos_meta::*;

use icondata::ChMenuMeatball;
use leptos_icons::Icon;

pub(crate) mod components;
pub mod format;

use components::format_header::FormatOptions;
use leptos_use::{use_websocket, UseWebSocketReturn};
use uuid::Uuid;

use shared::server::{ServerReply, ServerRequest};

// Import BinaryCodec for use_websocket
// Removed: use leptos_use::codec::BinaryCodec;

use crate::format::{
    element::{ElementComponent, ScreenPlayElement},
    ScreenplayElementKind,
};

mod socket;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct AppState {
    pub user_id: Uuid,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            user_id: Uuid::new_v4(),
        }
    }

    pub fn from_ctx() -> Self {
        use_context::<Self>().unwrap()
    }
}

#[component]
pub fn App() -> impl IntoView {
    provide_meta_context();
    let (loaded, _) = signal(false);

    let UseWebSocketReturn {
        ready_state,
        message,
        send,
        open,
        ..
    } = use_websocket::<ServerRequest, ServerReply, socket::SocketCodec>(
        "ws://localhost:3001/ws/lobby",
    );

    // Only run this effect once, on mount
    Effect::new(move |prev| {
        open();
    });

    provide_context(socket::WebsocketContext::new(
        message,
        Arc::new(send.clone()),
    ));

    let websocket = expect_context::<socket::WebsocketContext>();

    view! {
        <Html attr:lang="en" attr:dir="ltr" attr:data-theme="light" />

        // sets the document title
        <Title text="Welcome to Leptos CSR" />

        // injects metadata in the <head> of the page
        <Meta charset="UTF-8" />
        <Meta name="viewport" content="width=device-width, initial-scale=1.0" />
        // Full-viewport app shell
        <div class="app-shell">
            <Composer />
        </div>
    }
}

#[component]
pub fn Composer() -> impl IntoView {
    const MAX_PAGE_LINES: usize = 55;

    let websocket = expect_context::<socket::WebsocketContext>();
    let (active_format, set_active_format) = signal(ScreenplayElementKind::General);

    let (page_count, set_page_count) = signal(1);

    view! {
        <ErrorBoundary fallback=|errors| {
            view! {
                <div class="error">
                    <h1>"Uh oh! Something went wrong!"</h1>
                    <p>"Errors: "</p>
                    <ul>
                        {move || {
                            errors
                                .get()
                                .into_iter()
                                .map(|(_, e)| view! { <li>{e.to_string()}</li> })
                                .collect_view()
                        }}
                    </ul>
                </div>
            }
        }>
            <div class="editor-shell">
                <div class="navbar bg-base-100 shadow-sm w-full">
                    <div class="flex-1 navbar-start">
                        <FormatOptions active_format set_active_format />
                    </div>
                    <div class="flex-none navbar-end">
                        <button class="btn btn-square btn-ghost">
                            <Icon icon=ChMenuMeatball />
                        </button>
                    </div>
                </div>

                <main class="page-container">
                    <For each=move || 0..page_count.get() key=|i| *i let:i>
                        <Page page=i set_active_format />
                    </For>
                </main>
            </div>
        </ErrorBoundary>
    }
}

#[component]
fn Page(page: usize, set_active_format: WriteSignal<ScreenplayElementKind>) -> impl IntoView {
    let (position, set_position) = signal(0);

    view! {
        <article class="doc-page" role="textbox" aria-multiline="true">
            <fieldset class="fieldset">
                <div
                    class="element-textarea"
                    contenteditable="true"
                    on:mousedown=move |_| {
                        //
                    }
                >
                    "Start something awesome"
                </div>
            </fieldset>
        </article>
    }
}

/// A parameterized incrementing button
#[component]
pub fn Button(#[prop(default = 1)] increment: i32) -> impl IntoView {
    let (count, set_count) = signal(0);
    view! {
        <button on:click=move |_| {
            set_count.set(count.get() + increment)
        }>

            "Click me: " {count}
        </button>
    }
}
