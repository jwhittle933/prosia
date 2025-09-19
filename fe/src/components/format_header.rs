use leptos::prelude::*;
use leptos_icons::Icon;

use crate::format::ScreenplayElementKind;

#[component]
pub fn FormatOptions(
    active_format: ReadSignal<ScreenplayElementKind>,
    set_active_format: WriteSignal<ScreenplayElementKind>,
) -> impl IntoView {
    view! {
        <div class="meta-actions join">
            <button
                class="btn menu-action join-item"
                class:btn-active=move || { active_format.get() == ScreenplayElementKind::General }
                title="General"
                on:click=move |_| {
                    set_active_format.set(ScreenplayElementKind::General);
                }
            >
                <Icon icon=icondata::MdiFormatLetterCase />
            </button>
            <button
                class="btn menu-action join-item"
                class:btn-active=move || {
                    active_format.get() == ScreenplayElementKind::SceneHeading
                }
                title="Scene Heading"
                on:click=move |_| {
                    set_active_format.set(ScreenplayElementKind::SceneHeading);
                }
            >
                <Icon icon=icondata::BiHeadingRegular />
            </button>
            <button
                class="btn menu-action join-item"
                class:btn-active=move || active_format.get() == ScreenplayElementKind::Action
                title="Action"
                on:click=move |_| {
                    set_active_format.set(ScreenplayElementKind::Action);
                }
            >
                <Icon icon=icondata::BsLightning />
            </button>
            <button
                class="btn menu-action join-item"
                class:btn-active=move || active_format.get() == ScreenplayElementKind::Character
                title="Character"
                on:click=move |_| { set_active_format.set(ScreenplayElementKind::Character) }
            >
                <Icon icon=icondata::BsPersonArmsUp />
            </button>
            <button
                class="btn menu-action join-item"
                class:btn-active=move || active_format.get() == ScreenplayElementKind::Parenthetical
                title="Parenthetical"
                on:click=move |_| { set_active_format.set(ScreenplayElementKind::Parenthetical) }
            >
                <Icon icon=icondata::LuParentheses />
            </button>
            <button
                class="btn menu-action join-item"
                class:btn-active=move || active_format.get() == ScreenplayElementKind::Dialogue
                title="Dialogue"
                on:click=move |_| { set_active_format.set(ScreenplayElementKind::Dialogue) }
            >
                <Icon icon=icondata::BiCommentDetailRegular />
            </button>
            <button
                class="btn menu-action join-item"
                class:btn-active=move || active_format.get() == ScreenplayElementKind::Transition
                title="Transition"
                on:click=move |_| { set_active_format.set(ScreenplayElementKind::Transition) }
            >
                <Icon icon=icondata::MdiTransitDetour />
            </button>
        </div>
    }
}
