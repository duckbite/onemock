import { describe, expect, it } from 'vitest'
import { StateStore } from './state-store'

describe('StateStore', () => {
  it('creates a resource with an auto-generated id and can fetch it back', () => {
    const store = new StateStore()
    const created = store.create('pets', { name: 'Rex' })

    expect(created.id).toBe('1')
    expect(store.get('pets', '1')).toEqual({ name: 'Rex', id: '1' })
  })

  it('lists all resources in a collection', () => {
    const store = new StateStore()
    store.create('pets', { name: 'Rex' })
    store.create('pets', { name: 'Fido' })

    expect(store.list('pets')).toHaveLength(2)
  })

  it('updates an existing resource by merging fields', () => {
    const store = new StateStore()
    store.create('pets', { name: 'Rex' }, '1')

    const updated = store.update('pets', '1', { name: 'Rex Updated' })

    expect(updated).toEqual({ name: 'Rex Updated', id: '1' })
  })

  it('returns undefined when updating a resource that does not exist', () => {
    const store = new StateStore()

    expect(store.update('pets', 'missing', { name: 'x' })).toBeUndefined()
  })

  it('deletes a resource and reports whether it existed', () => {
    const store = new StateStore()
    store.create('pets', { name: 'Rex' }, '1')

    expect(store.delete('pets', '1')).toBe(true)
    expect(store.delete('pets', '1')).toBe(false)
    expect(store.get('pets', '1')).toBeUndefined()
  })

  it('keeps separate collections independent', () => {
    const store = new StateStore()
    store.create('pets', { name: 'Rex' }, '1')
    store.create('owners', { name: 'Alice' }, '1')

    expect(store.get('pets', '1')).toEqual({ name: 'Rex', id: '1' })
    expect(store.get('owners', '1')).toEqual({ name: 'Alice', id: '1' })
  })

  it('reset clears all collections and the id counter', () => {
    const store = new StateStore()
    store.create('pets', { name: 'Rex' })
    store.reset()

    expect(store.list('pets')).toEqual([])
    expect(store.create('pets', { name: 'Fido' }).id).toBe('1')
  })
})
