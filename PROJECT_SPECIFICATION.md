# Gym Management System - Project Specification

**Project Duration:** 1 Week  
**Client:** Gym Owner (Admin)  
**Date Created:** April 2, 2026

---

## 1. PROJECT OVERVIEW

A Business Intelligence gym management system designed for a small gym (0-100 members) with:
- **Admin-only access** for gym owner (email/password authentication)
- **Member registration** through in-app form
- **Multiple dashboards** tracking key metrics (revenue, attendance, capacity)
- **Responsive design** supporting both desktop and mobile devices

---

## 2. TECHNICAL STACK

| Layer | Technology |
|-------|-----------|
| **Frontend** | HTML, CSS, JavaScript (Vanilla or lightweight framework) |
| **Backend** | Node.js (Express.js recommended) |
| **Database** | Supabase (PostgreSQL) |
| **Hosting** | TBD |
| **Authentication** | Email/Password (Supabase Auth) |

---

## 3. CORE FEATURES

### 3.1 Authentication
- Owner login with email/password
- Session management with secure tokens
- Password reset capability (optional for v1)

### 3.2 Member Management
- **Member Registration Form** capturing:
  - Name (VARCHAR, unique)
  - Gender (Male/Female)
  - Membership Type (Monthly/Session)
  - QR Code (auto-generated or manual upload)
- **Member Check-in** (Owner authenticated via QR code):
  - Owner scans member QR code
  - Records check-in date/time automatically
  - Optional: Record payment amount during check-in

### 3.3 Business Intelligence Dashboards

#### Dashboard 1: HOME
- Active Members (total count)
- Revenue (monthly, badge with % change)
- Trainers/Staff count
- Revenue trend chart (last 30 days)

#### Dashboard 2: STATUS & WEEKLY ATTENDANCE
- Weekly attendance chart (Mon-Sun) showing # of check-ins per day
- Peak hours visualization (from Time In data - bar chart of hourly distribution)
- Daily revenue breakdown
- Top visiting times/hours

#### Dashboard 3: MEMBERS
- Searchable members list
- Member details (name, gender, membership type, qr code)
- Filters (membership type: Monthly/Session)
- Pagination (if needed)

#### Dashboard 4: MEMBERSHIP FORM
- Add new member form
- Form validation
- Success/error notifications

---

## 4. DATABASE SCHEMA (Supabase)

### Table: users (Owner Account)
```
- id (UUID, PK)
- email (VARCHAR, UNIQUE)
- password_hash (VARCHAR)
- created_at (TIMESTAMP)
```

### Table: members
```
- id (UUID, PK)
- name (VARCHAR, UNIQUE)
- gender (VARCHAR: Male, Female)
- membership_type (VARCHAR: Monthly, Session)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### Table: check_ins (Attendance Log)
```
- id (UUID, PK)
- member_id (UUID, FK -> members)
- check_in_date (DATE)
- check_in_time (TIME)
- payment_amount (DECIMAL) - Payment made on this check-in (0 if no payment)
- created_at (TIMESTAMP)
```

### Table: daily_revenue (Aggregated)
```
- id (UUID, PK)
- check_in_date (DATE)
- total_revenue (DECIMAL) - SUM of all payments on that date
- member_count (INT) - Number of check-ins that day
- created_at (TIMESTAMP)
```

---

## 5. PAGES & COMPONENTS

### Pages
1. **Login Page** - Email/password authentication
2. **Dashboard Home** - Overview metrics (revenue, active members, check-ins today) & revenue chart
3. **Members Page** - Member list with search/filter by name or membership type
4. **Analytics Page** - Weekly attendance chart + peak hours visualization
5. **Add Member Page** - Registration form (name, gender, membership type) + auto-generate QR code

### Reusable Components
- Navbar/Sidebar navigation
- Card component (for metrics)
- Chart component (using Chart.js or similar)
- Table component (members list)
- Form component (with validation)
- Modal/Toast notifications

---

### Key Business Logic

### Metrics Calculated
- **Total Members:** COUNT(DISTINCT members)
- **Active Members (This Month):** COUNT(DISTINCT member_id FROM check_ins WHERE check_in_date IN current month)
- **Monthly Revenue:** SUM(payment_amount FROM check_ins WHERE check_in_date IN current month)
- **Revenue % Change:** (Current Month - Previous Month) / Previous Month * 100
- **Weekly Attendance:** COUNT(check_ins GROUP BY DATE WHERE last 7 days)
- **Peak Hours:** Most frequent TIME(check_in_time) from check_ins (group by hour)
- **Check-ins Today:** COUNT(check_ins WHERE check_in_date = TODAY())

### Data Import Strategy
1. Current Excel data (gym_records.csv) will be imported into check_ins table
2. Extract unique members from check_ins to populate members table
3. Auto-generate QR codes for each member
4. Aggregate daily_revenue from check_ins for quick dashboard access

---

## 7. API ENDPOINTS (Backend)

### Authentication
- `POST /api/auth/login` - Owner login
- `POST /api/auth/logout` - Logout

### Members
- `GET /api/members` - List all members (with filters/search)
- `POST /api/members` - Create new member
- `GET /api/members/:id` - Get member details
- `PUT /api/members/:id` - Update member
- `DELETE /api/members/:id` - Delete member

### Check-ins
- `POST /api/check-ins` - Log member check-in (with payment optional)
- `GET /api/check-ins` - Get check-in history (with filters)
- `GET /api/check-ins/today` - Get today's check-ins

### Analytics
- `GET /api/analytics/dashboard` - All dashboard metrics (revenue, member count, etc.)
- `GET /api/analytics/revenue` - Monthly/weekly revenue breakdown
- `GET /api/analytics/peak-hours` - Peak hours distribution (hourly counts)
- `GET /api/analytics/weekly-attendance` - Attendance by day of week

---

## 8. DESIGN REFERENCE

**Figma Design Elements:**
- Dark purple/blue theme with accent colors
- Cards for metrics display
- Line charts for revenue/attendance trends
- Table for member list
- Form fields with custom styling
- Mobile-friendly breakpoints (tested on 375px, 768px, 1024px+)

---

## 9. DELIVERABLES

- [ ] Fully functional backend (Node.js + Supabase)
- [ ] Responsive frontend (Desktop & Mobile)
- [ ] Owner authentication system
- [ ] Member management system
- [ ] BI dashboards with real-time data
- [ ] API documentation
- [ ] Deployment on hosting platform
- [ ] User manual/documentation

---

## 10. NOTES & ASSUMPTIONS

- **CSV Data Import**: gym_records.csv will be imported (contains 40+ member records with historical check-ins)
  - CSV columns map to: Date → check_in_date, Name → member name, Time In → check_in_time, Payment (PHP) → payment_amount, Gender, Membership
  - Unique members will be extracted and loaded into members table
  - QR codes will be generated using a library (e.g., qrcode npm package)
  - Historical check-ins from CSV will retroactively populate the check_ins table
- Owner uses laptop/desktop for primary work; mobile is secondary
- Check-in process: Owner scans member QR code, system logs time + optional payment
- Revenue metrics are gym-level aggregated (not per-member transactions)
- Only 1 admin user (gym owner) required
- No email/contact fields needed in member profile for v1
- Membership types: Monthly (900 PHP), Session (100 PHP) - based on Excel data

---
