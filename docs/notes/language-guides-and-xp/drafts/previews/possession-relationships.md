# Express possession and relationships

People and things

Express who something belongs to or how people and things are related.

**Boundary:** Possession, access, and association do not necessarily imply ownership.

## Meaning

` relationship(holder, related_entity, kind) `

Someone or something has a relationship to another person or thing.

- ` holder ` — Who or what the relationship is relative to.
- ` related_entity ` — The other person or thing.
- ` kind ` — The relationship, such as ownership, kinship, or use. It may be unclear.

## Examples

### 1. English

> Ana owns this book.

` relationship(Ana, book, ownership) `

### 2. English

> My sister.

` relationship(speaker, sister, kinship) `

Expresses a family relationship, not ownership.

### 3. English

> My seat.

` relationship(speaker, seat, unresolved) `

Context may establish assignment, use, ownership, or another association.

### 4. English

> This book does not belong to Ana.

` not(relationship(Ana, book, ownership)) `

Denies ownership rather than asserting it.

### 5. English

> A book.

Identifies a kind of thing but expresses no possession or relationship by itself.

## Authoring details

- **ID:** ` possession_relationships `
- **Applies to:** shared
- **Status:** draft · needs review
- **Authorship:** ai authored
