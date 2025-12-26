/**
 * Planet Name Generator - Generates unique planet names
 */

const PLANET_PREFIXES = [
    'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
    'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi',
    'Rho', 'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega'
];

const PLANET_SUFFIXES = [
    'Prime', 'Major', 'Minor', 'Proxima', 'Centauri', 'Nova', 'Stella',
    'Astra', 'Cosmo', 'Nebula', 'Vega', 'Orion', 'Lyra', 'Cygnus'
];

/**
 * Generate a random planet name
 */
export function generatePlanetName(index: number): string {
    const prefix = PLANET_PREFIXES[index % PLANET_PREFIXES.length];
    const suffix = PLANET_SUFFIXES[Math.floor(index / PLANET_PREFIXES.length) % PLANET_SUFFIXES.length];
    const number = Math.floor(index / (PLANET_PREFIXES.length * PLANET_SUFFIXES.length));

    if (number > 0) {
        return `${prefix} ${suffix} ${number + 1}`;
    }
    return `${prefix} ${suffix}`;
}
