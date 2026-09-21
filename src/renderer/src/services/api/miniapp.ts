import { http } from '../http/httpClient'

export interface MiniAppServiceItem {
  id: string
  name: string
  iconPath: string
  introduction: string
  entryUrl: string
}

export interface MiniAppServiceCategory {
  typeName: string
  items: MiniAppServiceItem[]
}

function textValue(source: Record<string, unknown>, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return fallback
}

function itemFrom(source: Record<string, unknown>): MiniAppServiceItem {
  return {
    id: textValue(source, ['id', 'appId', 'serviceId', 'miniappId', 'miniProgramId', 'code']),
    name: textValue(source, ['name', 'title', 'appName', 'label']),
    iconPath: textValue(source, ['icon', 'iconUrl', 'logo', 'cover', 'avatar']),
    introduction: textValue(source, ['introduction', 'intro']),
    entryUrl: textValue(source, ['link', 'url', 'entryUrl', 'h5Url', 'webUrl', 'path', 'href'])
  }
}

function listValue(source: Record<string, unknown>): unknown[] {
  for (const key of ['items', 'services', 'children', 'list', 'apps']) {
    if (Array.isArray(source[key])) return source[key] as unknown[]
  }
  return []
}

function normalize(raw: unknown): MiniAppServiceCategory[] {
  let values: unknown = raw
  if (values && typeof values === 'object' && !Array.isArray(values)) {
    const source = values as Record<string, unknown>
    values = source.data ?? source.list ?? source.categories ?? source.items ?? []
  }
  if (!Array.isArray(values) || !values.length) return []
  const objects = values.filter(
    (value): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
  )
  if (!objects.length) return []
  const first = objects[0]
  const flat = !listValue(first).length && ['icon', 'iconUrl', 'logo'].some((key) => key in first)
  if (flat) return [{ typeName: '服务', items: objects.map(itemFrom) }]
  return objects.map((source) => ({
    typeName: textValue(
      source,
      ['typeName', 'type', 'category', 'categoryName', 'groupName', 'name'],
      '服务'
    ),
    items: listValue(source)
      .filter(
        (value): value is Record<string, unknown> =>
          !!value && typeof value === 'object' && !Array.isArray(value)
      )
      .map(itemFrom)
  }))
}

export async function getMiniAppServices(): Promise<MiniAppServiceCategory[]> {
  return normalize(await http.get<unknown>('/miniapp/services'))
}
