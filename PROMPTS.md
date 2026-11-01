# Prompts used (edit these to match what you actually typed, then paste the AI's key answers under each one)

## Prompt 1: Plan before coding
Act as a senior frontend developer with backend experience. Before writing any code, plan a 3D browser game website called "Ghost Lantern":
a first-person escape-room game in Three.js where the player explores a haunted house with a torch, collects diamonds and a key, banishes
ghosts with raycasting, then escapes through a portal to a second level. Include login/signup with email OTP verification, a player stats
dashboard and a leaderboard. Give me: tech stack, folder structure, database schema, API endpoints, security plan (hashed passwords and OTPs,
input validation and sanitization, rate limiting), page list, and a time-boxed build order for 5 hours. Do not write code yet.

## Prompt 2: Shell, app structure, responsiveness
Create the project shell from the plan: Express server, Postgres connection with auto-created tables, static frontend with pages
index.html (auth), dashboard.html and game.html, and one shared neon haunted-house stylesheet. Make every page responsive (mobile first,
no sideways scrolling, tables scroll inside their own container) and keyboard accessible. No game logic yet.

## Prompt 3: Authentication and security
Add signup, email OTP verification (6 digits, 10 minutes, 5 attempts, stored hashed), login, logout and a JWT in an httpOnly cookie.
Hash passwords with bcrypt. Validate every input with zod on the server and mirror the rules on the client (username letters/numbers/underscore
only, numeric-only OTP field, valid email, password rules). Escape HTML characters before storing text. Add rate limiting: strict on login,
signup, verify and resend, looser on the rest of the API. Do not reveal whether an email exists.

## Prompt 4: 3D scene / game
Build the first-person 3D game in Three.js: a house generated from a text grid map (rooms, hallways, collision), dark fog, a spotlight torch
attached to the camera, WASD and mouse look, diamonds and a key to collect, a back door that opens after everything is collected, and a
sci-fi portal that pulls the player into level 2, a glowing forest. Add synthesized sound with the Web Audio API (no downloaded files).

## Prompt 5: Raycasting (interaction)
Add raycasting from the screen centre so the torch beam can banish ghosts: a ray tests invisible hit spheres around each ghost, damages the
targeted ghost while the beam button is held, drains the battery, and hurts the player if a friendly ghost is targeted.

## Prompt 6: Game state and rules
Define the rules: 100 health with no regeneration; four ghost types (tall, fast, horrific, friendly) that spawn out of sight and chase the
player; scoring (100 per diamond, 150 per key, 25 per ghost, time bonus on escape); win by escaping both levels; lose at 0 health. Increase
difficulty over time and in level 2. Send the final run to the server, which rejects impossible scores.

## Prompt 7: Player stats dashboard
Build the dashboard: stat cards (games, best score, average, ghosts banished, diamonds, escapes), a table of the last 10 runs and a global
top-10 leaderboard. Render all database values with textContent so nothing can be injected as HTML.

## Prompt 8: Testing and debugging
Review the whole app for bugs and security holes. List test cases and run through them: invalid inputs, XSS payloads in username, wrong and
expired OTP, 6th OTP attempt, rate-limit trips, tampered score POST, calling the API without a cookie, window resize, losing pointer lock.
Fix everything you find.

## Prompt 9: Explain the app (answer to paste into your report)
Ghost Lantern is a full-stack 3D browser game. The frontend is vanilla JavaScript with Three.js: a first-person escape room where the player
walks through a grid-based haunted house with a spotlight torch, collects diamonds and a key, and uses raycasting from the screen centre to
banish ghosts that spawn out of sight and chase them. When everything is collected the back door opens into a sci-fi portal that carries the
player to a second, harder forest level. Scoring, health, battery and ghost behaviour form the game state, and sound is synthesized live with the
Web Audio API.

The backend is Node and Express with PostgreSQL. Users sign up with a username, email and password, verify with a six-digit emailed code, and
stay logged in through an httpOnly JWT cookie. Passwords are hashed with bcrypt and OTPs are stored only as HMAC hashes. Inputs are validated
with zod on the server and filtered on the client, text is escaped before storage and rendered with textContent, and rate limiting protects
login, signup, verification and resend. After each run the game posts its result, the server rejects scores the rules cannot produce, and the
dashboard shows each player's stats, recent runs and the global leaderboard.
