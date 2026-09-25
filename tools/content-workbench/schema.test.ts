import {parse} from 'yaml'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {schemaPreview} from './schema.ts'
import {readFileSync, readdirSync} from 'node:fs'
test('schema shapes expand local references and mark optional keys, maps and alternatives honestly', () => {
  const p = schemaPreview({type:'object', required:['name'], properties:{name:{type:'string'}, children:{type:'array',items:{$ref:'#/definitions/item'}}, mode:{enum:['a','b']}, maybe:{anyOf:[{type:'null'},{type:'integer'}]}}, definitions:{item:{type:'object',properties:{next:{$ref:'#/definitions/item'}}}}})
  assert.deepEqual(p.fields.find(f=>f.path==='$.name'), {path:'$.name',presence:'required',type:'string'})
  assert.equal(p.fields.find(f=>f.path==='$.children')?.presence, 'optional')
  assert(p.notes.some(n=>n.includes('Recursive')))
  assert(p.notes.some(n=>n.includes('alternatives')))
  assert.equal((p.sample as any).mode, 'a')
})
test('all current generated schemas produce bounded illustrative shapes', () => {
  for (const name of readdirSync('content/schemas').filter(n=>n.endsWith('.yaml'))) {
    const p = schemaPreview(parse(readFileSync(`content/schemas/${name}`,'utf8')))
    assert(p.fields.length > 0, name)
    assert(JSON.stringify(p).length < 500000, name)
  }
})
