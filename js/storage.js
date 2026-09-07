/**
 * India Salary Offer Comparator - Local Storage & Profile Management
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SalaryStorage = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_PREFIX = 'salaryEngine_v1_';
  const CURRENT_STATE_KEY = STORAGE_PREFIX + 'autosave_state';
  const PROFILES_INDEX_KEY = STORAGE_PREFIX + 'profiles_index';

  /**
   * Default initial app state
   */
  function getDefaultState() {
    return {
      version: '1.0',
      timestamp: Date.now(),
      profile: {
        ageBracket: 'under60',
        city: 'bengaluru',
        pfBasis: 'actual',
        bonusTreatment: 'include',
        employerType: 'private'
      },
      deductions: {
        annualRent: 360000,
        other80C: 50000,
        insuranceSelf: 25000,
        isSelfSenior: false,
        insuranceParents: 30000,
        isParentSenior: true,
        homeLoanInterest: 0,
        nps80CCD1B: 50000,
        otherDeductions: 0
      },
      currentSalary: {
        enabled: true,
        mode: 'quick', // 'quick' | 'detailed'
        ctc: 2000000,
        details: {
          basic: 800000,
          hra: 400000,
          special: 507800,
          bonus: 0,
          employerPf: 96000,
          gratuity: 38480,
          employerNps: 0,
          employeePf: 96000
        }
      },
      activeOfferId: 'offer_1',
      offers: [
        {
          id: 'offer_1',
          label: 'Offer A',
          company: 'Tech Corp',
          mode: 'quick',
          ctc: 2600000,
          details: {
            basic: 1040000,
            hra: 520000,
            special: 660140,
            bonus: 0,
            employerPf: 124800,
            gratuity: 50024,
            employerNps: 0,
            employeePf: 124800,
            lta: 0,
            meal: 0,
            fuel: 0,
            telecom: 0,
            joining: 0
          },
          esop: {
            enabled: false,
            entryMode: 'value', // 'value' | 'units'
            units: 1000,
            pricePerUnit: 1200,
            currency: 'INR', // 'INR' | 'USD'
            usdRate: 87,
            grant: 1200000,
            vestingYears: 4,
            scheduleType: 'equal', // 'equal' | 'custom'
            customPcts: [25, 25, 25, 25]
          }
        }
      ]
    };
  }

  /**
   * Safely read from localStorage
   */
  function loadAutoSave() {
    try {
      const raw = localStorage.getItem(CURRENT_STATE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      const def = getDefaultState();
      return {
        ...def,
        ...parsed,
        profile: { ...def.profile, ...(parsed.profile || {}) },
        deductions: { ...def.deductions, ...(parsed.deductions || {}) },
        currentSalary: { ...def.currentSalary, ...(parsed.currentSalary || {}) }
      };
    } catch (e) {
      console.warn('SalaryStorage: Error reading auto-save from localStorage:', e);
      return null;
    }
  }

  /**
   * Save current state to localStorage (auto-save)
   */
  function saveAutoSave(state) {
    try {
      if (!state) return false;
      const payload = {
        ...state,
        timestamp: Date.now()
      };
      localStorage.setItem(CURRENT_STATE_KEY, JSON.stringify(payload));
      return true;
    } catch (e) {
      console.warn('SalaryStorage: Error writing auto-save to localStorage:', e);
      return false;
    }
  }

  /**
   * List all saved named profiles
   */
  function listProfiles() {
    try {
      const raw = localStorage.getItem(PROFILES_INDEX_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  /**
   * Save a named profile
   */
  function saveNamedProfile(name, state) {
    if (!name || !name.trim()) return { success: false, error: 'Profile name is required.' };
    try {
      const cleanName = name.trim();
      const profileId = 'prof_' + cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const profileKey = STORAGE_PREFIX + 'profile_' + profileId;

      const profileData = {
        id: profileId,
        name: cleanName,
        savedAt: Date.now(),
        state: state
      };

      localStorage.setItem(profileKey, JSON.stringify(profileData));

      // Update index
      const index = listProfiles().filter(p => p.id !== profileId);
      index.unshift({
        id: profileId,
        name: cleanName,
        savedAt: Date.now()
      });
      localStorage.setItem(PROFILES_INDEX_KEY, JSON.stringify(index));

      return { success: true, profileId };
    } catch (e) {
      console.error('SalaryStorage: Error saving named profile:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * Load a named profile
   */
  function loadNamedProfile(profileId) {
    try {
      const profileKey = STORAGE_PREFIX + 'profile_' + profileId;
      const raw = localStorage.getItem(profileKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.state) {
        const def = getDefaultState();
        parsed.state = {
          ...def,
          ...parsed.state,
          profile: { ...def.profile, ...(parsed.state.profile || {}) },
          deductions: { ...def.deductions, ...(parsed.state.deductions || {}) },
          currentSalary: { ...def.currentSalary, ...(parsed.state.currentSalary || {}) }
        };
      }
      return parsed;
    } catch (e) {
      console.error('SalaryStorage: Error loading profile:', e);
      return null;
    }
  }

  /**
   * Delete a named profile
   */
  function deleteNamedProfile(profileId) {
    try {
      const profileKey = STORAGE_PREFIX + 'profile_' + profileId;
      localStorage.removeItem(profileKey);

      const index = listProfiles().filter(p => p.id !== profileId);
      localStorage.setItem(PROFILES_INDEX_KEY, JSON.stringify(index));
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Clear auto-save and reset
   */
  function clearAllData() {
    try {
      localStorage.removeItem(CURRENT_STATE_KEY);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Export state to JSON file download
   */
  function exportToJsonFile(state, fileName = 'india-salary-comparison.json') {
    try {
      const jsonStr = JSON.stringify(state, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch (e) {
      console.error('SalaryStorage: Export failed:', e);
      return false;
    }
  }

  /**
   * Import state from a JSON string or file reader
   */
  function parseImportedJson(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid JSON structure');
      }
      const def = getDefaultState();
      const merged = {
        ...def,
        ...parsed,
        profile: { ...def.profile, ...(parsed.profile || {}) },
        deductions: { ...def.deductions, ...(parsed.deductions || {}) },
        currentSalary: { ...def.currentSalary, ...(parsed.currentSalary || {}) }
      };
      return { success: true, data: merged };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  return {
    getDefaultState,
    loadAutoSave,
    saveAutoSave,
    listProfiles,
    saveNamedProfile,
    loadNamedProfile,
    deleteNamedProfile,
    clearAllData,
    exportToJsonFile,
    parseImportedJson
  };
});
