# Life Skill Tree

A video-game-style skill tree for real-life skills. Log hours as XP, count songs/dishes/projects, track PRs, and watch your life clock.

Plain HTML/JS, no build step. Data lives in the browser (localStorage) and optionally syncs through Firebase.

## Files

- `index.html`: the app
- `icons.js`: bundled icons from [game-icons.net](https://game-icons.net) (CC BY 3.0)
- `sync.js`: cloud sync (Google sign-in + Firestore). Stays off until `firebase-config.js` has a config
- `firebase-config.js`: Firebase web config (public by design)
- `firestore.rules`: security rules so each user can only access their own save

## Running locally

Open `index.html` directly for local-only use. Sync needs the page served over http(s), e.g. `python3 -m http.server` then http://localhost:8000.
