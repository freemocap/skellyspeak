//! Browsing projection. Only main skills carry assessed experience.
use super::{Registry, Result};
use serde_json::{Value, json};
impl Registry {
    pub fn practice_catalog(&self, language: &str) -> Result<Value> {
        self.language_config(language)?;
        Ok(self.shared_practice_catalog())
    }
    pub fn shared_practice_catalog(&self) -> Value {
        let mut nodes = vec![
            json!({"id":"experience","parent":null,"label":"Experience","code":"ROOT","kind":"root","color":"#dae2df","description":"Recorded experience and effort.","criterion":"Correct skill use and qualifying revisions; not proficiency."}),
        ];
        let colors = ["#80c6a4", "#86b6d8", "#cda2dd", "#e5ba79"];
        for (index, skill) in self.skills.skills.iter().enumerate() {
            nodes.push(json!({"id":skill.id,"parent":"experience","label":skill.name,"code":format!("{:02}",index+1),"kind":"skill","color":colors[index % colors.len()],"description":skill.overview,"criterion":skill.boundary}));
        }
        json!(nodes)
    }
}
