use super::*;

impl Registry {
    pub fn romanization_guidance(&self, id: &str) -> Result<Option<String>> {
        let l = self.language_config(id)?;
        self.romanization_for(
            l,
            l.varieties
                .iter()
                .find(|v| v.id == l.default_variety)
                .unwrap(),
        )
    }
    pub(super) fn variety_romanization<'a>(
        language: &'a Language,
        variety: &'a Variety,
    ) -> Option<&'a String> {
        if variety.romanization_disabled {
            None
        } else {
            variety
                .romanization
                .as_ref()
                .or(language.romanization.as_ref())
        }
    }
    fn romanization_for(&self, language: &Language, variety: &Variety) -> Result<Option<String>> {
        Ok(Self::variety_romanization(language, variety).map(|id| {
            let s = self
                .romanizations
                .iter()
                .find(|s| s.id == *id)
                .expect("validated scheme");
            let examples = s
                .examples
                .iter()
                .map(|(a, b)| format!("{a} → {b}"))
                .collect::<Vec<_>>()
                .join("; ");
            format!(
                "Romanization: {} ({}). {} Examples: {}. Sources: {}.",
                s.label,
                s.id,
                s.instructions,
                examples,
                s.sources.join(", ")
            )
        }))
    }
    pub fn resolve(
        &self,
        language: &str,
        variety: Option<&str>,
        explanation: &str,
    ) -> Result<LanguageContext> {
        self.resolve_pair(language, variety, explanation, None)
    }
    pub fn resolve_pair(
        &self,
        language: &str,
        variety: Option<&str>,
        explanation: &str,
        explanation_variety: Option<&str>,
    ) -> Result<LanguageContext> {
        let target = self.language_config(language)?;
        let explanation = self.language_config(explanation)?;
        let explanation_variety = explanation_variety.unwrap_or(&explanation.default_variety);
        if !explanation
            .varieties
            .iter()
            .any(|v| v.id == explanation_variety)
        {
            return Err(error(
                "languages",
                "unknown_explanation_variety",
                explanation_variety,
            ));
        }
        let variety = variety.unwrap_or(&target.default_variety);
        if !target.varieties.iter().any(|v| v.id == variety) {
            return Err(error("languages", "unknown_variety", variety));
        }
        let mut guidance = BTreeMap::<String, Vec<String>>::new();
        for scope in SCOPES {
            let lang = if *scope == "explanation_writing" {
                explanation
            } else {
                target
            };
            let v = if *scope == "explanation_writing" {
                explanation_variety
            } else {
                variety
            };
            let selected = lang
                .varieties
                .iter()
                .find(|item| item.id == v)
                .expect("validated variety");
            let mut rules = vec![format!(
                "Use {} — {} ({}). {}",
                lang.name, selected.name, selected.id, selected.description
            )];
            // [@asha_language_variation]
            if *scope == "assessment" {
                rules.push("Distinguish errors from valid forms in another variety. Explain a mismatch with the selected variety without treating all variation as incorrect.".into());
            }
            let mut add = |notes: &[Guidance]| {
                rules.extend(
                    notes
                        .iter()
                        .filter(|g| g.scope == *scope)
                        .map(|g| g.text.clone()),
                );
            };
            add(&self.universal);
            let mut seen = BTreeSet::new();
            let mut ordered = vec![];
            for id in &lang.traits {
                self.trait_order(id, &mut seen, &mut ordered);
            }
            for t in ordered {
                add(&t.guidance);
            }
            add(&self
                .orthographies
                .iter()
                .find(|o| o.id == *selected.orthography.as_ref().unwrap_or(&lang.orthography))
                .expect("validated orthography")
                .guidance);
            add(&lang.guidance);
            add(&lang
                .varieties
                .iter()
                .find(|x| x.id == v)
                .expect("validated variety")
                .guidance);
            if *scope == "romanization"
                && let Some(text) = self.romanization_for(target, selected)?
            {
                rules.push(text);
            }
            guidance.insert(scope.to_string(), rules);
        }
        let (direction, font_scale, word_spacing) = self.resolved_scalars(target, variety);
        let mut ctx = LanguageContext {
            script: target
                .varieties
                .iter()
                .find(|v| v.id == variety)
                .unwrap()
                .script
                .as_ref()
                .unwrap_or(&target.script)
                .clone(),
            direction,
            font_scale,
            word_spacing,
            language_id: language.into(),
            variety_id: variety.into(),
            explanation_language_id: explanation.id.clone(),
            explanation_variety_id: explanation_variety.into(),
            target_name: target.name.clone(),
            variety_name: target
                .varieties
                .iter()
                .find(|v| v.id == variety)
                .unwrap()
                .name
                .clone(),
            external_tags: {
                let mut tags = target.external_tags.clone();
                tags.extend(
                    target
                        .varieties
                        .iter()
                        .find(|v| v.id == variety)
                        .unwrap()
                        .external_tags
                        .clone(),
                );
                tags
            },
            hash: String::new(),
            guidance,
        };
        ctx.hash = fingerprint(&(&self.hash, &ctx));
        Ok(ctx)
    }
    pub(super) fn resolved_scalars(
        &self,
        language: &Language,
        variety: &str,
    ) -> (String, f64, bool) {
        let script = self
            .scripts
            .iter()
            .find(|s| {
                s.id == *language
                    .varieties
                    .iter()
                    .find(|v| v.id == variety)
                    .unwrap()
                    .script
                    .as_ref()
                    .unwrap_or(&language.script)
            })
            .expect("validated script");
        let mut result = (
            script.direction.clone(),
            script.font_scale,
            script.word_spacing,
        );
        let mut apply = |overrides: &ScalarOverrides| {
            if let Some(value) = &overrides.direction {
                result.0 = value.clone();
            }
            if let Some(value) = overrides.font_scale {
                result.1 = value;
            }
            if let Some(value) = overrides.word_spacing {
                result.2 = value;
            }
        };
        let mut ordered = vec![];
        let mut seen = BTreeSet::new();
        for id in &language.traits {
            self.trait_order(id, &mut seen, &mut ordered);
        }
        for item in ordered {
            apply(&item.scalars);
        }
        apply(&language.scalars);
        apply(
            &language
                .varieties
                .iter()
                .find(|v| v.id == variety)
                .expect("validated variety")
                .scalars,
        );
        result
    }
    fn trait_order<'a>(
        &'a self,
        id: &str,
        seen: &mut BTreeSet<String>,
        ordered: &mut Vec<&'a Trait>,
    ) {
        if !seen.insert(id.into()) {
            return;
        }
        let t = self
            .traits
            .iter()
            .find(|t| t.id == id)
            .expect("validated trait");
        for dep in &t.requires {
            self.trait_order(dep, seen, ordered);
        }
        ordered.push(t);
    }
}
