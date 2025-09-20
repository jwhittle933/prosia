use leptos::prelude::*;

use super::ScreenplayElementKind;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ScreenPlayElement {
    pub kind: ScreenplayElementKind,
    pub content: (ReadSignal<String>, WriteSignal<String>),
}

impl ScreenPlayElement {
    pub fn new(kind: ScreenplayElementKind) -> Self {
        let content = signal(String::new());

        Self { kind, content }
    }

    pub fn with_content(self, content: &str) -> Self {
        self.content.1.set(content.into());
        self
    }
}

#[component]
pub fn ElementComponent(
    element: ScreenPlayElement,
    set_active_format: WriteSignal<ScreenplayElementKind>,
) -> impl IntoView {
    let rows = move || element.content.0.get().lines().count().max(1) + 1;

    view! {
        <fieldset class="fieldset">
            <textarea
                class="element-textarea"
                placeholder="Start something magical..."
                autocomplete="off"
                autofocus="off"
                rows=rows
                prop:value=element.content.0
                on:input:target=move |ev| {
                    element.content.1.set(ev.target().value());
                }
                on:click=move |_| set_active_format.set(element.kind.clone())
            ></textarea>
        </fieldset>
    }
}
