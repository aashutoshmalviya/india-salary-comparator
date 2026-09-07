# India Salary Offer & Tax Regime Comparator (FY 2026-27)

> **Live Website & PWA**: [https://aashutoshmalviya.github.io/india-salary-comparator/](https://aashutoshmalviya.github.io/india-salary-comparator/)

A modern, fast, private, and client-side web application to evaluate Indian salary offers, compare **New vs Old Tax Regimes** under **FY 2026-27** rules, and model **ESOP / RSU equity vesting**.

---

## Features

- **New Tax Regime (FY 2026-27 / AY 2027-28)**:
  - 7-tier revised slabs (0–4L Nil, 4–8L 5%, 8–12L 10%, 12–16L 15%, 16–20L 20%, 20–24L 25%, >24L 30%).
  - ₹75,000 Standard Deduction (gross salaries up to ₹12.75L are 100% tax-free).
  - Section 87A Rebate & **Marginal Relief** between ₹12L and ₹12.7L.
  - Section 80CCD(2) Corporate NPS deduction up to 14% of Basic.
  - Surcharge capping at 25% with marginal relief for high earners (> ₹50L).
- **Old Tax Regime Engine**:
  - HRA exemption under Section 10(13A) with 50% metro status for 8 cities (Bengaluru, Pune, Hyderabad, Ahmedabad, Delhi, Mumbai, Kolkata, Chennai).
  - Section 80C (PPF, ELSS, EPF combined cap at ₹1.5L).
  - Section 80D health insurance (with senior citizen self & parent caps up to ₹1L).
  - Section 24(b) Home loan interest up to ₹2L, Section 80CCD(1B) NPS up to ₹50k, 80E, and 80G.
- **Multi-Offer Comparison Strip**:
  - Compare up to 5 concurrent job offers side-by-side on an interactive leaderboard.
  - Quick Mode (CTC-driven auto-generation) and Detailed Mode (all allowances & employer costs).
- **ESOP & Equity Vesting Engine**:
  - Enter equity by Total Grant Value or by **Number of Units & Today's Price**.
  - Dual Currency support (₹ INR or $ USD with configurable exchange rate).
  - Equal and Custom 1-to-5 year vesting schedules with year-by-year unit breakdowns.
- **Client-Side Privacy & Persistence**:
  - All data is auto-saved locally in your browser (`localStorage`).
  - Zero server tracking, zero external network transmission.
  - Named profile management with instant JSON Export & Import.
- **Installable PWA**:
  - Install as a native app on macOS, Windows, iOS, and Android with full offline capability.

---

## Running Locally

No dependencies or build steps required. Simply open `index.html` in any modern browser:

```bash
# Clone the repository
git clone https://github.com/aashutoshmalviya/india-salary-comparator.git

# Navigate to project
cd india-salary-comparator

# Open in browser or run a local static server
npx serve .
# or
python3 -m http.server 8000
```

---

## Testing

Run the automated test suite verifying tax slabs, rebates, marginal relief, and storage persistence:

```bash
node js/calculator.test.js
```

---

## License

MIT
