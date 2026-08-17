import { Faker, en } from '@faker-js/faker'

export type JsonSchema = Record<string, unknown>

export interface GeneratorOptions {
  seed?: number
}

export class SchemaGenerator {
  private readonly faker: Faker

  constructor(options: GeneratorOptions = {}) {
    this.faker = new Faker({ locale: [en] })
    this.faker.seed(options.seed ?? 1)
  }

  generate(schema: JsonSchema | undefined): unknown {
    return this.generateFromSchema(schema)
  }

  private generateFromSchema(schema: JsonSchema | undefined): unknown {
    if (schema === undefined) return undefined

    const enumValues = schema.enum as unknown[] | undefined
    if (Array.isArray(enumValues) && enumValues.length > 0) {
      return this.faker.helpers.arrayElement(enumValues)
    }

    const allOf = schema.allOf as JsonSchema[] | undefined
    if (Array.isArray(allOf)) {
      let merged: Record<string, unknown> = {}
      for (const sub of allOf) {
        const value = this.generateFromSchema(sub)
        if (typeof value === 'object' && value !== null) {
          merged = { ...merged, ...(value as Record<string, unknown>) }
        }
      }
      return merged
    }

    const oneOf = schema.oneOf as JsonSchema[] | undefined
    if (Array.isArray(oneOf) && oneOf.length > 0) {
      return this.generateFromSchema(oneOf[0])
    }

    const anyOf = schema.anyOf as JsonSchema[] | undefined
    if (Array.isArray(anyOf) && anyOf.length > 0) {
      return this.generateFromSchema(anyOf[0])
    }

    const type = schema.type as string | undefined

    if (type === 'object' || (type === undefined && schema.properties !== undefined)) {
      const properties = (schema.properties ?? {}) as Record<string, JsonSchema>
      const result: Record<string, unknown> = {}
      for (const [key, propSchema] of Object.entries(properties)) {
        result[key] = this.generateFromSchema(propSchema)
      }
      return result
    }

    if (type === 'array') {
      const itemSchema = schema.items as JsonSchema | undefined
      const count = this.faker.number.int({ min: 1, max: 3 })
      return Array.from({ length: count }, () => this.generateFromSchema(itemSchema))
    }

    return this.generatePrimitive(type, schema.format as string | undefined)
  }

  private generatePrimitive(type: string | undefined, format: string | undefined): unknown {
    switch (type) {
      case 'string':
        return this.generateString(format)
      case 'integer':
        return this.faker.number.int({ min: 0, max: 1000 })
      case 'number':
        return this.faker.number.float({ min: 0, max: 1000, fractionDigits: 2 })
      case 'boolean':
        return this.faker.datatype.boolean()
      case 'null':
        return null
      default:
        return this.faker.word.sample()
    }
  }

  private generateString(format: string | undefined): string {
    switch (format) {
      case 'uuid':
        return this.faker.string.uuid()
      case 'email':
        return this.faker.internet.email()
      case 'date':
        return this.faker.date.recent().toISOString().slice(0, 10)
      case 'date-time':
        return this.faker.date.recent().toISOString()
      case 'uri':
      case 'url':
        return this.faker.internet.url()
      default:
        return this.faker.word.words({ count: { min: 1, max: 3 } })
    }
  }
}
