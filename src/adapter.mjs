import mssql from 'mssql'
import { Helper } from 'casbin'

// IMPORTANT: This adapter only supports Auto-Save mode
// Disabling Auto-Save via EnableAutoSave is not supported because
// it will result in catastrophic failures under heavy workloads.
class CasbinMssqlAdapter {
  // region Async Constructor
  static #isInternalConstructing = false

  static async newAdapter (config, options = { table: 'casbin_rule' }) {
    CasbinMssqlAdapter.#isInternalConstructing = true
    const adapter = new CasbinMssqlAdapter(config, options)
    adapter.db = await adapter.pool.connect()
    await adapter._createTableIfNotExists()
    return adapter
  }

  // IMPORTANT: constructors MUST be public and sync
  constructor (config, options) {
    if (!CasbinMssqlAdapter.#isInternalConstructing) { throw new SyntaxError('NOT_CONSTRUCTABLE') }

    this.pool = options.pool ?? new mssql.ConnectionPool(config)
    this.table = options.table ?? 'casbin_rule'
    this.schema = options.schema
    this.identifier = this.schema
      ? `[${this.schema}].[${this.table}]`
      : `[${this.table}]`
  }

  async dispose () {
    await this.pool.close()
  }

  async _createTableIfNotExists () {
    const query = `
IF OBJECT_ID('${this.identifier}', 'U') IS NULL
BEGIN
  CREATE TABLE ${this.identifier} (
    id int IDENTITY(1, 1) NOT NULL CONSTRAINT PK_${this.table}_key PRIMARY KEY CLUSTERED,
    ptype nvarchar(255),
    v0 varchar(255),
    v1 varchar(255),
    v2 varchar(255),
    v3 varchar(255),
    v4 varchar(255),
    v5 varchar(255)
  ) ON [PRIMARY]
  CREATE UNIQUE NONCLUSTERED INDEX IN_${this.table}_compositeKey ON ${this.identifier}(ptype, v0, v1, v2, v3, v4, v5) ON [PRIMARY]
END
`
    await this.db.request()
      .query(query)
  }
  // endregion

  // region IAdapter
  async loadPolicy (model) {
    const query = `
SELECT ptype, v0, v1, v2, v3, v4, v5
FROM ${this.identifier}
`
    const { recordset } = await this.db.request()
      .query(query)
    recordset.forEach(record => {
      const line = this.#lineFromRecord(record)
      Helper.loadPolicyLine(line, model)
    })
  }

  async savePolicy (model) {
    // "Shi" (死) is the Japanese kanji for death, "Ganbo" (願望) means wish, "Omoi" (思い) means have, and "Desu ka" (ですか) is a question particle.
    throw new SyntaxError('死の願望をおもちですか')
  }

  async addPolicy (sec, ptype, rule) {
    const d = this.#dataFromPolicyRule(ptype, rule)
    const query = `
INSERT INTO ${this.identifier} (ptype, v0, v1, v2, v3, v4, v5)
VALUES (@ptype, @v0, @v1, @v2, @v3, @v4, @v5)
`
    await this.db.request()
      .input('ptype', mssql.VarChar(255), d.ptype)
      .input('v0', mssql.VarChar(255), d.v0)
      .input('v1', mssql.VarChar(255), d.v1)
      .input('v2', mssql.VarChar(255), d.v2)
      .input('v3', mssql.VarChar(255), d.v3)
      .input('v4', mssql.VarChar(255), d.v4)
      .input('v5', mssql.VarChar(255), d.v5)
      .query(query)
  }

  async removePolicy (sec, ptype, rule) {
    const d = this.#dataFromPolicyRule(ptype, rule)
    const query = `
DELETE FROM ${this.identifier}
WHERE ptype = @ptype
  AND (@v0 IS NULL OR v0 = @v0)
  AND (@v1 IS NULL OR v1 = @v1)
  AND (@v2 IS NULL OR v2 = @v2)
  AND (@v3 IS NULL OR v3 = @v3)
  AND (@v4 IS NULL OR v4 = @v4)
  AND (@v5 IS NULL OR v5 = @v5)
`
    await this.db.request()
      .input('ptype', mssql.VarChar(255), d.ptype)
      .input('v0', mssql.VarChar(255), d.v0)
      .input('v1', mssql.VarChar(255), d.v1)
      .input('v2', mssql.VarChar(255), d.v2)
      .input('v3', mssql.VarChar(255), d.v3)
      .input('v4', mssql.VarChar(255), d.v4)
      .input('v5', mssql.VarChar(255), d.v5)
      .query(query)
  }

  async removeFilteredPolicy (sec, ptype, fieldIndex, ...fieldValues) {
    const request = this.db.request().input('ptype', mssql.VarChar(255), ptype)
    const filters = fieldValues.map((v, i) => {
      request.input(`v${fieldIndex + i}`, mssql.VarChar(255), v)
      return ` AND v${fieldIndex + i} = @v${fieldIndex + i}`
    })
    const predicate = `ptype = @ptype${filters.join('')}`
    const query = `DELETE FROM ${this.identifier} WHERE ${predicate}`
    await request.query(query)
  }
  // endregion

  // region IUpdatable
  async updatePolicy (sec, ptype, oldRule, newRule) {
    const prev = this.#dataFromPolicyRule(ptype, oldRule)
    const next = this.#dataFromPolicyRule(ptype, newRule)
    const query = `
;WITH cte AS (
  SELECT id
  FROM ${this.identifier}
  WHERE ptype = @prev_ptype
    AND (@prev_v0 IS NULL OR v0 = @prev_v0)
    AND (@prev_v1 IS NULL OR v1 = @prev_v1)
    AND (@prev_v2 IS NULL OR v2 = @prev_v2)
    AND (@prev_v3 IS NULL OR v3 = @prev_v3)
    AND (@prev_v4 IS NULL OR v4 = @prev_v4)
    AND (@prev_v5 IS NULL OR v5 = @prev_v5)
)
UPDATE t SET
  t.ptype = COALESCE(@next_ptype, t.ptype),
  t.v0 = COALESCE(@next_v0, t.v0),
  t.v1 = COALESCE(@next_v1, t.v1),
  t.v2 = COALESCE(@next_v2, t.v2),
  t.v3 = COALESCE(@next_v3, t.v3),
  t.v4 = COALESCE(@next_v4, t.v4),
  t.v5 = COALESCE(@next_v5, t.v5)
FROM ${this.identifier} t
  INNER JOIN cte ON t.id = cte.id
`
    await this.db.request()
      .input('prev_ptype', mssql.VarChar(255), prev.ptype)
      .input('prev_v0', mssql.VarChar(255), prev.v0)
      .input('prev_v1', mssql.VarChar(255), prev.v1)
      .input('prev_v2', mssql.VarChar(255), prev.v2)
      .input('prev_v3', mssql.VarChar(255), prev.v3)
      .input('prev_v4', mssql.VarChar(255), prev.v4)
      .input('prev_v5', mssql.VarChar(255), prev.v5)
      .input('next_ptype', mssql.VarChar(255), next.ptype)
      .input('next_v0', mssql.VarChar(255), next.v0)
      .input('next_v1', mssql.VarChar(255), next.v1)
      .input('next_v2', mssql.VarChar(255), next.v2)
      .input('next_v3', mssql.VarChar(255), next.v3)
      .input('next_v4', mssql.VarChar(255), next.v4)
      .input('next_v5', mssql.VarChar(255), next.v5)
      .query(query)
  }
  // endregion

  // region IBatchAdapter
  async addPolicies (sec, ptype, rules) {
    const table = new mssql.Table(this.identifier)
    table.create = false// table already exists
    table.columns.add('ptype', mssql.VarChar(255), { nullable: true })
    table.columns.add('v0', mssql.VarChar(255), { nullable: true })
    table.columns.add('v1', mssql.VarChar(255), { nullable: true })
    table.columns.add('v2', mssql.VarChar(255), { nullable: true })
    table.columns.add('v3', mssql.VarChar(255), { nullable: true })
    table.columns.add('v4', mssql.VarChar(255), { nullable: true })
    table.columns.add('v5', mssql.VarChar(255), { nullable: true })

    for (const rule of rules) {
      const data = this.#dataFromPolicyRule(ptype, rule)
      table.rows.add(data.ptype, data.v0, data.v1, data.v2, data.v3, data.v4, data.v5)
    }

    await this.db.request()
      .bulk(table)
  }

  async removePolicies (sec, ptype, rules) {
    for (const rule of rules) {
      await this.removePolicy(sec, ptype, rule)
    }
  }
  // endregion

  // region IFilteredAdapter
  #filtered = false

  async loadFilteredPolicy (model, filter) {
    for (const ptype in filter) {
      const constraints = filter[ptype]
      for (const values of constraints) {
        const request = this.db.request()
        let predicate = 'ptype = @ptype'
        request.input('ptype', mssql.VarChar(255), ptype)
        values.forEach((v, i) => {
          predicate += ` AND v${i} = @v${i}`
          request.input(`v${i}`, mssql.VarChar(255), v)
        })
        const query = `
        SELECT ptype, v0, v1, v2, v3, v4, v5
        FROM ${this.identifier}
        WHERE ${predicate}
        `
        const { recordset } = await request.query(query)
        recordset.forEach(record => {
          const line = this.#lineFromRecord(record)
          Helper.loadPolicyLine(line, model)
        })
      }
    }
    this.#filtered = true
  }

  async isFiltered () {
    return this.#filtered
  }
  // endregion

  // region helpers
  #dataFromPolicyRule (ptype, rule) {
    return {
      ptype,
      v0: rule[0] ?? null,
      v1: rule[1] ?? null,
      v2: rule[2] ?? null,
      v3: rule[3] ?? null,
      v4: rule[4] ?? null,
      v5: rule[5] ?? null
    }
  }

  #lineFromRecord (record) {
    const rule = Object.values(record).filter(v => v !== null && v !== undefined && v !== '')
    return rule.join(', ')
  }
  // endregion
}

export default CasbinMssqlAdapter
