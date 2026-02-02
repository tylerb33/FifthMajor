import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useTournamentStore } from '@/stores/tournamentStore'
import { db, generateLocalId } from '@/lib/db/schema'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { generateShareCode, generateAdminPin } from '@/lib/utils'

export function CreateTournament() {
  const navigate = useNavigate()
  const { setCurrentTournament, setIsAdmin } = useTournamentStore()

  const [step, setStep] = useState<'form' | 'success'>('form')
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  // Created tournament info
  const [shareCode, setShareCode] = useState('')
  const [adminPin, setAdminPin] = useState('')
  const [copied, setCopied] = useState<'code' | 'pin' | null>(null)

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Please enter a tournament name')
      return
    }
    if (!startDate) {
      setError('Please select a start date')
      return
    }
    if (!endDate) {
      setError('Please select an end date')
      return
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError('End date must be after start date')
      return
    }

    setIsCreating(true)
    setError('')

    const newShareCode = generateShareCode()
    const newAdminPin = generateAdminPin()
    const now = new Date().toISOString()

    try {
      let tournamentId: string

      if (isSupabaseConfigured()) {
        // Create on server first
        const { data, error: createError } = await supabase
          .from('tournaments')
          .insert({
            name: name.trim(),
            share_code: newShareCode,
            admin_pin: newAdminPin,
            status: 'draft',
            start_date: startDate,
            end_date: endDate
          })
          .select()
          .single()

        if (createError) throw createError
        tournamentId = data.id

        // Save to local DB
        await db.tournaments.put({
          ...data,
          synced_at: now
        })
      } else {
        // Create locally only
        tournamentId = generateLocalId()
        await db.tournaments.put({
          id: tournamentId,
          name: name.trim(),
          share_code: newShareCode,
          admin_pin: newAdminPin,
          status: 'draft',
          start_date: startDate,
          end_date: endDate,
          created_at: now
        })
      }

      setShareCode(newShareCode)
      setAdminPin(newAdminPin)
      setCurrentTournament(tournamentId)
      setIsAdmin(true)
      setStep('success')
    } catch (err) {
      console.error('Error creating tournament:', err)
      setError('Failed to create tournament. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleCopy = async (type: 'code' | 'pin') => {
    const text = type === 'code' ? shareCode : adminPin
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  if (step === 'success') {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Tournament Created!</CardTitle>
            <CardDescription>
              Save these codes - you'll need them to manage your tournament
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Share Code */}
            <div className="space-y-2">
              <Label>Share Code (for participants)</Label>
              <div className="flex gap-2">
                <div className="flex-1 rounded-lg bg-muted p-3 text-center font-mono text-2xl tracking-widest">
                  {shareCode}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy('code')}
                >
                  {copied === 'code' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Admin PIN */}
            <div className="space-y-2">
              <Label>Admin PIN (keep private!)</Label>
              <div className="flex gap-2">
                <div className="flex-1 rounded-lg bg-orange-100 p-3 text-center font-mono text-2xl tracking-widest text-orange-700">
                  {adminPin}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy('pin')}
                >
                  {copied === 'pin' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                You'll need this PIN to add players and manage the tournament
              </p>
            </div>

            <Button
              className="w-full"
              onClick={() => navigate('/players')}
            >
              Continue to Add Players
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => navigate('/')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <Card className="mx-auto max-w-sm">
        <CardHeader>
          <CardTitle>Create Tournament</CardTitle>
          <CardDescription>
            Set up a new golf tournament
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tournament Name</Label>
            <Input
              id="name"
              placeholder="e.g., Summer Championship 2024"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            className="w-full"
            onClick={handleCreate}
            disabled={isCreating}
          >
            {isCreating ? 'Creating...' : 'Create Tournament'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
