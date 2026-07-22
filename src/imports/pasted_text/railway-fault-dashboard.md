You are a Senior Frontend Engineer and UI/UX Designer.

Your task is to design and develop a complete, modern, responsive frontend for a web application.

Project Name:
AI-Based Railway Track Fault Detection and Alert System

This is a final-year Computer Interfacing project. The frontend should look like a professional Railway Control Center dashboard.

Do NOT build the backend.
Do NOT write any FastAPI, Django, database, or authentication backend code.
Only build the frontend using dummy/mock data.

=========================================
TECH STACK
=========================================

- React.js
- TypeScript
- Vite
- Tailwind CSS
- React Router DOM
- Axios (prepare API service only)
- React Icons
- Framer Motion
- Chart.js (or Recharts)

Use modern component-based architecture.

=========================================
UI THEME
=========================================

Create a modern industrial dashboard inspired by

• Railway Control Centers
• Tesla Dashboard
• Smart City Monitoring Systems

Theme:

Dark Mode

Primary Color:
#2563EB

Danger:
#DC2626

Success:
#16A34A

Warning:
#F59E0B

Background:
#0F172A

Card Background:
#1E293B

Text:
#F8FAFC

Requirements

• Responsive
• Smooth animations
• Professional spacing
• Rounded cards
• Glassmorphism where appropriate
• Modern charts
• Beautiful tables
• Mobile friendly
• Desktop optimized

=========================================
USER ROLES
=========================================

There are three user roles.

• Station Incharge
• Maintenance Team
• Railway Administrator

Use mock login and role switching using dummy JSON data.

No backend authentication.

=========================================
PAGES
=========================================

1. Login Page

Modern login UI

Contains

• Logo
• Username
• Password
• Remember Me
• Forgot Password
• Login Button

=========================================

2. Dashboard

Show summary cards

• Total Stations
• Total Tracks
• Active Faults
• Critical Faults
• Fixed Today
• Under Maintenance
• System Status

Include

• Line Chart
• Pie Chart
• Recent Alerts Table
• Latest Activity

=========================================

3. Live Railway Monitoring

Display all railway tracks.

Each track card should contain

• Track ID
• Station Name
• Current Status
• Latest Camera Snapshot
• Sensor Health
• Last Updated

Status badges

Green = Safe

Yellow = Warning

Red = Critical

Include

Search

Filter

Pagination

=========================================

4. Alerts & Fault Records

Beautiful data table.

Columns

• Fault ID
• Station
• Track ID
• Fault Type
• Severity
• Detection Time
• Status
• Image
• View Button

When clicking View

Open a modal containing

• Fault Image
• Fault Details
• AI Confidence
• Sensor Values
• Detection Time
• Remarks

Status badges

Active

Under Maintenance

Fixed

=========================================

5. Maintenance Updates

Display repair tasks.

Columns

• Fault ID
• Assigned Team
• Engineer
• Progress
• Status
• Completion Time

Buttons

Start Repair

Update Progress

Mark Fixed

Use dummy functionality only.

=========================================

6. Reports & Analytics

Beautiful dashboard with

Charts

Statistics

Cards

Tables

Show

Daily Report

Weekly Report

Monthly Report

Most Faulty Station

Most Common Fault

Fixed Fault Count

Active Fault Count

Include Export PDF and Export Excel buttons (UI only).

=========================================

7. Settings

Profile Card

Change Password Form

Notification Preferences

Theme Settings

=========================================
LAYOUT
=========================================

Create a professional dashboard layout.

Sidebar

• Dashboard
• Live Monitoring
• Alerts & Fault Records
• Maintenance Updates
• Reports & Analytics
• Settings
• Logout

Top Navbar

• Search
• Notifications
• Current Time
• User Profile

=========================================
COMPONENTS
=========================================

Create reusable components.

Examples

Sidebar

Navbar

Card

Status Badge

Alert Card

Fault Table

Track Card

Statistics Card

Modal

Button

Loader

Search Bar

Pagination

Chart Components

=========================================
PROJECT STRUCTURE
=========================================

Generate a clean folder structure.

Example

src/

components/

pages/

layouts/

hooks/

services/

types/

utils/

assets/

data/

routes/

contexts/

=========================================
MOCK DATA
=========================================

Create realistic dummy data for

Stations

Tracks

Faults

Maintenance

Notifications

Users

=========================================
DESIGN QUALITY
=========================================

The UI should be professional enough to include in a university project report.

Focus heavily on

• UI consistency
• UX
• Animations
• Clean code
• Reusable components
• Responsive design
• Modern dashboard aesthetics

=========================================
IMPORTANT
=========================================

Do NOT generate everything in one response.

Generate the project incrementally.

Start with:

1. Folder structure
2. Install dependencies
3. Routing
4. Layout
5. Sidebar
6. Navbar

Then wait for my "Continue" before generating the next part.

Maintain consistency throughout the project.

Generate production-quality React code.