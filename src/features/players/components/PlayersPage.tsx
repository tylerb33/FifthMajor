import { useState } from 'react'
import { Plus, Lock, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTournamentStore } from '@/stores/tournamentStore'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, generateLocalId } from '@/lib/db/schema'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export function PlayersPage() {
  const { currentTournamentId, isAdmin, verifyAdminPin } = useTournamentStore()
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [showPinDialog, setShowPinDialog] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')

  // Fetch tournament and players
  const tournament = useLiveQuery(
    () => currentTournamentId ? db.tournaments.get(currentTournamentId) : undefined,
    [currentTournamentId]
  )

  const tournamentPlayers = useLiveQuery(
    async () => {
      if (!currentTournamentId) return []
      const tps = await db.tournamentPlayers
        .where('tournament_id')
        .equals(currentTournamentId)
        .toArray()

      // Get player details
      const playerIds = tps.map(tp => tp.player_id)
      const players = await db.players.bulkGet(playerIds)
      const playerMap = new Map(players.filter(Boolean).map(p => [p!.id, p!]))

      return tps.map(tp => ({
        ...tp,
        player: playerMap.get(tp.player_id)
      })).sort((a, b) => a.group_number - b.group_number)
    },
    [currentTournamentId]
  )

  const handleAdminAction = (action: () => void) => {
    if (isAdmin) {
      action()
    } else {
      setShowPinDialog(true)
    }
  }

  const handlePinSubmit = () => {
    if (!tournament) return
    if (verifyAdminPin(pinInput, tournament.admin_pin)) {
      setShowPinDialog(false)
      setPinInput('')
      setPinError('')
      setShowAddPlayer(true)
    } else {
      setPinError('Incorrect PIN')
    }
  }

  // Group players by group number
  const playersByGroup = (tournamentPlayers || []).reduce((acc, tp) => {
    const group = tp.group_number || 1
    if (!acc[group]) acc[group] = []
    acc[group].push(tp)
    return acc
  }, {} as Record<number, typeof tournamentPlayers>)

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Players</h1>
        <Button onClick={() => handleAdminAction(() => setShowAddPlayer(true))}>
          <Plus className="mr-2 h-4 w-4" />
          Add Player
        </Button>
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" />
          <span>Enter admin PIN to edit players</span>
        </div>
      )}

      {Object.keys(playersByGroup).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="font-semibold">No players yet</h3>
            <p className="text-sm text-muted-foreground">
              Add players to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(playersByGroup).map(([groupNum, players]) => (
          <Card key={groupNum}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Group {groupNum}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {players?.map(tp => (
                <div
                  key={tp.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <div className="font-medium">{tp.player?.name || 'Unknown'}</div>
                    <div className="text-sm text-muted-foreground">
                      Handicap: {tp.handicap > 0 ? `+${tp.handicap}` : tp.handicap}
                    </div>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {/* Edit player */}}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      {/* Admin PIN Dialog */}
      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin Access Required</DialogTitle>
            <DialogDescription>
              Enter the admin PIN to manage players
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pin">Admin PIN</Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="text-center text-2xl tracking-widest"
              />
              {pinError && <p className="text-sm text-destructive">{pinError}</p>}
            </div>
            <Button className="w-full" onClick={handlePinSubmit}>
              Verify PIN
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Player Dialog */}
      <AddPlayerDialog
        open={showAddPlayer}
        onOpenChange={setShowAddPlayer}
        tournamentId={currentTournamentId!}
      />
    </div>
  )
}

interface AddPlayerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tournamentId: string
}

function AddPlayerDialog({ open, onOpenChange, tournamentId }: AddPlayerDialogProps) {
  const [name, setName] = useState('')
  const [handicap, setHandicap] = useState('-10')
  const [groupNumber, setGroupNumber] = useState('1')
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState('')

  const handleAdd = async () => {
    if (!name.trim()) {
      setError('Please enter a player name')
      return
    }

    setIsAdding(true)
    setError('')

    const now = new Date().toISOString()

    try {
      let playerId: string
      let tournamentPlayerId: string

      if (isSupabaseConfigured()) {
        // Create player on server
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .insert({ name: name.trim() })
          .select()
          .single()

        if (playerError) throw playerError
        playerId = playerData.id

        // Create tournament_player link
        const { data: tpData, error: tpError } = await supabase
          .from('tournament_players')
          .insert({
            tournament_id: tournamentId,
            player_id: playerId,
            handicap: parseInt(handicap) || 0,
            group_number: parseInt(groupNumber) || 1
          })
          .select()
          .single()

        if (tpError) throw tpError
        tournamentPlayerId = tpData.id

        // Save to local DB
        await db.players.put({ ...playerData, synced_at: now })
        await db.tournamentPlayers.put({ ...tpData, synced_at: now })
      } else {
        // Create locally only
        playerId = generateLocalId()
        tournamentPlayerId = generateLocalId()

        await db.players.put({
          id: playerId,
          name: name.trim(),
          created_at: now
        })

        await db.tournamentPlayers.put({
          id: tournamentPlayerId,
          tournament_id: tournamentId,
          player_id: playerId,
          handicap: parseInt(handicap) || 0,
          group_number: parseInt(groupNumber) || 1
        })
      }

      // Reset form
      setName('')
      setHandicap('-10')
      setGroupNumber('1')
      onOpenChange(false)
    } catch (err) {
      console.error('Error adding player:', err)
      setError('Failed to add player. Please try again.')
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Player</DialogTitle>
          <DialogDescription>
            Add a new player to the tournament
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="playerName">Name</Label>
            <Input
              id="playerName"
              placeholder="Player name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="handicap">Handicap</Label>
              <Input
                id="handicap"
                type="number"
                value={handicap}
                onChange={(e) => setHandicap(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use negative for good players (e.g., -15)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="group">Group</Label>
              <Input
                id="group"
                type="number"
                min="1"
                max="6"
                value={groupNumber}
                onChange={(e) => setGroupNumber(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button className="w-full" onClick={handleAdd} disabled={isAdding}>
            {isAdding ? 'Adding...' : 'Add Player'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
