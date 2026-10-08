//! Import authored dictionary data once at startup, then use indexed saved reading.
use super::{ReadingScope, saved::*};
use crate::{configuration::Registry, model::*, storage::store::Store};
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

const BUNDLED: &[(&str, &str)] = &[
    (
        "reading/preload-pilot.json",
        include_str!("../../../../content/reading/preload-pilot.json"),
    ),
    (
        "reading/english.json",
        include_str!("../../../../content/reading/english.json"),
    ),
    (
        "reading/spanish.json",
        include_str!("../../../../content/reading/spanish.json"),
    ),
    (
        "reading/french.json",
        include_str!("../../../../content/reading/french.json"),
    ),
    (
        "reading/arabic.json",
        include_str!("../../../../content/reading/arabic.json"),
    ),
];

pub(crate) fn registered(path: &str) -> bool {
    BUNDLED.iter().any(|(name, _)| *name == path)
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Package {
    schema_version: u32,
    id: String,
    version: String,
    license: String,
    review: String,
    sources: Vec<String>,
    entries: Vec<Entry>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Entry {
    id: String,
    scope: ReadingScope,
    text: String,
    gloss: String,
    romanization: Option<String>,
    pronunciation: Option<String>,
    sense: String,
    sources: Vec<String>,
}

fn invalid(message: &str) -> AppError {
    AppError::new(ErrorCode::ConfigLoad, format!("Reading preload: {message}"))
}

fn bounded(value: &str, limit: usize) -> bool {
    !value.trim().is_empty() && !value.contains('\0') && value.encode_utf16().count() <= limit
}

fn validate(package: &Package, config: Option<&Registry>) -> Result<()> {
    if package.schema_version != 1
        || !bounded(&package.id, 128)
        || !bounded(&package.version, 128)
        || !bounded(&package.license, 2048)
        || !matches!(
            package.review.as_str(),
            "source_checked" | "editorially_reviewed"
        )
        || package.sources.is_empty()
        || package.sources.len() > 256
        || package.sources.iter().any(|s| !bounded(s, 2048))
        || package.entries.is_empty()
        || package.entries.len() > 500_000
    {
        return Err(invalid("unsupported or incomplete package metadata."));
    }
    let mut ids = HashSet::new();
    let mut scopes = HashSet::new();
    for entry in &package.entries {
        if !ids.insert(&entry.id)
            || !bounded(&entry.id, 256)
            || !bounded(&entry.text, 2048)
            || !bounded(&entry.gloss, 2048)
            || !bounded(&entry.sense, 2048)
            || entry.sources.is_empty()
            || entry.sources.iter().any(|s| !package.sources.contains(s))
            || entry
                .romanization
                .as_ref()
                .is_some_and(|s| !bounded(s, 2048))
            || entry
                .pronunciation
                .as_ref()
                .is_some_and(|s| !bounded(s, 2048))
        {
            return Err(invalid("invalid, duplicate or unsourced dictionary entry."));
        }
        let Some(config) = config else { continue };
        // Thousands of entries share a handful of exact scopes. Resolve each
        // once; constructing full language guidance per word delays startup.
        if !scopes.insert((
            &entry.scope.language,
            &entry.scope.variety,
            &entry.scope.explanation,
            &entry.scope.explanation_variety,
        )) {
            continue;
        }
        let context = config.resolve_pair(
            &entry.scope.language,
            entry.scope.variety.as_deref(),
            &entry.scope.explanation,
            entry.scope.explanation_variety.as_deref(),
        )?;
        if entry.scope.variety.as_deref() != Some(context.variety_id.as_str())
            || entry.scope.explanation_variety.as_deref()
                != Some(context.explanation_variety_id.as_str())
        {
            return Err(invalid(
                "entries require explicit canonical variety identities.",
            ));
        }
    }
    Ok(())
}

pub(crate) fn validate_document_shape(json: &str) -> Result<()> {
    validate(&decode(json)?, None)
}

fn decode(json: &str) -> Result<Package> {
    let package: Package = serde_json::from_str(json)
        .map_err(|error| invalid("package does not match its declared schema.").with_diagnostics(serde_json::json!({
            "stage":"preload_decode", "category":format!("{:?}",error.classify()), "line":error.line(), "column":error.column()
        })))?;
    Ok(package)
}

pub(crate) fn install_bundled(db: &mut Connection, config: &Registry) -> Result<()> {
    let mut ids = HashSet::new();
    // Validate the complete catalog before replacing any installed package.
    for (_, json) in BUNDLED {
        let package = decode(json)?;
        validate(&package, Some(config))?;
        if !ids.insert(package.id) {
            return Err(invalid("duplicate bundled package identity."));
        }
    }
    for (_, json) in BUNDLED {
        install(db, config, json)?;
    }
    Ok(())
}

fn install(db: &mut Connection, config: &Registry, json: &str) -> Result<()> {
    let package = decode(json)?;
    validate(&package, Some(config))?;
    let digest = crate::ai::results::digest(&serde_json::to_vec(&package)?);
    let installed: Option<(String, String)> = db
        .query_row(
            "SELECT version,digest FROM reading_packages WHERE id=?1",
            [&package.id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    if let Some((version, previous_digest)) = installed
        && version == package.version
    {
        return if previous_digest == digest {
            Ok(())
        } else {
            Err(invalid("package changed without a version change."))
        };
    }
    let tx = db.transaction()?;
    tx.execute(
        "DELETE FROM reading_dictionary WHERE package_id=?1",
        [&package.id],
    )?;
    tx.execute("INSERT INTO reading_packages(id,version,digest,license,review) VALUES(?1,?2,?3,?4,?5) ON CONFLICT(id) DO UPDATE SET version=excluded.version,digest=excluded.digest,license=excluded.license,review=excluded.review",
        params![package.id,package.version,digest,package.license,package.review])?;
    {
        let mut insert = tx.prepare("INSERT INTO reading_dictionary(package_id,id,language,variety,explanation,explanation_variety,surface,payload) VALUES(?1,?2,?3,?4,?5,?6,?7,?8)")?;
        for entry in &package.entries {
            insert.execute(params![
                package.id,
                entry.id,
                entry.scope.language,
                entry.scope.variety,
                entry.scope.explanation,
                entry.scope.explanation_variety,
                entry.text,
                serde_json::to_string(entry)?
            ])?;
        }
    }
    tx.commit()?;
    Ok(())
}

pub(crate) fn sources(store: &Store, query: &SavedGlossQuery) -> Result<Vec<SavedGlossSource>> {
    query.validate()?;
    let context = store.config.resolve_pair(
        &query.scope.language,
        query.scope.variety.as_deref(),
        &query.scope.explanation,
        query.scope.explanation_variety.as_deref(),
    )?;
    let mut statement = store.connection.prepare(
        "SELECT d.package_id,p.version,p.review,d.payload FROM reading_dictionary d JOIN reading_packages p ON p.id=d.package_id
         WHERE d.language=?1 AND d.variety=?2 AND d.explanation=?3 AND d.explanation_variety=?4
         AND d.surface IN (SELECT value FROM json_each(?5)) ORDER BY d.package_id,d.id")?;
    let rows = statement.query_map(
        params![
            context.language_id,
            context.variety_id,
            context.explanation_language_id,
            context.explanation_variety_id,
            serde_json::to_string(&query.surfaces)?
        ],
        |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
            ))
        },
    )?;
    let mut output = Vec::new();
    let mut bytes = 0;
    for row in rows {
        let (package_id, version, review, payload) = row?;
        bytes += payload.len();
        if bytes > 8 * 1024 * 1024 {
            return Err(AppError::new(
                ErrorCode::Validation,
                "Saved dictionary lookup exceeds its response limit. Select a shorter passage.",
            ));
        }
        let entry: Entry = serde_json::from_str(&payload)?;
        output.push(SavedGlossSource {
            source_id: format!("dictionary/{package_id}/{version}/{}", entry.id),
            dictionary: Some(true),
            provenance: Some(SavedGlossProvenance {
                package_id,
                version,
                sense: entry.sense,
                sources: entry.sources,
                review,
            }),
            operation_id: None,
            attempt_id: None,
            scope: entry.scope,
            segments: vec![GlossSegment {
                start: 0,
                end: entry.text.encode_utf16().count() as u32,
                kind: GlossSegmentKind::Gloss,
                gloss: Some(entry.gloss),
                romanization: entry.romanization,
                pronunciation: entry.pronunciation,
            }],
            text: entry.text,
        });
    }
    Ok(output)
}

#[cfg(test)]
mod tests;
