# Student Information System - Setup (Tanglish)

## 1. 3 Google Sheets create pannunga (veru veru file)
   - `AdminData`, `ProfessorData`, `StudentData`
   - Ovvoru sheet URL la `/d/` ku apram `/edit` ku munnadi irukkura text dhaan **Sheet ID**.

## 2. Backend (Apps Script)
   - https://script.new open pannunga -> `Code.gs` content-a paste pannunga.
   - Mela `IDS` la 3 Sheet ID-yum paste pannunga. `SALT` la own random text podunga. Save.
   - Function dropdown la **setup** select panni **Run** (one time) -> Authorize.
     (Admins / Professors / Students / Attendance / Marks tabs create aagum, admin login ready aagum)
   - Deploy -> New deployment -> Web app -> Execute as: **Me**, Who has access: **Anyone** -> Deploy
   - **Web app URL** copy pannunga (`/exec` nu mudiyanum).
   - URL-a browser la open panna `{"ok":true,"msg":"API running"}` varanum.

## 3. Frontend
   - `script.js` la `API_URL` la antha URL paste pannunga. `index.html` open pannunga.

## Admin login
   ID: `admin`   Password: `admin123`  (login panni udane Change Password pannunga)

## Code.gs maathina
   Deploy -> Manage deployments -> Edit -> Version: **New version** -> Deploy
