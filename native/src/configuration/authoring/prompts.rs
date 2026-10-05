//! Reproducible offline assessment assembly, with the exact source files retained.
use super::*;
use crate::configuration::{Result, error, fingerprint};
use serde_json::{Value, json};
use std::collections::BTreeSet;

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Criteria {
    pub schema_version: u32,
    pub revision: String,
    pub criteria: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct CreditPolicy {
    pub schema_version: u32,
    pub revision: String,
    pub policy_id: String,
    pub positive_categories: Vec<String>,
    pub minimum_positive_probability: f64,
    pub assessment_unit: String,
    pub subskill_credit: bool,
}

#[derive(Debug, Serialize)]
pub struct Source {
    pub path: String,
    pub fingerprint: String,
}

#[derive(Debug, Serialize)]
pub struct Specimen {
    pub sources: Vec<Source>,
    pub request: Value,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct State {
    current_learner_message: String,
    preceding_exchange: Vec<Message>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Message {
    role: Role,
    content: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Role {
    User,
    Assistant,
}

fn invalid(path: &str, message: &str) -> crate::configuration::ConfigLoadError {
    error(path, "assessment_content", message)
}

pub fn criteria(
    files: &BTreeMap<String, String>,
    kind: &str,
    expected: &[&str],
) -> Result<Criteria> {
    let path = format!("prompts/assessment/{kind}-criteria.yaml");
    let d: Criteria =
        serde_yaml_ng::from_str(source(files, &path)?).map_err(|e| error(&path, "yaml", e))?;
    let actual: BTreeSet<_> = d.criteria.keys().map(String::as_str).collect();
    if d.schema_version != 1
        || d.revision.trim().is_empty()
        || actual != expected.iter().copied().collect()
        || d.criteria
            .values()
            .any(|s| s.trim().is_empty() || s.len() > 4000)
    {
        return Err(invalid(
            &path,
            "Expected the complete named criteria, version and revision.",
        ));
    }
    Ok(d)
}

pub fn credit_policy(files: &BTreeMap<String, String>) -> Result<CreditPolicy> {
    let path = "policies/skill-credit.yaml";
    let p: CreditPolicy =
        serde_yaml_ng::from_str(source(files, path)?).map_err(|e| error(path, "yaml", e))?;
    if p.schema_version != 1
        || p.revision.trim().is_empty()
        || p.policy_id.trim().is_empty()
        || p.positive_categories != ["contextual", "direct"]
        || p.assessment_unit != "main_skill"
        || p.subskill_credit
        || !p.minimum_positive_probability.is_finite()
        || !(0.0..=1.0).contains(&p.minimum_positive_probability)
    {
        return Err(invalid(
            path,
            "Expected main-skill credit, contextual/direct positives and a finite probability threshold.",
        ));
    }
    Ok(p)
}

pub fn instructions(
    files: &BTreeMap<String, String>,
) -> Result<crate::learning::practice_assessment::Instructions> {
    let p = credit_policy(files)?;
    let c = criteria(
        files,
        "skill",
        &["absent", "contextual", "direct", "unclear"],
    )?;
    let markdown = source(files, "prompts/assessment/skill-assessment.md")?;
    let (instructions, question) = markdown.split_once("\n## Question\n").ok_or_else(|| {
        invalid(
            "prompts/assessment/skill-assessment.md",
            "A single Question section is required.",
        )
    })?;
    if question.contains("\n## Question\n") || question.trim().is_empty() {
        return Err(invalid(
            "prompts/assessment/skill-assessment.md",
            "Expected exactly one nonempty question.",
        ));
    }
    Ok(crate::learning::practice_assessment::Instructions {
        attribution: crate::learning::coaching::skill_attribution::Config {
            minimum_positive_probability: p.minimum_positive_probability,
            instructions: source(files, "prompts/assessment/evidence-attribution.md")?.to_owned(),
        },
        instructions: instructions.trim().into(),
        question: question.trim().into(),
        criteria: c.criteria,
    })
}

pub fn message_questions(
    files: &BTreeMap<String, String>,
) -> Result<crate::learning::turn_assessment::MessageQuestions> {
    use crate::learning::turn_assessment::{
        GRAMMAR_LABELS, MessageQuestions, Question, UNDERSTANDABILITY_LABELS,
    };
    let question = |kind: &str, labels: &[&str]| -> Result<Question> {
        let c = criteria(files, kind, labels)?;
        Ok(Question {
            instructions: source(files, &format!("prompts/assessment/{kind}.md"))?.to_owned(),
            criteria: c.criteria,
        })
    };
    Ok(MessageQuestions {
        grammar: question("grammar", &GRAMMAR_LABELS)?,
        understandability: question("understandability", &UNDERSTANDABILITY_LABELS)?,
    })
}

fn source<'a>(files: &'a BTreeMap<String, String>, path: &str) -> Result<&'a str> {
    let value = files
        .get(path)
        .ok_or_else(|| invalid(path, "Required file is missing."))?;
    if value.trim().is_empty() {
        return Err(invalid(path, "Source is empty."));
    }
    Ok(value)
}

impl Content {
    /// No learner explanation is read or sent to the assessor.
    pub fn assessment_specimen(
        &self,
        language: &str,
        variety: &str,
        mut state: Value,
    ) -> Result<Specimen> {
        let files = &self.files;
        let parsed: State = serde_json::from_value(state.clone())
            .map_err(|e| error("state", "assessment_state", e))?;
        if parsed.current_learner_message.trim().is_empty()
            || parsed.preceding_exchange.len() > 4
            || parsed
                .preceding_exchange
                .iter()
                .any(|m| m.content.trim().is_empty())
        {
            return Err(invalid(
                "state",
                "Expected a nonempty learner message and at most four nonempty preceding messages.",
            ));
        }
        let lang = self
            .languages
            .get(language)
            .ok_or_else(|| invalid(language, "Unknown target language."))?;
        let local = lang
            .varieties
            .iter()
            .find(|v| v.id == variety)
            .ok_or_else(|| invalid(variety, "Unknown target variety."))?;
        if !state.is_object()
            || !state["currentLearnerMessage"].is_string()
            || !state["precedingExchange"].is_array()
            || state.to_string().len() > 16000
        {
            return Err(invalid(
                "state",
                "Expected currentLearnerMessage text and precedingExchange array within 16000 bytes.",
            ));
        }
        state["language"] = json!(lang.identity.name);
        state["variety"] = json!(local.name);
        let mut paths: BTreeSet<String> = [
            "prompts/assessment/skill-assessment.md",
            "prompts/assessment/skill-criteria.yaml",
            "prompts/assessment/evidence-attribution.md",
            "policies/skill-credit.yaml",
        ]
        .into_iter()
        .map(String::from)
        .collect();
        paths.insert(format!("languages/{language}/{language}-language.yaml"));
        let mut skills = Vec::new();
        for d in self.definitions.values() {
            let stem = validation::slug(&d.id);
            let path =
                format!("languages/{language}/skills/{stem}/{language}-{stem}-assessment.yaml");
            let a = self
                .assessments
                .get(&path)
                .ok_or_else(|| invalid(&path, "Required assessment guidance is missing."))?;
            let supplement = match &a.varieties[variety] {
                Disposition::UseCore { .. } => "",
                Disposition::Supplement { text, .. } => text,
            };
            paths.insert(path);
            paths.insert(format!("skills/{stem}/{stem}-definition.yaml"));
            skills.push(crate::learning::practice_assessment::SkillPrompt {
                id: d.id.clone(),
                name: d.name.clone(),
                overview: d.purpose.clone(),
                boundary: d.boundary.clone(),
                language_guidance: format!("{}\n\n{}", a.guidance, supplement),
            });
        }
        let request = crate::learning::turn_assessment::request(
            state,
            &skills,
            &instructions(files)?,
            &message_questions(files)?,
        )
        .map_err(|e| invalid("assessment", &e.message))?;
        for kind in ["grammar", "understandability"] {
            paths.insert(format!("prompts/assessment/{kind}.md"));
            paths.insert(format!("prompts/assessment/{kind}-criteria.yaml"));
        }
        Ok(Specimen {
            request,
            sources: paths
                .into_iter()
                .map(|path| {
                    let hash = fingerprint(&files[&path]);
                    Source {
                        path,
                        fingerprint: hash,
                    }
                })
                .collect(),
        })
    }
}
