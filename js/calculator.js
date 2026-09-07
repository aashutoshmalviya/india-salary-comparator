/**
 * India Salary Offer & Tax Regime Engine (FY 2026-27 / AY 2027-28)
 * Pure Tax Calculation & Financial Logic
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SalaryCalculator = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────────
     1. UTILITIES: INDIAN CURRENCY & NUMBER FORMATTING
     ───────────────────────────────────────────────────────────────── */
  const inrFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  });

  const inrNumberFormatter = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0
  });

  function formatINR(val) {
    if (isNaN(val) || val === null || val === undefined) return '₹0';
    return inrFormatter.format(Math.round(val));
  }

  function formatINRPlain(val) {
    if (isNaN(val) || val === null || val === undefined) return '0';
    return inrNumberFormatter.format(Math.round(val));
  }

  function parseINR(str) {
    if (typeof str === 'number') return isNaN(str) ? 0 : str;
    if (!str) return 0;
    const cleaned = str.toString().replace(/[^0-9.-]+/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  function formatAsIndianCurrency(val) {
    const digits = (val || '').toString().replace(/\D/g, '');
    if (!digits) return '';
    const num = parseInt(digits, 10);
    if (isNaN(num)) return '';
    return formatINRPlain(num);
  }

  function findNewCursorPosition(formatted, digitsBeforeCursor) {
    if (digitsBeforeCursor <= 0) return 0;
    let count = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted[i])) {
        count++;
        if (count === digitsBeforeCursor) {
          return i + 1;
        }
      }
    }
    return formatted.length;
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  /* ─────────────────────────────────────────────────────────────────
     2. METRO CITIES (HRA 50% vs 40%)
     ───────────────────────────────────────────────────────────────── */
  const METRO_CITIES = [
    'delhi', 'mumbai', 'kolkata', 'chennai',
    'bengaluru', 'pune', 'hyderabad', 'ahmedabad'
  ];

  function isMetroCity(city) {
    if (!city) return false;
    return METRO_CITIES.includes(city.toLowerCase().trim());
  }

  /* ─────────────────────────────────────────────────────────────────
     3. TAX CALCULATION ENGINE (FY 2026-27 / AY 2027-28)
     ───────────────────────────────────────────────────────────────── */

  /**
   * Surcharge thresholds and rates:
   * 50L - 1Cr: 10%
   * 1Cr - 2Cr: 15%
   * 2Cr - 5Cr: 25%
   * Above 5Cr: 37% (Old Regime only; New Regime capped at 25%)
   * 
   * Implements Marginal Relief at each boundary.
   */
  function calculateSurchargeWithMarginalRelief(baseTax, totalTaxableIncome, regime) {
    if (totalTaxableIncome <= 5000000) {
      return { surcharge: 0, marginalRelief: 0, effectiveSurcharge: 0 };
    }

    let surchargeRate = 0;
    let threshold = 5000000;
    let prevTaxWithSurcharge = 0;

    if (totalTaxableIncome > 50000000) { // > 5Cr
      surchargeRate = (regime === 'NEW') ? 0.25 : 0.37;
      threshold = 50000000;
      const taxAt5Cr = computeBaseTax(50000000, regime);
      prevTaxWithSurcharge = taxAt5Cr * 1.25;
    } else if (totalTaxableIncome > 20000000) { // 2Cr - 5Cr
      surchargeRate = 0.25;
      threshold = 20000000;
      const taxAt2Cr = computeBaseTax(20000000, regime);
      prevTaxWithSurcharge = taxAt2Cr * 1.15;
    } else if (totalTaxableIncome > 10000000) { // 1Cr - 2Cr
      surchargeRate = 0.15;
      threshold = 10000000;
      const taxAt1Cr = computeBaseTax(10000000, regime);
      prevTaxWithSurcharge = taxAt1Cr * 1.10;
    } else { // 50L - 1Cr
      surchargeRate = 0.10;
      threshold = 5000000;
      const taxAt50L = computeBaseTax(5000000, regime);
      prevTaxWithSurcharge = taxAt50L; // 0% surcharge at 50L
    }

    const unadjustedSurcharge = baseTax * surchargeRate;
    const totalTaxWithoutRelief = baseTax + unadjustedSurcharge;

    // Marginal relief: incremental tax (tax + surcharge) above threshold cannot exceed incremental income
    const extraIncome = totalTaxableIncome - threshold;
    const maxAllowedTax = prevTaxWithSurcharge + extraIncome;

    let marginalRelief = 0;
    let finalTaxAndSurcharge = totalTaxWithoutRelief;

    if (totalTaxWithoutRelief > maxAllowedTax) {
      marginalRelief = totalTaxWithoutRelief - maxAllowedTax;
      finalTaxAndSurcharge = maxAllowedTax;
    }

    const effectiveSurcharge = Math.max(0, finalTaxAndSurcharge - baseTax);

    return {
      surcharge: unadjustedSurcharge,
      marginalRelief: marginalRelief,
      effectiveSurcharge: effectiveSurcharge
    };
  }

  /**
   * Base Tax computation before rebate and cess
   */
  function computeBaseTax(taxableIncome, regime, ageBracket = 'under60') {
    if (taxableIncome <= 0) return 0;
    let tax = 0;
    let remainingIncome = taxableIncome;

    if (regime === 'NEW') {
      // New Regime slabs (FY 2026-27, same for all ages):
      // 0 - 4L: Nil
      // 4L - 8L: 5%
      // 8L - 12L: 10%
      // 12L - 16L: 15%
      // 16L - 20L: 20%
      // 20L - 24L: 25%
      // > 24L: 30%
      if (remainingIncome > 2400000) {
        tax += (remainingIncome - 2400000) * 0.30;
        remainingIncome = 2400000;
      }
      if (remainingIncome > 2000000) {
        tax += (remainingIncome - 2000000) * 0.25;
        remainingIncome = 2000000;
      }
      if (remainingIncome > 1600000) {
        tax += (remainingIncome - 1600000) * 0.20;
        remainingIncome = 1600000;
      }
      if (remainingIncome > 1200000) {
        tax += (remainingIncome - 1200000) * 0.15;
        remainingIncome = 1200000;
      }
      if (remainingIncome > 800000) {
        tax += (remainingIncome - 800000) * 0.10;
        remainingIncome = 800000;
      }
      if (remainingIncome > 400000) {
        tax += (remainingIncome - 400000) * 0.05;
        remainingIncome = 400000;
      }
    } else {
      // Old Regime slabs (age sensitive):
      let nilSlab = 250000;
      if (ageBracket === '60to80') nilSlab = 300000;
      else if (ageBracket === 'above80') nilSlab = 500000;

      if (remainingIncome > 1000000) {
        tax += (remainingIncome - 1000000) * 0.30;
        remainingIncome = 1000000;
      }
      if (remainingIncome > 500000) {
        tax += (remainingIncome - 500000) * 0.20;
        remainingIncome = 500000;
      }
      if (remainingIncome > nilSlab) {
        tax += (remainingIncome - nilSlab) * 0.05;
      }
    }

    return Math.round(tax * 100) / 100;
  }

  /**
   * Complete tax details including Section 87A rebate, surcharge and 4% cess
   */
  function computeTaxDetails(taxableIncome, regime, ageBracket = 'under60') {
    const baseTax = computeBaseTax(taxableIncome, regime, ageBracket);
    let rebate87A = 0;
    let marginalRelief87A = 0;

    // Rebate u/s 87A & Marginal Relief
    if (regime === 'NEW') {
      if (taxableIncome <= 1200000) {
        // Full rebate up to ₹60,000 (tax becomes 0)
        rebate87A = baseTax;
      } else {
        // Section 87A Marginal Relief for income slightly exceeding ₹12,00,000:
        // Tax (pre-cess) cannot exceed the income in excess of ₹12,00,000
        const excessIncome = taxableIncome - 1200000;
        if (baseTax > excessIncome) {
          marginalRelief87A = baseTax - excessIncome;
          rebate87A = marginalRelief87A;
        }
      }
    } else {
      // Old regime: Taxable income <= 5,00,000 -> rebate up to ₹12,500
      if (taxableIncome <= 500000) {
        rebate87A = Math.min(baseTax, 12500);
      }
    }

    const taxAfterRebate = Math.max(0, baseTax - rebate87A);

    // Surcharge & marginal relief (calculated on taxable income > 50L)
    let effectiveSurcharge = 0;
    let surchargeMarginalRelief = 0;

    if (taxAfterRebate > 0 && taxableIncome > 5000000) {
      const surObj = calculateSurchargeWithMarginalRelief(taxAfterRebate, taxableIncome, regime);
      effectiveSurcharge = surObj.effectiveSurcharge;
      surchargeMarginalRelief = surObj.marginalRelief;
    }

    // 4% Health & Education Cess
    const cess = Math.round((taxAfterRebate + effectiveSurcharge) * 0.04);
    const totalTax = Math.round(taxAfterRebate + effectiveSurcharge + cess);

    return {
      taxableIncome,
      baseTax,
      rebate87A,
      marginalRelief87A,
      taxAfterRebate,
      surcharge: effectiveSurcharge,
      marginalRelief: surchargeMarginalRelief + marginalRelief87A,
      cess,
      totalTax
    };
  }

  /**
   * Evaluates HRA exemption under Section 10(13A)
   * Lowest of:
   * 1. Actual HRA received
   * 2. 50% of Basic (metro) or 40% (non-metro)
   * 3. Rent paid - 10% of Basic (0 if negative)
   */
  function calculateHraExemption(actualHra, basic, annualRent, isMetro) {
    if (annualRent <= 0 || actualHra <= 0 || basic <= 0) return 0;
    const pctCap = isMetro ? 0.50 : 0.40;
    const limit1 = actualHra;
    const limit2 = basic * pctCap;
    const limit3 = Math.max(0, annualRent - (0.10 * basic));
    return Math.min(limit1, limit2, limit3);
  }

  /**
   * Evaluates 80D Health Insurance deduction
   */
  function calculate80D(selfPremium, isSelfSenior, parentPremium, isParentSenior) {
    const selfCap = isSelfSenior ? 50000 : 25000;
    const parentCap = isParentSenior ? 50000 : 25000;
    const allowedSelf = Math.min(selfPremium || 0, selfCap);
    const allowedParents = Math.min(parentPremium || 0, parentCap);
    return allowedSelf + allowedParents;
  }

  /**
   * Full Salary Component Calculation
   */
  function computeSalaryDetails(rawSalary, profile, deductions, regime) {
    const basic = rawSalary.basic || 0;
    const hra = rawSalary.hra || 0;
    const special = rawSalary.special || 0;
    const bonus = (profile.bonusTreatment === 'include') ? (rawSalary.bonus || 0) : 0;
    const employerPf = rawSalary.employerPf || 0;
    const gratuity = rawSalary.gratuity || 0;
    const employerNps = rawSalary.employerNps || 0;
    const employerInsurance = rawSalary.employerInsurance || 0;
    const employeePf = rawSalary.employeePf || 0;
    const voluntaryNps = rawSalary.voluntaryNps || 0;
    const professionalTax = 2500; // Standard annual ceiling

    // Extra reimbursements / perks
    const lta = rawSalary.lta || 0;
    const meal = rawSalary.meal || 0;
    const fuel = rawSalary.fuel || 0;
    const telecom = rawSalary.telecom || 0;
    const joining = rawSalary.joining || 0;

    // Total CTC
    const totalCtc = basic + hra + special + bonus + employerPf + gratuity +
      employerNps + employerInsurance + lta + meal + fuel + telecom + joining;

    // STEP 1: Cash Gross Salary
    // CTC minus employer-side retirement & non-cash overheads (PF, gratuity, employer insurance, employer NPS)
    const cashGrossSalary = totalCtc - employerPf - gratuity - employerInsurance - employerNps;

    // STEP 2: Gross For Tax
    // Under Section 17(1), employer NPS contribution is legally part of salary perquisites, offset by 80CCD(2) deduction
    const grossForTax = cashGrossSalary + employerNps;

    // NPS 80CCD(2) Cap:
    // New regime: 14% of Basic for all
    // Old regime: 14% for govt, 10% for private
    let npsCapPct = 0.14;
    if (regime === 'OLD' && profile.employerType === 'private') {
      npsCapPct = 0.10;
    }
    const employerNpsDeduction = Math.min(employerNps, npsCapPct * basic);

    // Deductions
    let standardDeduction = 0;
    let hraExempt = 0;
    let deduction80C = 0;
    let deduction80D = 0;
    let deduction80CCD1B = 0;
    let homeLoanDeduction = 0;
    let otherDeductionsTotal = 0;

    if (regime === 'NEW') {
      standardDeduction = 75000;
      // New regime allows only Standard Deduction + Employer NPS 80CCD(2)
    } else {
      // OLD REGIME
      standardDeduction = 50000;

      // HRA Exemption
      hraExempt = calculateHraExemption(hra, basic, (deductions && deductions.annualRent) || 0, profile.isMetro);

      // 80C combined limit: EPF counts inside this!
      const other80cVal = (deductions && deductions.other80C) || 0;
      const raw80C = employeePf + other80cVal;
      deduction80C = Math.min(raw80C, 150000);

      // 80CCD(1B) Self NPS: up to 50k
      deduction80CCD1B = Math.min((deductions && deductions.nps80CCD1B) || 0, 50000);

      // 80D Health Insurance
      deduction80D = calculate80D(
        deductions ? deductions.insuranceSelf : 0,
        deductions ? deductions.isSelfSenior : false,
        deductions ? deductions.insuranceParents : 0,
        deductions ? deductions.isParentSenior : false
      );

      // Home loan interest 24(b)
      homeLoanDeduction = Math.min((deductions && deductions.homeLoanInterest) || 0, 200000);

      // Other deductions (80E, 80G, etc.)
      otherDeductionsTotal = (deductions && deductions.otherDeductions) || 0;
    }

    const totalDeductions = standardDeduction + employerNpsDeduction +
      hraExempt + deduction80C + deduction80CCD1B +
      deduction80D + homeLoanDeduction + otherDeductionsTotal;

    // STEP 3: Taxable Income & Tax
    const taxableIncome = Math.max(0, grossForTax - totalDeductions);
    const taxDetails = computeTaxDetails(taxableIncome, regime, profile.ageBracket);

    // STEP 4: Net Take-Home (uses Cash Gross)
    const netTakeHome = cashGrossSalary -
      taxDetails.totalTax -
      employeePf -
      voluntaryNps -
      professionalTax;

    return {
      totalCtc,
      cashGrossSalary,
      grossForTax,
      basic,
      hra,
      special,
      bonus,
      employerPf,
      gratuity,
      employerNps,
      employerNpsDeduction,
      employeePf,
      voluntaryNps,
      professionalTax,
      standardDeduction,
      hraExempt,
      deduction80C,
      deduction80CCD1B,
      deduction80D,
      homeLoanDeduction,
      otherDeductionsTotal,
      totalDeductions,
      taxableIncome,
      taxDetails,
      netTakeHome,
      monthlyTakeHome: Math.round(netTakeHome / 12)
    };
  }

  /* ─────────────────────────────────────────────────────────────────
     4. DEFAULT ASSUMPTIONS BUILDER (QUICK MODE)
     ───────────────────────────────────────────────────────────────── */
  function generateDefaultsFromCtc(totalCtc, isMetro, pfBasis) {
    // Basic = 40% of CTC
    const basic = Math.round(totalCtc * 0.40);

    // HRA = 50% of Basic if metro, else 40%
    const hra = Math.round(basic * (isMetro ? 0.50 : 0.40));

    // Employer & Employee PF: 12% of Basic (or capped at 1800/mo = 21600/yr if pfBasis == 'capped')
    let employerPf = Math.round(basic * 0.12);
    let employeePf = Math.round(basic * 0.12);
    if (pfBasis === 'capped') {
      employerPf = Math.min(employerPf, 21600);
      employeePf = Math.min(employeePf, 21600);
    }

    // Gratuity provision = 4.81% of Basic
    const gratuity = Math.round(basic * 0.0481);

    // Special Allowance = CTC minus employer costs minus basic minus hra
    const special = Math.max(0, totalCtc - basic - hra - employerPf - gratuity);

    return {
      basic,
      hra,
      special,
      bonus: 0,
      employerPf,
      gratuity,
      employerNps: 0,
      employerInsurance: 0,
      employeePf,
      voluntaryNps: 0,
      lta: 0,
      meal: 0,
      fuel: 0,
      telecom: 0,
      joining: 0
    };
  }

  /* ─────────────────────────────────────────────────────────────────
     5. ESOP & TOTAL COMPENSATION ENGINE
     ───────────────────────────────────────────────────────────────── */

  /**
   * Calculates ESOP vesting schedule per year
   * @param {number} totalGrant Total ESOP / RSUs grant value in INR
   * @param {number} vestingYears Number of vesting years (typically 1 to 5, default 4)
   * @param {string} scheduleType 'equal' | 'custom'
   * @param {Array<number>} customPercentages Array of percentages per year, e.g. [10, 20, 30, 40]
   * @param {number} totalUnits Optional number of shares / options granted
   */
  function calculateEsopVesting(totalGrant, vestingYears = 4, scheduleType = 'equal', customPercentages = [], totalUnits = 0) {
    const grant = Math.max(0, parseINR(totalGrant));
    const years = clamp(parseInt(vestingYears, 10) || 4, 1, 10);
    const units = Math.max(0, parseINR(totalUnits));
    const schedule = [];

    if (scheduleType === 'equal') {
      const equalPct = years > 0 ? (100 / years) : 0;
      const equalAmount = Math.round(grant / years);
      const equalUnits = Math.round(units / years);
      let cumulativeAmt = 0;
      let cumulativeUnits = 0;

      for (let y = 1; y <= years; y++) {
        // Last year takes remainder to avoid rounding drift
        const amt = (y === years) ? (grant - cumulativeAmt) : equalAmount;
        const u = (y === years) ? (units - cumulativeUnits) : equalUnits;
        cumulativeAmt += amt;
        cumulativeUnits += u;
        schedule.push({
          year: y,
          percent: parseFloat(equalPct.toFixed(2)),
          amount: Math.max(0, amt),
          units: Math.max(0, u)
        });
      }
    } else {
      // Custom schedule
      let cumulativeAmt = 0;
      let cumulativeUnits = 0;
      for (let y = 1; y <= years; y++) {
        const pct = customPercentages[y - 1] !== undefined ? clamp(parseFloat(customPercentages[y - 1]) || 0, 0, 100) : 0;
        const amt = Math.round(grant * (pct / 100));
        const u = Math.round(units * (pct / 100));
        cumulativeAmt += amt;
        cumulativeUnits += u;
        schedule.push({
          year: y,
          percent: pct,
          amount: amt,
          units: u
        });
      }
    }

    const year1Amount = schedule.length > 0 ? schedule[0].amount : 0;
    const year1Units = schedule.length > 0 ? schedule[0].units : 0;
    const averageAnnualEsop = years > 0 ? Math.round(grant / years) : 0;
    const averageAnnualUnits = years > 0 ? Math.round(units / years) : 0;

    return {
      totalGrant: grant,
      totalUnits: units,
      vestingYears: years,
      scheduleType,
      schedule,
      year1Amount,
      year1Units,
      averageAnnualEsop,
      averageAnnualUnits
    };
  }

  /**
   * Computes Total Compensation (CTC + ESOP Annual Component)
   * @param {number} ctc Cost to Company (annual)
   * @param {number} esopAnnual Annual ESOP value (Year 1 or average)
   * @param {number} netTakeHome Annual In-hand salary
   */
  function computeTotalCompensation(ctc, esopAnnual = 0, netTakeHome = 0) {
    const cleanCtc = Math.max(0, parseINR(ctc));
    const cleanEsop = Math.max(0, parseINR(esopAnnual));
    const cleanTakeHome = Math.max(0, parseINR(netTakeHome));

    return {
      ctc: cleanCtc,
      esopAnnual: cleanEsop,
      totalCompensation: cleanCtc + cleanEsop,
      monthlyCtc: Math.round(cleanCtc / 12),
      monthlyTotalCompensation: Math.round((cleanCtc + cleanEsop) / 12),
      netTakeHome: cleanTakeHome,
      totalRealizedValue: cleanTakeHome + cleanEsop, // Cash Take-home + Vested equity
      equitySharePct: (cleanCtc + cleanEsop > 0) ? ((cleanEsop / (cleanCtc + cleanEsop)) * 100).toFixed(1) : '0'
    };
  }

  /**
   * Sums all CTC components (excluding employee deductions like employeePf)
   * @param {Object} c Map of component amounts
   * @returns {number} Total CTC in INR
   */
  function calculateTotalCtcFromComponents(c) {
    if (!c) return 0;
    const basic = parseINR(c.basic);
    const hra = parseINR(c.hra);
    const special = parseINR(c.special);
    const bonus = parseINR(c.bonus);
    const employerPf = parseINR(c.employerPf);
    const gratuity = parseINR(c.gratuity);
    const employerNps = parseINR(c.employerNps);
    const employerInsurance = parseINR(c.employerInsurance);
    const lta = parseINR(c.lta);
    const meal = parseINR(c.meal);
    const fuel = parseINR(c.fuel);
    const telecom = parseINR(c.telecom);
    const joining = parseINR(c.joining);

    return basic + hra + special + bonus + employerPf + gratuity +
      employerNps + employerInsurance + lta + meal + fuel + telecom + joining;
  }

  return {
    formatINR,
    formatINRPlain,
    parseINR,
    formatAsIndianCurrency,
    findNewCursorPosition,
    clamp,
    METRO_CITIES,
    isMetroCity,
    calculateSurchargeWithMarginalRelief,
    computeBaseTax,
    computeTaxDetails,
    calculateHraExemption,
    calculate80D,
    computeSalaryDetails,
    generateDefaultsFromCtc,
    calculateEsopVesting,
    computeTotalCompensation,
    calculateTotalCtcFromComponents
  };
});
