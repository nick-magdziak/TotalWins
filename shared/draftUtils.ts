// Draft utility functions for managing different draft types

export interface DraftPickOrder {
  position: number;
  round: number;
  pick: number;
}

/**
 * Generate the custom 10-player, 30-pick draft order
 * Team 1: {1st pick, 20th pick, 26th pick}
 * Team 2: {2, 16, 29}
 * Team 3: {3, 13, 30}
 * Team 4: {4, 18, 25}
 * Team 5: {5, 15, 27}
 * Team 6: {6, 19, 22}
 * Team 7: {7, 11, 28}
 * Team 8: {8, 17, 21}
 * Team 9: {9, 14, 23}
 * Team 10: {10, 12, 24}
 */
export function getCustom10Player30PickOrder(): DraftPickOrder[] {
  const customOrder: Record<number, number[]> = {
    1: [1, 20, 26],
    2: [2, 16, 29],
    3: [3, 13, 30],
    4: [4, 18, 25],
    5: [5, 15, 27],
    6: [6, 19, 22],
    7: [7, 11, 28],
    8: [8, 17, 21],
    9: [9, 14, 23],
    10: [10, 12, 24]
  };

  const draftOrder: DraftPickOrder[] = [];
  
  for (const [position, picks] of Object.entries(customOrder)) {
    picks.forEach((pick, index) => {
      draftOrder.push({
        position: parseInt(position),
        round: index + 1,
        pick: pick
      });
    });
  }

  // Sort by pick number to get the draft order
  return draftOrder.sort((a, b) => a.pick - b.pick);
}

/**
 * Generate snake draft order
 */
export function getSnakeDraftOrder(numPlayers: number, numRounds: number): DraftPickOrder[] {
  const draftOrder: DraftPickOrder[] = [];
  let pickNumber = 1;

  for (let round = 1; round <= numRounds; round++) {
    if (round % 2 === 1) {
      // Odd rounds: 1 to numPlayers
      for (let position = 1; position <= numPlayers; position++) {
        draftOrder.push({
          position,
          round,
          pick: pickNumber++
        });
      }
    } else {
      // Even rounds: numPlayers to 1
      for (let position = numPlayers; position >= 1; position--) {
        draftOrder.push({
          position,
          round,
          pick: pickNumber++
        });
      }
    }
  }

  return draftOrder;
}

/**
 * Generate linear draft order
 */
export function getLinearDraftOrder(numPlayers: number, numRounds: number): DraftPickOrder[] {
  const draftOrder: DraftPickOrder[] = [];
  let pickNumber = 1;

  for (let round = 1; round <= numRounds; round++) {
    for (let position = 1; position <= numPlayers; position++) {
      draftOrder.push({
        position,
        round,
        pick: pickNumber++
      });
    }
  }

  return draftOrder;
}

/**
 * Get the appropriate draft order based on draft type
 */
export function getDraftOrder(
  draftType: string,
  numPlayers: number,
  numRounds: number
): DraftPickOrder[] {
  switch (draftType) {
    case "custom_10_30":
      return getCustom10Player30PickOrder();
    case "snake":
      return getSnakeDraftOrder(numPlayers, numRounds);
    case "linear":
      return getLinearDraftOrder(numPlayers, numRounds);
    default:
      return getSnakeDraftOrder(numPlayers, numRounds);
  }
}