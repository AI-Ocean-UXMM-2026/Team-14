/** MMK is integral. BigInt preserves exact per-session half-up rounding. */
export function sessionPay(start: string, end: string, hourlyRate: number) {
  const milliseconds = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) throw new Error('INVALID_INTERVAL');
  if (!Number.isSafeInteger(hourlyRate) || hourlyRate <= 0) throw new Error('INVALID_RATE');
  const minutes = Math.floor(milliseconds / 60000);
  const amount = (BigInt(minutes) * BigInt(hourlyRate) + 30n) / 60n;
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('AMOUNT_OVERFLOW');
  return { minutes, amount: Number(amount) };
}
export function localStartDate(timestamp: string) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) throw new Error('INVALID_TIMESTAMP');
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Yangon', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export type Session = { id: string; teacher: string; subject: string; start: string; end: string | null; rate: number | null; verification: 'pending' | 'verified'; correction: boolean };
export function eligibility(session: Session) {
  if (!session.end) return 'Missing checkout';
  if (session.correction) return 'Pending correction';
  if (session.verification !== 'verified') return 'Awaiting verification';
  if (session.rate === null) return 'Missing rate';
  return 'Eligible';
}
