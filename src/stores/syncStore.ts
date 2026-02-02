import { create } from 'zustand'
import { syncManager } from '@/lib/sync/SyncManager'

type SyncStatus = 'idle' | 'syncing' | 'error'

interface SyncState {
  status: SyncStatus
  pendingCount: number
  isOnline: boolean
}

export const useSyncStore = create<SyncState>()(() => ({
  status: 'idle',
  pendingCount: 0,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true
}))

// Initialize sync manager subscription
if (typeof window !== 'undefined') {
  syncManager.subscribe((status, pendingCount) => {
    useSyncStore.setState({ status, pendingCount })
  })

  window.addEventListener('online', () => {
    useSyncStore.setState({ isOnline: true })
  })

  window.addEventListener('offline', () => {
    useSyncStore.setState({ isOnline: false })
  })
}
