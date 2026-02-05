import { useState, useEffect, useRef } from 'react'
import { Cloud, CloudOff, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { useSyncStore } from '@/stores/syncStore'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'

export function SyncIndicator() {
  const { status, pendingCount, isOnline, error, retrySync, clearError } = useSyncStore()
  const { toast } = useToast()
  const [showDetails, setShowDetails] = useState(false)
  const [lastErrorId, setLastErrorId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDetails(false)
      }
    }

    if (showDetails) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDetails])

  // Show toast when a new error occurs
  useEffect(() => {
    if (error && error.timestamp) {
      const errorId = error.timestamp.toISOString()
      if (errorId !== lastErrorId) {
        setLastErrorId(errorId)
        toast({
          title: error.message,
          description: error.details,
          variant: 'destructive',
          action: {
            label: 'Retry',
            onClick: () => {
              retrySync()
            }
          },
          duration: 8000
        })
      }
    }
  }, [error, lastErrorId, toast, retrySync])

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 text-orange-600">
        <CloudOff className="h-4 w-4" />
        <span className="text-xs">Offline</span>
      </div>
    )
  }

  if (status === 'syncing') {
    return (
      <div className="flex items-center gap-1.5 text-blue-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Syncing{pendingCount > 0 ? ` (${pendingCount})` : ''}</span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1.5 text-red-600 hover:text-red-700 transition-colors"
        >
          <AlertCircle className="h-4 w-4" />
          <span className="text-xs">Sync error</span>
        </button>

        {showDetails && error && (
          <div className="absolute right-0 top-full mt-2 w-72 rounded-lg border bg-background p-3 shadow-lg z-50">
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <p className="font-medium text-sm text-red-600">{error.message}</p>
                <button
                  onClick={() => {
                    setShowDetails(false)
                    clearError()
                  }}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  Dismiss
                </button>
              </div>
              {error.details && (
                <p className="text-xs text-muted-foreground">{error.details}</p>
              )}
              {error.failedCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {error.failedCount} item(s) waiting to sync
                </p>
              )}
              <button
                onClick={() => {
                  setShowDetails(false)
                  retrySync()
                }}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <RefreshCw className="h-3 w-3" />
                Retry now
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (pendingCount > 0) {
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Cloud className="h-4 w-4" />
        <span className="text-xs">{pendingCount} pending</span>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-1.5 text-green-600')}>
      <Cloud className="h-4 w-4" />
      <span className="text-xs">Synced</span>
    </div>
  )
}
