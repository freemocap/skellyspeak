//! Durable practice destination, independent of webview storage and open dialogs.
use crate::{model::*, storage::store::Store};

impl Store {
    pub fn practice_view(&self) -> Result<PracticeView> {
        let raw: String = self.connection.query_row(
            "SELECT preferences FROM learner WHERE singleton=1",
            [],
            |r| r.get(0),
        )?;
        let preferences: Preferences = serde_json::from_str(&raw)?;
        Ok(preferences.practice_view.unwrap_or_default())
    }
    pub fn set_practice_view(&mut self, view: PracticeView) -> Result<()> {
        let value = serde_json::to_value(view)?.as_str().unwrap().to_owned();
        let tx = self.connection.transaction()?;
        tx.execute("UPDATE learner SET preferences=json_set(preferences,'$.practiceView',?1), revision=revision+1 WHERE singleton=1", [&value])?;
        tx.execute("UPDATE metadata SET revision=revision+1", [])?;
        tx.commit()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn practice_destination_survives_workspace_reopen_in_both_directions() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("navigation.sqlite3");
        let mut store = Store::open(&path).unwrap();
        assert_eq!(store.practice_view().unwrap(), PracticeView::Chat);
        store.set_practice_view(PracticeView::Drill).unwrap();
        drop(store);
        let mut store = Store::open(&path).unwrap();
        assert_eq!(store.practice_view().unwrap(), PracticeView::Drill);
        assert_eq!(
            store.snapshot().unwrap().learner.preferences.practice_view,
            Some(PracticeView::Drill)
        );
        store.set_practice_view(PracticeView::Chat).unwrap();
        drop(store);
        assert_eq!(
            Store::open(&path).unwrap().practice_view().unwrap(),
            PracticeView::Chat
        );
    }
}
