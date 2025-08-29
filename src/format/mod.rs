//! Screenplay element types (Hollywood-style paragraph categories).
//!
//! These represent the block/paragraph-level elements recognized by common
//! screenplay formats (Final Draft, Fountain, etc.). They’re intentionally
//! tool-agnostic and can be mapped to specific render rules.
//!
use icondata::{
    BiCommentDetailRegular, BiHeadingRegular, BsLightning, BsPersonArmsUp, LuParentheses,
    MdiTransitDetour,
};

use crate::components::icon::IntoIcon;

/// Paragraph-level element kinds in a screenplay.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
#[non_exhaustive]
pub enum ScreenplayElement {
    General,
    /// Scene heading (aka slugline): e.g., INT. OFFICE - DAY
    SceneHeading,
    /// Action/description blocks
    Action,
    /// Character cue preceding dialogue
    Character,
    /// Parenthetical (wryly), between character and dialogue
    Parenthetical,
    /// Dialogue text
    Dialogue,
    /// Transition blocks (e.g., CUT TO:)
    Transition,
}

impl core::fmt::Display for ScreenplayElement {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        let s = match self {
            ScreenplayElement::General => "General",
            ScreenplayElement::SceneHeading => "SceneHeading",
            ScreenplayElement::Action => "Action",
            ScreenplayElement::Character => "Character",
            ScreenplayElement::Parenthetical => "Parenthetical",
            ScreenplayElement::Dialogue => "Dialogue",
            ScreenplayElement::Transition => "Transition",
        };
        f.write_str(s)
    }
}

impl IntoIcon for ScreenplayElement {
    fn into_icon(&self) -> icondata_core::Icon {
        match self {
            ScreenplayElement::SceneHeading => BiHeadingRegular,
            ScreenplayElement::Action => BsLightning,
            ScreenplayElement::Character => BsPersonArmsUp,
            ScreenplayElement::Parenthetical => LuParentheses,
            ScreenplayElement::Dialogue => BiCommentDetailRegular,
            ScreenplayElement::Transition => MdiTransitDetour,
            ScreenplayElement::General => BiCommentDetailRegular,
        }
    }
}

/// Error when parsing a [`ScreenplayElement`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ParseElementError;

impl core::fmt::Display for ParseElementError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str("invalid screenplay element")
    }
}
