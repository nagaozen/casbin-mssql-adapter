import test, { it } from 'node:test'
import assert from 'node:assert'
import { newEnforcer } from 'casbin'
import CasbinMssqlAdapter from './adapter.mjs'

const config = process.env.MSSQL_CONNECTION_STRING
const schema = 'dbo'
const table = 'policies'
const identifier = `[${schema}].[${table}]`

// Helper function to clear the table.
async function clearTable (adapter) {
  await adapter.db.request().query(`DELETE FROM ${identifier}`)
}

test('CasbinMssqlAdapter with RBAC-with-tenants model', async app => {
  app.context = {}

  app.before(async () => {
    app.context.adapter = await CasbinMssqlAdapter.newAdapter(config, { table, schema })
  })

  app.after(() => {
    app.context.adapter.dispose()
  })

  await it('should load a model correctly', async () => {
    const { adapter } = app.context
    await clearTable(adapter)
    const enforcer = await newEnforcer('model.conf', adapter)
    await enforcer.addPolicy('devsecops', 'evolved.com.br', 'resource', 'create')
    const policies = await enforcer.getPolicy()
    assert.deepStrictEqual(policies, [['devsecops', 'evolved.com.br', 'resource', 'create']])
  })

  await it('should add and remove policies correctly', async () => {
    const { adapter } = app.context
    await clearTable(adapter)
    const enforcer = await newEnforcer('model.conf', adapter)
    await enforcer.addPolicy('devsecops', 'evolved.com.br', 'resource', 'create')
    await enforcer.addPolicy('devsecops', 'evolved.com.br', 'resource', 'retrieve')
    await enforcer.addPolicy('devsecops', 'evolved.com.br', 'resource', 'update')
    await enforcer.addPolicy('devsecops', 'evolved.com.br', 'resource', 'delete')
    await enforcer.removePolicy('devsecops', 'evolved.com.br', 'resource', 'delete')
    const policies = await enforcer.getPolicy()
    assert.deepStrictEqual(policies, [
      ['devsecops', 'evolved.com.br', 'resource', 'create'],
      ['devsecops', 'evolved.com.br', 'resource', 'retrieve'],
      ['devsecops', 'evolved.com.br', 'resource', 'update']
    ])
  })

  await it('should update policies correctly', async () => {
    const { adapter } = app.context
    await clearTable(adapter)
    const enforcer = await newEnforcer('model.conf', adapter)
    await enforcer.addPolicy('devsecops', 'evolved.com.br', 'resource', 'create')
    await enforcer.addPolicy('devsecops', 'evolved.com.br', 'resource', 'retrieve')
    await enforcer.addPolicy('devsecops', 'evolved.com.br', 'resource', 'update')
    await enforcer.addPolicy('devsecops', 'evolved.com.br', 'resource', 'delete')
    await enforcer.removePolicy('devsecops', 'evolved.com.br', 'resource', 'delete')
    await enforcer.updatePolicy(
      ['devsecops', 'evolved.com.br', 'resource', 'update'],
      ['devsecops', 'evolved.com.br', 'resource', 'delete']
    )
    const policies = await enforcer.getPolicy()
    assert.deepStrictEqual(policies, [
      ['devsecops', 'evolved.com.br', 'resource', 'create'],
      ['devsecops', 'evolved.com.br', 'resource', 'retrieve'],
      ['devsecops', 'evolved.com.br', 'resource', 'delete']
    ])
  })

  await it('should load policies correctly', async () => {
    const { adapter } = app.context
    const enforcer = await newEnforcer('model.conf', adapter)
    const policies = await enforcer.getPolicy()
    assert.deepStrictEqual(policies, [
      ['devsecops', 'evolved.com.br', 'resource', 'create'],
      ['devsecops', 'evolved.com.br', 'resource', 'delete'],
      ['devsecops', 'evolved.com.br', 'resource', 'retrieve']
    ])
  })

  await it('should remove filtered policies correctly', async () => {
    const { adapter } = app.context
    const enforcer = await newEnforcer('model.conf', adapter)
    // model.conf defines `p = sub, dom, obj, act`
    await enforcer.removeFilteredPolicy(1, 'evolved.com.br', 'resource')
    const policies = await enforcer.getPolicy()
    assert.deepStrictEqual(policies, [])
  })

  await it('should add a batch of policies correctly', async () => {
    const { adapter } = app.context
    const rules = [
      ['devsecops', 'evolved.com.br', 'resource', 'create'],
      ['devsecops', 'evolved.com.br', 'resource', 'retrieve'],
      ['devsecops', 'evolved.com.br', 'resource', 'update'],
      ['devsecops', 'evolved.com.br', 'resource', 'delete']
    ]
    const enforcer = await newEnforcer('model.conf', adapter)
    await enforcer.addPolicies(rules)
    const policies = await enforcer.getPolicy()
    assert.deepStrictEqual(policies, [
      ['devsecops', 'evolved.com.br', 'resource', 'create'],
      ['devsecops', 'evolved.com.br', 'resource', 'retrieve'],
      ['devsecops', 'evolved.com.br', 'resource', 'update'],
      ['devsecops', 'evolved.com.br', 'resource', 'delete']
    ])
  })

  await it('should load filtered policies correctly', async () => {
    const { adapter } = app.context
    const enforcer = await newEnforcer('model.conf', adapter)
    const filter = {
      p: [['devsecops']],
      g: [['', 'devsecops']]
    }
    await enforcer.loadFilteredPolicy(filter)
    const policies = await enforcer.getPolicy()
    assert.deepStrictEqual(policies, [
      ['devsecops', 'evolved.com.br', 'resource', 'create'],
      ['devsecops', 'evolved.com.br', 'resource', 'delete'],
      ['devsecops', 'evolved.com.br', 'resource', 'retrieve'],
      ['devsecops', 'evolved.com.br', 'resource', 'update']
    ])
  })

  await it('should remove a batch of policies correctly', async () => {
    const { adapter } = app.context
    const rules = [
      ['devsecops', 'evolved.com.br', 'resource', 'create'],
      ['devsecops', 'evolved.com.br', 'resource', 'retrieve'],
      ['devsecops', 'evolved.com.br', 'resource', 'update'],
      ['devsecops', 'evolved.com.br', 'resource', 'delete']
    ]
    const enforcer = await newEnforcer('model.conf', adapter)
    await enforcer.removePolicies(rules)
    const policies = await enforcer.getPolicy()
    assert.deepStrictEqual(policies, [])
  })
})
