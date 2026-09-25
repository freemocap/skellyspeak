//! Browsing projection, not a prerequisite or scoring hierarchy.
use super::{Registry, Result};
use serde_json::{Value, json};

impl Registry {
    pub fn practice_catalog(&self, language: &str) -> Result<Value> {
        Ok(self.skill_navigation(self.skills_for_language(language)?))
    }
    pub fn shared_practice_catalog(&self) -> Value {
        self.skill_navigation(self.shared_skills().skills.iter().collect())
    }
    fn skill_navigation(&self, skills: Vec<&super::skills::Skill>) -> Value {
        let mut nodes = vec![
            json!({"id":"experience","parent":null,"label":"Experience","code":"ROOT","kind":"root","color":"#dae2df","description":"Recorded experience and effort.","criterion":"Presence and changed retries; not proficiency."}),
        ];
        let colors = ["#80c6a4", "#86b6d8", "#cda2dd", "#e5ba79"];
        for (index, category) in self.shared_skills().categories.iter().enumerate() {
            let code = format!("{:02}", index + 1);
            let color = colors[index % colors.len()];
            nodes.push(json!({"id":category.id,"parent":"experience","label":category.name,"code":code,"kind":"domain","color":color,"description":"Browsing category.","criterion":"Skills are assessed independently."}));
            for (position, skill) in skills
                .iter()
                .filter(|s| s.category == category.id)
                .enumerate()
            {
                nodes.push(json!({"id":skill.id,"parent":category.id,"label":skill.name,"code":format!("{code}.{}",position+1),"kind":"skill","color":color,"description":skill.overview,"criterion":skill.boundary}));
            }
        }
        json!(nodes)
    }
}
