/**
 * ADSR envelope utilities for sound synthesis
 */

import type { EnvelopeParams } from './audioTypes';

/**
 * Calculate the total duration of an ADSR envelope
 */
export function getEnvelopeDuration(params: EnvelopeParams): number {
    return params.attackTime + params.decayTime + params.sustainTime + params.releaseTime;
}

/**
 * Calculate ADSR envelope value at a given time
 * @param localTime - Time since the note started
 * @param params - ADSR envelope parameters
 * @returns Envelope amplitude (0 to 1)
 */
export function calculateEnvelope(localTime: number, params: EnvelopeParams): number {
    const { attackTime, decayTime, sustainTime, releaseTime, sustainLevel } = params;

    if (localTime < attackTime) {
        // Attack phase: ramp up from 0 to 1
        return localTime / attackTime;
    }

    if (localTime < attackTime + decayTime) {
        // Decay phase: ramp down from 1 to sustain level
        const decayProgress = (localTime - attackTime) / decayTime;
        return 1 - (1 - sustainLevel) * decayProgress;
    }

    if (localTime < attackTime + decayTime + sustainTime) {
        // Sustain phase: hold at sustain level
        return sustainLevel;
    }

    // Release phase: ramp down from sustain level to 0
    const releaseProgress = (localTime - attackTime - decayTime - sustainTime) / releaseTime;
    return sustainLevel * Math.max(0, 1 - releaseProgress);
}

