<script lang="ts">
  import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
  import { AI_DIFFICULTY_OPTIONS } from '$lib/game/entities/aiPersonalities';
  import type { GameConfiguration } from '$lib/client/stores/clientStorage';

  export let gameSettings: Omit<GameConfiguration, 'playerSlots'>;

  const difficultyOptions = AI_DIFFICULTY_OPTIONS;
  const mapSizeOptions = ['Small', 'Medium', 'Large'];
  const turnOptions = createTurnOptions();
  const timeLimitOptions = createTimeLimitOptions();

  // Turn options with labels and values
  function createTurnOptions() {
      const turnOptions: Array<{label: string, value: number}> = GAME_CONSTANTS.MAX_TURN_OPTIONS.map(v => ({label: `${v} Turns`, value: v }));
      turnOptions.push({ label: 'Endless', value: GAME_CONSTANTS.UNLIMITED_TURNS });
      return turnOptions;
  }

  // Time limit options with labels and values
  function createTimeLimitOptions() {
      return GAME_CONSTANTS.TIME_LIMITS.map(v => {
          if (v === GAME_CONSTANTS.UNLIMITED_TIME) {
              return { label: 'Unlimited', value: v };
          }
          return { label: `${v}s`, value: v };
      });
  }
</script>

<div class="settings-section">
  <div class="setting">
    <label for="ai-difficulty">AI Difficulty:</label>
    <select id="ai-difficulty" bind:value={gameSettings.aiDifficulty} data-testid="game-setting-aidifficulty">
      {#each difficultyOptions as difficulty}
        <option value={difficulty}>{difficulty}</option>
      {/each}
    </select>
  </div>

  <div class="setting">
    <label for="turns">Turns:</label>
    <select id="turns" bind:value={gameSettings.maxTurns} data-testid="game-setting-maxturns">
      {#each turnOptions as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  </div>

  <div class="setting">
    <label for="time-limit">Time Limit:</label>
    <select id="time-limit" bind:value={gameSettings.timeLimit} data-testid="game-setting-timelimit">
      {#each timeLimitOptions as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  </div>

  <div class="setting">
    <label for="map-size">Map Size:</label>
    <select id="map-size" bind:value={gameSettings.mapSize} data-testid="game-setting-mapsize">
      {#each mapSizeOptions as size}
        <option value={size}>{size}</option>
      {/each}
    </select>
  </div>
</div>

<style>
  .settings-section {
    margin-bottom: 12px;
  }

  .setting {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .setting label {
    font-weight: 500;
    color: #f8fafc;
  }

  .setting select {
    padding: 6px 10px;
    border: 1px solid #374151;
    border-radius: 4px;
    background: #374151;
    color: white;
    transition: border-color 0.2s ease;
    min-width: 80px;
  }

  .setting select:focus {
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
