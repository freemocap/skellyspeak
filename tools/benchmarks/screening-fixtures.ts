// Small authored inputs for screening-helper tests, not model-quality benchmarks.
// These deliberately exercise only the schema subset used by the helper.
export const reactionFixture = {
  task: 'reaction', expected: ['confused'],
  schema: {
    type: 'object', required: ['kind', 'interpretation', 'explanation'], additionalProperties: false,
    properties: {
      kind: { type: 'string', enum: ['happy', 'confused'] },
      interpretation: { type: 'string' }, explanation: { type: 'string' },
    },
  },
}

export const coachFixture = {
  id: 'coach-clear', task: 'coach', source: 'Me gusta leer.',
  schema: {
    type: 'object', required: ['meaning_recovered', 'items'], additionalProperties: false,
    properties: {
      meaning_recovered: { type: 'string', enum: ['full'] },
      items: { type: 'array', items: {
        type: 'object', required: ['construct', 'quote', 'outcome', 'error', 'rationale'], additionalProperties: false,
        properties: {
          construct: { type: 'string' }, quote: { type: 'string' }, outcome: { type: 'string' },
          error: { type: 'null' }, rationale: { type: 'string' },
        },
      } },
    },
  },
}
