use leptos::prelude::*;

use fe::{App, AppState};

fn main() {
    _ = console_log::init_with_level(log::Level::Debug);
    console_error_panic_hook::set_once();

    provide_context(AppState::new());

    mount_to_body(|| {
        view! { <App /> }
    })
}
