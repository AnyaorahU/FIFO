// Turns free-text pay ("$33.00/hr + penalties", "$1,900 per week", "$95,000 + super", "$75k - $85k") into a rate
// and unit so jobs can be filtered by salary. Ranges use the lower figure.
const HOURS_PER_YEAR = 38 * 52;
const PER_YEAR = { hour: HOURS_PER_YEAR, day: 5 * 52, week: 52, year: 1 };

function parsePay(text) {
  if (!text) return { rate: null, unit: null };
  const t = String(text);
  const m = t.replace(/,/g, '').match(/\$?\s*(\d+(?:\.\d+)?)\s*(k)?/i);
  if (!m) return { rate: null, unit: null };
  let rate = parseFloat(m[1]);
  if (m[2]) rate *= 1000;
  let unit;
  if (/\b(hr|hour|ph|p\/h)\b|\/h\b/i.test(t)) unit = 'hour';
  else if (/\b(day|daily|pd)\b|\/d\b/i.test(t)) unit = 'day';
  else if (/\b(week|weekly|wk|pw)\b|\/w\b/i.test(t)) unit = 'week';
  else if (/\b(year|annual|annum|pa|p\.a\.)\b|super/i.test(t)) unit = 'year';
  else unit = rate < 300 ? 'hour' : rate < 15000 ? 'week' : 'year';
  return { rate, unit };
}

// MongoDB expression for a job's approximate annual salary.
const ANNUAL_EXPR = { $multiply: ['$pay_rate', { $switch: {
  branches: Object.entries(PER_YEAR).map(([u, n]) => ({ case: { $eq: ['$pay_unit', u] }, then: n })), default: 1,
} }] };

module.exports = { parsePay, HOURS_PER_YEAR, PER_YEAR, ANNUAL_EXPR };
