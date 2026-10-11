export type PromoTimeLeft = {
  days: number;
  hours: number;
  mins: number;
  secs: number;
};

/** Days stay at 00. The offer counts down in hours, then starts again. */
const PROMO_CYCLE_MS = 17 * 60 * 60 * 1000;

export function getPromoTimeLeft(now = Date.now()): PromoTimeLeft {
  const remainingMs = PROMO_CYCLE_MS - (now % PROMO_CYCLE_MS);
  const totalSeconds = Math.min(
    17 * 60 * 60,
    Math.max(1, Math.ceil(remainingMs / 1000)),
  );
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  return {
    days: 0,
    hours,
    mins,
    secs,
  };
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

export function formatPromoCountdown(timeLeft: PromoTimeLeft) {
  return `${timeLeft.days}d ${pad(timeLeft.hours)}h ${pad(timeLeft.mins)}m ${pad(timeLeft.secs)}s`;
}

export function padCountdownUnit(value: number) {
  return pad(value);
}
