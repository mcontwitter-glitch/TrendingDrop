import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ImagePlus, CheckCircle2, AlertCircle } from 'lucide-react'
import { useNarrativeProgram } from '../hooks/useNarrativeProgram'
import { initializeStory } from '../lib/solana/transactions'
import { useToast } from '../components/Toast'

export function CreateStory() {
  const navigate = useNavigate()
  const { program, publicKey, connected, cluster } = useNarrativeProgram()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [ticker, setTicker] = useState('')
  const [description, setDescription] = useState('')
  const [twitter, setTwitter] = useState('')
  const [telegram, setTelegram] = useState('')
  const [website, setWebsite] = useState('')
  const [duration, setDuration] = useState<'24' | '48'>('24')
  const [imageName, setImageName] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState<'chain' | 'mock'>('mock')
  const [txSig, setTxSig] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [configNote, setConfigNote] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !ticker.trim() || !description.trim()) return
    setError(null)
    setConfigNote(null)

    const meta = {
      title: title.trim(),
      ticker: ticker.trim().toUpperCase(),
      blurb: description.trim().slice(0, 140),
      description: description.trim(),
      socials: {
        ...(twitter ? { twitter } : {}),
        ...(telegram ? { telegram } : {}),
        ...(website ? { website } : {}),
      },
    }
    const durationSeconds = Number(duration) * 60 * 60

    if (connected && program && publicKey) {
      setSubmitting(true)
      try {
        const result = await initializeStory(program, {
          meta,
          durationSeconds,
          creator: publicKey,
        })
        setMode('chain')
        setTxSig(result.signature)
        setConfigNote(
          'If this was the first story on this cluster, initialize_config ran automatically with your wallet as authority/treasury.',
        )
        setSubmitted(true)
        toast.success(
          'Story created on-chain',
          `${result.signature.slice(0, 16)}… · Name cached in this browser only (add to public/meta/stories.json for others)`,
        )
        window.setTimeout(() => navigate(`/story/${result.storyPda.toBase58()}`), 2200)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        toast.error('Create story failed', msg)
      } finally {
        setSubmitting(false)
      }
      return
    }

    // Mock path when wallet / program unavailable
    setMode('mock')
    setSubmitted(true)
    toast.info(
      'Mock submission',
      'Connect wallet on a deployed cluster for a real initialize_story tx',
    )
    window.setTimeout(() => navigate('/'), 1800)
  }

  if (submitted) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
        <CheckCircle2 className="mb-4 h-16 w-16 text-bcc-green" />
        <h1 className="font-display text-2xl font-bold">Story submitted</h1>
        <p className="mt-2 text-sm text-bcc-muted">
          {mode === 'chain'
            ? 'On-chain initialize_story confirmed. Redirecting…'
            : 'Mock submission — connect a wallet on a deployed cluster for a real tx. Redirecting to the board…'}
        </p>
        {txSig && (
          <p className="mt-3 break-all font-mono text-[10px] text-bcc-muted">sig: {txSig}</p>
        )}
        {configNote && <p className="mt-2 text-xs text-bcc-muted">{configNote}</p>}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-bcc-muted transition hover:text-bcc-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to board
      </Link>

      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Create a Story</h1>
        <p className="mt-2 text-sm text-bcc-muted">
          Submit a meme concept for a narrative auction. Users stake SOL; top stories graduate to
          tokens later.
        </p>
        <p className="mt-2 text-xs text-bcc-muted">
          {connected
            ? `Wallet connected · will call initialize_story on ${cluster} (config auto-inits if missing).`
            : 'Wallet not connected — submit stays mock-only.'}
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-5 bcc-card rounded-2xl p-5 sm:p-7"
      >
        <Field label="Title" required>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Void Cats"
            maxLength={64}
            className="field-input"
          />
        </Field>

        <Field label="Ticker / short label" required hint="3–10 chars, memetic">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 w-4 -translate-y-1/2 text-center font-semibold text-bcc-muted">
              $
            </span>
            <input
              required
              value={ticker}
              onChange={(e) =>
                setTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))
              }
              placeholder="VOID"
              className="field-input field-input-ticker uppercase"
            />
          </div>
        </Field>

        <Field label="Description" required>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell the lore. Why does this narrative deserve to exist?"
            rows={5}
            maxLength={800}
            className="field-input resize-y"
          />
          <div className="mt-1 text-right text-[10px] text-bcc-muted">{description.length}/800</div>
        </Field>

        <Field label="Cover image" hint="Placeholder — upload mocked">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-bcc-border bg-bcc-bg px-4 py-10 transition hover:border-bcc-green/40 hover:bg-bcc-green/5">
            <ImagePlus className="h-8 w-8 text-bcc-muted" />
            <span className="text-sm text-bcc-muted">
              {imageName ? imageName : 'Click to choose an image'}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setImageName(e.target.files?.[0]?.name ?? null)}
            />
          </label>
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Twitter / X">
            <input
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
              placeholder="https://x.com/…"
              className="field-input"
            />
          </Field>
          <Field label="Telegram">
            <input
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              placeholder="https://t.me/…"
              className="field-input"
            />
          </Field>
          <Field label="Website">
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://…"
              className="field-input"
            />
          </Field>
        </div>

        <Field label="Auction duration">
          <div className="flex gap-2">
            {(['24', '48'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition ${
                  duration === d
                    ? 'border-bcc-green/50 bg-bcc-green/10 text-bcc-green'
                    : 'border-bcc-border bg-bcc-bg text-bcc-muted hover:border-bcc-cyan/40'
                }`}
              >
                {d} hours
              </button>
            ))}
          </div>
        </Field>

        <div className="flex items-center justify-between rounded-xl border border-bcc-border bg-bcc-bg px-4 py-3 text-sm">
          <span className="text-bcc-muted">Minimum stake to participate</span>
          <span className="font-stat text-bcc-green">0.01 SOL</span>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="bcc-glow-btn w-full rounded-xl py-3.5 font-display text-sm font-bold disabled:opacity-50"
        >
          {submitting
            ? 'Submitting on-chain…'
            : connected
              ? 'Submit story on-chain'
              : 'Submit story to auction (mock)'}
        </button>
      </form>

      <style>{`
        .field-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #1a3a55;
          background: #030a16;
          padding: 0.75rem 1rem;
          color: #f0f7ff;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .field-input:focus {
          border-color: #22d3ee99;
          box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.25);
        }
        .field-input::placeholder {
          color: #7a9bb0;
        }
        .field-input-ticker {
          padding-left: 2.25rem;
        }
      `}</style>
    </div>
  )
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label className="text-xs font-semibold uppercase tracking-wide text-bcc-muted">
          {label}
          {required && <span className="text-bcc-green"> *</span>}
        </label>
        {hint && <span className="text-[10px] text-bcc-muted">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
