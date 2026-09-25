use super::*;
fn unique<'a>(path: &str, ids: impl Iterator<Item = &'a str>) -> Result<BTreeSet<String>> {
    let mut set = BTreeSet::new();
    for id in ids {
        if id.trim().is_empty() || !set.insert(id.into()) {
            return Err(error(
                path,
                "identity",
                format!("Empty or duplicate id: {id}"),
            ));
        }
    }
    Ok(set)
}
fn reference(path: &str, id: &str, ids: &BTreeSet<String>) -> Result<()> {
    if !ids.contains(id) {
        return Err(error(path, "unknown_reference", id));
    }
    Ok(())
}
fn nonempty(path: &str, values: &[&str]) -> Result<()> {
    if values.iter().any(|s| s.trim().is_empty()) {
        return Err(error(path, "empty", "Required content is empty."));
    }
    Ok(())
}
fn review(path: &str, value: &str) -> Result<()> {
    if !["needs_review", "reviewed"].contains(&value) {
        return Err(error(path, "review", "Use needs_review or reviewed."));
    }
    Ok(())
}
fn citations(path: &str, sources: &[String], keys: &BTreeSet<String>) -> Result<()> {
    if sources.is_empty() {
        return Err(error(
            path,
            "citation",
            "Content needs at least one source.",
        ));
    }
    for key in sources {
        reference(path, key, keys)?;
    }
    Ok(())
}
fn notes(path: &str, guidance: &[Guidance], keys: &BTreeSet<String>) -> Result<()> {
    for g in guidance {
        if !SCOPES.contains(&g.scope.as_str()) {
            return Err(error(path, "scope", &g.scope));
        }
        nonempty(path, &[&g.text])?;
        citations(path, &g.sources, keys)?;
    }
    Ok(())
}
fn acyclic(path: &str, graph: &BTreeMap<String, Vec<String>>) -> Result<()> {
    fn visit(
        id: &str,
        graph: &BTreeMap<String, Vec<String>>,
        active: &mut BTreeSet<String>,
        done: &mut BTreeSet<String>,
    ) -> Result<()> {
        if done.contains(id) {
            return Ok(());
        }
        if !active.insert(id.into()) {
            return Err(error(id, "cycle", "Dependency cycle."));
        }
        for dep in &graph[id] {
            if !graph.contains_key(dep) {
                return Err(error(id, "unknown_reference", dep));
            }
            visit(dep, graph, active, done)?;
        }
        active.remove(id);
        done.insert(id.into());
        Ok(())
    }
    let mut done = BTreeSet::new();
    for id in graph.keys() {
        visit(id, graph, &mut BTreeSet::new(), &mut done).map_err(|mut e| {
            e.path = format!("{path}/{}", e.path);
            e
        })?;
    }
    Ok(())
}
fn scalars(path: &str, value: &ScalarOverrides) -> Result<()> {
    if value
        .direction
        .as_ref()
        .is_some_and(|d| !["ltr", "rtl"].contains(&d.as_str()))
        || value
            .font_scale
            .is_some_and(|f| !f.is_finite() || !(0.5..=3.0).contains(&f))
    {
        return Err(error(
            path,
            "scalar",
            "Invalid direction or font scale override.",
        ));
    }
    Ok(())
}
impl Registry {
    pub(super) fn validate(&self, bib: &str) -> Result<()> {
        let bibliography =
            citations::parse_bib(bib).map_err(|e| error("references.bib", "bib", e))?;
        let keys = bibliography.keys().cloned().collect();
        let checked_review = |path: &str, state: &str, sources: &[String]| -> Result<()> {
            if state == "reviewed"
                && sources.iter().any(|id| {
                    bibliography
                        .get(id)
                        .is_some_and(|entry| entry["review"] == "abstract")
                })
            {
                return Err(error(
                    path,
                    "unreviewed_source",
                    "Reviewed content cannot rely on an abstract-only source.",
                ));
            }
            Ok(())
        };
        let langs = unique("languages", self.languages.iter().map(|l| l.id.as_str()))?;
        let scripts = unique("scripts", self.scripts.iter().map(|x| x.id.as_str()))?;
        let orth = unique(
            "orthographies",
            self.orthographies.iter().map(|x| x.id.as_str()),
        )?;
        let schemes = unique(
            "romanizations",
            self.romanizations.iter().map(|x| x.id.as_str()),
        )?;
        let traits = unique("traits", self.traits.iter().map(|x| x.id.as_str()))?;
        let families = unique("families", self.families.iter().map(|x| x.id.as_str()))?;
        let constructs = unique("constructs", self.constructs.iter().map(|x| x.id.as_str()))?;
        let nav = unique("navigation", self.navigation.iter().map(|x| x.id.as_str()))?;
        unique("topics", self.topics.iter().map(|x| x.id.as_str()))?;
        if langs.is_empty() || constructs.is_empty() || self.topics.is_empty() {
            return Err(error(
                "config",
                "empty",
                "Languages, constructs and topics cannot be empty.",
            ));
        }
        for s in &self.scripts {
            if !["ltr", "rtl"].contains(&s.direction.as_str())
                || !s.font_scale.is_finite()
                || !(0.5..=3.0).contains(&s.font_scale)
            {
                return Err(error(&s.id, "script", "Invalid direction or font scale."));
            }
        }
        for o in &self.orthographies {
            reference(&o.id, &o.script, &scripts)?;
            notes(&o.id, &o.guidance, &keys)?;
        }
        for f in &self.families {
            nonempty(&f.id, &[&f.label])?;
        }
        for s in &self.romanizations {
            checked_review(&s.id, &s.review, &s.sources)?;
            nonempty(&s.id, &[&s.label, &s.instructions])?;
            review(&s.id, &s.review)?;
            citations(&s.id, &s.sources, &keys)?;
            if s.examples.len() < 3 {
                return Err(error(
                    &s.id,
                    "examples",
                    "At least three examples required.",
                ));
            }
            for (a, b) in &s.examples {
                nonempty(&s.id, &[a, b])?;
            }
        }
        for t in &self.traits {
            scalars(&t.id, &t.scalars)?;
            for note in &t.guidance {
                checked_review(&t.id, &t.review, &note.sources)?;
            }
            review(&t.id, &t.review)?;
            notes(&t.id, &t.guidance, &keys)?;
            for dep in &t.requires {
                reference(&t.id, dep, &traits)?;
            }
        }
        acyclic(
            "traits",
            &self
                .traits
                .iter()
                .map(|t| (t.id.clone(), t.requires.clone()))
                .collect(),
        )?;
        notes("universal", &self.universal, &keys)?;
        for l in &self.languages {
            scalars(&l.id, &l.scalars)?;
            for note in &l.guidance {
                checked_review(&l.id, &l.review, &note.sources)?;
            }
            nonempty(&l.id, &[&l.name, &l.native_name])?;
            for (provider, tag) in &l.external_tags {
                nonempty(&l.id, &[provider, tag])?;
            }
            review(&l.id, &l.review)?;
            reference(&l.id, &l.script, &scripts)?;
            reference(&l.id, &l.orthography, &orth)?;
            reference(&l.id, &l.family, &families)?;
            if self
                .orthographies
                .iter()
                .find(|o| o.id == l.orthography)
                .expect("checked orthography")
                .script
                != l.script
            {
                return Err(error(
                    &l.id,
                    "script_mismatch",
                    "Orthography uses another script.",
                ));
            }
            if let Some(id) = &l.romanization {
                reference(&l.id, id, &schemes)?;
            }
            for id in &l.traits {
                reference(&l.id, id, &traits)?;
            }
            let varieties = unique(&l.id, l.varieties.iter().map(|v| v.id.as_str()))?;
            reference(&l.id, &l.default_variety, &varieties)?;
            for v in &l.varieties {
                scalars(&v.id, &v.scalars)?;
                nonempty(&v.id, &[&v.name, &v.description])?;
                review(&v.id, &v.review)?;
                if v.review == "reviewed" {
                    citations(&v.id, &v.sources, &keys)?;
                }
                checked_review(&v.id, &v.review, &v.sources)?;
                for source in &v.sources {
                    reference(&v.id, source, &keys)?;
                }
                let script = v.script.as_ref().unwrap_or(&l.script);
                let orthography = v.orthography.as_ref().unwrap_or(&l.orthography);
                reference(&v.id, script, &scripts)?;
                reference(&v.id, orthography, &orth)?;
                if self
                    .orthographies
                    .iter()
                    .find(|o| &o.id == orthography)
                    .unwrap()
                    .script
                    != *script
                {
                    return Err(error(
                        &v.id,
                        "script_mismatch",
                        "Variety orthography uses another script.",
                    ));
                }
                if v.romanization_disabled && v.romanization.is_some() {
                    return Err(error(
                        &v.id,
                        "romanization",
                        "Choose a romanization override or disable it, not both.",
                    ));
                }
                if let Some(scheme) = &v.romanization {
                    reference(&v.id, scheme, &schemes)?;
                }
                for (provider, tag) in &v.external_tags {
                    nonempty(&v.id, &[provider, tag])?;
                }
                for note in &v.guidance {
                    checked_review(&v.id, &v.review, &note.sources)?;
                }
                notes(&v.id, &v.guidance, &keys)?;
            }
            notes(&l.id, &l.guidance, &keys)?;
            let projected = self
                .language(&l.id)
                .map_err(|e| error(&l.id, "language", e))?;
            crate::partners::persona::validate_for_language(&l.starter_persona, &projected)
                .map_err(|e| error(&l.id, "starter_persona", e))?;
        }
        for c in &self.constructs {
            checked_review(&c.id, &c.review, &c.sources)?;
            nonempty(&c.id, &[&c.label, &c.criterion, &c.opportunity])?;
            review(&c.id, &c.review)?;
            citations(&c.id, &c.sources, &keys)?;
            if !BANDS.contains(&c.band.as_str())
                || ![
                    "function",
                    "form",
                    "interaction",
                    "pragmatics",
                    "support",
                    "fluency",
                ]
                .contains(&c.lens.as_str())
            {
                return Err(error(&c.id, "construct", "Unsupported band or lens."));
            }
            for dep in &c.requires {
                reference(&c.id, dep, &constructs)?;
            }
            for id in &c.traits {
                reference(&c.id, id, &traits)?;
            }
            if c.nav
                .keys()
                .any(|k| !["practical", "functional"].contains(&k.as_str()))
                || c.nav.len() != 2
            {
                return Err(error(
                    &c.id,
                    "navigation",
                    "Both practical and functional navigation are required.",
                ));
            }
            reference(&c.id, &c.nav["practical"], &nav)?;
            if ![
                "function",
                "form",
                "interaction",
                "pragmatics",
                "support",
                "fluency",
            ]
            .contains(&c.nav["functional"].as_str())
            {
                return Err(error(&c.id, "navigation", "Unknown functional navigation."));
            }
        }
        acyclic(
            "constructs",
            &self
                .constructs
                .iter()
                .map(|c| (c.id.clone(), c.requires.clone()))
                .collect(),
        )?;
        unique(
            "navigation codes",
            self.navigation.iter().map(|n| n.code.as_str()),
        )?;
        if self.navigation.iter().filter(|n| n.kind == "root").count() != 1 {
            return Err(error("navigation", "root", "Exactly one root is required."));
        }
        for c in &self.constructs {
            reference(&c.id, &c.id, &nav)?;
        }
        for n in &self.navigation {
            if n.kind == "root" {
                if n.parent.is_some() || n.code != "ROOT" {
                    return Err(error(&n.id, "root", "Root needs no parent and code ROOT."));
                }
            } else {
                let parent = n
                    .parent
                    .as_ref()
                    .and_then(|id| self.navigation.iter().find(|p| p.id == *id))
                    .ok_or_else(|| error(&n.id, "parent", "Non-root requires a parent."))?;
                if parent.kind != "root" && !n.code.starts_with(&format!("{}.", parent.code)) {
                    return Err(error(&n.id, "code", "Code must descend from parent code."));
                }
                if parent.kind == "root" && n.kind != "domain" {
                    return Err(error(
                        &n.id,
                        "parent",
                        "Only domains may be direct root children.",
                    ));
                }
            }
            if !["root", "domain", "skill"].contains(&n.kind.as_str()) {
                return Err(error(&n.id, "navigation", "Unknown node kind."));
            }
            if let Some(id) = &n.parent {
                reference(&n.id, id, &nav)?;
            }
            if n.kind == "skill" {
                reference(&n.id, &n.id, &constructs)?;
                if !n.label.is_empty() || !n.criterion.is_empty() || !n.description.is_empty() {
                    return Err(error(
                        &n.id,
                        "duplicate_content",
                        "Skill label, description and criterion belong only in construct definitions.",
                    ));
                }
            } else {
                nonempty(&n.id, &[&n.label])?;
            }
        }
        acyclic(
            "navigation",
            &self
                .navigation
                .iter()
                .map(|n| (n.id.clone(), n.parent.iter().cloned().collect()))
                .collect(),
        )?;
        let g = &self.game;
        let same = |values: &[String], required: &[&str]| {
            values.len() == required.len()
                && required.iter().all(|key| values.iter().any(|v| v == key))
        };
        let keys_match = |map: &std::collections::BTreeMap<String, f64>, keys: &[&str]| {
            map.len() == keys.len()
                && keys.iter().all(|key| {
                    map.get(*key)
                        .is_some_and(|v| v.is_finite() && *v > 0.0 && *v <= 10.0)
                })
        };
        if g.version != 1
            || !same(
                &g.rules,
                &["evidence_caused", "truthful", "never_punish_stopping"],
            )
            || !same(
                &g.never_from,
                &["time", "message_count", "login", "coach_output"],
            )
            || g.base.len() != 3
            || ["demonstrated", "partial", "repair"]
                .iter()
                .any(|k| g.base.get(*k).is_none_or(|v| *v == 0 || *v > 100))
            || !keys_match(
                &g.support,
                &[
                    "none",
                    "partner_clarify",
                    "hint",
                    "elicit",
                    "metalinguistic",
                    "suggestion",
                    "revision",
                    "explicit",
                ],
            )
            || !keys_match(
                &g.difficulty,
                &[
                    "absolute_zero",
                    "beginner",
                    "intermediate",
                    "advanced",
                    "fluent",
                ],
            )
            || !keys_match(&g.novelty, &["first_ever", "first_this_week", "routine"])
            || g.tiers.len() != 3
            || ["construct_discovered", "repair", "xp_tick"]
                .iter()
                .any(|k| g.tiers.get(*k).is_none_or(|v| *v > 3))
        {
            return Err(error(
                "shared/teaching-policy.yaml#game",
                "game",
                "Reward rules, evidence causes, tiers or numeric bounds are invalid.",
            ));
        }
        citations("shared/teaching-policy.yaml#game", &g.sources, &keys)?;
        let e = &self.estimator;
        let steps = [
            "none",
            "partner_clarify",
            "hint",
            "elicit",
            "metalinguistic",
            "suggestion",
            "revision",
            "explicit",
        ];
        if e.version != 1
            || !e.initial_rating.is_finite()
            || e.initial_rating.abs() > 10.0
            || !e.learning_rate.is_finite()
            || !(0.0..=1.0).contains(&e.learning_rate)
            || e.learning_rate == 0.0
            || ![
                e.min_half_life_days,
                e.initial_half_life_days,
                e.max_half_life_days,
                e.success_growth,
                e.failure_shrink,
                e.due_recall,
            ]
            .iter()
            .all(|x| x.is_finite())
            || e.min_half_life_days <= 0.0
            || e.initial_half_life_days < e.min_half_life_days
            || e.max_half_life_days < e.initial_half_life_days
            || e.max_half_life_days > 36500.0
            || e.success_growth < 1.0
            || e.success_growth > 10.0
            || e.failure_shrink <= 0.0
            || e.failure_shrink > 1.0
            || e.due_recall <= 0.0
            || e.due_recall >= 1.0
            || e.minimum_independent_observations == 0
            || e.support.len() != steps.len()
            || steps.iter().any(|key| {
                e.support
                    .get(*key)
                    .is_none_or(|v| !v.is_finite() || *v <= 0.0 || *v > 1.0)
            })
            || e.support.get("none") != Some(&1.0)
        {
            return Err(error(
                "shared/teaching-policy.yaml#estimator",
                "estimator",
                "Invalid estimator bounds or support weights.",
            ));
        }
        citations("shared/teaching-policy.yaml#estimator", &e.sources, &keys)?;
        let p = &self.feedback;
        let ladder = [
            "partner_clarify",
            "hint",
            "elicit",
            "metalinguistic",
            "explicit",
        ];
        if p.max_corrections_per_turn != 1
            || !["focus_and_meaning_blocking", "useful_language"].contains(&p.correct_only.as_str())
            || p.ladder != ladder.iter().map(|s| s.to_string()).collect::<Vec<_>>()
        {
            return Err(error(
                "shared/teaching-policy.yaml#feedback",
                "policy",
                "Unsupported correction policy or ladder.",
            ));
        }
        if p.never.iter().map(String::as_str).collect::<BTreeSet<_>>()
            != [
                "praise_the_person",
                "correct_in_partner_voice",
                "block_continuing",
            ]
            .into_iter()
            .collect()
        {
            return Err(error(
                "shared/teaching-policy.yaml#feedback",
                "policy",
                "All three learner-agency protections are required.",
            ));
        }
        if p.skip_sources
            .iter()
            .any(|s| !["developmental", "slip", "transfer", "unknown"].contains(&s.as_str()))
        {
            return Err(error(
                "shared/teaching-policy.yaml#feedback",
                "policy",
                "Unknown error source.",
            ));
        }
        if p.intensity
            .keys()
            .map(String::as_str)
            .collect::<BTreeSet<_>>()
            != ["light", "standard", "thorough"].into_iter().collect()
        {
            return Err(error(
                "shared/teaching-policy.yaml#feedback",
                "policy",
                "Expected light, standard and thorough intensities.",
            ));
        }
        for i in p.intensity.values() {
            if !["hint", "elicit", "metalinguistic", "explicit"].contains(&i.start_at.as_str())
                || !(1..=3).contains(&i.max_revisions)
            {
                return Err(error(
                    "shared/teaching-policy.yaml#feedback",
                    "policy",
                    "Unsupported starting move or revision limit.",
                ));
            }
        }
        citations("shared/teaching-policy.yaml#feedback", &p.sources, &keys)?;
        let prompt = &self.conversation_prompt;
        nonempty(
            "conversation prompt",
            &[
                &prompt.base,
                &prompt.coach_focus,
                &prompt.persona,
                &prompt.interaction,
                &prompt.examples_intro,
                &prompt.ceiling,
                &prompt.past,
                &prompt.future,
                &prompt.opening,
                &prompt.response,
                &prompt.subject,
            ],
        )?;
        if !prompt.opening_angles.is_empty() && prompt.opening_angles.len() < 4 {
            return Err(error(
                "conversation prompt",
                "opening_angles",
                "At least four opening situations required.",
            ));
        }
        for angle in &prompt.opening_angles {
            nonempty("conversation opening situations", &[angle])?;
        }
        for (variety, examples) in &prompt.examples {
            if !self
                .languages
                .iter()
                .any(|language| language.varieties.iter().any(|v| &v.id == variety))
            {
                return Err(error(
                    "conversation prompt",
                    "examples",
                    "Conversation examples must name a known target variety.",
                ));
            }
            nonempty("conversation prompt examples", &[examples])?;
        }
        if prompt.difficulty.len() != super::difficulty::LEVELS.len()
            || super::difficulty::LEVELS.iter().any(|level| {
                prompt
                    .difficulty
                    .get(super::difficulty::key(level))
                    .is_none_or(|s| s.trim().is_empty())
            })
        {
            return Err(error(
                "conversation prompt",
                "difficulty",
                "All five difficulty instructions are required.",
            ));
        }
        for topic in &self.topics {
            nonempty(&topic.id, &[&topic.subject])?;
            for locale in super::INTERFACE_LOCALES {
                if topic
                    .labels
                    .get(*locale)
                    .is_none_or(|label| label.trim().is_empty())
                {
                    return Err(error(
                        &topic.id,
                        "localization",
                        "Missing interface topic label.",
                    ));
                }
            }
        }
        Ok(())
    }
}
