import { expect, it } from 'vitest'
import { sourceToken } from './source-token'
it('does not reuse punctuation from a later sentence for a duplicate annotation', () => {
 expect(sourceToken('Hola! Otra!', '!', 5)).toBeNull()
 expect(sourceToken('¡Hola! ¡Hola!', '¡Hola!', 1)).toEqual({start:1,end:6,text:'Hola!'})
})
it('preserves Arabic and Chinese punctuation without inventing spaces', () => {
 expect(sourceToken('مرحبا؟', 'مرحبا؟', 0)?.text).toBe('مرحبا؟')
 expect(sourceToken('你好。', '你好。', 0)?.text).toBe('你好。')
 expect(sourceToken('你好。', '。', 3)).toBeNull()
})
