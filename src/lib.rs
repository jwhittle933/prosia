use leptos::{prelude::*, server::codee::string::FromToStringCodec};
use leptos_meta::*;
use leptos_router::{components::*, path};

use icondata::ChMenuMeatball;
use leptos_icons::Icon;

pub(crate) mod components;
pub mod format;

use components::format_header::FormatOptions;
use leptos_use::{core::ConnectionReadyState, use_websocket, UseWebSocketReturn};
use uuid::Uuid;

use crate::format::ScreenplayElement;

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

    let UseWebSocketReturn {
        ready_state,
        message,
        send,
        open,
        close,
        ..
    } = use_websocket::<String, String, FromToStringCodec>("ws://localhost:3001/ws/lobby");

    Effect::new(move |_| {
        open();
    });

    let send_message = move |_: String| {
        send(&"Hello, world!".to_string());
    };

    let status = move || ready_state.get().to_string();

    let connected = move || ready_state.get() == ConnectionReadyState::Open;

    view! {
        <Html attr:lang="en" attr:dir="ltr" attr:data-theme="light" />

        // sets the document title
        <Title text="Welcome to Leptos CSR" />

        // injects metadata in the <head> of the page
        <Meta charset="UTF-8" />
        <Meta name="viewport" content="width=device-width, initial-scale=1.0" />
        // Full-viewport app shell
        <div class="app-shell">
            <Scriptre />
        </div>
    }
}

/// Default Home Page
#[component]
pub fn Scriptre() -> impl IntoView {
    let (docs, set_docs) = signal(Vec::<ScreenplayElement>::new());
    let (active_format, set_active_format) = signal(ScreenplayElement::General);

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
                    <article class="doc-page" role="textbox" aria-multiline="true">
                        <p>"Start typing…"</p>
                    </article>
                </main>
            </div>
        </ErrorBoundary>
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
