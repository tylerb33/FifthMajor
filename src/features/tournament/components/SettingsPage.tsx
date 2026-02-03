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
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null)
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
                <button
                  key={course.id}
                  onClick={() => handleAdminAction(() => setEditingCourseId(course.id))}
                  className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <div className="font-medium">{course.name}</div>
                    <div className="text-sm text-muted-foreground">Par {course.par}</div>
                  </div>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </button>
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

      {/* Edit Course Dialog */}
      <EditCourseDialog
        courseId={editingCourseId}
        onOpenChange={(open) => !open && setEditingCourseId(null)}
      />
    </div>
  )
}

interface AddCourseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function AddCourseDialog({ open, onOpenChange }: AddCourseDialogProps) {
  const [step, setStep] = useState<'info' | 'holes'>('info')
  const [name, setName] = useState('')
  const [holePars, setHolePars] = useState<number[]>(Array(18).fill(4))
  const [isAdding, setIsAdding] = useState(false)

  const totalPar = holePars.reduce((sum, p) => sum + p, 0)
  const frontNine = holePars.slice(0, 9).reduce((sum, p) => sum + p, 0)
  const backNine = holePars.slice(9).reduce((sum, p) => sum + p, 0)

  const updateHolePar = (index: number, par: number) => {
    const newPars = [...holePars]
    newPars[index] = Math.max(3, Math.min(6, par))
    setHolePars(newPars)
  }

  const handleNext = () => {
    if (name.trim()) {
      setStep('holes')
    }
  }

  const handleBack = () => {
    setStep('info')
  }

  const handleAdd = async () => {
    if (!name.trim()) return

    setIsAdding(true)
    const now = new Date().toISOString()

    try {
      let courseId: string

      if (isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('courses')
          .insert({ name: name.trim(), par: totalPar })
          .select()
          .single()

        if (error) throw error
        courseId = data.id
        await db.courses.put({ ...data, synced_at: now })

        const holes = holePars.map((par, i) => ({
          course_id: courseId,
          hole_number: i + 1,
          par,
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
          par: totalPar,
          created_at: now
        })

        for (let i = 0; i < 18; i++) {
          await db.holes.put({
            id: generateLocalId(),
            course_id: courseId,
            hole_number: i + 1,
            par: holePars[i],
            yardage: null
          })
        }
      }

      // Reset form
      setName('')
      setHolePars(Array(18).fill(4))
      setStep('info')
      onOpenChange(false)
    } catch (err) {
      console.error('Error adding course:', err)
    } finally {
      setIsAdding(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Reset form when closing
      setStep('info')
      setName('')
      setHolePars(Array(18).fill(4))
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{step === 'info' ? 'Add Course' : 'Set Hole Pars'}</DialogTitle>
          <DialogDescription>
            {step === 'info'
              ? 'Add a golf course for tournament rounds'
              : `${name} - Total Par: ${totalPar}`}
          </DialogDescription>
        </DialogHeader>

        {step === 'info' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Course Name</Label>
              <Input
                placeholder="e.g., Pine Valley Golf Club"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={handleNext} disabled={!name.trim()}>
              Next: Set Hole Pars
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Front Nine */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Front Nine</Label>
                <span className="text-sm text-muted-foreground">Par {frontNine}</span>
              </div>
              <div className="grid grid-cols-9 gap-1">
                {holePars.slice(0, 9).map((par, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <span className="text-[10px] text-muted-foreground mb-1">{i + 1}</span>
                    <select
                      value={par}
                      onChange={(e) => updateHolePar(i, parseInt(e.target.value))}
                      className="w-full h-10 text-center text-sm font-medium border rounded-md bg-background"
                    >
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                      <option value={5}>5</option>
                      <option value={6}>6</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Back Nine */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Back Nine</Label>
                <span className="text-sm text-muted-foreground">Par {backNine}</span>
              </div>
              <div className="grid grid-cols-9 gap-1">
                {holePars.slice(9).map((par, i) => (
                  <div key={i + 9} className="flex flex-col items-center">
                    <span className="text-[10px] text-muted-foreground mb-1">{i + 10}</span>
                    <select
                      value={par}
                      onChange={(e) => updateHolePar(i + 9, parseInt(e.target.value))}
                      className="w-full h-10 text-center text-sm font-medium border rounded-md bg-background"
                    >
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                      <option value={5}>5</option>
                      <option value={6}>6</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="flex items-center justify-center gap-4 py-2 bg-muted rounded-lg">
              <div className="text-center">
                <div className="text-lg font-bold">{frontNine}</div>
                <div className="text-xs text-muted-foreground">Out</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{backNine}</div>
                <div className="text-xs text-muted-foreground">In</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-primary">{totalPar}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleBack}>
                Back
              </Button>
              <Button className="flex-1" onClick={handleAdd} disabled={isAdding}>
                {isAdding ? 'Adding...' : 'Add Course'}
              </Button>
            </div>
          </div>
        )}
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

interface EditCourseDialogProps {
  courseId: string | null
  onOpenChange: (open: boolean) => void
}

function EditCourseDialog({ courseId, onOpenChange }: EditCourseDialogProps) {
  const [holePars, setHolePars] = useState<number[]>(Array(18).fill(4))
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const course = useLiveQuery(
    () => courseId ? db.courses.get(courseId) : undefined,
    [courseId]
  )

  const holes = useLiveQuery(
    async () => {
      if (!courseId) return []
      return db.holes
        .where('course_id')
        .equals(courseId)
        .sortBy('hole_number')
    },
    [courseId]
  )

  // Load hole pars when holes data changes
  useState(() => {
    if (holes && holes.length > 0) {
      const pars = Array(18).fill(4)
      holes.forEach(h => {
        if (h.hole_number >= 1 && h.hole_number <= 18) {
          pars[h.hole_number - 1] = h.par
        }
      })
      setHolePars(pars)
      setHasChanges(false)
    }
  })

  // Update holePars when holes load
  if (holes && holes.length > 0) {
    const storedPars = holePars
    const needsUpdate = holes.some((h) => {
      const idx = h.hole_number - 1
      return storedPars[idx] !== h.par
    })
    if (needsUpdate && !hasChanges) {
      const pars = Array(18).fill(4)
      holes.forEach(h => {
        if (h.hole_number >= 1 && h.hole_number <= 18) {
          pars[h.hole_number - 1] = h.par
        }
      })
      setHolePars(pars)
    }
  }

  const totalPar = holePars.reduce((sum, p) => sum + p, 0)
  const frontNine = holePars.slice(0, 9).reduce((sum, p) => sum + p, 0)
  const backNine = holePars.slice(9).reduce((sum, p) => sum + p, 0)

  const updateHolePar = (index: number, par: number) => {
    const newPars = [...holePars]
    newPars[index] = Math.max(3, Math.min(6, par))
    setHolePars(newPars)
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (!courseId || !holes) return

    setIsSaving(true)

    try {
      // Update course total par
      if (isSupabaseConfigured()) {
        await supabase
          .from('courses')
          .update({ par: totalPar })
          .eq('id', courseId)
      }
      await db.courses.update(courseId, { par: totalPar })

      // Update each hole
      for (const hole of holes) {
        const newPar = holePars[hole.hole_number - 1]
        if (hole.par !== newPar) {
          if (isSupabaseConfigured()) {
            await supabase
              .from('holes')
              .update({ par: newPar })
              .eq('id', hole.id)
          }
          await db.holes.update(hole.id, { par: newPar })
        }
      }

      setHasChanges(false)
      onOpenChange(false)
    } catch (err) {
      console.error('Error saving course:', err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={!!courseId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{course?.name || 'Edit Course'}</DialogTitle>
          <DialogDescription>
            Edit hole pars - Total Par: {totalPar}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Front Nine */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Front Nine</Label>
              <span className="text-sm text-muted-foreground">Par {frontNine}</span>
            </div>
            <div className="grid grid-cols-9 gap-1">
              {holePars.slice(0, 9).map((par, i) => (
                <div key={i} className="flex flex-col items-center">
                  <span className="text-[10px] text-muted-foreground mb-1">{i + 1}</span>
                  <select
                    value={par}
                    onChange={(e) => updateHolePar(i, parseInt(e.target.value))}
                    className="w-full h-10 text-center text-sm font-medium border rounded-md bg-background"
                  >
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                    <option value={6}>6</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Back Nine */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Back Nine</Label>
              <span className="text-sm text-muted-foreground">Par {backNine}</span>
            </div>
            <div className="grid grid-cols-9 gap-1">
              {holePars.slice(9).map((par, i) => (
                <div key={i + 9} className="flex flex-col items-center">
                  <span className="text-[10px] text-muted-foreground mb-1">{i + 10}</span>
                  <select
                    value={par}
                    onChange={(e) => updateHolePar(i + 9, parseInt(e.target.value))}
                    className="w-full h-10 text-center text-sm font-medium border rounded-md bg-background"
                  >
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                    <option value={6}>6</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="flex items-center justify-center gap-4 py-2 bg-muted rounded-lg">
            <div className="text-center">
              <div className="text-lg font-bold">{frontNine}</div>
              <div className="text-xs text-muted-foreground">Out</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold">{backNine}</div>
              <div className="text-xs text-muted-foreground">In</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-primary">{totalPar}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </div>

          <Button
            className="w-full"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
          >
            {isSaving ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
