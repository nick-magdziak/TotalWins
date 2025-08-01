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
 * Generate custom 6-player, 30-pick draft order
 */
export function getCustom6Player30PickOrder(): DraftPickOrder[] {
  const draftOrder: DraftPickOrder[] = [
    // Round 1
    { position: 1, round: 1, pick: 1 },   // A
    { position: 2, round: 1, pick: 2 },   // B
    { position: 3, round: 1, pick: 3 },   // C
    { position: 4, round: 1, pick: 4 },   // D
    { position: 5, round: 1, pick: 5 },   // E
    { position: 6, round: 1, pick: 6 },   // F

    // Round 2
    { position: 5, round: 2, pick: 7 },   // E
    { position: 6, round: 2, pick: 8 },   // F
    { position: 3, round: 2, pick: 9 },   // C
    { position: 4, round: 2, pick: 10 },  // D
    { position: 2, round: 2, pick: 11 },  // B
    { position: 3, round: 2, pick: 12 },  // C

    // Round 3
    { position: 1, round: 3, pick: 13 },  // A
    { position: 6, round: 3, pick: 14 },  // F
    { position: 4, round: 3, pick: 15 },  // D
    { position: 2, round: 3, pick: 16 },  // B
    { position: 1, round: 3, pick: 17 },  // A
    { position: 5, round: 3, pick: 18 },  // E

    // Round 4
    { position: 1, round: 4, pick: 19 },  // A
    { position: 6, round: 4, pick: 20 },  // F
    { position: 5, round: 4, pick: 21 },  // E
    { position: 2, round: 4, pick: 22 },  // B
    { position: 4, round: 4, pick: 23 },  // D
    { position: 3, round: 4, pick: 24 },  // C

    // Round 5
    { position: 4, round: 5, pick: 25 },  // D
    { position: 5, round: 5, pick: 26 },  // E
    { position: 2, round: 5, pick: 27 },  // B
    { position: 1, round: 5, pick: 28 },  // A
    { position: 6, round: 5, pick: 29 },  // F
    { position: 3, round: 5, pick: 30 }   // C
  ];

  return draftOrder;
}

/**
 * Generate custom 8-player, 24-pick draft order
 */
export function getCustom8Player24PickOrder(): DraftPickOrder[] {
  // Placeholder for custom 8-player configuration
  // Will be filled with specific pick order when provided
  return getSnakeDraftOrder(8, 3); // Temporary fallback
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
    case "custom_6_30":
      return getCustom6Player30PickOrder();
    case "custom_8_24":
      return getCustom8Player24PickOrder();
    case "snake":
      return getSnakeDraftOrder(numPlayers, numRounds);
    default:
      return getSnakeDraftOrder(numPlayers, numRounds);
  }
}