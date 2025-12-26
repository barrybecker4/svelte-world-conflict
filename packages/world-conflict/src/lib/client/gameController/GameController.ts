import { get } from 'svelte/store';
import { audioSystem } from '$lib/client/audio/AudioSystem';
import type { Player, GameStateData } from '$lib/game/entities/gameTypes';
import { useGameWebSocket } from '$lib/client/composables/useGameWebsocket';
import { ModalManager } from './ModalManager';
import { GameApiClient } from './GameApiClient';
import { UndoManager } from './UndoManager';
import { MoveQueue } from './MoveQueue';
import { LocalMoveExecutor } from './LocalMoveExecutor';
import { TutorialCoordinator } from './TutorialCoordinator';
import { TurnTimerCoordinator } from './TurnTimerCoordinator';
import { BattleCoordinator } from './BattleCoordinator';
import { MoveUICoordinator } from './MoveUICoordinator';
import { GameEndCoordinator } from './GameEndCoordinator';
import { GameState } from '$lib/game/state/GameState';
import { BuildCommand } from '$lib/game/commands/BuildCommand';
import { CommandProcessor } from '$lib/game/commands/CommandProcessor';

/**
 * Single controller that manages all game logic
 * The component just renders based on this controller's state
 */
export class GameController {
    // Managers
    private modalManager: ModalManager;
    private apiClient: GameApiClient;
    private websocket: ReturnType<typeof useGameWebSocket>;
    private gameStore: any;
    private undoManager: UndoManager;
    private moveQueue: MoveQueue;
    private localExecutor: LocalMoveExecutor;

    // Coordinators
    private tutorialCoordinator: TutorialCoordinator;
    private turnTimerCoordinator: TurnTimerCoordinator;
    private battleCoordinator: BattleCoordinator;
    private moveUICoordinator: MoveUICoordinator;
    private gameEndCoordinator: GameEndCoordinator;

    // State
    private lastTurnNumber: number = -1;
    private readonly playerSlotIndex: number;
    private boundBattleStateHandler: ((event: Event) => void) | null = null;
    private pendingEndTurn: boolean = false;
    private battleProgressUnsubscribe: (() => void) | null = null;

    constructor(
        private gameId: string,
        private playerId: string,
        gameStore: any
    ) {
        this.gameStore = gameStore;
        this.playerSlotIndex = parseInt(playerId);

        // Initialize managers
        this.modalManager = new ModalManager();
        this.apiClient = new GameApiClient(gameId);
        this.undoManager = new UndoManager();
        this.moveQueue = new MoveQueue();
        this.localExecutor = new LocalMoveExecutor();

        // Initialize coordinators
        this.tutorialCoordinator = new TutorialCoordinator(playerId);
        this.turnTimerCoordinator = new TurnTimerCoordinator(playerId, () => this.endTurn());
        this.battleCoordinator = new BattleCoordinator(playerId, gameStore, this.undoManager, this.moveQueue);
        this.moveUICoordinator = new MoveUICoordinator(gameStore, this.modalManager);
        this.gameEndCoordinator = new GameEndCoordinator(
            gameId,
            playerId,
            this.modalManager,
            this.turnTimerCoordinator,
            updater => gameStore.gameState.update(updater)
        );

        this.websocket = useGameWebSocket(
            gameId,
            gameData => {
                this.handleWebSocketUpdate(gameData);
            },
            playerId
        );

        gameStore.setOnTurnReadyCallback((gameState: GameStateData) => {
            this.turnTimerCoordinator.handleTurnChange(gameState);
        });
    }

    /**
     * Handle incoming WebSocket game state updates
     */
    private handleWebSocketUpdate(gameData: any): void {
        if (gameData.turnNumber !== undefined && gameData.turnNumber !== this.lastTurnNumber) {
            this.lastTurnNumber = gameData.turnNumber;
            this.undoManager.reset();
            this.moveQueue.clear();
        }
        this.gameStore.handleGameStateUpdate(gameData);
        this.updateTooltips();
    }

    /**
     * Initialize the game - call this from onMount
     */
    async initialize(mapContainer: HTMLElement | undefined): Promise<void> {
        this.setupBattleAnimations(mapContainer);
        const initialGameState = await this.initializeGameStore();
        await this.initializeServices();
        this.setupBattleStateListener();
        this.startInitialTurn(initialGameState);
    }

    /**
     * Set up battle animation system with the map container
     */
    private setupBattleAnimations(mapContainer: HTMLElement | undefined): void {
        if (mapContainer) {
            this.battleCoordinator.setMapContainer(mapContainer);
            const battleAnimationSystem = this.battleCoordinator.getBattleAnimationSystem();
            this.gameStore.setBattleAnimationSystem(battleAnimationSystem);
        }
    }

    /**
     * Initialize game store with callbacks
     */
    private async initializeGameStore(): Promise<GameStateData | null> {
        const { gameState: initialGameState } = await this.gameStore.initializeGame(
            (source: number, target: number, count: number) =>
                this.battleCoordinator.handleMoveComplete(source, target, count, () => this.updateTooltips()),
            (newState: any) => this.moveUICoordinator.handleMoveStateChange(newState, () => this.updateTooltips())
        );

        this.gameStore.setIsBattleInProgressCallback(() => this.battleCoordinator.isBattleInProgress());
        this.gameStore.setTriggerAiProcessingCallback(() => this.triggerAiProcessing());

        return initialGameState;
    }

    /**
     * Initialize WebSocket and audio services
     */
    private async initializeServices(): Promise<void> {
        await this.websocket.initialize();
        await audioSystem.enable();
    }

    /**
     * Set up battle state update listener for animations
     */
    private setupBattleStateListener(): void {
        if (typeof window === 'undefined') return;

        this.boundBattleStateHandler = ((event: CustomEvent) => {
            const animationState = event.detail.gameState;
            this.gameStore.gameState.set(animationState);
        }) as EventListener;

        window.addEventListener('battleStateUpdate', this.boundBattleStateHandler);
    }

    /**
     * Start the initial turn (timer, tooltips, AI processing)
     */
    private startInitialTurn(initialGameState: GameStateData | null): void {
        if (!initialGameState) return;

        this.turnTimerCoordinator.handleTurnChange(initialGameState);
        this.lastTurnNumber = initialGameState.turnNumber || 0;
        this.updateTooltips();

        // Trigger AI processing if current player is AI
        const currentPlayer = initialGameState.players?.find(
            (p: any) => p.slotIndex === initialGameState.currentPlayerSlot
        );
        if (currentPlayer?.isAI) {
            this.triggerAiProcessing();
        }
    }

    /**
     * Trigger AI turn processing on the server
     */
    private async triggerAiProcessing(): Promise<void> {
        try {
            await this.apiClient.triggerAiProcessing();
        } catch (error) {
            console.error('Error triggering AI processing:', error);
        }
    }

    /**
     * Set the map container for battle animations (can be called after initialization)
     */
    setMapContainer(container: HTMLElement): void {
        this.battleCoordinator.setMapContainer(container);
        const battleAnimationSystem = this.battleCoordinator.getBattleAnimationSystem();
        this.gameStore.setBattleAnimationSystem(battleAnimationSystem);
    }

    /**
     * Cleanup - call this from onDestroy
     */
    destroy(): void {
        this.turnTimerCoordinator.stopTimer();
        this.battleCoordinator.destroy();
        this.websocket.cleanup();
        this.gameStore.resetTurnManager();

        // Clean up battle progress subscription
        if (this.battleProgressUnsubscribe) {
            this.battleProgressUnsubscribe();
            this.battleProgressUnsubscribe = null;
        }
        this.pendingEndTurn = false;

        if (this.boundBattleStateHandler && typeof window !== 'undefined') {
            window.removeEventListener('battleStateUpdate', this.boundBattleStateHandler);
        }
    }

    /**
     * Check for game end
     */
    checkGameEnd(gameState: GameStateData | null, players: Player[]): void {
        this.gameEndCoordinator.checkGameEnd(gameState, players);
    }

    // Move UI delegation methods
    handleRegionClick(region: any, isMyTurn: boolean): void {
        this.moveUICoordinator.handleRegionClick(region, isMyTurn);
    }

    handleTempleClick(regionIndex: number, isMyTurn: boolean): void {
        this.moveUICoordinator.handleTempleClick(regionIndex, isMyTurn);
    }

    handleSoldierCountChange(count: number): void {
        this.moveUICoordinator.handleSoldierCountChange(count);
    }

    confirmSoldierSelection(count: number): void {
        this.moveUICoordinator.confirmSoldierSelection(count);
    }

    cancelSoldierSelection(): void {
        this.moveUICoordinator.cancelSoldierSelection();
    }

    closeTempleUpgradePanel(): void {
        this.moveUICoordinator.closeTempleUpgradePanel();
    }

    /**
     * Purchase temple upgrade (execute locally and queue for server)
     */
    async purchaseUpgrade(regionIndex: number, upgradeIndex: number): Promise<void> {
        const gameState = get(this.gameStore.gameState) as GameStateData | null;
        if (!gameState) return;

        try {
            this.undoManager.saveState(gameState, this.playerSlotIndex);

            const gameStateObj = new GameState(gameState);
            const player = gameStateObj.getPlayerBySlotIndex(this.playerSlotIndex);
            if (!player) {
                throw new Error(`Player not found: ${this.playerSlotIndex}`);
            }

            const command = new BuildCommand(gameStateObj, player, regionIndex, upgradeIndex);
            const processor = new CommandProcessor();
            const result = processor.process(command);

            if (!result.success) {
                throw new Error(result.error || 'Build command failed');
            }

            const newGameStateData = result.newState!.toJSON();
            this.gameStore.handleGameStateUpdate(newGameStateData);

            this.moveQueue.push({
                type: 'BUILD',
                regionIndex,
                upgradeIndex
            });

            this.undoManager.disableUndo();
        } catch (error) {
            console.error('Purchase upgrade error:', error);
            alert('Error purchasing upgrade: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    /**
     * End turn - send all queued moves to server
     * If a battle is in progress, defer until it completes
     */
    async endTurn(): Promise<void> {
        // If battle in progress, defer until it completes
        if (this.battleCoordinator.isBattleInProgress()) {
            this.pendingEndTurn = true;
            this.subscribeToWaitForBattleCompletion();
            return;
        }

        await this.executeEndTurn();
    }

    /**
     * Subscribe to battle progress store and execute end turn when battle completes
     */
    private subscribeToWaitForBattleCompletion(): void {
        // Clean up any existing subscription
        if (this.battleProgressUnsubscribe) {
            this.battleProgressUnsubscribe();
        }

        const battleInProgressStore = this.battleCoordinator.getBattleInProgressStore();
        this.battleProgressUnsubscribe = battleInProgressStore.subscribe(inProgress => {
            if (!inProgress && this.pendingEndTurn) {
                this.pendingEndTurn = false;

                // Clean up subscription
                if (this.battleProgressUnsubscribe) {
                    this.battleProgressUnsubscribe();
                    this.battleProgressUnsubscribe = null;
                }

                // Execute the deferred end turn
                this.executeEndTurn();
            }
        });
    }

    /**
     * Execute the actual end turn logic
     */
    private async executeEndTurn(): Promise<void> {
        this.turnTimerCoordinator.stopTimer();

        try {
            const queuedMoves = this.moveQueue.getAll();
            await this.apiClient.endTurn(this.playerId, queuedMoves);
            this.moveQueue.clear();
            this.moveUICoordinator.resetMoveState();
        } catch (error) {
            console.error('End turn error:', error);
            alert('Failed to end turn: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    /**
     * Undo the last move (client-side only until turn ends)
     */
    async undo(): Promise<void> {
        const gameState = get(this.gameStore.gameState) as GameStateData | null;

        if (!this.undoManager.canUndo(gameState, this.playerSlotIndex)) {
            return;
        }

        const previousState = this.undoManager.undo();
        if (!previousState) return;

        this.moveQueue.pop();
        this.moveUICoordinator.resetMoveState(previousState.movesRemaining || 3);
        this.modalManager.hideSoldierSelection();
        this.gameStore.handleGameStateUpdate(previousState);

        const moveSystem = this.gameStore.getMoveSystem();
        if (moveSystem) {
            moveSystem.reset();
        }

        this.updateTooltips();
    }

    /**
     * Check if undo is currently available
     */
    canUndo(): boolean {
        const gameState = get(this.gameStore.gameState) as GameStateData | null;
        return this.undoManager.canUndo(gameState, this.playerSlotIndex);
    }

    showInstructions(): void {
        this.modalManager.showInstructions();
    }

    closeInstructions(): void {
        this.modalManager.closeInstructions();
    }

    /**
     * Resign from the game
     */
    async resign(): Promise<void> {
        if (!confirm('Are you sure you want to resign from this game?')) {
            return;
        }

        // Stop the timer immediately - resigned player becomes a spectator
        this.turnTimerCoordinator.stopTimer();

        try {
            await this.apiClient.resign(this.playerId);
            // Don't redirect - stay on the page to spectate or see game summary
            // The WebSocket update will trigger checkGameEnd() which will show
            // the game summary modal if the game has ended
        } catch (error) {
            console.error('Resign error:', error);
            alert('Failed to resign from game: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    /**
     * Update tutorial tooltips based on current game state
     */
    private updateTooltips(): void {
        const gameState = get(this.gameStore.gameState) as GameStateData | null;
        const regions = get(this.gameStore.regions) as any[];
        const currentMoveState = get(this.moveUICoordinator.getMoveStateStore());
        this.tutorialCoordinator.updateTooltips(gameState, regions, currentMoveState as any);
    }

    /**
     * Dismiss a tutorial tooltip
     */
    dismissTooltip(tooltipId: string): void {
        this.tutorialCoordinator.dismissTooltip(tooltipId);
        this.updateTooltips();
    }

    /**
     * Get stores for component binding
     */
    getStores() {
        return {
            modalState: this.modalManager.getModalState(),
            moveState: this.moveUICoordinator.getMoveStateStore(),
            isConnected: this.websocket.getConnectedStore(),
            tutorialTips: this.tutorialCoordinator.getTutorialTipsStore(),
            battleInProgress: this.battleCoordinator.getBattleInProgressStore()
        };
    }
}
