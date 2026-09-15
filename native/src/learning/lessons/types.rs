use super::*;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum LessonCategory {
    Practical,
    Grammar,
    AboutLanguage,
    Reading,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LessonQuizQuestion {
    pub question: String,
    pub options: Vec<String>,
    pub correct_option: u32,
    pub explanation: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct LessonQuizAnswer {
    pub question_index: u32,
    pub option_index: u32,
    pub correct: bool,
    pub xp: u32,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct LessonQuizCredit {
    pub lesson_id: String,
    pub conversation_id: String,
    pub question_index: u32,
    pub xp: u32,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum LessonControl {
    Open,
    Practice,
    End,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LessonExample {
    pub text: String,
    pub translation: String,
    pub romanization: Option<String>,
    pub pronunciation: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LessonPlan {
    pub quiz: Vec<LessonQuizQuestion>,
    pub title: String,
    pub objective: String,
    pub explanation: String,
    pub examples: Vec<LessonExample>,
    pub exercise: String,
    pub feedback_guidance: String,
    pub situation: String,
    pub completion_criteria: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LessonEvidence {
    pub message_id: String,
    pub quote: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LessonRecap {
    pub completed: bool,
    pub text: String,
    pub evidence: Vec<LessonEvidence>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct LessonView {
    pub category: LessonCategory,
    pub quiz_answers: Vec<LessonQuizAnswer>,
    pub coach_turn_ids: Vec<String>,
    pub id: String,
    pub topic: String,
    pub status: String,
    pub plan: Option<LessonPlan>,
    pub recap: Option<LessonRecap>,
    pub exposed: bool,
    pub handoff_turn_id: Option<String>,
    pub error: Option<String>,
    pub operation_id: Option<String>,
}
pub(crate) struct LessonRequest<'a> {
    pub topic: &'a str,
    pub choice_id: Option<&'a str>,
    pub category: LessonCategory,
    pub expected: i32,
}
