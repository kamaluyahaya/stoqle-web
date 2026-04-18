/**
 * Shared utility to manage global z-index stacking.
 * 
 * Instead of hardcoding numbers like z-[900000], we use an incrementing counter.
 * Each newly opened modal/overlay requests a new z-index, ensuring it always 
 * sits on top of previously opened ones.
 */

let globalZIndexCounter = 800000;

/**
 * Returns a new, unique z-index that is guaranteed to be higher than 
 * the one returned by the previous call.
 */
export const getNextZIndex = (): number => {
  globalZIndexCounter += 1000; // Large step to allow for internal layering within the modal
  return globalZIndexCounter;
};
