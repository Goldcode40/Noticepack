'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabaseClient } from '@/lib/supabase/client'

export default function NewCasePage() {
  const router = useRouter()
  const supabase = useMemo(() => supabaseClient(), [])

  const [title, setTitle] = useState('')
  const [stateCode, setStateCode] = useState('CA')
  const [status, setStatus] = useState('active')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    setLoading(true)

    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
      if (sessionErr) throw sessionErr
      const session = sessionData.session
      if (!session) {
        router.replace('/login')
        return
      }

      const userId = session.user.id

      const { error } = await supabase.from('cases').insert([
        {
          user_id: userId,
          title,
          state_code: stateCode,
          status,
        },
      ])

      if (error) throw error

      router.push('/cases')
    } catch (err: any) {
      setMsg(err?.message ?? 'Failed to create case')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New Case</h1>
        <Link className="rounded border px-3 py-2" href="/cases">
          Back
        </Link>
      </div>

      <form onSubmit={onCreate} className="rounded border p-4 space-y-3 max-w-xl">
        <div>
          <label className="text-sm">Title</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Smith - Unit 2B - Nonpayment"
            required
          />
        </div>

        <div>
          <label className="text-sm">State</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value.toUpperCase())}
            placeholder="CA"
            maxLength={2}
            required
          />
        </div>

        <div>
          <label className="text-sm">Status</label>
          <select
            className="mt-1 w-full rounded border px-3 py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="active">active</option>
            <option value="closed">closed</option>
          </select>
        </div>

        <button className="rounded bg-black text-white px-4 py-2" disabled={loading} type="submit">
          {loading ? 'Creating…' : 'Create case'}
        </button>

        {msg && <p className="text-sm mt-2">{msg}</p>}
      </form>
    </div>
  )
}
