# svelte-world-conflict

A real-time multiplayer strategy game built with SvelteKit and Cloudflare infrastructure. This is a modernized port of the original World Conflict game from Google Apps Script to a scalable, real-time architecture.

## 🎮 Features

- **WebSocket connections** for real-time game updates
- **Durable Objects** for persistent connection state
- **Game-based routing** - each game gets its own Durable Object instance
- **Health monitoring** endpoint
- **Automatic reconnection** handling

## 🏗️ Architecture

- **Frontend**: SvelteKit app deployed on Cloudflare Pages
- **Real-time**: WebSocket Durable Objects for instant game updates
- **Storage**: Cloudflare KV for persistent game data
- **Backend**: Cloudflare Workers
- **Deployment**: Fully serverless on Cloudflare

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account (free tier works)

### Development Setup

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/your-username/svelte-world-conflict
   cd svelte-world-conflict
   npm install
   ```

2. **Install WebSocket worker dependencies:**
   ```bash
   cd web-socket-worker
   npm install
   cd ..
   ```

3. **Start development servers:**
   ```bash
   # Option A: Start everything together (recommended)
   npm run dev:full
   
   # Option B: Start services separately
   # Terminal 1: Start WebSocket worker
   npm run dev:websocket
   
   # Terminal 2: Start main app
   npm run dev
   ```

4. **Verify setup:**
    - Main app: [http://localhost:5173](http://localhost:5173)
    - WebSocket health: [http://localhost:8787/health](http://localhost:8787/health)

## 🛠️ Development

### Available Scripts

```

### WebSocket Development Modes

The WebSocket worker supports multiple development modes:

1. **Remote Development** (recommended)
   ```bash
   npm run dev:websocket
   ```
    - Uses actual Cloudflare edge
    - Fastest and most reliable
    - No local compatibility issues

2. **Hybrid Development** (fallback)
   ```bash
   npm run dev:websocket:hybrid
   ```
    - Minimal local simulation
    - Good for offline development

3. **Full Stack Development**
   ```bash
   npm run dev:full
   ```
    - Starts both WebSocket worker and main app
    - Perfect for end-to-end development

### Testing WebSocket Connection

Once both servers are running, test the WebSocket connection:

```javascript
// Open browser console at http://localhost:5173 and run:
const ws = new WebSocket('ws://localhost:8787/websocket?gameId=test');
ws.onopen = () => console.log('✅ WebSocket connected');
ws.onmessage = (event) => console.log('📨 Message:', JSON.parse(event.data));
ws.onerror = (err) => console.error('❌ WebSocket error:', err);

// Subscribe to game updates
ws.send(JSON.stringify({ type: 'subscribe', gameId: 'test' }));
```

## 🎮 How to Play

World Conflict is a strategic multiplayer game where players:

1. **Join or create** a multiplayer game
2. **Take turns** moving armies between connected regions
3. **Attack opponents** to expand your territory
4. **Build temples** and upgrades to strengthen your position
5. **Win by elimination** or controlling the most territory

## 🚀 Deployment

### Deploy to Cloudflare

1. **Deploy WebSocket worker:**
   ```bash
   npm run websocket:deploy
   ```

2. **Deploy main application:**
   ```bash
   npm run deploy
   ```

3. **Set up KV namespaces** in Cloudflare dashboard and update `wrangler.toml`

### Environment Variables

Update `wrangler.toml` with your Cloudflare settings:
- KV namespace IDs
- WebSocket worker name
- Custom domain (optional)

## 🔧 Troubleshooting

### WebSocket Issues

1. **Check worker health:**
   ```bash
   npm run websocket:health
   ```

2. **View worker logs:**
   ```bash
   npm run websocket:tail
   ```

3. **Try different development modes:**
   ```bash
   npm run dev:websocket:hybrid
   ```

### Common Issues

- **Port conflicts**: Change ports in `wrangler.toml` if 8787 is in use
- **Module errors**: Use remote development mode (`npm run dev:websocket`)
- **Connection timeouts**: Check firewall settings for port 8787

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with `npm run dev:full`
5. Submit a pull request

## 📝 License

MIT License - feel free to use this project as a starting point for your own multiplayer games!