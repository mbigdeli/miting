import { ensureGmeetPairing } from "../shared/autoPairing.js";
import { checkGmeetHealth } from "../shared/gmeetClient.js";

export type ServiceStatus = "connected" | "unavailable";

/**
 * Ask the app whether it is running and whether it accepts our token.
 *
 * Pair first: `/gmeet/health` is reachable without a token, but the popup
 * treats a missing pairing as "Desktop app unavailable". On macOS the host
 * reads Application Support; this call is what stores the token.
 *
 * Health answers without a token so we can tell "Miting is not running" from
 * "Miting is running but will reject us". Only a rejected token re-pairs: a
 * drifted token is repaired on the next tick instead of waiting for a start
 * to fail with a 401, and a good one no longer launches the native host every
 * minute.
 */
export async function checkServiceHealth(): Promise<ServiceStatus> {
  await ensureGmeetPairing();
  let health = await checkGmeetHealth();
  if (health.ok && health.data?.authorized === false) {
    const refreshed = await ensureGmeetPairing(true);
    if (refreshed) {
      console.info("[MCS:bg] pairing token was stale: re-paired with the app");
      health = await checkGmeetHealth();
    }
  }
  return health.ok ? "connected" : "unavailable";
}
