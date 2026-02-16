import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    return NextResponse.json(
      { ok: false, error: 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY' },
      { status: 500 }
    )
  }

  const supabase = createClient(url, anon)

  const { count: docCount, error: docErr } = await supabase
    .from('document_types')
    .select('*', { count: 'exact', head: true })

  const { count: stateCount, error: stateErr } = await supabase
    .from('states')
    .select('*', { count: 'exact', head: true })

  const { count: covCount, error: covErr } = await supabase
    .from('coverage_matrix')
    .select('*', { count: 'exact', head: true })

  if (docErr || stateErr || covErr) {
    return NextResponse.json(
      {
        ok: false,
        errors: {
          document_types: docErr?.message,
          states: stateErr?.message,
          coverage_matrix: covErr?.message,
        },
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    counts: { document_types: docCount, states: stateCount, coverage_matrix: covCount },
  })
}
