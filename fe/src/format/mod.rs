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

pub mod element;

/// Paragraph-level element kinds in a screenplay.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
#[non_exhaustive]
pub enum ScreenplayElementKind {
    /// Any typing that doesn’t fit another category
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

impl core::fmt::Display for ScreenplayElementKind {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        let s = match self {
            ScreenplayElementKind::General => "General",
            ScreenplayElementKind::SceneHeading => "SceneHeading",
            ScreenplayElementKind::Action => "Action",
            ScreenplayElementKind::Character => "Character",
            ScreenplayElementKind::Parenthetical => "Parenthetical",
            ScreenplayElementKind::Dialogue => "Dialogue",
            ScreenplayElementKind::Transition => "Transition",
        };
        f.write_str(s)
    }
}

impl IntoIcon for ScreenplayElementKind {
    fn into_icon(&self) -> icondata_core::Icon {
        match self {
            ScreenplayElementKind::SceneHeading => BiHeadingRegular,
            ScreenplayElementKind::Action => BsLightning,
            ScreenplayElementKind::Character => BsPersonArmsUp,
            ScreenplayElementKind::Parenthetical => LuParentheses,
            ScreenplayElementKind::Dialogue => BiCommentDetailRegular,
            ScreenplayElementKind::Transition => MdiTransitDetour,
            ScreenplayElementKind::General => BiCommentDetailRegular,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ParseElementError;

impl core::fmt::Display for ParseElementError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str("invalid screenplay element")
    }
}
