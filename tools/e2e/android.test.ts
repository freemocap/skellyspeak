import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deviceFromList } from './android.ts'
test('selects only authorized devices, never treats an absent device as a passed run',()=>{
  assert.equal(deviceFromList('List of devices attached\npixel\tdevice\n'), 'pixel')
  assert.throws(()=>deviceFromList('List of devices attached\npixel\tunauthorized\n'),/found 0/)
  assert.throws(()=>deviceFromList('a\tdevice\nb\tdevice\n'),/found 2/)
  assert.equal(deviceFromList('a\tdevice\nb\tdevice\n','b'),'b')
  assert.throws(()=>deviceFromList('a\tdevice\n','b'),/not connected/)
})
