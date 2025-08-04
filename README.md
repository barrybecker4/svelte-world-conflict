# svelte-world-conflict

A real-time multiplayer strategy game built with SvelteKit and Cloudflare infrastructure. This is a modernized port of the original World Conflict game from Google Apps Script to a scalable, real-time architecture.

## 🎮 Features

- ✅ Real-time multiplayer gameplay (up to 4 players)
- ✅ Strategic combat system inspired by Risk
- ✅ AI opponents with different personalities
- ✅ Persistent game state with Cloudflare KV
- ✅ Instant WebSocket updates
- ✅ Global CDN distribution
- ✅ Mobile-friendly interface

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

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Start local websocket server:**
   ```bash
   npm run dev
   ```
4**View in browser:**
   Open [http://localhost:5173](http://localhost:5173)

## 🛠️ Development

### Available Scripts

```bash
npm run dev                # Start development server
npm run build             # Build for production
npm run preview           # Preview production build
npm run test              # Run unit tests
npm run test:e2e          # Run end-to-end tests
npm run lint              # Lint code
npm run format            # Format code
npm run deploy            # Deploy to Cloudflare Pages
```

## 🎮 How to Play

World Conflict is a strategic multiplayer game where players:

1. **Conquer territories** by moving armies between regions
2. **Build up forces** to strengthen your position
3. **Attack opponents** to expand your territory
4. **Win by elimination** or controlling the most territory

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `npm run dev`
5. Submit a pull request

## 📝 License

MIT License - feel free to use this project as a starting point for your own multiplayer games!

## 🙏 Credits

- Original World Conflict game by Jakub Wasilewski
- Google Apps Script version by Barry Becker
- SvelteKit port and modernization by Barry Becker (with halp from Claude AI)

---

**🚧 Note**: This project is actively under development. The game is not yet playable but the foundation is being built incrementally.
