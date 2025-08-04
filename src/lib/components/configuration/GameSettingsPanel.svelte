<script lang="ts">
  export let gameSettings;

  const difficultyOptions = ['Nice', 'Normal', 'Hard'];
  const mapSizeOptions = ['Small', 'Medium', 'Large'];

  // Reactive updates to ensure parent component stays in sync
  $: if (gameSettings) {
    // Validate settings have valid values
    if (!difficultyOptions.includes(gameSettings.aiDifficulty)) {
      gameSettings.aiDifficulty = 'Nice';
    }
    if (!mapSizeOptions.includes(gameSettings.mapSize)) {
      gameSettings.mapSize = 'Large';
    }
  }
</script>

<div class="settings-section">
  <h3>Game Settings</h3>

  <div class="setting">
    <label for="ai-difficulty">AI Difficulty:</label>
    <select id="ai-difficulty" bind:value={gameSettings.aiDifficulty}>
      {#each difficultyOptions as difficulty}
        <option value={difficulty}>{difficulty}</option>
      {/each}
    </select>
  </div>

  <div class="setting">
    <label for="turns">Turns:</label>
    <input
      id="turns"
      type="number"
      min="5"
      max="50"
      bind:value={gameSettings.turns}
      class="number-input"
    />
  </div>

  <div class="setting">
    <label for="time-limit">Time Limit (sec):</label>
    <input
      id="time-limit"
      type="number"
      min="10"
      max="300"
      bind:value={gameSettings.timeLimit}
      class="number-input"
    />
  </div>

  <div class="setting">
    <label for="map-size">Map Size:</label>
    <select id="map-size" bind:value={gameSettings.mapSize}>
      {#each mapSizeOptions as size}
        <option value={size}>{size}</option>
      {/each}
    </select>
  </div>
</div>

<style>
  .settings-section {
    margin-bottom: 24px;
  }

  h3 {
    font-size: 20px;
    color: #f8fafc;
    margin-bottom: 8px;
  }

  .setting {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .setting label {
    font-weight: 500;
    color: #f8fafc;
  }

  .setting select, .number-input {
    padding: 6px 10px;
    border: 1px solid #374151;
    border-radius: 4px;
    background: #374151;
    color: white;
    transition: border-color 0.2s ease;
    min-width: 80px;
  }

  .setting select:focus, .number-input:focus {
    border-color: #60a5fa;
    outline: none;
  }

  .setting select option {
    background: #374151;
    color: white;
    padding: 8px;
  }

  .setting select:focus option {
    background: #374151;
    color: white;
  }

  .setting select option:checked {
    background: #60a5fa;
    color: white;
  }
</style>
