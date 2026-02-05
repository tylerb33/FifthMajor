import { create } from 'zustand'

export type ToastVariant = 'default' | 'destructive' | 'warning'

export interface ToastData {
  id: string
  title: string
  description?: string
  variant?: ToastVariant
  action?: {
    label: string
    onClick: () => void
  }
  duration?: number
}

interface ToastState {
  toasts: ToastData[]
  addToast: (toast: Omit<ToastData, 'id'>) => void
  dismissToast: (id: string) => void
  dismissAll: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9)
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }))
  },
  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },
  dismissAll: () => {
    set({ toasts: [] })
  },
}))

export function useToast() {
  const { toasts, addToast, dismissToast, dismissAll } = useToastStore()

  return {
    toasts,
    toast: addToast,
    dismiss: dismissToast,
    dismissAll,
  }
}
