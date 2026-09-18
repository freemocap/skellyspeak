use super::*;
use documents::*;

fn readable_id(path: &str, id: &str) -> Result<()> {
    if id.is_empty()
        || !id
            .bytes()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'-')
        || id.starts_with('-')
        || id.ends_with('-')
    {
        return Err(error(
            path,
            "identity",
            "Use a readable lowercase name with hyphens.",
        ));
    }
    Ok(())
}
impl Registry {
    pub(super) fn add_definitions(
        &mut self,
        owner: &str,
        orthographies: &BTreeMap<String, OrthographyDefinition>,
        schemes: &BTreeMap<String, RomanizationDefinition>,
    ) -> Result<()> {
        for (id, o) in orthographies {
            readable_id(&format!("{owner}#orthographies.{id}"), id)?;
            self.orthographies.push(Orthography {
                id: format!("{owner}:{id}"),
                script: o.script.clone(),
                guidance: o.guidance.clone(),
            });
        }
        for (id, s) in schemes {
            readable_id(&format!("{owner}#romanization_schemes.{id}"), id)?;
            self.romanizations.push(Romanization {
                id: format!("{owner}:{id}"),
                label: s.label.clone(),
                instructions: s.instructions.clone(),
                examples: s
                    .examples
                    .iter()
                    .map(|e| (e.original.clone(), e.romanized.clone()))
                    .collect(),
                sources: s.sources.clone(),
                review: s.review.to_string(),
            });
        }
        Ok(())
    }
    fn orthography_script(&self, path: &str, key: &str) -> Result<String> {
        self.orthographies
            .iter()
            .find(|o| o.id == key)
            .map(|o| o.script.clone())
            .ok_or_else(|| {
                error(
                    path,
                    "unknown_reference",
                    format!("Unknown orthography {key}."),
                )
            })
    }
    fn check_schemes(
        &self,
        path: &str,
        language: &str,
        supported: &[DefinitionRef],
        selected: &RomanizationSelection,
    ) -> Result<()> {
        let mut keys = BTreeSet::new();
        for reference in supported {
            let key = reference.key(language);
            if !keys.insert(key.clone()) {
                return Err(error(
                    path,
                    "duplicate_reference",
                    format!("Duplicate supported scheme {key}."),
                ));
            }
            if !self.romanizations.iter().any(|s| s.id == key) {
                return Err(error(
                    path,
                    "unknown_reference",
                    format!(
                        "Unknown scheme {key}; expected {}.",
                        reference.source(language, "romanization_schemes")
                    ),
                ));
            }
        }
        if let Some(key) = selected.key(language)
            && !keys.contains(&key)
        {
            return Err(error(
                path,
                "unsupported_default",
                format!("Default scheme {key} must be in supported_romanizations."),
            ));
        }
        Ok(())
    }
    pub(super) fn add_language(&mut self, path: &str, doc: LanguageDocument) -> Result<()> {
        let id = &doc.identity.id.0;
        readable_id(&format!("{path}#identity.id"), id)?;
        if id == "shared" {
            return Err(error(
                path,
                "identity",
                "The shared namespace is reserved for shared definitions.",
            ));
        }
        if doc.schema_version != 1 {
            return Err(error(
                path,
                "schema_version",
                "Supported content schema version is 1.",
            ));
        }
        self.add_definitions(
            id,
            &doc.definitions.orthographies,
            &doc.definitions.romanization_schemes,
        )?;
        let orthography = doc.defaults.orthography.key(id);
        let script =
            self.orthography_script(&format!("{path}#defaults.orthography"), &orthography)?;
        self.check_schemes(
            &format!("{path}#defaults.romanization"),
            id,
            &doc.defaults.supported_romanizations,
            &doc.defaults.romanization,
        )?;
        let mut varieties = vec![];
        for v in &doc.varieties {
            let vpath = format!("{path}#varieties.{}", v.id);
            readable_id(&vpath, v.id.0.as_str())?;
            let o = &v.overrides;
            self.check_schemes(
                &format!("{vpath}.overrides.romanization"),
                id,
                o.supported_romanizations
                    .as_deref()
                    .unwrap_or(&doc.defaults.supported_romanizations),
                o.romanization
                    .as_ref()
                    .unwrap_or(&doc.defaults.romanization),
            )?;
            let orth = o.orthography.as_ref().map(|r| r.key(id));
            let script = orth
                .as_ref()
                .map(|key| self.orthography_script(&format!("{vpath}.overrides.orthography"), key))
                .transpose()?;
            varieties.push(Variety {
                id: v.id.to_string(),
                name: v.name.clone(),
                description: v.description.clone(),
                review: v.review.to_string(),
                sources: v.sources.clone(),
                script,
                orthography: orth,
                romanization: o.romanization.as_ref().and_then(|r| r.key(id)),
                romanization_disabled: matches!(
                    o.romanization,
                    Some(RomanizationSelection::Disabled)
                ),
                external_tags: o.integrations.tags(),
                scalars: o.scalars.clone(),
                guidance: v.guidance.clone(),
            });
        }
        self.goal_material
            .insert(id.clone(), doc.learning.goal_material.clone());
        self.languages.push(Language {
            id: id.clone(),
            name: doc.identity.name.clone(),
            native_name: doc.identity.native_name.clone(),
            family: doc.identity.family.clone(),
            review: doc.identity.review.to_string(),
            external_tags: doc.integrations.tags(),
            starter_persona: doc.conversation.default_partner.clone(),
            scalars: doc.defaults.scalars.clone(),
            script,
            orthography,
            romanization: doc.defaults.romanization.key(id),
            traits: doc.traits.clone(),
            default_variety: doc.defaults.variety.to_string(),
            varieties,
            guidance: doc.guidance.clone(),
        });
        self.documents.insert(id.clone(), doc);
        Ok(())
    }
    pub(super) fn entity_source(&self, entity: &str) -> Option<String> {
        for (id, doc) in &self.documents {
            let path = format!("languages/{id}.yaml");
            if id == entity {
                return Some(path);
            }
            if doc.varieties.iter().any(|v| v.id == entity) {
                return Some(format!("{path}#varieties.{entity}"));
            }
            for (kind, keys) in [
                (
                    "orthographies",
                    doc.definitions.orthographies.keys().collect::<Vec<_>>(),
                ),
                (
                    "romanization_schemes",
                    doc.definitions.romanization_schemes.keys().collect(),
                ),
            ] {
                for key in keys {
                    if entity == format!("{id}:{key}") {
                        return Some(format!("{path}#definitions.{kind}.{key}"));
                    }
                }
            }
        }
        None
    }
}
