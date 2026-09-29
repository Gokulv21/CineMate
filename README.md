# 🎬 CineMate

> **Watch together. Wherever you are.**

**CineMate** is a private, real-time "watch together" web application designed for people who are physically in different locations. 

Whether one user is in Tokyo and another in London, **CineMate** lets both viewers enjoy movie night in sync with synchronized playback, crystal-clear WebRTC voice chat, text chat, live floating reactions, and complete privacy.

---

## 🎬 The Core Principle: Zero Video Uploads

Traditional watch parties require uploading gigabytes of copyrighted video files or streaming through heavy screen-shares with stuttering and compression.

**CineMate does not upload, store, process, or redistribute video files.**

```
                 CINEMATE CINEMA ROOM

User A (Browser)                   User B (Browser)
      │                                  │
      │ local video                      │ local video
      │ (URL.createObjectURL)            │ (URL.createObjectURL)
      │                                  │
      └──────── WebSocket Server ────────┘
                 │
      • Room Creation & Joining
      • Sub-second Playback Sync
      • Text Chat & Reactions
      • WebRTC Audio Signaling
```

Both users select their own local copy of the same video file (e.g. `Movie.mp4`). Playback timestamps, play/pause commands, and seeks are synchronized over lightweight WebSocket messages, while voice communication runs over direct peer-to-peer WebRTC audio.

---

## ✨ Features

- **Sub-Second Playback Synchronization**:
  - Synchronizes native `<video>` elements using timestamps and server clock offsets.
  - Automatic drift correction: minor latency differences (0.25s–1.0s) smoothly adjust playback speed without stuttering; larger offsets (> 1.0s) seamlessly seek to lockstep.
  - Cyclic loop protection (`isRemoteUpdate` isolation) prevents endless echo events.
- **Custom Dark Cinema UI**:
  - Tailored cinema-inspired aesthetic (dark charcoal, soft rose crimson accents, Inter & Noto Sans typography).
  - Hover timeline scrubber with floating timestamp previews, playback speed selector (0.5x to 2.0x), Picture-in-Picture, and fullscreen mode.
- **Video Duration Matching**:
  - Exchanges video duration and file metadata across viewers.
  - Displays an intuitive warning banner if video versions or cuts differ by more than 3 seconds, with the option to proceed anyway.
- **Peer-to-Peer Voice Chat (WebRTC)**:
  - Low-latency WebRTC mesh with STUN server configuration.
  - Web Audio API `AnalyserNode` speech detection with glowing speaking visualizer rings.
  - One-click mute/unmute and graceful fallback if microphone access is unavailable.
- **Real-Time Text Chat & Quick Reactions**:
  - Live chat stream supporting text, system announcements, and timestamps.
  - One-click quick emoji reaction bar (`❤️`, `😂`, `😭`, `😱`, `🔥`, `👏`).
  - Floating animated reaction bursts soaring across the movie screen.
- **Host Permissions & Room Settings**:
  - Room creator is designated as Host.
  - Switch playback controls between **"Host only"** and **"Everyone"**.
  - Toggles for Auto-sync latency correction, Voice chat, Text chat, and Floating reactions.
- **Internationalization (i18n)**:
  - Full translations for **English**, **Japanese (日本語)**, and **Tamil (தமிழ்)**.
  - Persistent language selection in `localStorage`.
- **Mobile Responsive Design**:
  - Priority cinema viewport with touch-friendly controls.
  - Segmented tab bar switching between Video, Chat, and Voice panels on smaller screens.

---

## 🛠️ Technology Stack

### Client
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS + Custom Cinema Design Tokens
- **Icons**: Lucide React
- **Internationalization**: `i18next` + `react-i18next`
- **Video**: Native `HTMLVideoElement` + Browser File API (`URL.createObjectURL`)
- **Voice**: WebRTC `RTCPeerConnection` + Web Audio API (`AudioContext`, `AnalyserNode`)

### Server
- **Runtime**: Node.js + TypeScript
- **HTTP**: Express
- **Real-Time**: `ws` (WebSocket)
- **Signaling**: WebRTC SDP offer/answer & ICE candidate routing
- **Storage**: In-memory room and presence manager (with automatic 30-minute stale room cleanup)

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (tested on Node v20/v22/v26)
- npm 9+

### 1. Clone & Install Dependencies

From the repository root:
```bash
# Install root orchestrator dependencies
npm install

# Install server dependencies
npm --prefix server install

# Install client dependencies
npm --prefix client install
```

### 2. Configure Environment

Copy `.env.example` to `.env` in the root:
```bash
cp .env.example .env
```

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `4000` | HTTP and WebSocket server port |
| `CLIENT_URL` | `http://localhost:3000` | Allowed CORS origin for the client |
| `VITE_API_URL` | `http://localhost:4000` | Client target for REST requests |
| `VITE_WS_URL` | `ws://localhost:4000/ws` | Client target for WebSocket connection |
| `VITE_STUN_URL` | `stun:stun.l.google.com:19302` | STUN servers for WebRTC audio |

### 3. Run in Development Mode

Run both the server and client concurrently:
```bash
npm run dev
```

Or run them individually in separate terminals:
```bash
# Terminal 1: Backend API & WebSocket (port 4000)
npm run dev:server

# Terminal 2: Frontend Vite App (port 3000)
npm run dev:client
```

Open your browser at:
```
http://localhost:3000
```

---

## 🧪 Testing

Run backend room management and real-time WebSocket synchronization tests:
```bash
npm run test
```

Or run directly in the server folder:
```bash
npm --prefix server test
```

---

## 📦 Production Build

```bash
# Build both server and client bundles
npm run build

# Start production server
npm start
```
The server will automatically serve the built client from `client/dist` on port `4000`.

---

## 🔒 Privacy Architecture

1. **Local File Object URLs**: Video files selected via `<input type="file" />` are read directly in memory by the browser using `URL.createObjectURL(file)`.
2. **Zero Media Traffic on Server**: Video stream bytes are never sent to Express, WebSocket, or any remote server.
3. **Metadata Only**: The WebSocket connection only exchanges lightweight metadata (`fileName`, `duration`, `size`) solely to verify file compatibility between viewers.
4. **Direct Audio Mesh**: WebRTC voice audio travels directly between peers using STUN; voice packets are never proxied through the WebSocket server.

---

## ⚠️ Known Limitations for MVP

- **In-Memory Storage**: Rooms, chat history, and playback states exist in server RAM. Restarting the server destroys active rooms.
- **TURN Server**: Development uses Google's public STUN servers. If both users are behind restrictive symmetric NATs, a TURN server (e.g. coturn) can be configured via `VITE_STUN_URL`.
- **Matching Video Files**: Both users must have access to their own local video file cut with compatible durations.
