export type PromoTimeLeft = {
  days: number;
  hours: number;
  mins: number;
  secs: number;
};

export function getPromoOfferEndDate() {
  const end = new Date();
  end.setDate(end.getDate() + 15);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function getPromoTimeLeft(target: Date): PromoTimeLeft {
  const diff = Math.max(0, target.getTime() - Date.now());
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);
  const secs = Math.floor((diff / 1000) % 60);
  return { days, hours, mins, secs };
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
