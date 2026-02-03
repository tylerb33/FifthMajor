# Fifth Major

*A tradition like any other*

A mobile-first golf tournament scoring app built for friends who take their annual golf tournament seriously (but not too seriously).

## Features

### Scoring
- **One-tap score entry** - Quick buttons for common scores (birdie through double bogey)
- **Swipe navigation** - Swipe left/right between holes
- **Auto-advance** - Automatically moves to next hole after entering a score
- **Haptic feedback** - Feel the tap when you enter a score
- **Celebration animations** - Confetti for eagles and birdies because you earned it
- **Live totals** - See your gross and net scores update in real-time

### Leaderboard
- **Real-time updates** - See scores as they're entered
- **Swipe to check** - Quickly swipe between scoring and leaderboard views
- **Net scoring** - Handicaps are factored in automatically
- **Multi-round support** - Track scores across multiple tournament rounds

### Tournament Management
- **Share codes** - Easy 6-character codes to join tournaments
- **Course setup** - Configure par for each hole
- **Player management** - Add players with handicaps
- **Admin controls** - PIN-protected admin features

### Offline-First
- **Works without internet** - Score your round even in spotty coverage
- **Auto-sync** - Scores sync when you're back online
- **Local storage** - All data stored locally on device

## Tech Stack

- **React 18** + TypeScript
- **Vite** for fast builds
- **Tailwind CSS** + shadcn/ui components
- **Dexie** (IndexedDB) for local storage
- **Supabase** for cloud sync (optional)
- **Zustand** for state management

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/tylerb33/FifthMajor.git
cd FifthMajor

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:5173`

### Environment Variables (Optional)

For cloud sync, create a `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Without Supabase configured, the app works fully offline with local storage.

## Usage

### Creating a Tournament

1. Open the app and tap "Create Tournament"
2. Enter tournament name and dates
3. Note your **share code** and **admin PIN**
4. Add courses with hole-by-hole par configuration
5. Create rounds and assign courses
6. Add players with their handicaps

### Joining a Tournament

1. Get the 6-character share code from the tournament admin
2. Enter the code on the home screen
3. Select your name from the player list
4. Start scoring!

### Scoring a Round

1. Select your round and player
2. Tap the score button that matches your strokes
3. Swipe left to go to the next hole (or it auto-advances)
4. Swipe right on the scoring page to check the leaderboard anytime

## Project Structure

```
src/
├── components/          # Shared UI components
│   ├── ui/             # shadcn/ui base components
│   ├── Celebration.tsx # Birdie/eagle animations
│   ├── Layout.tsx      # App shell with nav
│   └── SwipeableScoreView.tsx
├── features/
│   ├── leaderboard/    # Leaderboard views
│   ├── players/        # Player management
│   ├── scoring/        # Score entry components
│   └── tournament/     # Tournament setup
├── lib/
│   ├── db/            # Dexie database schema
│   ├── sync/          # Supabase sync manager
│   └── utils/         # Scoring calculations
├── stores/            # Zustand state stores
└── types/             # TypeScript types
```

## License

MIT

---

Built with caffeine and competitiveness for the Fifth Major Golf Tournament. Est. 2018.
