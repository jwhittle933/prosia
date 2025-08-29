use leptos::prelude::*;
use leptos_icons::Icon;

use crate::format::ScreenplayElement;

#[component]
pub fn FormatOptions(
    active_format: ReadSignal<ScreenplayElement>,
    set_active_format: WriteSignal<ScreenplayElement>,
) -> impl IntoView {
    view! {
        <div class="meta-actions join">
            <button
                class="btn menu-action join-item"
                class:btn-active=move || { active_format.get() == ScreenplayElement::General }
                title="General"
                on:click=move |_| {
                    set_active_format.set(ScreenplayElement::General);
                }
            >
                <Icon icon=icondata::MdiFormatLetterCase />
            </button>
            <button
                class="btn menu-action join-item"
                class:btn-active=move || { active_format.get() == ScreenplayElement::SceneHeading }
                title="Scene Heading"
                on:click=move |_| {
                    set_active_format.set(ScreenplayElement::SceneHeading);
                }
            >
                <Icon icon=icondata::BiHeadingRegular />
            </button>
            <button
                class="btn menu-action join-item"
                class:btn-active=move || active_format.get() == ScreenplayElement::Action
                title="Action"
                on:click=move |_| {
                    set_active_format.set(ScreenplayElement::Action);
                }
            >
                <Icon icon=icondata::BsLightning />
            </button>
            <button
                class="btn menu-action join-item"
                class:btn-active=move || active_format.get() == ScreenplayElement::Character
                title="Character"
                on:click=move |_| { set_active_format.set(ScreenplayElement::Character) }
            >
                <Icon icon=icondata::BsPersonArmsUp />
            </button>
            <button
                class="btn menu-action join-item"
                class:btn-active=move || active_format.get() == ScreenplayElement::Parenthetical
                title="Parenthetical"
                on:click=move |_| { set_active_format.set(ScreenplayElement::Parenthetical) }
            >
                <Icon icon=icondata::LuParentheses />
            </button>
            <button
                class="btn menu-action join-item"
                class:btn-active=move || active_format.get() == ScreenplayElement::Dialogue
                title="Dialogue"
                on:click=move |_| { set_active_format.set(ScreenplayElement::Dialogue) }
            >
                <Icon icon=icondata::BiCommentDetailRegular />
            </button>
            <button
                class="btn menu-action join-item"
                class:btn-active=move || active_format.get() == ScreenplayElement::Transition
                title="Transition"
                on:click=move |_| { set_active_format.set(ScreenplayElement::Transition) }
            >
                <Icon icon=icondata::MdiTransitDetour />
            </button>
        </div>
    }
}
