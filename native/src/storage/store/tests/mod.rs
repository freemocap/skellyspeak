use super::*;

mod lifecycle;
mod preferences;
mod schema;
mod transactions;
mod workspace;

pub(super) fn command(store: &Store, action: Action) -> Command {
    Command {
        session_id: store.session_id.clone(),
        action_id: id(),
        action,
    }
}

pub(super) fn apply(store: &mut Store, action: Action) -> Receipt {
    store.execute(command(store, action)).unwrap()
}

pub(super) fn contact(store: &mut Store) -> Contact {
    apply(
        store,
        Action::CreateContact {
            language_id: "spanish".into(),
            details: crate::partners::persona::starter("spanish").unwrap(),
        },
    );
    store.snapshot().unwrap().contacts.last().unwrap().clone()
}

pub(super) fn conversation(store: &mut Store, contact: &Contact, title: &str) -> Conversation {
    let receipt = apply(
        store,
        Action::CreateConversation {
            contact_id: contact.id.clone(),
            title: title.into(),
        },
    );
    store
        .snapshot()
        .unwrap()
        .conversations
        .into_iter()
        .find(|c| c.id == receipt.entity_id)
        .unwrap()
}
