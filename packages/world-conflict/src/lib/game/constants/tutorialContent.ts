import { GAME_CONSTANTS } from './gameConstants';
import { SYMBOLS } from './symbols';

export interface TutorialCard {
  title: string;
  icon: string;
  content: string[];
}

/**
 * Tutorial cards content for the game instructions modal.
 * Separated for easier content management and localization.
 */
export const TUTORIAL_CARDS: TutorialCard[] = [
  {
    title: "How to win (1/5)",
    icon: "♛",
    content: [
      `The standard game lasts <strong>${GAME_CONSTANTS.STANDARD_MAX_TURNS} turns</strong>.`,
      "Once time runs out, <strong>whoever has most regions, wins</strong>.",
      "Your <strong>soldiers</strong> conquer and defend <strong>regions</strong>.",
      "Your <strong>temples</strong> make new soldiers and can be <strong>upgraded</strong> with faith.",
      `You get <strong>faith</strong>(${SYMBOLS.FAITH}) for regions and for soldiers praying at temples.`
    ]
  },
  {
    title: "Temples (2/5)",
    icon: "🏛️",
    content: [
      "Each player <strong>starts with one temple</strong> under their control.",
      "After your turn, each of your temples <strong>produces a new soldier</strong>.",
      "You can <strong>take over</strong> your enemies' temples.",
      "There are <strong>neutral temples</strong> that you can conquer.",
      "Temples can be imbued with <strong>elemental powers</strong> using upgrades."
    ]
  },
  {
    title: "Soldiers (3/5)",
    icon: "⚔️",
    content: [
      "Soldiers can <strong>move between neighboring regions</strong>.",
      "You can <strong>attack enemy regions</strong> with your soldiers.",
      "Combat uses <strong>dice rolls</strong> - more soldiers = better odds.",
      "Winning an attack <strong>conquers the region</strong>.",
      "Soldiers that conquer a region <strong>cannot move again</strong> that turn."
    ]
  },
  {
    title: "Combat (4/5)",
    icon: "🎲",
    content: [
      "Combat is resolved with <strong>dice rolls</strong>.",
      "Attacker and defender each roll dice based on army size.",
      "Higher dice rolls win - ties go to the <strong>defender</strong>.",
      "Losing armies are eliminated until one side has no soldiers.",
      "Strategy tip: <strong>attack with overwhelming force</strong>!"
    ]
  },
  {
    title: "Upgrades (5/5)",
    icon: "✨",
    content: [
      `<strong>Elemental upgrades</strong> are purchased with <strong>faith</strong> (${SYMBOLS.FAITH}).`,
      "There are <strong>2 levels</strong> of each upgrade type.",
      "Instead of upgrading, you can use faith to <strong>recruit soldiers</strong>.",
      "Each soldier you recruit in a turn gets <strong>more expensive</strong>.",
      "If a temple is lost, the <strong>upgrade is lost with it</strong>."
    ]
  }
];

export const TOTAL_TUTORIAL_CARDS = TUTORIAL_CARDS.length;

