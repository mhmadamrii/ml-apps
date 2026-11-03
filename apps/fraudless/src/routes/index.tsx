import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@workspace/ui/components/alert'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@workspace/ui/components/table'
import { Textarea } from '@workspace/ui/components/textarea'
import { api, ApiError, type ModelInfo, type PredictResponse } from '../api'

export const Route = createFileRoute('/')({ component: Home })

const MAPPING_PLACEHOLDER = '{"amount": "Amt", "payment_method": "Method", "transaction_timestamp": "When"}'

function Home() {
  const [info, setInfo] = useState<ModelInfo | null>(null)
  const [infoError, setInfoError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [mapping, setMapping] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [result, setResult] = useState<PredictResponse | null>(null)
  const [flaggedOnly, setFlaggedOnly] = useState(false)

  useEffect(() => {
    api.modelInfo().then(setInfo).catch((e) => setInfoError(String(e.message ?? e)))
  }, [])

  async function run(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      setResult(await api.predict(file, mapping))
    } catch (err) {
      setError(err as Error)
    } finally {
      setBusy(false)
    }
  }

  const rows = useMemo(() => {
    const r = [...(result?.results ?? [])].sort((a, b) => b.risk_score - a.risk_score)
    return flaggedOnly ? r.filter((x) => x.prediction === 'potentially_suspicious') : r
  }, [result, flaggedOnly])

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">FraudLess</h1>
        <p className="text-sm text-muted-foreground">Upload a transaction CSV and review which rows look potentially suspicious.</p>
        <ModelBadge info={info} error={infoError} />
      </header>

      <Card>
        <form onSubmit={run}>
          <CardHeader>
            <CardTitle>Transactions file</CardTitle>
            <CardDescription>.csv, UTF-8, comma-separated. Processed in memory, never stored.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">File</Label>
              <Input id="file" data-testid="file-input" type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">Column names differ from the schema? Map them</summary>
              <p className="mt-2 text-muted-foreground">
                JSON of canonical field to your column header. Required: <code>amount</code>. Fields:{' '}
                {info?.supported_schema_fields.filter((f) => f.requirement !== 'training_only').map((f) => f.name).join(', ') ?? '…'}
              </p>
              <Textarea
                data-testid="mapping-input"
                rows={3}
                value={mapping}
                onChange={(e) => setMapping(e.target.value)}
                placeholder={MAPPING_PLACEHOLDER}
                className="mt-2 font-mono text-xs"
              />
            </details>
            <Button data-testid="run" disabled={!file || busy}>
              {busy ? 'Scoring…' : 'Run audit'}
            </Button>
          </CardContent>
        </form>
      </Card>

      {error && <ErrorBox error={error} />}
      {result && <Results result={result} rows={rows} flaggedOnly={flaggedOnly} setFlaggedOnly={setFlaggedOnly} />}
    </div>
  )
}

function ModelBadge({ info, error }: { info: ModelInfo | null; error: string }) {
  if (error)
    return (
      <Alert variant="destructive" data-testid="api-down">
        <AlertTitle>Cannot reach the scoring API</AlertTitle>
        <AlertDescription>
          {error}. Start it with <code>pnpm dev:fraudless-api</code>.
        </AlertDescription>
      </Alert>
    )
  if (!info) return null
  const m = info.metrics.test
  return (
    <p data-testid="model-badge" className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
      Model <b className="text-foreground">{info.model_version}</b> ({info.model_type}) · trained on simulated data · test PR-AUC{' '}
      {m.pr_auc.toFixed(2)} (random {m.prevalence.toFixed(4)}), precision {(m.precision * 100).toFixed(0)}%, recall{' '}
      {(m.recall * 100).toFixed(0)}% · proof of concept, not a fraud decision system.
    </p>
  )
}

function ErrorBox({ error }: { error: ApiError | Error }) {
  const apiErr = error instanceof ApiError ? error : null
  return (
    <Alert variant="destructive" data-testid="error">
      <AlertTitle>
        {apiErr ? `${apiErr.code}: ` : ''}
        {error.message}
      </AlertTitle>
      {apiErr && Object.keys(apiErr.details).length > 0 && (
        <AlertDescription>
          <pre className="overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(apiErr.details, null, 2)}</pre>
        </AlertDescription>
      )}
      {apiErr?.code === 'missing_required_columns' && (
        <AlertDescription>Use the column mapping above to point a canonical field at one of your columns.</AlertDescription>
      )}
    </Alert>
  )
}

function Results(p: {
  result: PredictResponse
  rows: PredictResponse['results']
  flaggedOnly: boolean
  setFlaggedOnly: (v: boolean) => void
}) {
  const { result: r } = p
  return (
    <section className="space-y-6" data-testid="results">
      <Alert data-testid="disclaimer">
        <AlertDescription>{r.disclaimer}</AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Rows in file" value={r.total_rows} testid="t-total" />
        <Tile label="Scored" value={r.scored_rows} testid="t-scored" />
        <Tile label="Rejected" value={r.rejected_row_count} testid="t-rejected" tone={r.rejected_row_count ? 'warn' : undefined} />
        <Tile label="Potentially suspicious" value={r.flagged_rows} testid="t-flagged" tone={r.flagged_rows ? 'alert' : undefined} />
      </div>
      <p className="text-xs text-muted-foreground">
        Flag threshold {r.threshold.toFixed(4)}. Risk score is a model-estimated probability under the training prevalence (about 0.13%), not a
        certainty. Run {r.run_id ?? 'not recorded'}.
      </p>

      {r.warnings.length > 0 && (
        <div data-testid="warnings" className="space-y-2">
          <h2 className="text-sm font-semibold">Data quality warnings</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {r.warnings.map((w, i) => (
              <li key={i}>
                <code className="text-xs">{w.code}</code> {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Scored rows</h2>
          <div className="flex items-center gap-4 text-sm">
            <Label className="gap-2 font-normal">
              <Checkbox data-testid="flagged-only" checked={p.flaggedOnly} onCheckedChange={(v) => p.setFlaggedOnly(v === true)} />
              Flagged only
            </Label>
            <Button type="button" variant="outline" size="sm" data-testid="download" onClick={() => download(r)}>
              Download CSV
            </Button>
          </div>
        </div>
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Row</TableHead>
                <TableHead>Transaction</TableHead>
                <TableHead>Result</TableHead>
                <TableHead className="text-right">Risk score</TableHead>
                <TableHead>Unknown inputs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {p.rows.map((x) => (
                <TableRow key={x.row_id} data-testid="result-row" data-prediction={x.prediction}>
                  <TableCell>{x.row_id}</TableCell>
                  <TableCell className="font-mono text-xs">{x.transaction_id}</TableCell>
                  <TableCell>
                    {x.prediction === 'potentially_suspicious' ? (
                      <Badge variant="destructive">potentially suspicious</Badge>
                    ) : (
                      <Badge variant="secondary">not flagged</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{x.risk_score.toFixed(4)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{x.missing_model_inputs.join(', ') || '-'}</TableCell>
                </TableRow>
              ))}
              {p.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No rows to show.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {r.rejected_rows.length > 0 && (
        <div data-testid="rejected" className="space-y-2">
          <h2 className="text-sm font-semibold">
            Rejected rows ({r.rejected_row_count}){r.rejected_rows_truncated && `, first ${r.rejected_rows.length} shown`}
          </h2>
          <ul className="space-y-1 text-sm">
            {r.rejected_rows.map((x) => (
              <li key={x.row_id} className="rounded-md border p-2">
                <b>Row {x.row_id}</b>: {x.errors.map((e) => `${e.field} (${e.message})`).join('; ')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function Tile({ label, value, testid, tone }: { label: string; value: number; testid: string; tone?: 'warn' | 'alert' }) {
  const color = tone === 'alert' ? 'text-destructive' : tone === 'warn' ? 'text-amber-600' : ''
  return (
    <Card className="gap-1 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div data-testid={testid} className={`text-2xl font-semibold tabular-nums ${color}`}>
        {value}
      </div>
    </Card>
  )
}

function csvCell(v: string | number): string {
  const s = String(v)
  // quote, and neutralize spreadsheet formula injection from user-supplied ids
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

function download(r: PredictResponse) {
  const lines = ['row_id,transaction_id,prediction,risk_score,missing_model_inputs']
  for (const x of r.results)
    lines.push([x.row_id, x.transaction_id, x.prediction, x.risk_score, x.missing_model_inputs.join('|')].map(csvCell).join(','))
  const url = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/csv' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `fraudless-${r.run_id ?? 'results'}.csv` })
  a.click()
  URL.revokeObjectURL(url)
}
