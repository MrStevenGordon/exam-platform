'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function TestPage() {
  const [status, setStatus] = useState('Checking connection...')

  useEffect(() => {
    async function checkConnection() {
      const { error } = await supabase.from('_test_').select('*').limit(1)
      if (error && error.code === 'PGRST205') {
        setStatus('✅ Connected to Supabase successfully! (table not found is expected)')
      } else if (error) {
        setStatus('❌ Connection issue: ' + error.message)
      } else {
        setStatus('✅ Connected to Supabase successfully!')
      }
    }
    checkConnection()
  }, [])

  return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>{status}</div>
}
