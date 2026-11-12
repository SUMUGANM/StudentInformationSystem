# StudentInformationSystem
Role-based Student Information System with Admin, Professor and Student logins, built with HTML, CSS, JavaScript and Google Sheets as the backend via Google Apps Script.
# Student Information System

A role-based student management web app with **Admin**, **Professor** and **Student** logins.
The frontend is plain HTML, CSS and JavaScript. The backend is **Google Apps Script**, and the data is stored in **Google Sheets**.

## Features

### Admin
- Add, edit and delete professors (name, degree, experience, date of birth, email, phone)
- Dashboard with total students, total professors, students per professor and students per class

### Professor
- Add, edit and delete students (name, DOB, father and mother name, siblings, address, phone, email, class, password)
- Mark daily attendance (Present / Absent) and edit it later
- Add, edit and delete semester-wise, subject-wise marks

### Student
- Log in to view their own profile, attendance percentage and marks (read-only)

## Tech Stack
- HTML, CSS, JavaScript (no frameworks)
- Google Apps Script (backend API)
- Google Sheets (3 separate sheets: Admin, Professor, Student)

## Data Storage
| Google Sheet | Tabs |
|---|---|
| AdminData | Admins |
| ProfessorData | Professors |
| StudentData | Students, Attendance, Marks |

Passwords are stored as salted SHA-256 hashes, never as plain text.

## Setup
1. Create 3 Google Sheets: `AdminData`, `ProfessorData`, `StudentData`.
2. Open https://script.new and paste the contents of `Code.gs`.
3. Set the 3 Sheet IDs in `IDS` and put your own random text in `SALT`.
4. Run the `setup` function once and authorize it.
5. Deploy as a **Web app** (Execute as: Me, Who has access: Anyone) and copy the `/exec` URL.
6. Paste the URL into `API_URL` in `script.js` and open `index.html`.

Default admin: `admin` / `admin123`. Change it right after the first login.

## Project Structure
```
├── index.html   # UI
├── style.css    # Styles
├── script.js    # Frontend logic
└── Code.gs      # Google Apps Script backend
```
