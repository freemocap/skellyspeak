//! Learner-owned appearance preferences; independent from conversation behavior.
use crate::model::{AppError, ErrorCode, Result};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Default, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SurfacePalette {
    #[default]
    Cool,
    Warm,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ControlDensity {
    #[default]
    Standard,
    Compact,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum LayoutSpacing {
    Roomy,
    Balanced,
    #[default]
    Tight,
    ExtraTight,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SurfaceDepth {
    Flat,
    #[default]
    Subtle,
    Raised,
    Recessed,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AppearancePreferences {
    pub palette: SurfacePalette,
    pub control_density: ControlDensity,
    pub layout_spacing: LayoutSpacing,
    pub depth: SurfaceDepth,
    pub glow_enabled: bool,
    pub glow_color: String,
    pub glow_strength: u8,
}
impl Default for AppearancePreferences {
    fn default() -> Self {
        Self {
            palette: Default::default(),
            control_density: Default::default(),
            layout_spacing: Default::default(),
            depth: Default::default(),
            glow_enabled: false,
            glow_color: "#7c5cff".into(),
            glow_strength: 30,
        }
    }
}
impl AppearancePreferences {
    pub fn validate(&self) -> Result<()> {
        if self.glow_strength > 70
            || self.glow_color.len() != 7
            || !self.glow_color.starts_with('#')
            || !self.glow_color.as_bytes()[1..]
                .iter()
                .all(u8::is_ascii_hexdigit)
        {
            return Err(AppError::new(
                ErrorCode::Validation,
                "Appearance requires a six-digit hex color and glow strength from 0 to 70.",
            ));
        }
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn appearance_roundtrips_and_rejects_invalid_values() {
        let mut preferences = AppearancePreferences::default();
        for palette in [SurfacePalette::Cool, SurfacePalette::Warm] {
            preferences.palette = palette;
            for depth in [
                SurfaceDepth::Flat,
                SurfaceDepth::Subtle,
                SurfaceDepth::Raised,
                SurfaceDepth::Recessed,
            ] {
                preferences.depth = depth;
                preferences.validate().unwrap();
                assert_eq!(
                    serde_json::from_str::<AppearancePreferences>(
                        &serde_json::to_string(&preferences).unwrap()
                    )
                    .unwrap(),
                    preferences
                );
            }
        }
        for color in ["", "#fff", "#zzzzzz", "red", "#123456;", "#éabcd"] {
            preferences.glow_color = color.into();
            assert!(preferences.validate().is_err());
        }
        preferences.glow_color = "#00Aaff".into();
        preferences.glow_strength = 70;
        preferences.validate().unwrap();
        preferences.glow_strength = 71;
        assert!(preferences.validate().is_err());
        let mut raw = serde_json::to_value(AppearancePreferences::default()).unwrap();
        raw["depth"] = "unknown".into();
        assert!(serde_json::from_value::<AppearancePreferences>(raw).is_err());
    }
}
