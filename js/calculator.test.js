/**
 * Unit Tests for India Salary Calculator (FY 2026-27 / AY 2027-28)
 * 
 * Run: node js/calculator.test.js
 */

const Calc = require('./calculator.js');
const Storage = require('./storage.js');

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, description) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(description);
    console.error(`  ✗ FAIL: ${description}`);
  }
}

function assertApprox(actual, expected, tolerance, description) {
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    passed++;
  } else {
    failed++;
    failures.push(`${description} (got ${actual}, expected ~${expected}, diff ${diff})`);
    console.error(`  ✗ FAIL: ${description} — got ${actual}, expected ~${expected}, diff ${diff}`);
  }
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

// ═══════════════════════════════════════════════════════════════════
// 1. FORMATTING UTILITIES
// ═══════════════════════════════════════════════════════════════════
section('Formatting Utilities');

assert(Calc.formatINR(100000) === '₹1,00,000', 'formatINR: 1 lakh');
assert(Calc.formatINR(0) === '₹0', 'formatINR: zero');
assert(Calc.formatINR(null) === '₹0', 'formatINR: null');
assert(Calc.formatINR(undefined) === '₹0', 'formatINR: undefined');
assert(Calc.formatINR(NaN) === '₹0', 'formatINR: NaN');
assert(Calc.formatINRPlain(2500000) === '25,00,000', 'formatINRPlain: 25L');
assert(Calc.parseINR('25,00,000') === 2500000, 'parseINR: comma-formatted string');
assert(Calc.parseINR('₹12,34,567') === 1234567, 'parseINR: currency-prefixed string');
assert(Calc.parseINR(0) === 0, 'parseINR: numeric zero');
assert(Calc.parseINR('') === 0, 'parseINR: empty string');
assert(Calc.parseINR(null) === 0, 'parseINR: null');

// Live format-as-you-type tests
assert(Calc.formatAsIndianCurrency('2500000') === '25,00,000', 'formatAsIndianCurrency: 25L raw string');
assert(Calc.formatAsIndianCurrency('1000') === '1,000', 'formatAsIndianCurrency: 1 thousand');
assert(Calc.formatAsIndianCurrency('10000') === '10,000', 'formatAsIndianCurrency: 10 thousand');
assert(Calc.formatAsIndianCurrency('100000') === '1,00,000', 'formatAsIndianCurrency: 1 lakh');
assert(Calc.formatAsIndianCurrency('1000000') === '10,00,000', 'formatAsIndianCurrency: 10 lakh');
assert(Calc.formatAsIndianCurrency('10000000') === '1,00,00,000', 'formatAsIndianCurrency: 1 crore');
assert(Calc.formatAsIndianCurrency('0') === '0', 'formatAsIndianCurrency: zero');
assert(Calc.formatAsIndianCurrency('00') === '0', 'formatAsIndianCurrency: leading zeros');
assert(Calc.formatAsIndianCurrency('0500') === '500', 'formatAsIndianCurrency: leading zero with digits');
assert(Calc.formatAsIndianCurrency('') === '', 'formatAsIndianCurrency: empty string');
assert(Calc.formatAsIndianCurrency('abc') === '', 'formatAsIndianCurrency: non-numeric string');
assert(Calc.formatAsIndianCurrency('25,00,000') === '25,00,000', 'formatAsIndianCurrency: already formatted');

// Cursor preservation tests
assert(Calc.findNewCursorPosition('25,00,000', 0) === 0, 'cursor: at start');
assert(Calc.findNewCursorPosition('25,00,000', 1) === 1, 'cursor: after 1st digit (2|5,00,000)');
assert(Calc.findNewCursorPosition('25,00,000', 2) === 2, 'cursor: after 2nd digit before comma (25|,00,000)');
assert(Calc.findNewCursorPosition('25,00,000', 3) === 4, 'cursor: after 3rd digit (25,0|0,000 -> pos 4)');
assert(Calc.findNewCursorPosition('25,00,000', 7) === 9, 'cursor: after 7th digit (end of string)');
assert(Calc.findNewCursorPosition('1,000', 2) === 3, 'cursor: after 2nd digit across comma in 1,000');

// ═══════════════════════════════════════════════════════════════════
// 2. METRO CITY DETECTION
// ═══════════════════════════════════════════════════════════════════
section('Metro City Detection');

assert(Calc.isMetroCity('bengaluru') === true, 'Bengaluru is metro');
assert(Calc.isMetroCity('Bengaluru') === true, 'Bengaluru case-insensitive');
assert(Calc.isMetroCity('mumbai') === true, 'Mumbai is metro');
assert(Calc.isMetroCity('delhi') === true, 'Delhi is metro');
assert(Calc.isMetroCity('hyderabad') === true, 'Hyderabad is metro (FY 26-27)');
assert(Calc.isMetroCity('pune') === true, 'Pune is metro (FY 26-27)');
assert(Calc.isMetroCity('ahmedabad') === true, 'Ahmedabad is metro (FY 26-27)');
assert(Calc.isMetroCity('chennai') === true, 'Chennai is metro');
assert(Calc.isMetroCity('kolkata') === true, 'Kolkata is metro');
assert(Calc.isMetroCity('jaipur') === false, 'Jaipur is not metro');
assert(Calc.isMetroCity('other') === false, '"other" is not metro');
assert(Calc.isMetroCity('') === false, 'Empty string is not metro');
assert(Calc.isMetroCity(null) === false, 'null is not metro');

// ═══════════════════════════════════════════════════════════════════
// 3. NEW REGIME TAX SLABS (FY 2026-27)
// ═══════════════════════════════════════════════════════════════════
section('New Regime Tax Slabs');

// Zero tax below 4L
assert(Calc.computeBaseTax(0, 'NEW') === 0, 'New: ₹0 taxable → ₹0 tax');
assert(Calc.computeBaseTax(400000, 'NEW') === 0, 'New: ₹4L taxable → ₹0 tax (nil slab)');

// 5% slab: 4L – 8L
assert(Calc.computeBaseTax(800000, 'NEW') === 20000, 'New: ₹8L → ₹20,000 tax (4L × 5%)');

// 10% slab: 8L – 12L
assert(Calc.computeBaseTax(1200000, 'NEW') === 60000, 'New: ₹12L → ₹60,000 tax');

// 15% slab: 12L – 16L
assert(Calc.computeBaseTax(1600000, 'NEW') === 120000, 'New: ₹16L → ₹1,20,000 tax');

// 20% slab: 16L – 20L
assert(Calc.computeBaseTax(2000000, 'NEW') === 200000, 'New: ₹20L → ₹2,00,000 tax');

// 25% slab: 20L – 24L
assert(Calc.computeBaseTax(2400000, 'NEW') === 300000, 'New: ₹24L → ₹3,00,000 tax');

// 30% slab: above 24L
assert(Calc.computeBaseTax(3000000, 'NEW') === 480000, 'New: ₹30L → ₹4,80,000 tax');

// Intermediate value
assertApprox(Calc.computeBaseTax(1500000, 'NEW'), 105000, 1, 'New: ₹15L → ₹1,05,000 tax');

// ═══════════════════════════════════════════════════════════════════
// 4. OLD REGIME TAX SLABS
// ═══════════════════════════════════════════════════════════════════
section('Old Regime Tax Slabs');

// Under 60: nil up to 2.5L
assert(Calc.computeBaseTax(250000, 'OLD', 'under60') === 0, 'Old (<60): ₹2.5L → ₹0');
assert(Calc.computeBaseTax(500000, 'OLD', 'under60') === 12500, 'Old (<60): ₹5L → ₹12,500');
assert(Calc.computeBaseTax(1000000, 'OLD', 'under60') === 112500, 'Old (<60): ₹10L → ₹1,12,500');
assert(Calc.computeBaseTax(1500000, 'OLD', 'under60') === 262500, 'Old (<60): ₹15L → ₹2,62,500');

// 60-80: nil up to 3L
assert(Calc.computeBaseTax(300000, 'OLD', '60to80') === 0, 'Old (60-80): ₹3L → ₹0');
assert(Calc.computeBaseTax(500000, 'OLD', '60to80') === 10000, 'Old (60-80): ₹5L → ₹10,000');

// 80+: nil up to 5L
assert(Calc.computeBaseTax(500000, 'OLD', 'above80') === 0, 'Old (80+): ₹5L → ₹0');
assert(Calc.computeBaseTax(600000, 'OLD', 'above80') === 20000, 'Old (80+): ₹6L → ₹20,000');

// ═══════════════════════════════════════════════════════════════════
// 5. SECTION 87A REBATE
// ═══════════════════════════════════════════════════════════════════
section('Section 87A Rebate');

// New regime: ≤12L taxable → rebate up to ₹60k (making tax 0)
{
  const res = Calc.computeTaxDetails(1200000, 'NEW');
  assert(res.rebate87A === 60000, 'New 87A: ₹12L → full ₹60k rebate');
  assert(res.totalTax === 0, 'New 87A: ₹12L → ₹0 total tax after rebate + cess');
}

// New regime: >12L up to ~12.7L gets Section 87A Marginal Relief
{
  // At ₹12,10,000: base tax = 61,500, excess over 12L = 10,000
  // Marginal relief restricts tax (pre-cess) to excess income ₹10,000
  const res121 = Calc.computeTaxDetails(1210000, 'NEW');
  assert(res121.taxAfterRebate === 10000, 'New 87A Marginal Relief: ₹12.1L → pre-cess tax = ₹10,000');
  assert(res121.totalTax === 10400, 'New 87A Marginal Relief: ₹12.1L → total tax with cess = ₹10,400');
  assert(res121.marginalRelief87A === 51500, 'New 87A Marginal Relief: relief amount = ₹51,500');

  // At ₹12,50,000: base tax = 67,500, excess over 12L = 50,000
  const res125 = Calc.computeTaxDetails(1250000, 'NEW');
  assert(res125.taxAfterRebate === 50000, 'New 87A Marginal Relief: ₹12.5L → pre-cess tax = ₹50,000');
  assert(res125.totalTax === 52000, 'New 87A Marginal Relief: ₹12.5L → total tax with cess = ₹52,000');

  // At ₹13,00,000: normal slab tax takes over (base tax = 75,000 < excess 1,00,000)
  const res130 = Calc.computeTaxDetails(1300000, 'NEW');
  assert(res130.taxAfterRebate === 75000, 'New 87A: ₹13L → normal slab tax ₹75,000 (no 87A relief)');
  assert(res130.totalTax === 78000, 'New 87A: ₹13L → total tax with cess = ₹78,000');
}

// Old regime: ≤5L taxable → rebate up to ₹12.5k
{
  const res = Calc.computeTaxDetails(500000, 'OLD', 'under60');
  assert(res.rebate87A === 12500, 'Old 87A: ₹5L → ₹12.5k rebate');
  assert(res.totalTax === 0, 'Old 87A: ₹5L → ₹0 total tax after rebate');
}

// ═══════════════════════════════════════════════════════════════════
// 6. SURCHARGE & MARGINAL RELIEF
// ═══════════════════════════════════════════════════════════════════
section('Surcharge & Marginal Relief');

// No surcharge below 50L
{
  const res = Calc.computeTaxDetails(4000000, 'NEW');
  assert(res.surcharge === 0, 'No surcharge at ₹40L');
}

// 10% surcharge kicks in above 50L
{
  const res = Calc.computeTaxDetails(6000000, 'NEW');
  assert(res.surcharge > 0, 'Surcharge positive at ₹60L');
}

// New regime: surcharge capped at 25% even above 5Cr
{
  const res5cr = Calc.calculateSurchargeWithMarginalRelief(10000000, 60000000, 'NEW');
  assert(res5cr.surcharge <= 10000000 * 0.25 + 1, 'New 5Cr+: surcharge rate capped at 25%');
}

// Old regime: 37% above 5Cr allowed
{
  const res5cr = Calc.calculateSurchargeWithMarginalRelief(10000000, 60000000, 'OLD');
  assert(res5cr.surcharge > 10000000 * 0.25, 'Old 5Cr+: surcharge can exceed 25%');
}

// ═══════════════════════════════════════════════════════════════════
// 7. HRA EXEMPTION (3-WAY TEST)
// ═══════════════════════════════════════════════════════════════════
section('HRA Exemption');

// Metro (50%): Basic 10L, HRA 5L, Rent 3.6L
{
  const exempt = Calc.calculateHraExemption(500000, 1000000, 360000, true);
  // min(500000, 500000, 360000-100000=260000) = 260000
  assert(exempt === 260000, 'HRA metro: min(5L, 5L, 2.6L) = ₹2.6L');
}

// Non-metro (40%): Basic 10L, HRA 4L, Rent 3.6L
{
  const exempt = Calc.calculateHraExemption(400000, 1000000, 360000, false);
  // min(400000, 400000, 260000) = 260000
  assert(exempt === 260000, 'HRA non-metro: min(4L, 4L, 2.6L) = ₹2.6L');
}

// Zero rent → no exemption
{
  const exempt = Calc.calculateHraExemption(500000, 1000000, 0, true);
  assert(exempt === 0, 'HRA: zero rent → ₹0 exemption');
}

// Zero HRA → no exemption
{
  const exempt = Calc.calculateHraExemption(0, 1000000, 360000, true);
  assert(exempt === 0, 'HRA: zero actual HRA → ₹0 exemption');
}

// ═══════════════════════════════════════════════════════════════════
// 8. SECTION 80D HEALTH INSURANCE
// ═══════════════════════════════════════════════════════════════════
section('80D Health Insurance');

assert(Calc.calculate80D(25000, false, 50000, true) === 75000, '80D: 25k self + 50k senior parents = 75k');
assert(Calc.calculate80D(50000, true, 50000, true) === 100000, '80D: 50k senior self + 50k senior parents = 1L');
assert(Calc.calculate80D(30000, false, 0, false) === 25000, '80D: 30k self (capped 25k) + 0 parents = 25k');
assert(Calc.calculate80D(0, false, 0, false) === 0, '80D: no premiums = 0');

// ═══════════════════════════════════════════════════════════════════
// 9. DEFAULT ASSUMPTIONS (QUICK MODE)
// ═══════════════════════════════════════════════════════════════════
section('Quick Mode Defaults');

{
  const d = Calc.generateDefaultsFromCtc(2000000, true, 'actual');
  assert(d.basic === 800000, 'Defaults: basic = 40% of CTC');
  assert(d.hra === 400000, 'Defaults: HRA = 50% of basic (metro)');
  assert(d.employerPf === 96000, 'Defaults: employer PF = 12% of basic');
  assert(d.employeePf === 96000, 'Defaults: employee PF = 12% of basic');
  assertApprox(d.gratuity, 38480, 1, 'Defaults: gratuity = 4.81% of basic');
  // Sum should equal CTC
  const sum = d.basic + d.hra + d.special + d.bonus + d.employerPf + d.gratuity;
  assert(sum === 2000000, 'Defaults: components sum to CTC');
}

// Non-metro: HRA = 40%
{
  const d = Calc.generateDefaultsFromCtc(2000000, false, 'actual');
  assert(d.hra === 320000, 'Defaults non-metro: HRA = 40% of basic');
}

// Capped PF
{
  const d = Calc.generateDefaultsFromCtc(2000000, true, 'capped');
  assert(d.employerPf === 21600, 'Defaults capped PF: ₹21,600');
  assert(d.employeePf === 21600, 'Defaults capped employee PF: ₹21,600');
}

// ═══════════════════════════════════════════════════════════════════
// 10. FULL SALARY COMPUTATION (INTEGRATION)
// ═══════════════════════════════════════════════════════════════════
section('Full Salary Computation');

{
  const raw = Calc.generateDefaultsFromCtc(2000000, true, 'actual');
  const profile = { ageBracket: 'under60', isMetro: true, pfBasis: 'actual', bonusTreatment: 'include', employerType: 'private' };
  const deductions = { annualRent: 360000, other80C: 50000, insuranceSelf: 25000, isSelfSenior: false, insuranceParents: 30000, isParentSenior: true, homeLoanInterest: 0, nps80CCD1B: 50000, otherDeductions: 0 };

  const oldRes = Calc.computeSalaryDetails(raw, profile, deductions, 'OLD');
  const newRes = Calc.computeSalaryDetails(raw, profile, deductions, 'NEW');

  assert(oldRes.totalCtc === 2000000, 'Integration: Old CTC = ₹20L');
  assert(newRes.totalCtc === 2000000, 'Integration: New CTC = ₹20L');
  assert(oldRes.netTakeHome > 0, 'Integration: Old take-home > 0');
  assert(newRes.netTakeHome > 0, 'Integration: New take-home > 0');
  assert(oldRes.standardDeduction === 50000, 'Integration: Old std deduction = ₹50k');
  assert(newRes.standardDeduction === 75000, 'Integration: New std deduction = ₹75k');
  assert(oldRes.hraExempt > 0, 'Integration: Old HRA exemption > 0');
  assert(newRes.hraExempt === 0, 'Integration: New HRA exemption = 0 (not allowed)');
  assert(oldRes.deduction80C > 0, 'Integration: Old 80C > 0');
  assert(newRes.deduction80C === 0, 'Integration: New 80C = 0 (not allowed)');
  assert(oldRes.professionalTax === 2500, 'Integration: PT = ₹2,500');
}

// ═══════════════════════════════════════════════════════════════════
// 11. ESOP VESTING ENGINE
// ═══════════════════════════════════════════════════════════════════
section('ESOP Vesting Engine');

// Equal schedule: 4 years
{
  const v = Calc.calculateEsopVesting(1200000, 4, 'equal', []);
  assert(v.totalGrant === 1200000, 'ESOP equal: grant = 12L');
  assert(v.vestingYears === 4, 'ESOP equal: 4 years');
  assert(v.schedule.length === 4, 'ESOP equal: 4 schedule entries');
  assert(v.year1Amount === 300000, 'ESOP equal: year 1 = ₹3L');
  assert(v.averageAnnualEsop === 300000, 'ESOP equal: avg = ₹3L/yr');
  const totalVested = v.schedule.reduce((s, e) => s + e.amount, 0);
  assert(totalVested === 1200000, 'ESOP equal: all years sum to grant');
}

// Custom schedule
{
  const v = Calc.calculateEsopVesting(4000000, 4, 'custom', [10, 20, 30, 40]);
  assert(v.schedule[0].amount === 400000, 'ESOP custom: yr1 = 10% of 40L');
  assert(v.schedule[1].amount === 800000, 'ESOP custom: yr2 = 20% of 40L');
  assert(v.schedule[2].amount === 1200000, 'ESOP custom: yr3 = 30% of 40L');
  assert(v.schedule[3].amount === 1600000, 'ESOP custom: yr4 = 40% of 40L');
  assert(v.year1Amount === 400000, 'ESOP custom: year 1 amount correct');
}

// Edge: 1 year vesting
{
  const v = Calc.calculateEsopVesting(500000, 1, 'equal', []);
  assert(v.schedule.length === 1, 'ESOP 1yr: single entry');
  assert(v.year1Amount === 500000, 'ESOP 1yr: full grant in year 1');
}

// Edge: zero grant
{
  const v = Calc.calculateEsopVesting(0, 4, 'equal', []);
  assert(v.totalGrant === 0, 'ESOP zero: grant = 0');
  assert(v.year1Amount === 0, 'ESOP zero: year 1 = 0');
}

// Units-based vesting: 1,000 units over 4 years equal
{
  const v = Calc.calculateEsopVesting(1200000, 4, 'equal', [], 1000);
  assert(v.totalUnits === 1000, 'ESOP units: totalUnits = 1000');
  assert(v.year1Units === 250, 'ESOP units: year 1 units = 250');
  assert(v.averageAnnualUnits === 250, 'ESOP units: avg annual units = 250');
  assert(v.schedule[0].units === 250, 'ESOP units: Yr 1 = 250 units');
  assert(v.schedule[1].units === 250, 'ESOP units: Yr 2 = 250 units');
  assert(v.schedule[2].units === 250, 'ESOP units: Yr 3 = 250 units');
  assert(v.schedule[3].units === 250, 'ESOP units: Yr 4 = 250 units');
  const sumUnits = v.schedule.reduce((s, e) => s + e.units, 0);
  assert(sumUnits === 1000, 'ESOP units: all schedule entries sum to total units');
}

// Units-based custom vesting: 1,000 units with [10, 20, 30, 40]
{
  const v = Calc.calculateEsopVesting(1200000, 4, 'custom', [10, 20, 30, 40], 1000);
  assert(v.schedule[0].units === 100, 'ESOP custom units: Yr 1 = 100 units');
  assert(v.schedule[1].units === 200, 'ESOP custom units: Yr 2 = 200 units');
  assert(v.schedule[2].units === 300, 'ESOP custom units: Yr 3 = 300 units');
  assert(v.schedule[3].units === 400, 'ESOP custom units: Yr 4 = 400 units');
}

// Units-based rounding remainder: 1,001 units over 4 years
{
  const v = Calc.calculateEsopVesting(1200000, 4, 'equal', [], 1001);
  const sumUnits = v.schedule.reduce((s, e) => s + e.units, 0);
  assert(sumUnits === 1001, 'ESOP units remainder: sum equals 1001 without drift');
}

// Math calculation: units × price
{
  const units = 1000;
  const priceINR = 1200;
  assert(units * priceINR === 1200000, 'Units math: 1,000 units × ₹1,200 = ₹12L');

  const usdShares = 500;
  const usdPrice = 20;
  const usdRate = 87;
  const inrGrant = usdShares * usdPrice * usdRate;
  assert(inrGrant === 870000, 'USD RSUs math: 500 units × $20 × ₹87/$ = ₹8.7L');
}

// ═══════════════════════════════════════════════════════════════════
// 12. TOTAL COMPENSATION
// ═══════════════════════════════════════════════════════════════════
section('Total Compensation');

{
  const tc = Calc.computeTotalCompensation(2600000, 300000, 1800000);
  assert(tc.ctc === 2600000, 'TC: CTC = 26L');
  assert(tc.esopAnnual === 300000, 'TC: ESOP annual = 3L');
  assert(tc.totalCompensation === 2900000, 'TC: total = 29L');
  assert(tc.totalRealizedValue === 2100000, 'TC: realized = take-home + ESOP = 21L');
  assert(tc.monthlyCtc === Math.round(2600000 / 12), 'TC: monthly CTC');
}

// No ESOP
{
  const tc = Calc.computeTotalCompensation(2000000, 0, 1500000);
  assert(tc.esopAnnual === 0, 'TC no ESOP: esop = 0');
  assert(tc.totalCompensation === 2000000, 'TC no ESOP: total = CTC');
  assert(tc.equitySharePct === '0.0', 'TC no ESOP: equity share = 0.0%');
}

// ═══════════════════════════════════════════════════════════════════
// 13. CROSS-REGIME VALIDATION: NEW vs OLD AT KEY SALARY LEVELS
// ═══════════════════════════════════════════════════════════════════
section('New vs Old Regime Cross-Validation');

{
  // At ₹12L taxable income, New regime should have 0 tax (87A rebate)
  const newAt12L = Calc.computeTaxDetails(1200000, 'NEW');
  assert(newAt12L.totalTax === 0, 'Cross: New ₹12L → zero tax (87A)');

  const oldAt12L = Calc.computeTaxDetails(1200000, 'OLD', 'under60');
  assert(oldAt12L.totalTax > 0, 'Cross: Old ₹12L → positive tax (no 87A at 12L)');

  // At very high income, both should have substantial tax
  const newAt50L = Calc.computeTaxDetails(5000000, 'NEW');
  const oldAt50L = Calc.computeTaxDetails(5000000, 'OLD', 'under60');
  assert(newAt50L.totalTax > 500000, 'Cross: New ₹50L → substantial tax');
  assert(oldAt50L.totalTax > 500000, 'Cross: Old ₹50L → substantial tax');

  // Cess should always be 4% of (tax after rebate + surcharge)
  const cessBasis = newAt50L.taxAfterRebate + newAt50L.surcharge;
  assertApprox(newAt50L.cess, Math.round(cessBasis * 0.04), 1, 'Cross: Cess = 4% of (tax + surcharge)');
}

// ═══════════════════════════════════════════════════════════════════
// 14. DETAILED CTC SUMMATION & COMPONENT SYNCHRONIZATION
// ═══════════════════════════════════════════════════════════════════
section('Detailed CTC Summation & Component Sync');

// Exact case from user screenshot: Basic 10.5L, Bonus 1.05L, Employer PF 50k
{
  const components = {
    basic: 1050000,
    hra: 0,
    special: 0,
    bonus: 105000,
    employerPf: 50000,
    gratuity: 0,
    employerNps: 0,
    employeePf: 0,
    lta: 0,
    meal: 0,
    fuel: 0,
    telecom: 0,
    joining: 0
  };

  const total = Calc.calculateTotalCtcFromComponents(components);
  assert(total === 1205000, 'User case: 10.5L basic + 1.05L bonus + 50k PF = 12.05L total CTC');

  const monthly = Math.round(total / 12);
  assert(monthly === 100417, 'User case monthly: 12.05L / 12 = ₹1,00,417 / mo');

  const basicPct = (components.basic / total * 100).toFixed(1);
  assert(basicPct === '87.1', 'User case: basic is 87.1% of CTC (not stuck at default 40%)');

  const hraPct = components.basic > 0 ? (components.hra / components.basic * 100).toFixed(1) : '0';
  assert(hraPct === '0.0', 'User case: HRA is 0.0% of Basic (not stuck at default 50%)');
}

// Formatted strings with commas and prefixes
{
  const formattedComponents = {
    basic: '10,50,000',
    hra: '0',
    special: '0',
    bonus: '1,05,000',
    employerPf: '50,000',
    gratuity: '0',
    employerNps: '0',
    employeePf: '50,000', // Employee deduction: MUST NOT be added to employer CTC
    lta: '0',
    meal: '0',
    fuel: '0',
    telecom: '0',
    joining: '0'
  };

  const total = Calc.calculateTotalCtcFromComponents(formattedComponents);
  assert(total === 1205000, 'String formatted inputs correctly parsed and summed to 12.05L');
}

// Full suite of components including perks and variable
{
  const fullComponents = {
    basic: 1200000,
    hra: 600000,
    special: 400000,
    bonus: 200000,
    employerPf: 144000,
    gratuity: 57720,
    employerNps: 120000,
    employerInsurance: 25000,
    employeePf: 144000, // should not affect CTC
    lta: 50000,
    meal: 26400,
    fuel: 48000,
    telecom: 24000,
    joining: 100000
  };

  const expectedSum = 1200000 + 600000 + 400000 + 200000 + 144000 + 57720 + 120000 + 25000 +
    50000 + 26400 + 48000 + 24000 + 100000;
  const computed = Calc.calculateTotalCtcFromComponents(fullComponents);
  assert(computed === expectedSum, `Full components sum: expected ${expectedSum}, got ${computed}`);

  const profile = { ageBracket: 'under60', isMetro: true, pfBasis: 'actual', employerType: 'private', bonusTreatment: 'include' };
  const salDetails = Calc.computeSalaryDetails(fullComponents, profile, {}, 'NEW');
  assert(salDetails.totalCtc === expectedSum, 'computeSalaryDetails totalCtc matches calculateTotalCtcFromComponents');
  assert(salDetails.cashGrossSalary === expectedSum - 144000 - 57720 - 25000 - 120000, 'cashGrossSalary correctly excludes employer NPS, PF, gratuity, insurance');
}

// Null and empty safety
{
  assert(Calc.calculateTotalCtcFromComponents(null) === 0, 'Null components returns 0');
  assert(Calc.calculateTotalCtcFromComponents({}) === 0, 'Empty components returns 0');
  assert(Calc.calculateTotalCtcFromComponents({ basic: '' }) === 0, 'Empty string component returns 0');
}

// ═══════════════════════════════════════════════════════════════════
// 15. PROFILE & DEDUCTIONS STATE PERSISTENCE & DEEP MERGING
// ═══════════════════════════════════════════════════════════════════
section('Profile & Deductions Persistence');

{
  const def = Storage.getDefaultState();
  assert(def.profile && typeof def.profile === 'object', 'Default state contains profile');
  assert(def.deductions && typeof def.deductions === 'object', 'Default state contains deductions');
  assert(def.profile.city === 'bengaluru', 'Default profile city is bengaluru');
  assert(def.deductions.annualRent === 360000, 'Default annualRent is 360000');

  // Test full custom JSON import preservation
  const customPayload = JSON.stringify({
    profile: {
      ageBracket: '60to80',
      city: 'mumbai',
      pfBasis: 'capped',
      bonusTreatment: 'exclude',
      employerType: 'govt'
    },
    deductions: {
      annualRent: 600000,
      other80C: 120000,
      insuranceSelf: 50000,
      isSelfSenior: true,
      insuranceParents: 50000,
      isParentSenior: true,
      homeLoanInterest: 200000,
      nps80CCD1B: 50000,
      otherDeductions: 25000
    }
  });

  const parsed = Storage.parseImportedJson(customPayload);
  assert(parsed.success === true, 'parseImportedJson succeeds on custom payload');
  assert(parsed.data.profile.city === 'mumbai', 'Profile city correctly preserved as mumbai');
  assert(parsed.data.profile.ageBracket === '60to80', 'Profile ageBracket correctly preserved as 60to80');
  assert(parsed.data.deductions.annualRent === 600000, 'Deductions annualRent correctly preserved as 600000');
  assert(parsed.data.deductions.isSelfSenior === true, 'Deductions isSelfSenior correctly preserved as true');
  assert(parsed.data.deductions.homeLoanInterest === 200000, 'Deductions homeLoanInterest correctly preserved');

  // Test partial import deep merges with default profile & deductions without losing properties
  const partialPayload = JSON.stringify({
    profile: {
      city: 'pune'
    },
    deductions: {
      annualRent: 480000
    }
  });

  const merged = Storage.parseImportedJson(partialPayload);
  assert(merged.success === true, 'parseImportedJson succeeds on partial payload');
  assert(merged.data.profile.city === 'pune', 'Partial profile updated city to pune');
  assert(merged.data.profile.ageBracket === 'under60', 'Partial profile retained default ageBracket under60');
  assert(merged.data.profile.pfBasis === 'actual', 'Partial profile retained default pfBasis actual');
  assert(merged.data.deductions.annualRent === 480000, 'Partial deductions updated annualRent to 480000');
  assert(merged.data.deductions.other80C === 50000, 'Partial deductions retained default other80C 50000');
  assert(merged.data.deductions.insuranceParents === 30000, 'Partial deductions retained default insuranceParents');
}

// ═══════════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('══════════════════════════════════════');

if (failed > 0) {
  console.log('\nFailed tests:');
  failures.forEach(f => console.log(`  • ${f}`));
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!\n');
  process.exit(0);
}
