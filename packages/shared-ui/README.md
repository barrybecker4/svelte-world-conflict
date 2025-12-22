# Shared UI Components

A collection of reusable Svelte 5 UI components shared across all games in this monorepo.

## 🎨 Components

### UI Components

- **Button** - Versatile button with variants (primary, secondary, danger, success, ghost) and sizes
- **IconButton** - Round icon button for actions and controls
- **Modal** - Feature-rich modal dialog with header, footer, and close handling
- **Panel** - Container component with variants (default, dark, glass, error, success)
- **Section** - Section component with optional title, subtitle, and action slots
- **Spinner** - Loading spinner with size and color variants
- **LoadingState** - Combined loading/error state component
- **ConnectionStatus** - Live connection indicator
- **StatDisplay** - Reusable stat display for game statistics
- **Tooltip** - Positioned tooltip with click-to-dismiss

### Chart Components

- **LineChart** - Interactive line chart with Chart.js integration, custom legend, and hover effects

### Audio Components

- **AudioButton** - Toggle button for audio on/off with test sound
- **SoundTestModal** - Modal for testing all game sounds

## 📦 Installation

This package is part of the monorepo and is automatically available to all game packages through npm workspaces.

## 🚀 Usage

Import components from the shared-ui package:

```typescript
import { Button, Modal, Spinner, LineChart } from 'shared-ui';
```

Import types:

```typescript
import type { Dataset, AudioSystem, SoundItem } from 'shared-ui';
```

### Example: Button

```svelte
<script>
  import { Button } from 'shared-ui';
</script>

<Button variant="primary" size="md" on:click={() => console.log('Clicked!')}>
  Click Me
</Button>
```

### Example: Modal

```svelte
<script>
  import { Modal, Button } from 'shared-ui';
  let isOpen = $state(false);
</script>

<Modal {isOpen} title="My Modal" on:close={() => isOpen = false}>
  <p>Modal content here</p>
  
  <svelte:fragment slot="footer">
    <Button variant="primary" on:click={() => isOpen = false}>
      Close
    </Button>
  </svelte:fragment>
</Modal>
```

### Example: LineChart

```svelte
<script>
  import { LineChart } from 'shared-ui';
  import type { Dataset } from 'shared-ui';
  
  const datasets: Dataset[] = [
    { label: 'Series 1', data: [1, 2, 3, 4], color: '#3b82f6' },
    { label: 'Series 2', data: [2, 3, 4, 5], color: '#22c55e' }
  ];
</script>

<LineChart
  title="My Chart"
  labels={['Jan', 'Feb', 'Mar', 'Apr']}
  {datasets}
  height="250px"
/>
```

### Example: AudioButton

```svelte
<script>
  import { AudioButton } from 'shared-ui';
  import { audioSystem } from '$lib/client/audio/AudioSystem';
  import { SOUNDS } from '$lib/client/audio/sounds';
</script>

<AudioButton {audioSystem} testSound={SOUNDS.CLICK} />
```

## 🏗️ Architecture

### Source-Level Sharing

This package uses **source-level sharing** - components are NOT pre-built. Instead:

1. Each game package imports `.svelte` files directly via Vite aliases
2. Components are compiled as part of each game's build process
3. No separate build step required for shared-ui

**Benefits:**
- Simpler development workflow (no watch/rebuild needed)
- Hot module replacement works across packages
- No build artifacts to manage
- Game-specific optimizations applied during game builds

### TypeScript Support

The package includes `ambient.d.ts` for proper TypeScript support with `.svelte` file imports.

## 🎯 Design Principles

1. **Composable** - Components are designed to work together
2. **Flexible** - Props and slots for customization
3. **Consistent** - Shared styling patterns across all games
4. **Type-Safe** - Full TypeScript support with exported types
5. **Accessible** - Proper ARIA attributes and keyboard support

## 🔧 Development

### Type Checking

Run type checking for the shared-ui package:

```bash
cd packages/shared-ui
npm run check
```

### Adding New Components

1. Create your component in `src/components/` (organized by category)
2. Export it from `src/index.ts`
3. Update this README with usage examples
4. Test in both game packages

### Component Guidelines

- Use Svelte 5 runes syntax (`$state`, `$props`, `$derived`)
- Export TypeScript interfaces for props
- Include proper TypeScript types
- Use CSS custom properties for theming where appropriate
- Follow existing naming conventions

## 📝 Available Exports

### Components
```typescript
// UI
Button, IconButton, Modal, Panel, Section, Spinner, 
LoadingState, ConnectionStatus, StatDisplay, Tooltip

// Charts
LineChart

// Audio
AudioButton, SoundTestModal
```

### Types
```typescript
Dataset, AudioSystem, SoundItem
```

## 🤝 Contributing

When adding new shared components:

1. Ensure they're truly reusable across games
2. Keep game-specific logic in the game packages
3. Document props and usage examples
4. Test in multiple games before committing

## 📄 License

MIT - Part of the Svelte Multiplayer Games Monorepo

