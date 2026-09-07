/**
 * India Salary Offer & Tax Regime Comparator (FY 2026-27)
 * App UI Controller, Multi-Offer Manager, ESOP Engine & Reactive Pipeline
 */

(function () {
  'use strict';

  // Rely on pure modules
  const Calc = window.SalaryCalculator;
  const Storage = window.SalaryStorage;

  if (!Calc || !Storage) {
    console.error('Required dependencies SalaryCalculator or SalaryStorage missing.');
    return;
  }

  /* ─────────────────────────────────────────────────────────────────
     1. APPLICATION STATE
     ───────────────────────────────────────────────────────────────── */
  let appState = Storage.loadAutoSave() || Storage.getDefaultState();

  // Ensure robust schema fallback
  if (!appState.offers || !Array.isArray(appState.offers) || appState.offers.length === 0) {
    appState.offers = Storage.getDefaultState().offers;
  }
  if (!appState.activeOfferId || !appState.offers.some(o => o.id === appState.activeOfferId)) {
    appState.activeOfferId = appState.offers[0].id;
  }

  // ── HTML Sanitization Utility ──
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ── Toast Notification Utility ──
  function showToast(message, type = 'info') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    const toast = document.createElement('div');
    toast.className = `toast-pill ${type}`;
    let iconSvg = '';
    if (type === 'error') {
      iconSvg = '<svg class="btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    } else if (type === 'success') {
      iconSvg = '<svg class="btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    } else {
      iconSvg = '<svg class="btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }
    toast.innerHTML = `<span class="toast-icon">${iconSvg}</span><span class="toast-msg">${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // ── Indian Currency Live Formatting Handlers ──
  function handleCurrencyInput(input) {
    const rawVal = input.value;
    const cursorPos = input.selectionStart ?? rawVal.length;

    // Count how many digits were before cursor
    const digitsBeforeCursor = (rawVal.slice(0, cursorPos).match(/\d/g) || []).length;

    const formatted = Calc.formatAsIndianCurrency(rawVal);
    input.value = formatted;

    const newPos = Calc.findNewCursorPosition(formatted, digitsBeforeCursor);
    input.setSelectionRange(newPos, newPos);

    // Remove is-default styling if present (user explicitly modified the field)
    if (input.classList.contains('is-default')) {
      input.classList.remove('is-default');
    }
  }

  function handleCurrencyKeydown(e, input) {
    if (e.key === 'Backspace') {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      // If single cursor position and character right before cursor is a comma
      if (start === end && start > 0 && input.value[start - 1] === ',') {
        e.preventDefault();
        const val = input.value;
        const before = val.slice(0, start - 2); // delete the digit before the comma
        const after = val.slice(start);
        const newVal = before + after;
        const digitsBefore = (val.slice(0, start - 2).match(/\d/g) || []).length;
        const formatted = Calc.formatAsIndianCurrency(newVal);
        input.value = formatted;
        const newPos = Calc.findNewCursorPosition(formatted, digitsBefore);
        input.setSelectionRange(newPos, newPos);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else if (e.key === 'Delete') {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      // If single cursor position and character right after cursor is a comma
      if (start === end && start < input.value.length && input.value[start] === ',') {
        e.preventDefault();
        const val = input.value;
        const before = val.slice(0, start);
        const after = val.slice(start + 2); // delete the digit after the comma
        const newVal = before + after;
        const digitsBefore = (val.slice(0, start).match(/\d/g) || []).length;
        const formatted = Calc.formatAsIndianCurrency(newVal);
        input.value = formatted;
        const newPos = Calc.findNewCursorPosition(formatted, digitsBefore);
        input.setSelectionRange(newPos, newPos);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }

  // Auto-save debouncer
  let autoSaveTimeout = null;
  function triggerAutoSave() {
    clearTimeout(autoSaveTimeout);
    const statusText = document.getElementById('storage-status-text');
    if (statusText) statusText.textContent = 'Saving...';

    autoSaveTimeout = setTimeout(() => {
      harvestAll();
      Storage.saveAutoSave(appState);
      if (statusText) statusText.textContent = 'Auto-saved';
    }, 400);
  }

  // ── Debounced Recalculation ──
  let recalcTimeout = null;
  function debouncedRecalc() {
    clearTimeout(recalcTimeout);
    recalcTimeout = setTimeout(() => {
      harvestAll();
      recalculateAll();
    }, 120);
  }

  /* ─────────────────────────────────────────────────────────────────
     2. DOM ELEMENTS CACHE
     ───────────────────────────────────────────────────────────────── */
  const el = {
    // Top Nav / Storage Actions
    storageStatus: document.getElementById('storage-status'),
    storageStatusText: document.getElementById('storage-status-text'),
    btnOpenProfiles: document.getElementById('btn-open-profiles'),
    btnExportJson: document.getElementById('btn-export-json'),
    btnTriggerImport: document.getElementById('btn-trigger-import'),
    fileImportInput: document.getElementById('file-import-input'),
    btnResetState: document.getElementById('btn-reset-state'),

    // Profiles Modal
    profilesModal: document.getElementById('profiles-modal'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    newProfileNameInput: document.getElementById('new-profile-name-input'),
    btnSaveCurrentProfile: document.getElementById('btn-save-current-profile'),
    savedProfilesList: document.getElementById('saved-profiles-list'),
    btnLoadSampleData: document.getElementById('btn-load-sample-data'),
    btnClearAllData: document.getElementById('btn-clear-all-data'),

    // Profile Card
    ageSelector: document.getElementById('age-selector'),
    ageRadios: document.querySelectorAll('input[name="age-bracket"]'),
    citySelect: document.getElementById('profile-city'),
    pfCeilingSelect: document.getElementById('pf-ceiling'),
    bonusTreatmentSelect: document.getElementById('bonus-treatment'),
    employerTypeSelect: document.getElementById('employer-type'),

    // Current Salary Card
    currentEnabled: document.getElementById('current-salary-enabled'),
    currentModeSwitch: document.getElementById('current-mode-switch'),
    currentQuickGroup: document.getElementById('current-quick-group'),
    currentDetailedGroup: document.getElementById('current-detailed-group'),
    currentBody: document.getElementById('current-salary-body'),
    currentDisabledMsg: document.getElementById('current-salary-disabled-msg'),
    currentCtcInput: document.getElementById('current-ctc'),
    currentCtcSlider: document.getElementById('current-ctc-slider'),
    currentCtcMonthly: document.getElementById('current-ctc-monthly'),

    curBasic: document.getElementById('cur-basic'),
    curHra: document.getElementById('cur-hra'),
    curSpecial: document.getElementById('cur-special'),
    curBonus: document.getElementById('cur-bonus'),
    curEmployerPf: document.getElementById('cur-employer-pf'),
    curGratuity: document.getElementById('cur-gratuity'),
    curEmployerNps: document.getElementById('cur-employer-nps'),
    curEmployeePf: document.getElementById('cur-employee-pf'),
    curBasicSub: document.getElementById('cur-basic-sub'),
    curHraSub: document.getElementById('cur-hra-sub'),
    curDetailedTotal: document.getElementById('cur-detailed-total'),
    curDetailedTotalSub: document.getElementById('cur-detailed-total-sub'),

    // Multi-Offer Strip & Active Offer Controls
    offersCountBadge: document.getElementById('offers-count-badge'),
    offerTabsStrip: document.getElementById('offer-tabs-strip'),
    offerLabelInput: document.getElementById('offer-label-input'),
    offerCompanyInput: document.getElementById('offer-company-input'),
    offerModeSwitch: document.getElementById('offer-mode-switch'),
    offerQuickGroup: document.getElementById('offer-quick-group'),
    offerDetailedGroup: document.getElementById('offer-detailed-group'),
    offerCtcInput: document.getElementById('offer-ctc'),
    offerCtcSlider: document.getElementById('offer-ctc-slider'),
    offerCtcMonthly: document.getElementById('offer-ctc-monthly'),

    offBasic: document.getElementById('off-basic'),
    offHra: document.getElementById('off-hra'),
    offSpecial: document.getElementById('off-special'),
    offBonus: document.getElementById('off-bonus'),
    offEmployerPf: document.getElementById('off-employer-pf'),
    offGratuity: document.getElementById('off-gratuity'),
    offEmployerNps: document.getElementById('off-employer-nps'),
    offEmployeePf: document.getElementById('off-employee-pf'),
    offBasicSub: document.getElementById('off-basic-sub'),
    offHraSub: document.getElementById('off-hra-sub'),
    offDetailedTotal: document.getElementById('off-detailed-total'),
    offDetailedTotalSub: document.getElementById('off-detailed-total-sub'),

    // Advanced Allowances
    advToggle: document.getElementById('adv-allowance-toggle'),
    advContent: document.getElementById('adv-allowance-content'),
    advIcon: document.getElementById('adv-icon'),
    offLta: document.getElementById('off-lta'),
    offMeal: document.getElementById('off-meal'),
    offFuel: document.getElementById('off-fuel'),
    offTelecom: document.getElementById('off-telecom'),
    offJoining: document.getElementById('off-joining'),

    // ESOP Section
    esopCard: document.getElementById('esop-card'),
    esopEnabled: document.getElementById('esop-enabled'),
    esopBody: document.getElementById('esop-body'),
    esopModeSwitch: document.getElementById('esop-mode-switch'),
    esopValueGroup: document.getElementById('esop-value-group'),
    esopUnitsGroup: document.getElementById('esop-units-group'),
    esopUnitsInput: document.getElementById('esop-units-input'),
    esopPriceInput: document.getElementById('esop-price-input'),
    esopPricePrefix: document.getElementById('esop-price-prefix'),
    esopCurrencySwitch: document.getElementById('esop-currency-switch'),
    esopUsdRateRow: document.getElementById('esop-usd-rate-row'),
    esopUsdRateInput: document.getElementById('esop-usd-rate-input'),
    esopCalcMath: document.getElementById('esop-calc-math'),
    esopCalcTotal: document.getElementById('esop-calc-total'),
    esopGrantInput: document.getElementById('esop-grant-input'),
    esopYearsSelect: document.getElementById('esop-years-select'),
    esopScheduleTypeSwitch: document.getElementById('esop-schedule-type-switch'),
    esopScheduleSummary: document.getElementById('esop-schedule-summary'),
    esopCustomPctsContainer: document.getElementById('esop-custom-pcts-container'),
    esopCustomInputsGrid: document.getElementById('esop-custom-inputs-grid'),
    esopPctTotalFeedback: document.getElementById('esop-pct-total-feedback'),
    esopYearsScheduleDisplay: document.getElementById('esop-years-schedule-display'),
    esopYr1Val: document.getElementById('esop-yr1-val'),
    esopAvgVal: document.getElementById('esop-avg-val'),

    // Deductions
    rentAnnual: document.getElementById('rent-annual'),
    rentSlider: document.getElementById('rent-slider'),
    rentMonthlyLbl: document.getElementById('rent-monthly-lbl'),
    investments80c: document.getElementById('investments-80c'),
    total80cClaimed: document.getElementById('total-80c-claimed'),
    total80cRoom: document.getElementById('total-80c-room'),
    insuranceSelf: document.getElementById('insurance-80d-self'),
    selfSenior: document.getElementById('self-senior'),
    insuranceParents: document.getElementById('insurance-80d-parents'),
    parentsSenior: document.getElementById('parents-senior'),
    homeloanInterest: document.getElementById('homeloan-interest'),
    nps80ccd1b: document.getElementById('nps-80ccd1b'),
    otherDeductions: document.getElementById('other-deductions'),

    // Leaderboard
    leaderboardActiveTag: document.getElementById('leaderboard-active-tag'),
    leaderboardTableBody: document.getElementById('leaderboard-table-body'),

    // Flow A: Hike Comparison
    panelHike: document.getElementById('panel-hike-comparison'),
    flowANotice: document.getElementById('flow-a-notice'),
    btnEnableCurrent: document.getElementById('btn-enable-current'),
    hikeAnalysisTitle: document.getElementById('hike-analysis-title'),
    colOfferNameHeader: document.getElementById('col-offer-name-header'),
    grossHikePct: document.getElementById('gross-hike-pct'),
    grossHikeAbs: document.getElementById('gross-hike-abs'),
    netHikePct: document.getElementById('net-hike-pct'),
    netHikeAbs: document.getElementById('net-hike-abs'),
    hikeErosionPts: document.getElementById('hike-erosion-pts'),
    hikeErosionDesc: document.getElementById('hike-erosion-desc'),
    plainCallout: document.getElementById('plain-language-callout'),
    compTableBody: document.getElementById('comparison-table-body'),

    // Total Compensation Card (CTC + ESOP)
    totalCompCard: document.getElementById('total-comp-card'),
    totalCompEquityShare: document.getElementById('total-comp-equity-share'),
    tcCtcVal: document.getElementById('tc-ctc-val'),
    tcCtcMo: document.getElementById('tc-ctc-mo'),
    tcEsopVal: document.getElementById('tc-esop-val'),
    tcEsopSub: document.getElementById('tc-esop-sub'),
    tcTotalVal: document.getElementById('tc-total-val'),
    tcRealizedVal: document.getElementById('tc-realized-val'),

    // Flow B: Regime Picker
    panelRegimePicker: document.getElementById('panel-regime-picker'),
    regimePickerTitle: document.getElementById('regime-picker-title'),
    recBanner: document.getElementById('rec-banner'),
    recWinnerBadge: document.getElementById('rec-winner-badge'),
    recWinnerTitle: document.getElementById('rec-winner-title'),
    recSavingsVal: document.getElementById('rec-savings-val'),
    recSavingsSub: document.getElementById('rec-savings-sub'),
    sensitivityText: document.getElementById('sensitivity-text'),

    cardOld: document.getElementById('card-regime-old'),
    cardNew: document.getElementById('card-regime-new'),
    badgeWinnerOld: document.getElementById('badge-winner-old'),
    badgeWinnerNew: document.getElementById('badge-winner-new'),

    oldTakehomeAnnual: document.getElementById('old-takehome-annual'),
    oldTakehomeMonthly: document.getElementById('old-takehome-monthly'),
    oldCashGross: document.getElementById('old-cash-gross'),
    oldHraExempt: document.getElementById('old-hra-exempt'),
    oldOtherDeduct: document.getElementById('old-other-deduct'),
    oldTaxableIncome: document.getElementById('old-taxable-income'),
    oldBaseTax: document.getElementById('old-base-tax'),
    oldRebate87a: document.getElementById('old-rebate-87a'),
    oldSurcharge: document.getElementById('old-surcharge'),
    oldCess: document.getElementById('old-cess'),
    oldTotalTax: document.getElementById('old-total-tax'),
    oldEmpDeduct: document.getElementById('old-emp-deduct'),

    newTakehomeAnnual: document.getElementById('new-takehome-annual'),
    newTakehomeMonthly: document.getElementById('new-takehome-monthly'),
    newCashGross: document.getElementById('new-cash-gross'),
    newNpsExempt: document.getElementById('new-nps-exempt'),
    newTaxableIncome: document.getElementById('new-taxable-income'),
    newBaseTax: document.getElementById('new-base-tax'),
    newRebate87a: document.getElementById('new-rebate-87a'),
    newSurcharge: document.getElementById('new-surcharge'),
    newCess: document.getElementById('new-cess'),
    newTotalTax: document.getElementById('new-total-tax'),
    newEmpDeduct: document.getElementById('new-emp-deduct'),

    // Charts
    donutChartTitle: document.getElementById('donut-chart-title'),
    donutSvg: document.getElementById('donut-svg'),
    donutTotal: document.getElementById('donut-center-total'),
    donutLegend: document.getElementById('donut-legend'),
    stackedBarContainer: document.getElementById('stacked-bar-container')
  };

  /* ─────────────────────────────────────────────────────────────────
     3. HELPER GETTERS & ACTIVE OFFER RESOLUTION
     ───────────────────────────────────────────────────────────────── */
  function getActiveOffer() {
    let offer = appState.offers.find(o => o.id === appState.activeOfferId);
    if (!offer) {
      offer = appState.offers[0];
      appState.activeOfferId = offer.id;
    }
    return offer;
  }

  function getProfile() {
    let ageBracket = 'under60';
    el.ageRadios.forEach(r => {
      if (r.checked) ageBracket = r.value;
    });

    const city = el.citySelect.value;
    return {
      ageBracket,
      city,
      isMetro: Calc.isMetroCity(city),
      pfBasis: el.pfCeilingSelect.value,
      bonusTreatment: el.bonusTreatmentSelect.value,
      employerType: el.employerTypeSelect.value
    };
  }

  function getDeductions() {
    return {
      annualRent: Calc.parseINR(el.rentAnnual.value),
      other80C: Calc.parseINR(el.investments80c.value),
      insuranceSelf: Calc.parseINR(el.insuranceSelf.value),
      isSelfSenior: el.selfSenior.checked,
      insuranceParents: Calc.parseINR(el.insuranceParents.value),
      isParentSenior: el.parentsSenior.checked,
      homeLoanInterest: Calc.parseINR(el.homeloanInterest.value),
      nps80CCD1B: Calc.parseINR(el.nps80ccd1b.value),
      otherDeductions: Calc.parseINR(el.otherDeductions.value)
    };
  }

  /* ─────────────────────────────────────────────────────────────────
     4. MULTI-OFFER TAB STRIP MANAGEMENT
     ───────────────────────────────────────────────────────────────── */
  function renderOfferTabs() {
    const active = getActiveOffer();
    const count = appState.offers.length;
    el.offersCountBadge.textContent = `${count} of 5 Offers`;

    let html = '';
    appState.offers.forEach((offer, idx) => {
      const isActive = (offer.id === active.id);
      const title = escapeHtml(offer.label || `Offer ${String.fromCharCode(65 + idx)}`);
      const sub = offer.company ? ` (${escapeHtml(offer.company)})` : '';

      html += `
        <button type="button" class="offer-tab-btn ${isActive ? 'active' : ''}" data-offer-id="${offer.id}">
          <span class="tab-label">
            <svg class="tab-icon" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            <span>${title}${sub}</span>
          </span>
          ${count > 1 ? `<span class="offer-tab-close" data-del-id="${offer.id}" title="Remove this offer">&times;</span>` : ''}
        </button>
      `;
    });

    if (count < 5) {
      html += `
        <button type="button" class="offer-tab-add" id="btn-add-offer-tab" title="Add another offer to compare (max 5)">
          <span class="tab-label">
            <svg class="tab-icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            <span>Add Offer</span>
          </span>
        </button>
      `;
    }

    el.offerTabsStrip.innerHTML = html;

    // Attach tab click events
    el.offerTabsStrip.querySelectorAll('.offer-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (e.target.classList.contains('offer-tab-close')) {
          const delId = e.target.dataset.delId;
          removeOffer(delId);
          return;
        }
        const offerId = btn.dataset.offerId;
        if (offerId !== appState.activeOfferId) {
          switchOffer(offerId);
        }
      });
    });

    const addBtn = document.getElementById('btn-add-offer-tab');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        addNewOffer();
      });
    }
  }

  function addNewOffer() {
    if (appState.offers.length >= 5) return;
    const nextIdx = appState.offers.length;
    const letter = String.fromCharCode(65 + nextIdx);
    const newId = 'offer_' + Date.now();

    // Baseline from active offer or default
    const active = getActiveOffer();
    const newCtc = Math.round((active.ctc || 2000000) * 1.15); // suggest 15% hike default
    const prof = getProfile();
    const defaults = Calc.generateDefaultsFromCtc(newCtc, prof.isMetro, prof.pfBasis);

    const newOffer = {
      id: newId,
      label: `Offer ${letter}`,
      company: '',
      mode: 'quick',
      ctc: newCtc,
      details: defaults,
      esop: {
        enabled: false,
        grant: Math.round(newCtc * 0.5),
        vestingYears: 4,
        scheduleType: 'equal',
        customPcts: [25, 25, 25, 25]
      }
    };

    appState.offers.push(newOffer);
    appState.activeOfferId = newId;
    harvestAll();
    populateActiveOfferForm();
    renderOfferTabs();
    recalculateAll();
    triggerAutoSave();
  }

  function removeOffer(offerId) {
    if (appState.offers.length <= 1) return;
    const target = appState.offers.find(o => o.id === offerId);
    const targetLabel = target ? (target.label || 'this offer') : 'this offer';
    if (!confirm(`Delete "${targetLabel}" and all its data? This cannot be undone.`)) return;
    appState.offers = appState.offers.filter(o => o.id !== offerId);
    if (appState.activeOfferId === offerId) {
      appState.activeOfferId = appState.offers[0].id;
    }
    harvestAll();
    populateActiveOfferForm();
    renderOfferTabs();
    recalculateAll();
    triggerAutoSave();
  }

  function switchOffer(offerId) {
    // Save current active form state before switching
    harvestAll();
    appState.activeOfferId = offerId;
    populateActiveOfferForm();
    renderOfferTabs();
    recalculateAll();
    triggerAutoSave();
  }

  /* ─────────────────────────────────────────────────────────────────
     5. POPULATE & HARVEST ACTIVE OFFER FORM
     ───────────────────────────────────────────────────────────────── */
  function populateActiveOfferForm() {
    const offer = getActiveOffer();

    // Labels
    el.offerLabelInput.value = offer.label || '';
    el.offerCompanyInput.value = offer.company || '';

    // Mode switch
    const mode = offer.mode || 'quick';
    el.offerModeSwitch.querySelectorAll('.pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    if (mode === 'detailed') {
      el.offerDetailedGroup.style.display = 'block';
      el.offerQuickGroup.style.display = 'none';
    } else {
      el.offerDetailedGroup.style.display = 'none';
      el.offerQuickGroup.style.display = 'block';
    }

    // Ensure details exist
    if (!offer.details || Object.keys(offer.details).length === 0) {
      const prof = getProfile();
      offer.details = Calc.generateDefaultsFromCtc(offer.ctc, prof.isMetro, prof.pfBasis);
    }

    // Detailed values
    const d = offer.details || {};
    el.offBasic.value = Calc.formatINRPlain(d.basic);
    el.offHra.value = Calc.formatINRPlain(d.hra);
    el.offSpecial.value = Calc.formatINRPlain(d.special);
    el.offBonus.value = Calc.formatINRPlain(d.bonus);
    el.offEmployerPf.value = Calc.formatINRPlain(d.employerPf);
    el.offGratuity.value = Calc.formatINRPlain(d.gratuity);
    el.offEmployerNps.value = Calc.formatINRPlain(d.employerNps);
    el.offEmployeePf.value = Calc.formatINRPlain(d.employeePf);

    if (el.offLta) el.offLta.value = Calc.formatINRPlain(d.lta || 0);
    if (el.offMeal) el.offMeal.value = Calc.formatINRPlain(d.meal || 0);
    if (el.offFuel) el.offFuel.value = Calc.formatINRPlain(d.fuel || 0);
    if (el.offTelecom) el.offTelecom.value = Calc.formatINRPlain(d.telecom || 0);
    if (el.offJoining) el.offJoining.value = Calc.formatINRPlain(d.joining || 0);

    if (mode === 'detailed') {
      updateOfferedDetailedTotal();
    } else {
      // Quick values
      el.offerCtcInput.value = Calc.formatINRPlain(offer.ctc);
      el.offerCtcSlider.value = offer.ctc;
      el.offerCtcMonthly.textContent = Calc.formatINR(offer.ctc / 12) + '/mo';

      if (el.offDetailedTotal) {
        el.offDetailedTotal.textContent = Calc.formatINR(offer.ctc) + ' / yr';
        el.offDetailedTotalSub.textContent = Calc.formatINR(offer.ctc / 12) + ' / mo';
      }
      if (el.offBasicSub) {
        el.offBasicSub.textContent = offer.ctc > 0 ? ((d.basic || 0) / offer.ctc * 100).toFixed(1) + '% of CTC' : '0% of CTC';
      }
      if (el.offHraSub) {
        el.offHraSub.textContent = (d.basic || 0) > 0 ? ((d.hra || 0) / (d.basic || 1) * 100).toFixed(1) + '% of Basic' : '0% of Basic';
      }
    }

    // ESOP values
    const esop = offer.esop || {
      enabled: false,
      entryMode: 'value',
      units: 1000,
      pricePerUnit: 1200,
      currency: 'INR',
      usdRate: 87,
      grant: 1200000,
      vestingYears: 4,
      scheduleType: 'equal',
      customPcts: []
    };
    el.esopEnabled.checked = !!esop.enabled;
    el.esopBody.style.display = esop.enabled ? 'flex' : 'none';

    // Entry mode switch
    const entryMode = esop.entryMode || 'value';
    if (el.esopModeSwitch) {
      el.esopModeSwitch.querySelectorAll('.pill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === entryMode);
      });
    }
    if (el.esopValueGroup && el.esopUnitsGroup) {
      if (entryMode === 'units') {
        el.esopValueGroup.style.display = 'none';
        el.esopUnitsGroup.style.display = 'block';
      } else {
        el.esopValueGroup.style.display = 'block';
        el.esopUnitsGroup.style.display = 'none';
      }
    }

    if (el.esopUnitsInput) el.esopUnitsInput.value = Calc.formatINRPlain(esop.units !== undefined ? esop.units : 1000);
    if (el.esopPriceInput) el.esopPriceInput.value = Calc.formatINRPlain(esop.pricePerUnit !== undefined ? esop.pricePerUnit : 1200);

    const curr = esop.currency || 'INR';
    if (el.esopCurrencySwitch) {
      el.esopCurrencySwitch.querySelectorAll('.pill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.currency === curr);
      });
    }
    if (el.esopPricePrefix) el.esopPricePrefix.textContent = curr === 'USD' ? '$' : '₹';
    if (el.esopUsdRateRow) el.esopUsdRateRow.style.display = curr === 'USD' ? 'block' : 'none';
    if (el.esopUsdRateInput) el.esopUsdRateInput.value = esop.usdRate || 87;

    el.esopGrantInput.value = Calc.formatINRPlain(esop.grant !== undefined ? esop.grant : 1200000);
    el.esopYearsSelect.value = (esop.vestingYears || 4).toString();

    // Schedule Type switch
    const schedType = esop.scheduleType || 'equal';
    el.esopScheduleTypeSwitch.querySelectorAll('.seg-label').forEach(lbl => {
      const type = lbl.dataset.type;
      const isAct = (type === schedType);
      lbl.classList.toggle('active', isAct);
      const radio = lbl.querySelector('input');
      if (radio) radio.checked = isAct;
    });

    renderEsopScheduleSection();
  }

  function updateOfferedDetailedTotal() {
    const basic = Calc.parseINR(el.offBasic ? el.offBasic.value : 0);
    const hra = Calc.parseINR(el.offHra ? el.offHra.value : 0);
    const special = Calc.parseINR(el.offSpecial ? el.offSpecial.value : 0);
    const bonus = Calc.parseINR(el.offBonus ? el.offBonus.value : 0);
    const employerPf = Calc.parseINR(el.offEmployerPf ? el.offEmployerPf.value : 0);
    const gratuity = Calc.parseINR(el.offGratuity ? el.offGratuity.value : 0);
    const employerNps = Calc.parseINR(el.offEmployerNps ? el.offEmployerNps.value : 0);
    const employeePf = Calc.parseINR(el.offEmployeePf ? el.offEmployeePf.value : 0);
    const lta = el.offLta ? Calc.parseINR(el.offLta.value) : 0;
    const meal = el.offMeal ? Calc.parseINR(el.offMeal.value) : 0;
    const fuel = el.offFuel ? Calc.parseINR(el.offFuel.value) : 0;
    const telecom = el.offTelecom ? Calc.parseINR(el.offTelecom.value) : 0;
    const joining = el.offJoining ? Calc.parseINR(el.offJoining.value) : 0;

    const components = {
      basic, hra, special, bonus, employerPf, gratuity,
      employerNps, employeePf, lta, meal, fuel, telecom, joining
    };

    const totalSum = Calc.calculateTotalCtcFromComponents(components);

    if (el.offDetailedTotal) {
      el.offDetailedTotal.textContent = Calc.formatINR(totalSum) + ' / yr';
    }
    if (el.offDetailedTotalSub) {
      el.offDetailedTotalSub.textContent = Calc.formatINR(totalSum / 12) + ' / mo';
    }
    if (el.offBasicSub) {
      el.offBasicSub.textContent = totalSum > 0 ? (basic / totalSum * 100).toFixed(1) + '% of CTC' : '0% of CTC';
    }
    if (el.offHraSub) {
      el.offHraSub.textContent = basic > 0 ? (hra / basic * 100).toFixed(1) + '% of Basic' : '0% of Basic';
    }

    if (el.offerCtcInput) el.offerCtcInput.value = Calc.formatINRPlain(totalSum);
    if (el.offerCtcSlider) el.offerCtcSlider.value = totalSum;
    if (el.offerCtcMonthly) el.offerCtcMonthly.textContent = Calc.formatINR(totalSum / 12) + '/mo';

    const active = getActiveOffer();
    if (active) {
      active.ctc = totalSum;
      active.details = components;
    }

    return totalSum;
  }

  function updateCurrentDetailedTotal() {
    const basic = Calc.parseINR(el.curBasic ? el.curBasic.value : 0);
    const hra = Calc.parseINR(el.curHra ? el.curHra.value : 0);
    const special = Calc.parseINR(el.curSpecial ? el.curSpecial.value : 0);
    const bonus = Calc.parseINR(el.curBonus ? el.curBonus.value : 0);
    const employerPf = Calc.parseINR(el.curEmployerPf ? el.curEmployerPf.value : 0);
    const gratuity = Calc.parseINR(el.curGratuity ? el.curGratuity.value : 0);
    const employerNps = Calc.parseINR(el.curEmployerNps ? el.curEmployerNps.value : 0);
    const employeePf = Calc.parseINR(el.curEmployeePf ? el.curEmployeePf.value : 0);

    const components = {
      basic, hra, special, bonus, employerPf, gratuity,
      employerNps, employeePf
    };

    const totalSum = Calc.calculateTotalCtcFromComponents(components);

    if (el.curDetailedTotal) {
      el.curDetailedTotal.textContent = Calc.formatINR(totalSum) + ' / yr';
    }
    if (el.curDetailedTotalSub) {
      el.curDetailedTotalSub.textContent = Calc.formatINR(totalSum / 12) + ' / mo';
    }
    if (el.curBasicSub) {
      el.curBasicSub.textContent = totalSum > 0 ? (basic / totalSum * 100).toFixed(1) + '% of CTC' : '0% of CTC';
    }
    if (el.curHraSub) {
      el.curHraSub.textContent = basic > 0 ? (hra / basic * 100).toFixed(1) + '% of Basic' : '0% of Basic';
    }

    if (el.currentCtcInput) el.currentCtcInput.value = Calc.formatINRPlain(totalSum);
    if (el.currentCtcSlider) el.currentCtcSlider.value = totalSum;
    if (el.currentCtcMonthly) el.currentCtcMonthly.textContent = Calc.formatINR(totalSum / 12) + '/mo';

    if (appState.currentSalary) {
      appState.currentSalary.ctc = totalSum;
      appState.currentSalary.details = components;
    }

    return totalSum;
  }

  function harvestActiveOfferForm() {
    const offer = getActiveOffer();
    offer.label = el.offerLabelInput.value.trim() || offer.label;
    offer.company = el.offerCompanyInput.value.trim();

    // Mode
    const activeModeBtn = el.offerModeSwitch.querySelector('.pill-btn.active');
    offer.mode = activeModeBtn ? activeModeBtn.dataset.mode : (offer.mode || 'quick');

    if (offer.mode === 'quick') {
      offer.ctc = Calc.parseINR(el.offerCtcInput.value);
      const prof = getProfile();
      offer.details = Calc.generateDefaultsFromCtc(offer.ctc, prof.isMetro, prof.pfBasis);
    } else {
      updateOfferedDetailedTotal();
    }

    // ESOP
    const esopYears = parseInt(el.esopYearsSelect.value, 10) || 4;
    const schedTypeRadio = el.esopScheduleTypeSwitch.querySelector('input[name="esop-sched-type"]:checked');
    const schedType = schedTypeRadio ? schedTypeRadio.value : 'equal';

    const customPcts = [];
    if (schedType === 'custom') {
      const inputs = el.esopCustomInputsGrid.querySelectorAll('input');
      inputs.forEach(inp => {
        customPcts.push(parseFloat(inp.value) || 0);
      });
    }

    const activeEsopModeBtn = el.esopModeSwitch ? el.esopModeSwitch.querySelector('.pill-btn.active') : null;
    const entryMode = activeEsopModeBtn ? activeEsopModeBtn.dataset.mode : ((offer.esop && offer.esop.entryMode) || 'value');

    const units = Calc.parseINR(el.esopUnitsInput ? el.esopUnitsInput.value : 0);
    const pricePerUnit = Calc.parseINR(el.esopPriceInput ? el.esopPriceInput.value : 0);
    const currency = el.esopCurrencySwitch ? (el.esopCurrencySwitch.querySelector('.pill-btn.active')?.dataset.currency || 'INR') : 'INR';
    const usdRate = el.esopUsdRateInput ? (parseFloat(el.esopUsdRateInput.value) || 87) : 87;

    let computedGrant = 0;
    if (entryMode === 'units') {
      const priceInInr = currency === 'USD' ? (pricePerUnit * usdRate) : pricePerUnit;
      computedGrant = Math.round(units * priceInInr);
      if (el.esopGrantInput) {
        el.esopGrantInput.value = Calc.formatINRPlain(computedGrant);
      }
    } else {
      computedGrant = Calc.parseINR(el.esopGrantInput ? el.esopGrantInput.value : 0);
    }

    offer.esop = {
      enabled: el.esopEnabled.checked,
      entryMode,
      units,
      pricePerUnit,
      currency,
      usdRate,
      grant: computedGrant,
      vestingYears: esopYears,
      scheduleType: schedType,
      customPcts: customPcts
    };
  }

  function harvestProfile() {
    appState.profile = getProfile();
    return appState.profile;
  }

  function harvestDeductions() {
    appState.deductions = getDeductions();
    return appState.deductions;
  }

  function harvestCurrentSalary() {
    if (!appState.currentSalary) appState.currentSalary = {};
    appState.currentSalary.enabled = el.currentEnabled ? el.currentEnabled.checked : true;
    const activeModeBtn = el.currentModeSwitch ? el.currentModeSwitch.querySelector('.pill-btn.active') : null;
    appState.currentSalary.mode = activeModeBtn ? activeModeBtn.dataset.mode : (appState.currentSalary.mode || 'quick');
    if (appState.currentSalary.mode === 'detailed') {
      updateCurrentDetailedTotal();
    } else {
      appState.currentSalary.ctc = Calc.parseINR(el.currentCtcInput ? el.currentCtcInput.value : 0);
      const prof = getProfile();
      appState.currentSalary.details = Calc.generateDefaultsFromCtc(appState.currentSalary.ctc, prof.isMetro, prof.pfBasis);
    }
    return appState.currentSalary;
  }

  function harvestAll() {
    harvestProfile();
    harvestDeductions();
    harvestCurrentSalary();
    harvestActiveOfferForm();
    return appState;
  }

  /* ─────────────────────────────────────────────────────────────────
     6. ESOP SCHEDULE SECTION RENDERER
     ───────────────────────────────────────────────────────────────── */
  function updateEsopUnitsMath() {
    if (!el.esopUnitsInput || !el.esopPriceInput || !el.esopCalcTotal) return 0;
    const units = Calc.parseINR(el.esopUnitsInput.value);
    const price = Calc.parseINR(el.esopPriceInput.value);
    const curr = el.esopCurrencySwitch?.querySelector('.pill-btn.active')?.dataset.currency || 'INR';
    const usdRate = el.esopUsdRateInput ? (parseFloat(el.esopUsdRateInput.value) || 87) : 87;

    const priceInInr = curr === 'USD' ? (price * usdRate) : price;
    const total = Math.round(units * priceInInr);

    if (el.esopCalcMath) {
      if (curr === 'USD') {
        el.esopCalcMath.textContent = `${Calc.formatINRPlain(units)} units × $${Calc.formatINRPlain(price)} × ₹${usdRate}/$`;
      } else {
        el.esopCalcMath.textContent = `${Calc.formatINRPlain(units)} units × ₹${Calc.formatINRPlain(price)}/unit`;
      }
    }
    el.esopCalcTotal.textContent = Calc.formatINR(total);
    if (el.esopGrantInput) {
      el.esopGrantInput.value = Calc.formatINRPlain(total);
    }
    return total;
  }

  function renderEsopScheduleSection() {
    const offer = getActiveOffer();
    const esop = offer.esop || {};
    const years = parseInt(el.esopYearsSelect.value, 10) || 4;

    const activeEsopModeBtn = el.esopModeSwitch ? el.esopModeSwitch.querySelector('.pill-btn.active') : null;
    const entryMode = activeEsopModeBtn ? activeEsopModeBtn.dataset.mode : (esop.entryMode || 'value');

    let grant = 0;
    let totalUnits = 0;
    if (entryMode === 'units') {
      grant = updateEsopUnitsMath() || 0;
      totalUnits = Calc.parseINR(el.esopUnitsInput ? el.esopUnitsInput.value : 0);
    } else {
      grant = Calc.parseINR(el.esopGrantInput.value);
    }

    const schedTypeRadio = el.esopScheduleTypeSwitch.querySelector('input[name="esop-sched-type"]:checked');
    const schedType = schedTypeRadio ? schedTypeRadio.value : (esop.scheduleType || 'equal');

    if (schedType === 'equal') {
      el.esopCustomPctsContainer.style.display = 'none';
      const eqPct = (100 / years).toFixed(1);
      el.esopScheduleSummary.textContent = `Equal (${eqPct}% per year)`;
    } else {
      el.esopCustomPctsContainer.style.display = 'block';
      el.esopScheduleSummary.textContent = `Custom schedule (${years} years)`;

      // Render custom percentage inputs if needed
      let customInputsHtml = '';
      let existingPcts = esop.customPcts || [];
      for (let y = 1; y <= years; y++) {
        let val = existingPcts[y - 1];
        if (val === undefined || isNaN(val)) {
          // Standard defaults for tech vesting
          if (years === 4) {
            val = [10, 20, 30, 40][y - 1] || 25;
          } else {
            val = Math.round(100 / years);
          }
        }
        customInputsHtml += `
          <div style="display:flex; flex-direction:column; gap:2px; text-align:center;">
            <label style="font-size:0.68rem; color:var(--text-muted);">Yr ${y} %</label>
            <input type="number" min="0" max="100" class="esop-custom-pct-input" data-year="${y}" value="${val}" style="padding:6px; font-size:0.82rem; text-align:center;">
          </div>
        `;
      }
      el.esopCustomInputsGrid.innerHTML = customInputsHtml;

      // Attach custom % change listener
      el.esopCustomInputsGrid.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', () => {
          updateEsopCustomValidation();
          recalculateAll();
        });
      });
      updateEsopCustomValidation();
    }

    // Calculate vesting cards
    const customPcts = [];
    if (schedType === 'custom') {
      el.esopCustomInputsGrid.querySelectorAll('input').forEach(inp => {
        customPcts.push(parseFloat(inp.value) || 0);
      });
    }

    const vestingRes = Calc.calculateEsopVesting(grant, years, schedType, customPcts, totalUnits);

    let cardsHtml = '';
    vestingRes.schedule.forEach(s => {
      const unitsHtml = (entryMode === 'units' && totalUnits > 0)
        ? `<div class="esop-year-units">${Calc.formatINRPlain(s.units)} units</div>`
        : '';
      cardsHtml += `
        <div class="esop-year-card">
          <div class="esop-year-lbl">Year ${s.year}</div>
          <div class="esop-year-pct">${s.percent}%</div>
          ${unitsHtml}
          <div class="esop-year-val">${Calc.formatINR(s.amount)}</div>
        </div>
      `;
    });
    el.esopYearsScheduleDisplay.innerHTML = cardsHtml;

    if (entryMode === 'units' && totalUnits > 0) {
      el.esopYr1Val.textContent = `${Calc.formatINR(vestingRes.year1Amount)} (${Calc.formatINRPlain(vestingRes.year1Units)} units)`;
      el.esopAvgVal.textContent = `${Calc.formatINR(vestingRes.averageAnnualEsop)} / yr (${Calc.formatINRPlain(vestingRes.averageAnnualUnits)} units/yr)`;
    } else {
      el.esopYr1Val.textContent = Calc.formatINR(vestingRes.year1Amount);
      el.esopAvgVal.textContent = Calc.formatINR(vestingRes.averageAnnualEsop) + ' / yr';
    }
  }

  function updateEsopCustomValidation() {
    let totalPct = 0;
    el.esopCustomInputsGrid.querySelectorAll('input').forEach(inp => {
      totalPct += parseFloat(inp.value) || 0;
    });
    const roundTotal = Math.round(totalPct);
    el.esopPctTotalFeedback.textContent = `Total: ${roundTotal}%`;
    if (roundTotal === 100) {
      el.esopPctTotalFeedback.style.color = 'var(--green-text)';
    } else {
      el.esopPctTotalFeedback.style.color = 'var(--amber-text)';
    }
  }

  /* ─────────────────────────────────────────────────────────────────
     7. MAIN RECALCULATION & MULTI-OFFER PIPELINE
     ───────────────────────────────────────────────────────────────── */
  function recalculateAll() {
    harvestProfile();
    harvestDeductions();
    const profile = appState.profile;
    const deductions = appState.deductions;

    // Rent display update
    el.rentMonthlyLbl.textContent = Calc.formatINR(deductions.annualRent / 12) + '/mo';

    // 1. Compute Current Salary
    let currentRaw = null;
    let currentCtcVal = 0;
    let currentBest = null;

    if (el.currentEnabled.checked) {
      const mode = appState.currentSalary.mode || 'quick';
      if (mode === 'quick') {
        currentCtcVal = Calc.parseINR(el.currentCtcInput.value);
        currentRaw = Calc.generateDefaultsFromCtc(currentCtcVal, profile.isMetro, profile.pfBasis);
        // Synchronize detailed inputs
        el.curBasic.value = Calc.formatINRPlain(currentRaw.basic);
        el.curHra.value = Calc.formatINRPlain(currentRaw.hra);
        el.curSpecial.value = Calc.formatINRPlain(currentRaw.special);
        el.curEmployerPf.value = Calc.formatINRPlain(currentRaw.employerPf);
        el.curGratuity.value = Calc.formatINRPlain(currentRaw.gratuity);
        el.curEmployeePf.value = Calc.formatINRPlain(currentRaw.employeePf);
      } else {
        // Detailed mode sum
        const basic = Calc.parseINR(el.curBasic.value);
        const hra = Calc.parseINR(el.curHra.value);
        const special = Calc.parseINR(el.curSpecial.value);
        const bonus = Calc.parseINR(el.curBonus.value);
        const employerPf = Calc.parseINR(el.curEmployerPf.value);
        const gratuity = Calc.parseINR(el.curGratuity.value);
        const employerNps = Calc.parseINR(el.curEmployerNps.value);
        const employeePf = Calc.parseINR(el.curEmployeePf.value);

        currentCtcVal = basic + hra + special + bonus + employerPf + gratuity + employerNps;
        el.currentCtcInput.value = Calc.formatINRPlain(currentCtcVal);
        el.currentCtcSlider.value = currentCtcVal;

        currentRaw = {
          basic, hra, special, bonus, employerPf, gratuity, employerNps,
          employerInsurance: 0, employeePf, voluntaryNps: 0,
          lta: 0, meal: 0, fuel: 0, telecom: 0, joining: 0
        };
      }

      el.currentCtcMonthly.textContent = Calc.formatINR(currentCtcVal / 12) + '/mo';
      if (el.curDetailedTotal) {
        el.curDetailedTotal.textContent = Calc.formatINR(currentCtcVal) + ' / yr';
        el.curDetailedTotalSub.textContent = Calc.formatINR(currentCtcVal / 12) + ' / mo';
      }
      if (el.curBasicSub && currentCtcVal > 0) {
        el.curBasicSub.textContent = (currentRaw.basic / currentCtcVal * 100).toFixed(1) + '% of CTC';
      }
      if (el.curHraSub && currentRaw.basic > 0) {
        el.curHraSub.textContent = (currentRaw.hra / currentRaw.basic * 100).toFixed(1) + '% of Basic';
      }

      // Compute current regimes
      const curOld = Calc.computeSalaryDetails(currentRaw, profile, deductions, 'OLD');
      const curNew = Calc.computeSalaryDetails(currentRaw, profile, deductions, 'NEW');
      currentBest = (curNew.netTakeHome >= curOld.netTakeHome) ? curNew : curOld;
      currentBest.optimalRegime = (curNew.netTakeHome >= curOld.netTakeHome) ? 'NEW' : 'OLD';
    }

    // 2. Synchronize Active Offer
    const activeOffer = getActiveOffer();
    const activeOfferMode = activeOffer.mode || 'quick';
    let activeOfferCtcVal = 0;
    let activeOfferRaw = null;

    if (activeOfferMode === 'quick') {
      activeOfferCtcVal = Calc.parseINR(el.offerCtcInput.value);
      activeOffer.ctc = activeOfferCtcVal;
      activeOfferRaw = Calc.generateDefaultsFromCtc(activeOfferCtcVal, profile.isMetro, profile.pfBasis);
      activeOffer.details = activeOfferRaw;

      // Synchronize detailed inputs in DOM
      el.offBasic.value = Calc.formatINRPlain(activeOfferRaw.basic);
      el.offHra.value = Calc.formatINRPlain(activeOfferRaw.hra);
      el.offSpecial.value = Calc.formatINRPlain(activeOfferRaw.special);
      el.offBonus.value = Calc.formatINRPlain(activeOfferRaw.bonus);
      el.offEmployerPf.value = Calc.formatINRPlain(activeOfferRaw.employerPf);
      el.offGratuity.value = Calc.formatINRPlain(activeOfferRaw.gratuity);
      el.offEmployerNps.value = Calc.formatINRPlain(activeOfferRaw.employerNps);
      el.offEmployeePf.value = Calc.formatINRPlain(activeOfferRaw.employeePf);
      el.offLta.value = Calc.formatINRPlain(activeOfferRaw.lta || 0);
      el.offMeal.value = Calc.formatINRPlain(activeOfferRaw.meal || 0);
      el.offFuel.value = Calc.formatINRPlain(activeOfferRaw.fuel || 0);
      el.offTelecom.value = Calc.formatINRPlain(activeOfferRaw.telecom || 0);
      el.offJoining.value = Calc.formatINRPlain(activeOfferRaw.joining || 0);
    } else {
      activeOfferCtcVal = updateOfferedDetailedTotal();
      activeOfferRaw = { ...activeOffer.details };
    }

    // Update active offer display indicators
    el.offerCtcMonthly.textContent = Calc.formatINR(activeOfferCtcVal / 12) + '/mo';
    if (el.offDetailedTotal) {
      el.offDetailedTotal.textContent = Calc.formatINR(activeOfferCtcVal) + ' / yr';
      el.offDetailedTotalSub.textContent = Calc.formatINR(activeOfferCtcVal / 12) + ' / mo';
    }
    if (el.offBasicSub) {
      el.offBasicSub.textContent = activeOfferCtcVal > 0 ? (activeOfferRaw.basic / activeOfferCtcVal * 100).toFixed(1) + '% of CTC' : '0% of CTC';
    }
    if (el.offHraSub) {
      el.offHraSub.textContent = activeOfferRaw.basic > 0 ? (activeOfferRaw.hra / activeOfferRaw.basic * 100).toFixed(1) + '% of Basic' : '0% of Basic';
    }

    // 3. Compute All Offers (Leaderboard Evaluation)
    const offerResults = [];

    appState.offers.forEach(offer => {
      let rawComponents;
      if (offer.id === activeOffer.id) {
        rawComponents = activeOfferRaw;
      } else if (offer.mode === 'quick') {
        rawComponents = Calc.generateDefaultsFromCtc(offer.ctc, profile.isMetro, profile.pfBasis);
      } else {
        rawComponents = { ...offer.details };
      }

      const oldRes = Calc.computeSalaryDetails(rawComponents, profile, deductions, 'OLD');
      const newRes = Calc.computeSalaryDetails(rawComponents, profile, deductions, 'NEW');
      const isNewWinner = newRes.netTakeHome >= oldRes.netTakeHome;
      const bestSalaryRes = isNewWinner ? newRes : oldRes;
      const bestRegime = isNewWinner ? 'NEW' : 'OLD';

      // ESOP calculations
      let esopRes = null;
      let yr1Esop = 0;
      if (offer.esop && offer.esop.enabled) {
        esopRes = Calc.calculateEsopVesting(
          offer.esop.grant,
          offer.esop.vestingYears,
          offer.esop.scheduleType,
          offer.esop.customPcts,
          offer.esop.units || 0
        );
        yr1Esop = esopRes.year1Amount;
      }

      // Total Comp
      const tc = Calc.computeTotalCompensation(offer.ctc, yr1Esop, bestSalaryRes.netTakeHome);

      // Hike vs current
      let grossHikePct = 0;
      let netHikePct = 0;
      if (currentBest && currentBest.totalCtc > 0) {
        grossHikePct = ((offer.ctc - currentBest.totalCtc) / currentBest.totalCtc) * 100;
        netHikePct = ((bestSalaryRes.netTakeHome - currentBest.netTakeHome) / currentBest.netTakeHome) * 100;
      }

      offerResults.push({
        offer,
        rawComponents,
        oldRes,
        newRes,
        bestSalaryRes,
        bestRegime,
        esopRes,
        yr1Esop,
        totalComp: tc,
        grossHikePct,
        netHikePct,
        // Score for sorting: Total Realized Value (Cash + Year 1 Equity)
        rankingScore: tc.totalRealizedValue
      });
    });

    // Sort by rankingScore descending
    const sortedLeaderboard = [...offerResults].sort((a, b) => b.rankingScore - a.rankingScore);

    // Render Leaderboard
    renderLeaderboard(sortedLeaderboard, currentBest);

    // 3. Render Active Offer Deep-Dive
    const activeOfferData = offerResults.find(r => r.offer.id === appState.activeOfferId) || offerResults[0];
    renderActiveOfferDetails(activeOfferData, currentBest, profile, deductions, offerResults);

    triggerAutoSave();
  }

  /* ─────────────────────────────────────────────────────────────────
     8. RENDER LEADERBOARD
     ───────────────────────────────────────────────────────────────── */
  function renderLeaderboard(sortedResults, currentBest) {
    let html = '';
    const activeId = appState.activeOfferId;

    sortedResults.forEach((item, idx) => {
      const rank = idx + 1;
      const isWinner = (rank === 1 && sortedResults.length > 1);
      const isActive = (item.offer.id === activeId);

      let rankPillClass = 'rank-3';
      if (rank === 1) rankPillClass = 'rank-1';
      else if (rank === 2) rankPillClass = 'rank-2';

      const rowClass = isWinner ? 'leaderboard-winner-row' : '';
      const activeMark = isActive ? 'style="font-weight:700; background:rgba(99,102,241,0.06);"' : '';

      const hikeBadge = (currentBest && item.netHikePct !== undefined)
        ? `<span class="diff-pill ${item.netHikePct >= 0 ? 'pos' : 'neg'}">${item.netHikePct >= 0 ? '+' : ''}${item.netHikePct.toFixed(1)}%</span>`
        : '';

      html += `
        <tr class="${rowClass}" ${activeMark} style="cursor:pointer;" onclick="window.switchOfferById('${item.offer.id}')" title="Click to view deep-dive analysis">
          <td style="text-align:center;">
            <span class="leaderboard-rank-pill ${rankPillClass}">#${rank}</span>
          </td>
          <td>
            <div style="font-weight:600; color:var(--text-primary);">
              ${escapeHtml(item.offer.label) || 'Offer'}
              ${isActive ? '<span class="badge-pill" style="font-size:0.62rem; margin-left:4px;">Active</span>' : ''}
            </div>
            <div style="font-size:0.7rem; color:var(--text-muted);">${escapeHtml(item.offer.company) || 'Organization'}</div>
          </td>
          <td class="col-num">${Calc.formatINR(item.offer.ctc)}</td>
          <td class="col-num" style="color:#c084fc;">${item.yr1Esop > 0 ? Calc.formatINR(item.yr1Esop) : '—'}</td>
          <td style="text-align:center;">
            <span class="badge-pill ${item.bestRegime === 'NEW' ? 'green' : 'blue'}" style="font-size:0.68rem;">
              ${item.bestRegime}
            </span>
          </td>
          <td class="col-num" style="color:var(--green-text);">
            <div>${Calc.formatINR(item.bestSalaryRes.netTakeHome)}/yr</div>
            <div style="font-size:0.68rem; color:var(--text-muted);">${Calc.formatINR(item.bestSalaryRes.monthlyTakeHome)}/mo ${hikeBadge}</div>
          </td>
          <td class="col-num" style="font-weight:800; color:#ffffff;">
            ${Calc.formatINR(item.totalComp.totalRealizedValue)}
          </td>
        </tr>
      `;
    });

    el.leaderboardTableBody.innerHTML = html;
  }

  // Expose global switcher for leaderboard row clicks
  window.switchOfferById = function (id) {
    switchOffer(id);
  };

  /* ─────────────────────────────────────────────────────────────────
     9. RENDER ACTIVE OFFER DETAILS
     ───────────────────────────────────────────────────────────────── */
  function renderActiveOfferDetails(data, currentBest, profile, deductions, allOffers) {
    const offer = data.offer;
    const raw = data.rawComponents;
    const oldRes = data.oldRes;
    const newRes = data.newRes;
    const bestRes = data.bestSalaryRes;
    const tc = data.totalComp;

    // Header labels
    el.hikeAnalysisTitle.textContent = `Salary Hike & In-Hand Analysis (${offer.label || 'Active Offer'})`;
    el.regimePickerTitle.textContent = `Tax Regime Recommendation (${offer.label || 'Active Offer'})`;
    el.colOfferNameHeader.textContent = `${offer.label || 'Offer'} (Annual)`;
    el.donutChartTitle.textContent = `${offer.label || 'Offer'} CTC Composition`;

    // 80C Room calculation based on active offer EPF
    const offerEmployeePf = raw.employeePf || 0;
    const total80CCombined = Math.min(150000, offerEmployeePf + deductions.other80C);
    const roomLeft = Math.max(0, 150000 - offerEmployeePf);
    el.total80cClaimed.textContent = Calc.formatINR(total80CCombined);
    el.total80cRoom.textContent = `Room left after EPF (₹${Calc.formatINRPlain(offerEmployeePf)}): ₹${Calc.formatINRPlain(roomLeft)}`;

    // Total Compensation Card Render
    el.tcCtcVal.textContent = Calc.formatINR(tc.ctc);
    el.tcCtcMo.textContent = Calc.formatINR(tc.monthlyCtc) + ' / mo';
    el.tcEsopVal.textContent = tc.esopAnnual > 0 ? '+ ' + Calc.formatINR(tc.esopAnnual) : '₹0';
    el.tcEsopSub.textContent = tc.esopAnnual > 0 ? 'Year 1 Vested Equity' : 'No ESOP attached';
    el.tcTotalVal.textContent = Calc.formatINR(tc.totalCompensation);
    el.tcRealizedVal.textContent = `In-Hand Cash + Equity: ${Calc.formatINR(tc.totalRealizedValue)}`;
    el.totalCompEquityShare.textContent = `Equity Share: ${tc.equitySharePct}%`;

    // Regime Recommendation Banner
    const isNewWinner = newRes.netTakeHome >= oldRes.netTakeHome;
    const annualDelta = Math.abs(newRes.netTakeHome - oldRes.netTakeHome);
    const monthlyDelta = Math.round(annualDelta / 12);

    if (isNewWinner) {
      el.cardNew.classList.add('winner');
      el.cardOld.classList.remove('winner');
      el.badgeWinnerNew.style.display = 'flex';
      el.badgeWinnerOld.style.display = 'none';

      el.recWinnerBadge.textContent = 'Recommended: New Tax Regime';
      el.recWinnerTitle.textContent = 'New Regime leaves more cash in hand';
      el.recSavingsVal.textContent = Calc.formatINR(annualDelta);
      el.recSavingsSub.textContent = `+${Calc.formatINR(monthlyDelta)}/month more in bank`;
      el.recBanner.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(99, 102, 241, 0.15) 100%)';

      const taxDelta = oldRes.taxDetails.totalTax - newRes.taxDetails.totalTax;
      if (taxDelta > 0) {
        const marginalRate = oldRes.taxableIncome > 1000000 ? 0.312 : 0.208;
        const extraDeductionNeeded = Math.round(taxDelta / marginalRate);
        el.sensitivityText.textContent = `You'd need approx. ₹${Calc.formatINRPlain(extraDeductionNeeded)} in additional 80C/80D/rent deductions for the Old Regime to beat the New Regime.`;
      } else {
        el.sensitivityText.textContent = `New Regime is strongly advantageous at this salary slab.`;
      }
    } else {
      el.cardOld.classList.add('winner');
      el.cardNew.classList.remove('winner');
      el.badgeWinnerOld.style.display = 'flex';
      el.badgeWinnerNew.style.display = 'none';

      el.recWinnerBadge.textContent = 'Recommended: Old Tax Regime';
      el.recWinnerTitle.textContent = 'Old Regime saves more through your deductions';
      el.recSavingsVal.textContent = Calc.formatINR(annualDelta);
      el.recSavingsSub.textContent = `+${Calc.formatINR(monthlyDelta)}/month more in bank`;
      el.recBanner.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.18) 0%, rgba(16, 185, 129, 0.15) 100%)';

      el.sensitivityText.textContent = `Your HRA & investment deductions currently save you ₹${Calc.formatINRPlain(annualDelta)}/yr over the default New Regime.`;
    }

    // Fill Old Regime Card
    el.oldTakehomeAnnual.textContent = Calc.formatINR(oldRes.netTakeHome);
    el.oldTakehomeMonthly.textContent = Calc.formatINR(oldRes.monthlyTakeHome) + ' / mo';
    el.oldCashGross.textContent = Calc.formatINR(oldRes.cashGrossSalary);
    el.oldHraExempt.textContent = '− ' + Calc.formatINR(oldRes.hraExempt);
    const otherOldDeductions = oldRes.deduction80C + oldRes.deduction80D +
                               oldRes.deduction80CCD1B + oldRes.homeLoanDeduction +
                               oldRes.otherDeductionsTotal;
    el.oldOtherDeduct.textContent = '− ' + Calc.formatINR(otherOldDeductions);
    el.oldTaxableIncome.textContent = Calc.formatINR(oldRes.taxableIncome);
    el.oldBaseTax.textContent = Calc.formatINR(oldRes.taxDetails.baseTax);
    el.oldRebate87a.textContent = (oldRes.taxDetails.rebate87A > 0) ? '− ' + Calc.formatINR(oldRes.taxDetails.rebate87A) : '₹0';
    el.oldSurcharge.textContent = Calc.formatINR(oldRes.taxDetails.surcharge);
    el.oldCess.textContent = Calc.formatINR(oldRes.taxDetails.cess);
    el.oldTotalTax.textContent = Calc.formatINR(oldRes.taxDetails.totalTax);
    el.oldEmpDeduct.textContent = '− ' + Calc.formatINR(oldRes.employeePf + oldRes.professionalTax);

    // Fill New Regime Card
    el.newTakehomeAnnual.textContent = Calc.formatINR(newRes.netTakeHome);
    el.newTakehomeMonthly.textContent = Calc.formatINR(newRes.monthlyTakeHome) + ' / mo';
    el.newCashGross.textContent = Calc.formatINR(newRes.cashGrossSalary);
    el.newNpsExempt.textContent = '− ' + Calc.formatINR(newRes.employerNpsDeduction);
    el.newTaxableIncome.textContent = Calc.formatINR(newRes.taxableIncome);
    el.newBaseTax.textContent = Calc.formatINR(newRes.taxDetails.baseTax);
    el.newRebate87a.textContent = (newRes.taxDetails.rebate87A > 0) ? '− ' + Calc.formatINR(newRes.taxDetails.rebate87A) : '₹0';
    el.newSurcharge.textContent = Calc.formatINR(newRes.taxDetails.surcharge);
    el.newCess.textContent = Calc.formatINR(newRes.taxDetails.cess);
    el.newTotalTax.textContent = Calc.formatINR(newRes.taxDetails.totalTax);
    el.newEmpDeduct.textContent = '− ' + Calc.formatINR(newRes.employeePf + newRes.professionalTax);

    // Hike Comparison (Flow A)
    if (currentBest && el.currentEnabled.checked) {
      el.panelHike.style.display = 'block';
      el.flowANotice.style.display = 'none';

      const grossHikeAbs = bestRes.totalCtc - currentBest.totalCtc;
      const grossHikePct = currentBest.totalCtc > 0 ? (grossHikeAbs / currentBest.totalCtc) * 100 : 0;

      const netHikeAbs = bestRes.netTakeHome - currentBest.netTakeHome;
      const netHikePct = currentBest.netTakeHome > 0 ? (netHikeAbs / currentBest.netTakeHome) * 100 : 0;

      const hikeErosionPts = grossHikePct - netHikePct;
      const erosionPctOfHike = grossHikeAbs > 0 ? Math.max(0, ((grossHikeAbs - netHikeAbs) / grossHikeAbs) * 100) : 0;

      el.grossHikePct.textContent = (grossHikePct >= 0 ? '+' : '') + grossHikePct.toFixed(1) + '%';
      el.grossHikeAbs.textContent = (grossHikeAbs >= 0 ? '+' : '−') + Calc.formatINR(Math.abs(grossHikeAbs)) + ' / yr';

      el.netHikePct.textContent = (netHikePct >= 0 ? '+' : '') + netHikePct.toFixed(1) + '%';
      el.netHikeAbs.textContent = (netHikeAbs >= 0 ? '+' : '−') + Calc.formatINR(Math.abs(netHikeAbs)) + ' / yr in bank';

      const netCard = document.getElementById('metric-card-net');
      if (netCard) {
        netCard.className = (netHikePct < 0) ? 'metric-card highlight negative' : 'metric-card highlight positive';
      }

      el.hikeErosionPts.textContent = (hikeErosionPts >= 0 ? '+' : '') + hikeErosionPts.toFixed(1) + ' pts';
      el.hikeErosionDesc.textContent = hikeErosionPts > 0
        ? `${erosionPctOfHike.toFixed(0)}% of hike lost to tax & PF`
        : `Higher in-hand efficiency`;

      if (grossHikeAbs >= 0) {
        el.plainCallout.className = 'callout-box';
        el.plainCallout.innerHTML = `
          Your offered <strong>${Calc.formatINR(grossHikeAbs)}</strong> CTC hike yields 
          <strong>${Calc.formatINR(netHikeAbs)}</strong> in actual bank take-home 
          (<strong>${Calc.formatINR(Math.round(netHikeAbs / 12))}/mo</strong> extra). 
          Approximately <strong>${erosionPctOfHike.toFixed(0)}%</strong> of your nominal hike is consumed by taxes and statutory deductions.
        `;
      } else {
        el.plainCallout.className = 'callout-box warning';
        el.plainCallout.innerHTML = `
          <strong>Warning:</strong> The offered CTC is <strong>${Calc.formatINR(Math.abs(grossHikeAbs))} lower</strong> 
          than your current CTC, reducing your annual in-hand take-home by <strong>${Calc.formatINR(Math.abs(netHikeAbs))}</strong>.
        `;
      }

      // Comparison Table
      const rows = [
        { name: 'Basic Salary', cur: currentBest.basic, off: bestRes.basic },
        { name: 'HRA', cur: currentBest.hra, off: bestRes.hra },
        { name: 'Special / Fixed Allowances', cur: currentBest.special, off: bestRes.special },
        { name: 'Variable / Bonus', cur: currentBest.bonus, off: bestRes.bonus },
        { name: 'Employer PF & Gratuity', cur: currentBest.employerPf + currentBest.gratuity, off: bestRes.employerPf + bestRes.gratuity },
        { name: 'Total CTC (Cost to Company)', cur: currentBest.totalCtc, off: bestRes.totalCtc, highlight: true },
        { name: 'Cash Gross Salary', cur: currentBest.cashGrossSalary, off: bestRes.cashGrossSalary },
        { name: 'Income Tax Payable', cur: -currentBest.taxDetails.totalTax, off: -bestRes.taxDetails.totalTax },
        { name: 'Employee PF Contribution', cur: -currentBest.employeePf, off: -bestRes.employeePf },
        { name: 'Net Take-Home (In-Hand)', cur: currentBest.netTakeHome, off: bestRes.netTakeHome, takehome: true }
      ];

      let tableHtml = '';
      rows.forEach(r => {
        const diffAnnual = r.off - r.cur;
        const diffMonthly = Math.round(diffAnnual / 12);
        const trClass = r.takehome ? 'row-takehome' : (r.highlight ? 'row-highlight' : '');
        const isNeg = diffMonthly < 0;
        const diffPillClass = isNeg ? 'diff-pill neg' : 'diff-pill pos';
        const sign = diffMonthly > 0 ? '+' : '';

        tableHtml += `
          <tr class="${trClass}">
            <td>${r.name}</td>
            <td class="col-num">${Calc.formatINR(Math.abs(r.cur))}${r.cur < 0 ? ' (deduct)' : ''}</td>
            <td class="col-num">${Calc.formatINR(Math.abs(r.off))}${r.off < 0 ? ' (deduct)' : ''}</td>
            <td class="col-num">
              <span>${sign}${Calc.formatINR(diffMonthly)}/mo</span>
              <span class="${diffPillClass}">${sign}${((r.cur !== 0) ? (diffAnnual / Math.abs(r.cur) * 100).toFixed(0) : '0')}%</span>
            </td>
          </tr>
        `;
      });
      el.compTableBody.innerHTML = tableHtml;

    } else {
      el.panelHike.style.display = 'none';
      el.flowANotice.style.display = 'block';
    }

    // Charts
    renderDonutChart(raw);
    renderStackedBarChart(currentBest, oldRes, newRes, allOffers);
  }

  /* ─────────────────────────────────────────────────────────────────
     10. CHARTS RENDERERS
     ───────────────────────────────────────────────────────────────── */
  function renderDonutChart(raw) {
    const segments = [
      { label: 'Basic', value: raw.basic, color: '#6366f1' },
      { label: 'HRA', value: raw.hra, color: '#3b82f6' },
      { label: 'Special Allowance', value: raw.special, color: '#10b981' },
      { label: 'Employer PF', value: raw.employerPf, color: '#f59e0b' },
      { label: 'Gratuity', value: raw.gratuity, color: '#ec4899' },
      { label: 'Bonus / Perks', value: (raw.bonus || 0) + (raw.lta || 0) + (raw.meal || 0) + (raw.fuel || 0), color: '#8b5cf6' }
    ].filter(s => s.value > 0);

    const total = segments.reduce((sum, s) => sum + s.value, 0);
    el.donutTotal.textContent = Calc.formatINR(total);

    const radius = 36;
    const circumference = 2 * Math.PI * radius;

    let accumulatedOffset = 0;
    let svgHtml = '';
    let legendHtml = '';

    segments.forEach(seg => {
      const pct = total > 0 ? (seg.value / total) : 0;
      const strokeDash = pct * circumference;
      const strokeOffset = -accumulatedOffset;
      accumulatedOffset += strokeDash;

      svgHtml += `
        <circle class="donut-slice"
          cx="50" cy="50" r="${radius}"
          stroke="${seg.color}"
          stroke-dasharray="${strokeDash} ${circumference - strokeDash}"
          stroke-dashoffset="${strokeOffset}">
        </circle>
      `;

      legendHtml += `
        <div class="legend-row">
          <div class="legend-key">
            <span class="legend-swatch" style="background:${seg.color};"></span>
            <span title="${seg.label}">${seg.label}</span>
          </div>
          <div class="legend-val">${Calc.formatINR(seg.value)} <span style="color:var(--text-muted); font-size:0.68rem;">(${(pct * 100).toFixed(0)}%)</span></div>
        </div>
      `;
    });

    el.donutSvg.innerHTML = svgHtml;
    el.donutLegend.innerHTML = legendHtml;
  }

  function renderStackedBarChart(currentBest, activeOld, activeNew, allOffers) {
    const bars = [];

    if (currentBest && el.currentEnabled.checked) {
      bars.push({
        label: 'Current Salary',
        total: currentBest.totalCtc,
        takehome: currentBest.netTakeHome,
        tax: currentBest.taxDetails.totalTax,
        pf: currentBest.employeePf,
        other: Math.max(0, currentBest.totalCtc - currentBest.netTakeHome - currentBest.taxDetails.totalTax - currentBest.employeePf)
      });
    }

    // Active offer regimes
    bars.push({
      label: 'Active Offer (Old Regime)',
      total: activeOld.totalCtc,
      takehome: activeOld.netTakeHome,
      tax: activeOld.taxDetails.totalTax,
      pf: activeOld.employeePf,
      other: Math.max(0, activeOld.totalCtc - activeOld.netTakeHome - activeOld.taxDetails.totalTax - activeOld.employeePf)
    });

    bars.push({
      label: 'Active Offer (New Regime)',
      total: activeNew.totalCtc,
      takehome: activeNew.netTakeHome,
      tax: activeNew.taxDetails.totalTax,
      pf: activeNew.employeePf,
      other: Math.max(0, activeNew.totalCtc - activeNew.netTakeHome - activeNew.taxDetails.totalTax - activeNew.employeePf)
    });

    let html = '';
    bars.forEach(b => {
      const pctTakehome = b.total > 0 ? Math.max(0, (b.takehome / b.total) * 100) : 0;
      const pctTax = b.total > 0 ? Math.max(0, (b.tax / b.total) * 100) : 0;
      const pctPf = b.total > 0 ? Math.max(0, (b.pf / b.total) * 100) : 0;
      const pctOther = b.total > 0 ? Math.max(0, (b.other / b.total) * 100) : 0;

      html += `
        <div class="bar-group">
          <div class="bar-header">
            <span class="bar-label">${b.label}</span>
            <span class="bar-total">${Calc.formatINR(b.total)} CTC</span>
          </div>
          <div class="stacked-bar">
            <div class="bar-seg takehome" style="width: ${pctTakehome.toFixed(1)}%;" title="In-Hand: ${Calc.formatINR(b.takehome)} (${pctTakehome.toFixed(0)}%)"></div>
            <div class="bar-seg tax" style="width: ${pctTax.toFixed(1)}%;" title="Tax: ${Calc.formatINR(b.tax)} (${pctTax.toFixed(0)}%)"></div>
            <div class="bar-seg pf" style="width: ${pctPf.toFixed(1)}%;" title="PF: ${Calc.formatINR(b.pf)} (${pctPf.toFixed(0)}%)"></div>
            <div class="bar-seg other" style="width: ${pctOther.toFixed(1)}%;" title="Employer Costs & Other: ${Calc.formatINR(b.other)} (${pctOther.toFixed(0)}%)"></div>
          </div>
        </div>
      `;
    });

    el.stackedBarContainer.innerHTML = html;
  }

  /* ─────────────────────────────────────────────────────────────────
     11. PROFILE MODAL & STORAGE CONTROLLER
     ───────────────────────────────────────────────────────────────── */
  function renderProfilesList() {
    const profiles = Storage.listProfiles();
    if (profiles.length === 0) {
      el.savedProfilesList.innerHTML = `
        <div style="font-size:0.78rem; color:var(--text-muted); padding:10px 0; text-align:center;">
          No saved profiles yet. Save your current scenario above!
        </div>
      `;
      return;
    }

    let html = '';
    profiles.forEach(p => {
      const dateStr = new Date(p.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      html += `
        <div class="profile-item">
          <div class="profile-info">
            <span class="profile-name">${escapeHtml(p.name)}</span>
            <span class="profile-date">Saved on ${dateStr}</span>
          </div>
          <div class="profile-actions">
            <button type="button" class="btn-tool" style="font-size:0.7rem; padding:4px 8px;" onclick="window.loadProfileById('${p.id}')">
              Load
            </button>
            <button type="button" class="btn-tool" style="font-size:0.7rem; padding:4px 8px; color:var(--red-text);" onclick="window.deleteProfileById('${p.id}')">
              &times;
            </button>
          </div>
        </div>
      `;
    });

    el.savedProfilesList.innerHTML = html;
  }

  window.loadProfileById = function (profileId) {
    const record = Storage.loadNamedProfile(profileId);
    if (record && record.state) {
      appState = record.state;
      restoreFullStateToUi();
      recalculateAll();
      el.profilesModal.classList.remove('open');
      showToast(`Loaded profile: "${record.name}"`, 'success');
    }
  };

  window.deleteProfileById = function (profileId) {
    if (confirm('Delete this saved profile?')) {
      Storage.deleteNamedProfile(profileId);
      renderProfilesList();
    }
  };

  function restoreFullStateToUi() {
    // Profile
    if (appState.profile) {
      el.citySelect.value = appState.profile.city || 'bengaluru';
      el.pfCeilingSelect.value = appState.profile.pfBasis || 'actual';
      el.bonusTreatmentSelect.value = appState.profile.bonusTreatment || 'include';
      el.employerTypeSelect.value = appState.profile.employerType || 'private';

      const ageBracket = appState.profile.ageBracket || 'under60';
      el.ageRadios.forEach(r => {
        const match = (r.value === ageBracket);
        r.checked = match;
        const parent = r.closest('.seg-label');
        if (parent) parent.classList.toggle('active', match);
      });
    }

    // Deductions
    if (appState.deductions) {
      el.rentAnnual.value = Calc.formatINRPlain(appState.deductions.annualRent || 0);
      el.rentSlider.value = appState.deductions.annualRent || 0;
      el.investments80c.value = Calc.formatINRPlain(appState.deductions.other80C || 0);
      el.insuranceSelf.value = Calc.formatINRPlain(appState.deductions.insuranceSelf || 0);
      el.selfSenior.checked = !!appState.deductions.isSelfSenior;
      el.insuranceParents.value = Calc.formatINRPlain(appState.deductions.insuranceParents || 0);
      el.parentsSenior.checked = !!appState.deductions.isParentSenior;
      el.homeloanInterest.value = Calc.formatINRPlain(appState.deductions.homeLoanInterest || 0);
      el.nps80ccd1b.value = Calc.formatINRPlain(appState.deductions.nps80CCD1B || 0);
      el.otherDeductions.value = Calc.formatINRPlain(appState.deductions.otherDeductions || 0);
    }

    // Current Salary
    if (appState.currentSalary) {
      el.currentEnabled.checked = (appState.currentSalary.enabled !== false);
      el.currentBody.style.display = el.currentEnabled.checked ? 'block' : 'none';
      el.currentDisabledMsg.style.display = el.currentEnabled.checked ? 'none' : 'block';

      const curMode = appState.currentSalary.mode || 'quick';
      el.currentModeSwitch.querySelectorAll('.pill-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === curMode);
      });
      if (curMode === 'detailed') {
        el.currentDetailedGroup.style.display = 'block';
        el.currentQuickGroup.style.display = 'none';
      } else {
        el.currentDetailedGroup.style.display = 'none';
        el.currentQuickGroup.style.display = 'block';
      }

      el.currentCtcInput.value = Calc.formatINRPlain(appState.currentSalary.ctc || 2000000);
      el.currentCtcSlider.value = appState.currentSalary.ctc || 2000000;

      const cd = appState.currentSalary.details || {};
      el.curBasic.value = Calc.formatINRPlain(cd.basic);
      el.curHra.value = Calc.formatINRPlain(cd.hra);
      el.curSpecial.value = Calc.formatINRPlain(cd.special);
      el.curBonus.value = Calc.formatINRPlain(cd.bonus);
      el.curEmployerPf.value = Calc.formatINRPlain(cd.employerPf);
      el.curGratuity.value = Calc.formatINRPlain(cd.gratuity);
      el.curEmployerNps.value = Calc.formatINRPlain(cd.employerNps);
      el.curEmployeePf.value = Calc.formatINRPlain(cd.employeePf);
    }

    renderOfferTabs();
    populateActiveOfferForm();
  }

  /* ─────────────────────────────────────────────────────────────────
     12. EVENT LISTENERS SETUP
     ───────────────────────────────────────────────────────────────── */
  function setupEventListeners() {
    // ── Live Indian Currency Format-As-You-Type for All Money Inputs ──
    const currencyInputs = document.querySelectorAll('input.has-prefix');
    currencyInputs.forEach(input => {
      input.addEventListener('input', () => {
        handleCurrencyInput(input);
      });
      input.addEventListener('keydown', (e) => {
        handleCurrencyKeydown(e, input);
      });
      input.addEventListener('blur', () => {
        const val = Calc.parseINR(input.value);
        input.value = Calc.formatINRPlain(val);
      });
    });

    // Real-time synchronization of sliders and state on text input
    el.currentCtcInput.addEventListener('input', () => {
      const val = Calc.parseINR(el.currentCtcInput.value);
      el.currentCtcSlider.value = val;
      appState.currentSalary.ctc = val;
    });

    el.offerCtcInput.addEventListener('input', () => {
      const val = Calc.parseINR(el.offerCtcInput.value);
      el.offerCtcSlider.value = val;
      const active = getActiveOffer();
      active.ctc = val;
    });

    el.rentAnnual.addEventListener('input', () => {
      const val = Calc.parseINR(el.rentAnnual.value);
      el.rentSlider.value = val;
    });

    el.esopGrantInput.addEventListener('input', () => {
      const active = getActiveOffer();
      if (active.esop) {
        active.esop.grant = Calc.parseINR(el.esopGrantInput.value);
      }
    });

    // Real-time synchronization for detailed offer components
    const detailedOfferInputs = [
      el.offBasic, el.offHra, el.offSpecial, el.offBonus,
      el.offEmployerPf, el.offGratuity, el.offEmployerNps, el.offEmployeePf,
      el.offLta, el.offMeal, el.offFuel, el.offTelecom, el.offJoining
    ].filter(Boolean);

    detailedOfferInputs.forEach(input => {
      input.addEventListener('input', () => {
        const active = getActiveOffer();
        if (active.mode === 'detailed') {
          updateOfferedDetailedTotal();
        }
      });
    });

    // Real-time synchronization for detailed current salary components
    const detailedCurrentInputs = [
      el.curBasic, el.curHra, el.curSpecial, el.curBonus,
      el.curEmployerPf, el.curGratuity, el.curEmployerNps, el.curEmployeePf
    ].filter(Boolean);

    detailedCurrentInputs.forEach(input => {
      input.addEventListener('input', () => {
        if (appState.currentSalary.mode === 'detailed') {
          updateCurrentDetailedTotal();
        }
      });
    });

    // Live update on any input change (debounced to prevent excessive recalculation)
    const autoInputs = document.querySelectorAll('input, select');
    autoInputs.forEach(input => {
      input.addEventListener('input', debouncedRecalc);
      input.addEventListener('change', () => {
        harvestAll();
        recalculateAll();
      });
    });

    // ── Profile & Rules Interactive Listeners ──
    if (el.ageSelector) {
      el.ageSelector.addEventListener('click', (e) => {
        const label = e.target.closest('.seg-label');
        if (!label) return;
        const radio = label.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
          el.ageSelector.querySelectorAll('.seg-label').forEach(lbl => lbl.classList.remove('active'));
          label.classList.add('active');
          harvestProfile();
          recalculateAll();
          triggerAutoSave();
        }
      });
    }

    if (el.citySelect) {
      el.citySelect.addEventListener('change', () => {
        harvestProfile();
        const prof = getProfile();
        if (appState.currentSalary && appState.currentSalary.mode === 'quick') {
          appState.currentSalary.details = Calc.generateDefaultsFromCtc(appState.currentSalary.ctc, prof.isMetro, prof.pfBasis);
        }
        appState.offers.forEach(off => {
          if (off.mode === 'quick') {
            off.details = Calc.generateDefaultsFromCtc(off.ctc, prof.isMetro, prof.pfBasis);
          }
        });
        recalculateAll();
        triggerAutoSave();
      });
    }

    if (el.pfCeilingSelect) {
      el.pfCeilingSelect.addEventListener('change', () => {
        harvestProfile();
        const prof = getProfile();
        if (appState.currentSalary && appState.currentSalary.mode === 'quick') {
          appState.currentSalary.details = Calc.generateDefaultsFromCtc(appState.currentSalary.ctc, prof.isMetro, prof.pfBasis);
        }
        appState.offers.forEach(off => {
          if (off.mode === 'quick') {
            off.details = Calc.generateDefaultsFromCtc(off.ctc, prof.isMetro, prof.pfBasis);
          }
        });
        recalculateAll();
        triggerAutoSave();
      });
    }

    if (el.bonusTreatmentSelect) {
      el.bonusTreatmentSelect.addEventListener('change', () => {
        harvestProfile();
        recalculateAll();
        triggerAutoSave();
      });
    }

    if (el.employerTypeSelect) {
      el.employerTypeSelect.addEventListener('change', () => {
        harvestProfile();
        recalculateAll();
        triggerAutoSave();
      });
    }

    // ── Deductions & Investments Interactive Listeners ──
    const deductionMoneyInputs = [
      el.investments80c,
      el.insuranceSelf,
      el.insuranceParents,
      el.homeloanInterest,
      el.nps80ccd1b,
      el.otherDeductions
    ].filter(Boolean);

    deductionMoneyInputs.forEach(input => {
      input.addEventListener('input', () => {
        harvestDeductions();
        debouncedRecalc();
      });
      input.addEventListener('blur', () => {
        const val = Calc.parseINR(input.value);
        input.value = Calc.formatINRPlain(val);
        harvestDeductions();
        recalculateAll();
        triggerAutoSave();
      });
    });

    if (el.selfSenior) {
      el.selfSenior.addEventListener('change', () => {
        harvestDeductions();
        recalculateAll();
        triggerAutoSave();
      });
    }

    if (el.parentsSenior) {
      el.parentsSenior.addEventListener('change', () => {
        harvestDeductions();
        recalculateAll();
        triggerAutoSave();
      });
    }

    // Sliders
    el.currentCtcSlider.addEventListener('input', () => {
      el.currentCtcInput.value = Calc.formatINRPlain(el.currentCtcSlider.value);
      appState.currentSalary.ctc = Calc.parseINR(el.currentCtcSlider.value);
      recalculateAll();
    });

    el.currentCtcInput.addEventListener('blur', () => {
      const val = Calc.parseINR(el.currentCtcInput.value);
      el.currentCtcSlider.value = val;
      el.currentCtcInput.value = Calc.formatINRPlain(val);
      appState.currentSalary.ctc = val;
      recalculateAll();
    });

    el.offerCtcSlider.addEventListener('input', () => {
      el.offerCtcInput.value = Calc.formatINRPlain(el.offerCtcSlider.value);
      const active = getActiveOffer();
      active.ctc = Calc.parseINR(el.offerCtcSlider.value);
      recalculateAll();
    });

    el.offerCtcInput.addEventListener('blur', () => {
      const val = Calc.parseINR(el.offerCtcInput.value);
      el.offerCtcSlider.value = val;
      el.offerCtcInput.value = Calc.formatINRPlain(val);
      const active = getActiveOffer();
      active.ctc = val;
      recalculateAll();
    });

    el.rentSlider.addEventListener('input', () => {
      el.rentAnnual.value = Calc.formatINRPlain(el.rentSlider.value);
      harvestDeductions();
      recalculateAll();
      triggerAutoSave();
    });

    el.rentAnnual.addEventListener('input', () => {
      const val = Calc.parseINR(el.rentAnnual.value);
      el.rentSlider.value = val;
      harvestDeductions();
      debouncedRecalc();
    });

    el.rentAnnual.addEventListener('blur', () => {
      const val = Calc.parseINR(el.rentAnnual.value);
      el.rentSlider.value = val;
      el.rentAnnual.value = Calc.formatINRPlain(val);
      harvestDeductions();
      recalculateAll();
      triggerAutoSave();
    });

    // Current Salary Toggle
    el.currentEnabled.addEventListener('change', () => {
      const isEn = el.currentEnabled.checked;
      appState.currentSalary.enabled = isEn;
      el.currentBody.style.display = isEn ? 'block' : 'none';
      el.currentDisabledMsg.style.display = isEn ? 'none' : 'block';
      recalculateAll();
    });

    el.btnEnableCurrent.addEventListener('click', () => {
      el.currentEnabled.checked = true;
      appState.currentSalary.enabled = true;
      el.currentBody.style.display = 'block';
      el.currentDisabledMsg.style.display = 'none';
      el.currentCtcInput.focus();
      recalculateAll();
    });

    // Mode Switches
    el.currentModeSwitch.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const mode = btn.dataset.mode;
      const prevMode = appState.currentSalary.mode || 'quick';
      if (mode === prevMode) return;

      // Warn if switching from detailed → quick (auto-generated defaults will overwrite manual entries)
      if (prevMode === 'detailed' && mode === 'quick') {
        if (!confirm('Switching to Quick mode will overwrite your detailed breakdown with auto-calculated defaults. Continue?')) return;
      }

      appState.currentSalary.mode = mode;
      el.currentModeSwitch.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (mode === 'detailed') {
        el.currentDetailedGroup.style.display = 'block';
        el.currentQuickGroup.style.display = 'none';
        if (prevMode === 'quick') {
          const prof = getProfile();
          const defs = Calc.generateDefaultsFromCtc(appState.currentSalary.ctc, prof.isMetro, prof.pfBasis);
          appState.currentSalary.details = defs;
          el.curBasic.value = Calc.formatINRPlain(defs.basic);
          el.curHra.value = Calc.formatINRPlain(defs.hra);
          el.curSpecial.value = Calc.formatINRPlain(defs.special);
          el.curBonus.value = Calc.formatINRPlain(defs.bonus);
          el.curEmployerPf.value = Calc.formatINRPlain(defs.employerPf);
          el.curGratuity.value = Calc.formatINRPlain(defs.gratuity);
          el.curEmployerNps.value = Calc.formatINRPlain(defs.employerNps);
          el.curEmployeePf.value = Calc.formatINRPlain(defs.employeePf);
        }
        updateCurrentDetailedTotal();
      } else {
        el.currentDetailedGroup.style.display = 'none';
        el.currentQuickGroup.style.display = 'block';
        el.currentCtcInput.value = Calc.formatINRPlain(appState.currentSalary.ctc);
        el.currentCtcSlider.value = appState.currentSalary.ctc;
      }
      recalculateAll();
    });

    el.offerModeSwitch.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const mode = btn.dataset.mode;
      const active = getActiveOffer();
      const prevMode = active.mode || 'quick';
      if (mode === prevMode) return;

      // Warn if switching from detailed → quick (auto-generated defaults will overwrite manual entries)
      if (prevMode === 'detailed' && mode === 'quick') {
        if (!confirm('Switching to Quick mode will replace your detailed component breakdown with auto-calculated defaults. Continue?')) return;
      }

      active.mode = mode;
      el.offerModeSwitch.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (mode === 'detailed') {
        el.offerDetailedGroup.style.display = 'block';
        el.offerQuickGroup.style.display = 'none';
        if (prevMode === 'quick') {
          const prof = getProfile();
          active.details = Calc.generateDefaultsFromCtc(active.ctc, prof.isMetro, prof.pfBasis);
        }
        populateActiveOfferForm();
      } else {
        el.offerDetailedGroup.style.display = 'none';
        el.offerQuickGroup.style.display = 'block';
        populateActiveOfferForm();
      }
      recalculateAll();
    });

    // Age selector UI
    const ageLabels = document.querySelectorAll('#age-selector .seg-label');
    ageLabels.forEach(label => {
      label.addEventListener('click', () => {
        ageLabels.forEach(l => l.classList.remove('active'));
        label.classList.add('active');
        const radio = label.querySelector('input');
        if (radio) radio.checked = true;
        recalculateAll();
      });
    });

    // ESOP Toggle
    el.esopEnabled.addEventListener('change', () => {
      const isEn = el.esopEnabled.checked;
      const active = getActiveOffer();
      if (!active.esop) active.esop = {};
      active.esop.enabled = isEn;
      el.esopBody.style.display = isEn ? 'flex' : 'none';
      renderEsopScheduleSection();
      recalculateAll();
    });

    // ESOP Mode Switch
    if (el.esopModeSwitch) {
      el.esopModeSwitch.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const mode = btn.dataset.mode;
        const active = getActiveOffer();
        if (!active.esop) active.esop = {};
        active.esop.entryMode = mode;

        el.esopModeSwitch.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (mode === 'units') {
          el.esopValueGroup.style.display = 'none';
          el.esopUnitsGroup.style.display = 'block';
          updateEsopUnitsMath();
        } else {
          el.esopValueGroup.style.display = 'block';
          el.esopUnitsGroup.style.display = 'none';
        }
        renderEsopScheduleSection();
        recalculateAll();
      });
    }

    // ESOP Currency Switch
    if (el.esopCurrencySwitch) {
      el.esopCurrencySwitch.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const curr = btn.dataset.currency;
        const active = getActiveOffer();
        if (!active.esop) active.esop = {};
        active.esop.currency = curr;

        el.esopCurrencySwitch.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (el.esopPricePrefix) el.esopPricePrefix.textContent = curr === 'USD' ? '$' : '₹';
        if (el.esopUsdRateRow) el.esopUsdRateRow.style.display = curr === 'USD' ? 'block' : 'none';

        updateEsopUnitsMath();
        renderEsopScheduleSection();
        recalculateAll();
      });
    }

    // ESOP Units & Price Inputs
    if (el.esopUnitsInput) {
      el.esopUnitsInput.addEventListener('input', () => {
        const active = getActiveOffer();
        if (!active.esop) active.esop = {};
        active.esop.units = Calc.parseINR(el.esopUnitsInput.value);
        if (active.esop.entryMode === 'units') {
          updateEsopUnitsMath();
          renderEsopScheduleSection();
          recalculateAll();
        }
      });
      el.esopUnitsInput.addEventListener('blur', () => {
        const val = Calc.parseINR(el.esopUnitsInput.value);
        el.esopUnitsInput.value = Calc.formatINRPlain(val);
        recalculateAll();
      });
    }

    if (el.esopPriceInput) {
      el.esopPriceInput.addEventListener('input', () => {
        const active = getActiveOffer();
        if (!active.esop) active.esop = {};
        active.esop.pricePerUnit = Calc.parseINR(el.esopPriceInput.value);
        if (active.esop.entryMode === 'units') {
          updateEsopUnitsMath();
          renderEsopScheduleSection();
          recalculateAll();
        }
      });
      el.esopPriceInput.addEventListener('blur', () => {
        const val = Calc.parseINR(el.esopPriceInput.value);
        el.esopPriceInput.value = Calc.formatINRPlain(val);
        recalculateAll();
      });
    }

    if (el.esopUsdRateInput) {
      el.esopUsdRateInput.addEventListener('input', () => {
        const active = getActiveOffer();
        if (!active.esop) active.esop = {};
        active.esop.usdRate = parseFloat(el.esopUsdRateInput.value) || 87;
        if (active.esop.entryMode === 'units') {
          updateEsopUnitsMath();
          renderEsopScheduleSection();
          recalculateAll();
        }
      });
      el.esopUsdRateInput.addEventListener('blur', () => {
        recalculateAll();
      });
    }

    // ESOP Grant Input
    el.esopGrantInput.addEventListener('blur', () => {
      const val = Calc.parseINR(el.esopGrantInput.value);
      el.esopGrantInput.value = Calc.formatINRPlain(val);
      const active = getActiveOffer();
      if (!active.esop) active.esop = {};
      active.esop.grant = val;
      renderEsopScheduleSection();
      recalculateAll();
    });

    // ESOP Years
    el.esopYearsSelect.addEventListener('change', () => {
      const y = parseInt(el.esopYearsSelect.value, 10) || 4;
      const active = getActiveOffer();
      if (!active.esop) active.esop = {};
      active.esop.vestingYears = y;
      renderEsopScheduleSection();
      recalculateAll();
    });

    // ESOP Schedule Type
    el.esopScheduleTypeSwitch.querySelectorAll('.seg-label').forEach(lbl => {
      lbl.addEventListener('click', () => {
        el.esopScheduleTypeSwitch.querySelectorAll('.seg-label').forEach(l => l.classList.remove('active'));
        lbl.classList.add('active');
        const radio = lbl.querySelector('input');
        if (radio) radio.checked = true;
        const type = lbl.dataset.type;
        const active = getActiveOffer();
        if (!active.esop) active.esop = {};
        active.esop.scheduleType = type;
        renderEsopScheduleSection();
        recalculateAll();
      });
    });

    // Advanced allowances accordion
    el.advToggle.addEventListener('click', () => {
      const isClosed = el.advContent.style.display === 'none';
      el.advContent.style.display = isClosed ? 'flex' : 'none';
      el.advIcon.textContent = isClosed ? '▲' : '▼';
    });

    // Auto-update formula dependents when Basic changes
    el.curBasic.addEventListener('input', () => {
      if (appState.currentSalary.mode === 'detailed') {
        const b = Calc.parseINR(el.curBasic.value);
        const prof = getProfile();
        if (el.curHra.classList.contains('is-default')) {
          el.curHra.value = Calc.formatINRPlain(Math.round(b * (prof.isMetro ? 0.5 : 0.4)));
        }
        if (el.curEmployerPf.classList.contains('is-default')) {
          const pfVal = prof.pfBasis === 'capped' ? Math.min(21600, Math.round(b * 0.12)) : Math.round(b * 0.12);
          el.curEmployerPf.value = Calc.formatINRPlain(pfVal);
        }
        if (el.curGratuity.classList.contains('is-default')) {
          el.curGratuity.value = Calc.formatINRPlain(Math.round(b * 0.0481));
        }
        if (el.curEmployeePf.classList.contains('is-default')) {
          const pfVal = prof.pfBasis === 'capped' ? Math.min(21600, Math.round(b * 0.12)) : Math.round(b * 0.12);
          el.curEmployeePf.value = Calc.formatINRPlain(pfVal);
        }
        updateCurrentDetailedTotal();
      }
    });

    el.offBasic.addEventListener('input', () => {
      const active = getActiveOffer();
      if (active.mode === 'detailed') {
        const b = Calc.parseINR(el.offBasic.value);
        const prof = getProfile();
        if (el.offHra.classList.contains('is-default')) {
          el.offHra.value = Calc.formatINRPlain(Math.round(b * (prof.isMetro ? 0.5 : 0.4)));
        }
        if (el.offEmployerPf.classList.contains('is-default')) {
          const pfVal = prof.pfBasis === 'capped' ? Math.min(21600, Math.round(b * 0.12)) : Math.round(b * 0.12);
          el.offEmployerPf.value = Calc.formatINRPlain(pfVal);
        }
        if (el.offGratuity.classList.contains('is-default')) {
          el.offGratuity.value = Calc.formatINRPlain(Math.round(b * 0.0481));
        }
        if (el.offEmployeePf.classList.contains('is-default')) {
          const pfVal = prof.pfBasis === 'capped' ? Math.min(21600, Math.round(b * 0.12)) : Math.round(b * 0.12);
          el.offEmployeePf.value = Calc.formatINRPlain(pfVal);
        }
        updateOfferedDetailedTotal();
      }
    });

    // Profile Modal & Storage actions
    el.btnOpenProfiles.addEventListener('click', () => {
      renderProfilesList();
      el.profilesModal.classList.add('open');
    });

    el.modalCloseBtn.addEventListener('click', () => {
      el.profilesModal.classList.remove('open');
    });

    el.profilesModal.addEventListener('click', (e) => {
      if (e.target === el.profilesModal) {
        el.profilesModal.classList.remove('open');
      }
    });

    el.btnSaveCurrentProfile.addEventListener('click', () => {
      const name = el.newProfileNameInput.value.trim();
      if (!name) {
        showToast('Please enter a name for this profile.', 'error');
        return;
      }
      harvestAll();
      const res = Storage.saveNamedProfile(name, appState);
      if (res.success) {
        el.newProfileNameInput.value = '';
        renderProfilesList();
        showToast(`Saved profile: "${name}"`, 'success');
      } else {
        showToast('Failed to save profile: ' + res.error, 'error');
      }
    });

    el.btnExportJson.addEventListener('click', () => {
      harvestAll();
      Storage.exportToJsonFile(appState, 'india-salary-offers.json');
    });

    window.addEventListener('beforeunload', () => {
      harvestAll();
      Storage.saveAutoSave(appState);
    });

    el.btnTriggerImport.addEventListener('click', () => {
      el.fileImportInput.click();
    });

    el.fileImportInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (evt) {
        const text = evt.target.result;
        const res = Storage.parseImportedJson(text);
        if (res.success && res.data) {
          appState = res.data;
          restoreFullStateToUi();
          recalculateAll();
          showToast('Imported salary scenario successfully!', 'success');
        } else {
          showToast('Could not parse JSON file: ' + res.error, 'error');
        }
        el.fileImportInput.value = '';
      };
      reader.readAsText(file);
    });

    el.btnLoadSampleData.addEventListener('click', () => {
      fetch('data/default-profile.json')
        .then(r => r.json())
        .then(sample => {
          appState = sample;
          restoreFullStateToUi();
          recalculateAll();
          el.profilesModal.classList.remove('open');
          showToast('Loaded benchmark sample scenario.', 'success');
        })
        .catch(err => {
          console.warn('Could not fetch sample profile:', err);
          showToast('Loaded local defaults.', 'info');
        });
    });

    el.btnClearAllData.addEventListener('click', () => {
      if (confirm('Clear local storage auto-save and reset all fields?')) {
        Storage.clearAllData();
        appState = Storage.getDefaultState();
        restoreFullStateToUi();
        recalculateAll();
        el.profilesModal.classList.remove('open');
      }
    });

    el.btnResetState.addEventListener('click', () => {
      if (confirm('Reset comparator to standard initial state?')) {
        appState = Storage.getDefaultState();
        restoreFullStateToUi();
        recalculateAll();
      }
    });
  }

  /* ─────────────────────────────────────────────────────────────────
     13. INITIALIZATION
     ───────────────────────────────────────────────────────────────── */
  function init() {
    restoreFullStateToUi();
    setupEventListeners();
    recalculateAll();
  }

  init();

})();
