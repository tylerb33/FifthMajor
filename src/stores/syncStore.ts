import { create } from 'zustand'
import { syncManager, type SyncStatus, type SyncError } from '@/lib/sync/SyncManager'

interface SyncState {
  status: SyncStatus
  pendingCount: number
  isOnline: boolean
  error: SyncError | null
  retrySync: () => void
  clearError: () => void
}

export const useSyncStore = create<SyncState>()(() => ({
  status: 'idle',
  pendingCount: 0,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  error: null,
  retrySync: () => {
    syncManager.retryFailed()
  },
  clearError: () => {
    syncManager.clearError()
  }
}))

// Initialize sync manager subscription
if (typeof window !== 'undefined') {
  syncManager.subscribe((status, pendingCount, error) => {
    useSyncStore.setState({ status, pendingCount, error })
  })

  window.addEventListener('online', () => {
    useSyncStore.setState({ isOnline: true })
  })

  window.addEventListener('offline', () => {
    useSyncStore.setState({ isOnline: false })
  })
}
