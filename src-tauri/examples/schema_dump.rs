// Dump the inlined schema we actually send, for one type.
//   cargo run --example schema_dump -- observer
use skellyspeak_lib::ai::inline_defs;
use schemars::schema_for;

fn main() {
    let which = std::env::args().nth(1).unwrap_or_else(|| "tokens".into());
    let raw = match which.as_str() {
        "observer" => serde_json::to_value(schema_for!(skellyspeak_lib::observer::ObserverOutput)),
        "coach" => serde_json::to_value(schema_for!(skellyspeak_lib::commands::CoachFeedback)),
        _ => serde_json::to_value(schema_for!(skellyspeak_lib::commands::TokensOut)),
    }
    .unwrap();
    println!("{}", serde_json::to_string_pretty(&inline_defs(raw)).unwrap());
}
