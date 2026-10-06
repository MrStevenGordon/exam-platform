'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { forgetUser } from '@/lib/offline/flashcardsOffline'
import { idbKv } from '@/lib/offline/kv'
import { clearEverything } from '@/lib/offline/offlineCache'
import { clearOfflineWorkerCaches } from '@/lib/offline/serviceWorker'

// When anyone signs out of this device, the flashcards, lessons and saved pages kept for offline use go with them, so a shared device never
// shows one student another's material. (Answers saved offline but not yet sent are kept, see clearReadableData in offlineCache.ts.)
export default function OfflineCleanup() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT') return
      const kv = idbKv()
      void (async () => { if (kv) await clearEverything(kv); await forgetUser(); await clearOfflineWorkerCaches() })()
    })
    return () => subscription.unsubscribe()
  }, [])
  return null
}
