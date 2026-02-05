import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  ToastAction,
} from "@/components/ui/toast"
import { useToast } from "@/hooks/useToast"

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <ToastProvider>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          variant={toast.variant}
          duration={toast.duration ?? 5000}
          onOpenChange={(open) => {
            if (!open) dismiss(toast.id)
          }}
        >
          <div className="grid gap-1">
            <ToastTitle>{toast.title}</ToastTitle>
            {toast.description && (
              <ToastDescription>{toast.description}</ToastDescription>
            )}
          </div>
          {toast.action && (
            <ToastAction altText={toast.action.label} onClick={toast.action.onClick}>
              {toast.action.label}
            </ToastAction>
          )}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
