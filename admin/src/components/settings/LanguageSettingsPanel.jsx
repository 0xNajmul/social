import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Languages, Plus, RefreshCw, Save, Search, Trash2, Upload } from 'lucide-react'
import api from '../../lib/api'
import { Button, Input, PageLoader } from '../ui'

const EMPTY_LANGUAGE = {
  code: '',
  name: '',
  native_name: '',
  is_active: true,
  is_default: false,
  is_rtl: false,
  sort_order: 0,
}

export default function LanguageSettingsPanel({ setMessage }) {
  const fileInputRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [languages, setLanguages] = useState([])
  const [translations, setTranslations] = useState([])
  const [autoDetect, setAutoDetect] = useState(true)
  const [search, setSearch] = useState('')
  const [localMessage, setLocalMessage] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/languages')
      hydrate(data.data)
    } catch (error) {
      setLocalMessage({ type: 'error', text: error.response?.data?.message || 'Could not load language settings.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const activeLanguages = useMemo(() => languages.filter((language) => language.is_active), [languages])
  const defaultLanguage = languages.find((language) => language.is_default)?.code || languages[0]?.code || 'en'
  const filteredTranslations = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return translations
    return translations.filter((row) => row.key.toLowerCase().includes(term))
  }, [search, translations])

  const hydrate = (payload) => {
    const nextLanguages = Array.isArray(payload?.languages) ? payload.languages : []
    setLanguages(nextLanguages.map((language, index) => ({
      ...EMPTY_LANGUAGE,
      ...language,
      sort_order: language.sort_order ?? index,
    })))
    setAutoDetect(Boolean(payload?.settings?.auto_detect ?? true))
    setTranslations(normalizeTranslations(payload?.translations || [], nextLanguages))
  }

  const updateLanguage = (index, changes) => {
    setLanguages((current) => current.map((language, rowIndex) => {
      if (rowIndex !== index) return language
      const next = { ...language, ...changes }
      return next.is_default ? { ...next, is_active: true } : next
    }))
  }

  const addLanguage = () => {
    setLanguages((current) => [
      ...current,
      { ...EMPTY_LANGUAGE, id: `new-${Date.now()}`, sort_order: current.length },
    ])
  }

  const removeLanguage = (index) => {
    if (languages.length <= 1) return
    const removed = languages[index]
    setLanguages((current) => {
      const next = current.filter((_, rowIndex) => rowIndex !== index)
      if (removed.is_default && next.length) next[0] = { ...next[0], is_default: true, is_active: true }
      return next.map((language, order) => ({ ...language, sort_order: order }))
    })
  }

  const setDefaultLanguage = (code) => {
    setLanguages((current) => current.map((language) => ({
      ...language,
      is_default: language.code === code,
      is_active: language.code === code ? true : language.is_active,
    })))
  }

  const saveLanguages = async () => {
    setBusy('languages')
    setLocalMessage(null)
    try {
      const { data } = await api.put('/admin/languages', {
        languages: languages.map((language, index) => ({ ...language, sort_order: index })),
        default_language: defaultLanguage,
        auto_detect: autoDetect,
      })
      hydrate(data.data)
      notify('success', data.message || 'Languages saved.')
    } catch (error) {
      notify('error', error.response?.data?.message || 'Could not save languages.')
    } finally {
      setBusy(null)
    }
  }

  const addTranslation = () => {
    const values = Object.fromEntries(languages.map((language) => [language.code, '']))
    setTranslations((current) => [{ key: '', original_key: '', values, id: `new-${Date.now()}` }, ...current])
  }

  const updateTranslation = (index, changes) => {
    setTranslations((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...changes } : row)))
  }

  const updateTranslationValue = (index, locale, value) => {
    setTranslations((current) => current.map((row, rowIndex) => (
      rowIndex === index ? { ...row, values: { ...row.values, [locale]: value } } : row
    )))
  }

  const saveTranslations = async () => {
    setBusy('translations')
    setLocalMessage(null)
    try {
      const rows = translations
        .map((row) => ({
          key: row.key.trim(),
          original_key: row.original_key || row.key.trim(),
          values: row.values || {},
        }))
        .filter((row) => row.key)
      const { data } = await api.put('/admin/translations', { translations: rows })
      hydrate(data.data)
      notify('success', data.message || 'Translations saved.')
    } catch (error) {
      notify('error', error.response?.data?.message || 'Could not save translations.')
    } finally {
      setBusy(null)
    }
  }

  const removeTranslation = async (row, index) => {
    if (!row.original_key) {
      setTranslations((current) => current.filter((_, rowIndex) => rowIndex !== index))
      return
    }

    setBusy(`delete-${row.original_key}`)
    try {
      const { data } = await api.delete('/admin/translations', { data: { key: row.original_key } })
      hydrate(data.data)
      notify('success', data.message || 'Translation deleted.')
    } catch (error) {
      notify('error', error.response?.data?.message || 'Could not delete translation.')
    } finally {
      setBusy(null)
    }
  }

  const syncFromFiles = async () => {
    setBusy('sync')
    try {
      const { data } = await api.post('/admin/translations/sync')
      hydrate(data.data)
      notify('success', data.message || 'Language files synced.')
    } catch (error) {
      notify('error', error.response?.data?.message || 'Could not sync language files.')
    } finally {
      setBusy(null)
    }
  }

  const exportDefaultLanguage = () => {
    const output = Object.fromEntries(
      translations
        .filter((row) => row.key.trim())
        .map((row) => [row.key.trim(), row.values?.[defaultLanguage] || '']),
    )
    const url = URL.createObjectURL(new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${defaultLanguage}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importJson = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'))
        const rows = Object.entries(flattenObject(parsed)).map(([key, value]) => ({
          key,
          original_key: key,
          values: { [defaultLanguage]: value == null ? '' : String(value) },
        }))
        setTranslations((current) => mergeTranslations(current, rows, languages))
        notify('success', `${rows.length} translations imported into ${defaultLanguage}. Save translations to persist them.`)
      } catch {
        notify('error', 'The selected file is not valid JSON.')
      } finally {
        event.target.value = ''
      }
    }
    reader.readAsText(file)
  }

  const notify = (type, text) => {
    setLocalMessage({ type, text })
    setMessage?.({ type, text })
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 p-5">
      {(localMessage) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${localMessage.type === 'success' ? 'border-emerald-900/60 bg-emerald-950/30 text-emerald-300' : 'border-rose-900/60 bg-rose-950/30 text-rose-300'}`}>
          {localMessage.text}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40">
        <div className="flex flex-col gap-3 border-b border-slate-800 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="flex items-center gap-2 font-semibold text-white"><Languages className="h-4 w-4 text-brand-300" /> Website languages</p>
            <p className="mt-1 text-sm text-slate-400">Add every locale your app should support, then choose the public default language.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Toggle checked={autoDetect} label="Auto detect" onChange={setAutoDetect} />
            <Button type="button" variant="secondary" onClick={addLanguage}><Plus className="h-4 w-4" /> Add language</Button>
            <Button type="button" loading={busy === 'languages'} onClick={saveLanguages}><Save className="h-4 w-4" /> Save languages</Button>
          </div>
        </div>
        <div className="divide-y divide-slate-800">
          {languages.map((language, index) => (
            <div key={language.id || `${language.code}-${index}`} className="grid gap-3 p-4 md:grid-cols-[7rem_1fr_1fr_7rem_7rem_2.75rem] md:items-end">
              <Input label="Code" value={language.code || ''} onChange={(event) => updateLanguage(index, { code: event.target.value.toLowerCase().replace(/\s/g, '') })} placeholder="en" />
              <Input label="Language name" value={language.name || ''} onChange={(event) => updateLanguage(index, { name: event.target.value })} placeholder="English" />
              <Input label="Native name" value={language.native_name || ''} onChange={(event) => updateLanguage(index, { native_name: event.target.value })} placeholder="English" />
              <Toggle checked={language.is_active} label="Active" onChange={(value) => updateLanguage(index, { is_active: value })} />
              <Toggle checked={language.is_rtl} label="RTL" onChange={(value) => updateLanguage(index, { is_rtl: value })} />
              <Button type="button" variant="ghost" className="text-rose-400" onClick={() => removeLanguage(index)} disabled={languages.length <= 1}><Trash2 className="h-4 w-4" /></Button>
              <div className="md:col-span-6">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                  <input type="radio" name="default-language" checked={language.is_default} onChange={() => setDefaultLanguage(language.code)} className="h-4 w-4 border-slate-600 text-brand-600" />
                  Use {language.name || language.code || 'this language'} as the default public language
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40">
        <div className="flex flex-col gap-3 border-b border-slate-800 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="font-semibold text-white">Translation keys</p>
            <p className="mt-1 text-sm text-slate-400">Each active language becomes a column. Save translations to update backend JSON files.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search keys" className="h-9 w-56 rounded-xl border border-slate-700 bg-slate-800 pl-9 pr-3 text-sm text-slate-100 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
            </div>
            <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={importJson} />
            <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4" /> Import JSON</Button>
            <Button type="button" variant="secondary" onClick={exportDefaultLanguage}><Download className="h-4 w-4" /> Export {defaultLanguage}</Button>
            <Button type="button" variant="secondary" loading={busy === 'sync'} onClick={syncFromFiles}><RefreshCw className="h-4 w-4" /> Sync files</Button>
            <Button type="button" variant="secondary" onClick={addTranslation}><Plus className="h-4 w-4" /> Add key</Button>
            <Button type="button" loading={busy === 'translations'} onClick={saveTranslations}><Save className="h-4 w-4" /> Save translations</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
            <thead className="bg-slate-950/50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="min-w-64 px-4 py-3">Translation key</th>
                {activeLanguages.map((language) => <th key={language.code} className="min-w-72 px-4 py-3">{language.name} <span className="text-slate-600">({language.code})</span></th>)}
                <th className="w-16 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredTranslations.map((row) => {
                const index = translations.indexOf(row)
                return (
                  <tr key={row.id || row.original_key || `${row.key}-${index}`} className="align-top">
                    <td className="px-4 py-3">
                      <input value={row.key} onChange={(event) => updateTranslation(index, { key: event.target.value })} placeholder="navigation.pricing" className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
                    </td>
                    {activeLanguages.map((language) => (
                      <td key={language.code} className="px-4 py-3">
                        <textarea value={row.values?.[language.code] || ''} onChange={(event) => updateTranslationValue(index, language.code, event.target.value)} rows={2} className="min-h-20 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <Button type="button" size="sm" variant="ghost" className="text-rose-400" loading={busy === `delete-${row.original_key}`} onClick={() => removeTranslation(row, index)}><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                )
              })}
              {filteredTranslations.length === 0 && (
                <tr>
                  <td colSpan={activeLanguages.length + 2} className="px-4 py-10 text-center text-sm text-slate-500">No translation keys found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Toggle({ checked, label, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${checked ? 'border-brand-500/50 bg-brand-500/15 text-brand-200' : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
    >
      <span className={`relative h-5 w-9 rounded-full transition ${checked ? 'bg-brand-600' : 'bg-slate-700'}`}>
        <span className={`absolute top-1 h-3 w-3 rounded-full bg-white transition ${checked ? 'left-5' : 'left-1'}`} />
      </span>
      {label}
    </button>
  )
}

function normalizeTranslations(rows, languages) {
  return rows.map((row) => ({
    key: row.key || '',
    original_key: row.original_key || row.key || '',
    values: {
      ...Object.fromEntries(languages.map((language) => [language.code, ''])),
      ...(row.values || {}),
    },
  }))
}

function mergeTranslations(current, importedRows, languages) {
  const values = Object.fromEntries(languages.map((language) => [language.code, '']))
  const map = new Map(current.map((row) => [row.key, { ...row, values: { ...values, ...(row.values || {}) } }]))

  importedRows.forEach((row) => {
    const existing = map.get(row.key)
    map.set(row.key, {
      key: row.key,
      original_key: existing?.original_key || row.key,
      values: { ...values, ...(existing?.values || {}), ...(row.values || {}) },
    })
  })

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key))
}

function flattenObject(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.entries(value).reduce((items, [key, entry]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return { ...items, ...flattenObject(entry, nextKey) }
    }
    return { ...items, [nextKey]: entry }
  }, {})
}
