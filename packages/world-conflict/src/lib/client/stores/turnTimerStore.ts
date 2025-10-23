import { writable } from 'svelte/store';
import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS } from '$lib/client/audio/sounds';

const WARNING_TIME = 10; // Start warning at 10 seconds

interface TimerState {
    timeRemaining: number;
    isRunning: boolean;
    shouldGlow: boolean;
}

function createTurnTimerStore() {
    const { subscribe, set, update } = writable<TimerState>({
        timeRemaining: 0,
        isRunning: false,
        shouldGlow: false
    });

    let intervalId: number | null = null;
    let onExpireCallback: (() => void) | null = null;

    function tick() {
        update(state => {
            if (!state.isRunning || state.timeRemaining <= 0) {
                return state;
            }

            const newTimeRemaining = state.timeRemaining - 1;

            // Play warning sound on every second when time is less than WARNING_TIME
            if (newTimeRemaining > 0 && newTimeRemaining < WARNING_TIME) {
                console.log(`⏰ Timer warning: ${newTimeRemaining} seconds remaining`);
                audioSystem.playSound(SOUNDS.ALMOST_OUT_OF_TIME);
            }

            // Handle timer expiration
            if (newTimeRemaining <= 0) {
                console.log('⏰ Timer expired!');
                audioSystem.playSound(SOUNDS.OUT_OF_TIME);
                
                // Clear the interval
                if (intervalId !== null) {
                    clearInterval(intervalId);
                    intervalId = null;
                }
                
                // Save the callback before clearing it
                const callbackToExecute = onExpireCallback;
                onExpireCallback = null;
                
                // Call the expiration callback
                if (callbackToExecute) {
                    console.log('⏰ Calling onExpire callback');
                    callbackToExecute();
                }
                
                return {
                    timeRemaining: 0,
                    isRunning: false,
                    shouldGlow: false
                };
            }

            // Trigger glow animation
            return {
                timeRemaining: newTimeRemaining,
                isRunning: true,
                shouldGlow: true
            };
        });

        // Reset glow after animation duration
        setTimeout(() => {
            update(state => ({ ...state, shouldGlow: false }));
        }, 300);
    }

    function startTimer(duration: number, onExpire: () => void) {
        console.log(`⏰ Starting turn timer: ${duration} seconds`);
        
        // Clear any existing timer
        if (intervalId !== null) {
            clearInterval(intervalId);
        }

        onExpireCallback = onExpire;

        set({
            timeRemaining: duration,
            isRunning: true,
            shouldGlow: false
        });

        // Start the countdown
        intervalId = window.setInterval(tick, 1000);
    }

    function stopTimer() {
        console.log('⏰ Stopping turn timer');
        
        if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
        }

        onExpireCallback = null;

        set({
            timeRemaining: 0,
            isRunning: false,
            shouldGlow: false
        });
    }

    return {
        subscribe,
        startTimer,
        stopTimer
    };
}

export const turnTimerStore = createTurnTimerStore();


