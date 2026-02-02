import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Copy, Check, LogOut, Lock, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTournamentStore } from '@/stores/tournamentStore'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, generateLocalId } from '@/lib/db/schema'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export function SettingsPage() {
  const navigate = useNavigate()
  const { currentTournamentId, isAdmin, verifyAdminPin, clearSession } = useTournamentStore()

  const [copied, setCopied] = useState(false)
  const [showPinDialog, setShowPinDialog] = useState(false)
  const [showCourseDialog, setShowCourseDialog] = useState(false)
  const [showRoundDialog, setShowRoundDialog] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')

  const tournament = useLiveQuery(
    () => currentTournamentId ? db.tournaments.get(currentTournamentId) : undefined,
    [currentTournamentId]
  )

  const courses = useLiveQuery(() => db.courses.toArray(), [])

  const rounds = useLiveQuery(
    async () => {
      if (!currentTournamentId) return []
      const rds = await db.rounds
        .where('tournament_id')
        .equals(currentTournamentId)
        .sortBy('round_number')

      // Get course names
      const courseIds = [...new Set(rds.map(r => r.course_id))]
      const courseList = await db.courses.bulkGet(courseIds)
      const courseMap = new Map(courseList.filter(Boolean).map(c => [c!.id, c!]))

      return rds.map(r => ({
        ...r,
        course: courseMap.get(r.course_id)
      }))
    },
    [currentTournamentId]
  )

  const handleCopyCode = async () => {
    if (tournament?.share_code) {
      await navigator.clipboard.writeText(tournament.share_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

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
    } else {
      setPinError('Incorrect PIN')
    }
  }

  const handleLeaveTournament = () => {
    clearSession()
    navigate('/')
  }

  if (!tournament) {
    return (
      <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center p-4">
        <div className="text-center text-muted-foreground">
          No tournament selected
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Tournament Info */}
      <Card>
        <CardHeader>
          <CardTitle>{tournament.name}</CardTitle>
          <CardDescription>
            {tournament.start_date} - {tournament.end_date}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Share Code */}
          <div className="space-y-2">
            <Label>Share Code</Label>
            <div className="flex gap-2">
              <div className="flex-1 rounded-lg bg-muted p-3 text-center font-mono text-xl tracking-widest">
                {tournament.share_code}
              </div>
              <Button variant="outline" size="icon" onClick={handleCopyCode}>
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Admin Status */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Lock className={isAdmin ? 'h-4 w-4 text-green-600' : 'h-4 w-4 text-muted-foreground'} />
              <span>{isAdmin ? 'Admin access granted' : 'Participant mode'}</span>
            </div>
            {!isAdmin && (
              <Button variant="outline" size="sm" onClick={() => setShowPinDialog(true)}>
                Enter PIN
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Course Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Courses</CardTitle>
            <CardDescription>Manage golf courses</CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => handleAdminAction(() => setShowCourseDialog(true))}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </CardHeader>
        <CardContent>
          {courses && courses.length > 0 ? (
            <div className="space-y-2">
              {courses.map(course => (
                <div key={course.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium">{course.name}</div>
                    <div className="text-sm text-muted-foreground">Par {course.par}</div>
                  </div>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No courses added yet</p>
          )}
        </CardContent>
      </Card>

      {/* Round Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Rounds</CardTitle>
            <CardDescription>Tournament rounds</CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => handleAdminAction(() => setShowRoundDialog(true))}
            disabled={!courses?.length}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </CardHeader>
        <CardContent>
          {rounds && rounds.length > 0 ? (
            <div className="space-y-2">
              {rounds.map(round => (
                <div key={round.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium">Round {round.round_number}</div>
                    <div className="text-sm text-muted-foreground">
                      {round.course?.name || 'No course'} - {round.date}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    round.status === 'completed' ? 'bg-green-100 text-green-700' :
                    round.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {round.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {courses?.length ? 'No rounds created yet' : 'Add a course first'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Leave Tournament */}
      <Button
        variant="outline"
        className="w-full text-destructive"
        onClick={handleLeaveTournament}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Leave Tournament
      </Button>

      {/* Admin PIN Dialog */}
      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin Access Required</DialogTitle>
            <DialogDescription>Enter the admin PIN</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter PIN"
              className="text-center text-2xl tracking-widest"
            />
            {pinError && <p className="text-sm text-destructive text-center">{pinError}</p>}
            <Button className="w-full" onClick={handlePinSubmit}>
              Verify PIN
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Course Dialog */}
      <AddCourseDialog
        open={showCourseDialog}
        onOpenChange={setShowCourseDialog}
      />

      {/* Add Round Dialog */}
      <AddRoundDialog
        open={showRoundDialog}
        onOpenChange={setShowRoundDialog}
        tournamentId={currentTournamentId!}
        courses={courses || []}
        existingRounds={rounds?.length || 0}
      />
    </div>
  )
}

interface AddCourseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function AddCourseDialog({ open, onOpenChange }: AddCourseDialogProps) {
  const [name, setName] = useState('')
  const [par, setPar] = useState('72')
  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = async () => {
    if (!name.trim()) return

    setIsAdding(true)
    const now = new Date().toISOString()

    try {
      let courseId: string

      if (isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('courses')
          .insert({ name: name.trim(), par: parseInt(par) || 72 })
          .select()
          .single()

        if (error) throw error
        courseId = data.id
        await db.courses.put({ ...data, synced_at: now })

        // Create default 18 holes
        const holes = Array.from({ length: 18 }, (_, i) => ({
          course_id: courseId,
          hole_number: i + 1,
          par: i < 4 || i === 8 || i === 9 || i === 13 || i === 17 ? 4 : i === 4 || i === 14 ? 5 : 3,
          yardage: null
        }))

        const { data: holesData } = await supabase
          .from('holes')
          .insert(holes)
          .select()

        if (holesData) {
          for (const hole of holesData) {
            await db.holes.put({ ...hole, synced_at: now })
          }
        }
      } else {
        courseId = generateLocalId()
        await db.courses.put({
          id: courseId,
          name: name.trim(),
          par: parseInt(par) || 72,
          created_at: now
        })

        // Create default 18 holes locally
        for (let i = 1; i <= 18; i++) {
          await db.holes.put({
            id: generateLocalId(),
            course_id: courseId,
            hole_number: i,
            par: 4, // Default to par 4
            yardage: null
          })
        }
      }

      setName('')
      setPar('72')
      onOpenChange(false)
    } catch (err) {
      console.error('Error adding course:', err)
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Course</DialogTitle>
          <DialogDescription>Add a golf course for tournament rounds</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Course Name</Label>
            <Input
              placeholder="e.g., Pine Valley Golf Club"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Total Par</Label>
            <Input
              type="number"
              value={par}
              onChange={(e) => setPar(e.target.value)}
            />
          </div>
          <Button className="w-full" onClick={handleAdd} disabled={isAdding || !name.trim()}>
            {isAdding ? 'Adding...' : 'Add Course'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface AddRoundDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tournamentId: string
  courses: { id: string; name: string }[]
  existingRounds: number
}

function AddRoundDialog({ open, onOpenChange, tournamentId, courses, existingRounds }: AddRoundDialogProps) {
  const [courseId, setCourseId] = useState('')
  const [date, setDate] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const roundNumber = existingRounds + 1

  const handleAdd = async () => {
    if (!courseId || !date) return

    setIsAdding(true)
    const now = new Date().toISOString()

    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('rounds')
          .insert({
            tournament_id: tournamentId,
            course_id: courseId,
            round_number: roundNumber,
            date,
            status: 'upcoming'
          })
          .select()
          .single()

        if (error) throw error
        await db.rounds.put({ ...data, synced_at: now })
      } else {
        await db.rounds.put({
          id: generateLocalId(),
          tournament_id: tournamentId,
          course_id: courseId,
          round_number: roundNumber,
          date,
          status: 'upcoming',
          created_at: now
        })
      }

      setCourseId('')
      setDate('')
      onOpenChange(false)
    } catch (err) {
      console.error('Error adding round:', err)
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Round {roundNumber}</DialogTitle>
          <DialogDescription>Create a new tournament round</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger>
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map(course => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <Button className="w-full" onClick={handleAdd} disabled={isAdding || !courseId || !date}>
            {isAdding ? 'Adding...' : 'Add Round'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
