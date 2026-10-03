# Sentria Samadhan 🏛️

> **Smart Citizen Grievance Reporting & Government Accountability System.**

[![Live Dashboard](https://img.shields.io/badge/Render-Live%20Dashboard-46E3B7?style=for-the-badge&logo=render)](https://sentria-samadhan-frontend.onrender.com/dashboard)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20&%20Storage-FFA611?style=for-the-badge&logo=firebase)](https://firebase.google.com/)
[![SQLite / PostgreSQL](https://img.shields.io/badge/Database-SQLite%20%2F%20Postgres-blue?style=for-the-badge&logo=sqlite)](https://sqlite.org/)

---

## 🌟 Live Application
* **Dashboard:** [https://sentria-samadhan-frontend.onrender.com/dashboard](https://sentria-samadhan-frontend.onrender.com/dashboard)
* **Backend API:** [https://sentria-samadhan-backend.onrender.com](https://sentria-samadhan-backend.onrender.com)

---

## 📖 Overview

**Sentria Samadhan** is an intelligent civic complaint redressal and municipal tracking platform enabling citizens to report community issues, track live resolution statuses, and enforce public service accountability.

### Key Features
* 📝 **Civic Grievance Reporting:** Categorized complaints with geo-location, multimedia uploads, and priority levels.
* 📊 **Administrative Dashboard:** Real-time ticket management, departmental assignment, and status updates.
* 🤖 **AI-Assisted Processing:** Integrated Google Generative AI for automated ticket categorization and urgency triage.
* 🔔 **Status Notifications:** Email and system notifications powered by Nodemailer.
* 📱 **Mobile & PWA Ready:** Capacitor configuration for native mobile builds and responsive web app layout.

---

## 🛠️ Tech Stack

* **Frontend:** React, Vite, Tailwind CSS
* **Backend:** Express 5, Node.js
* **Database:** SQLite3 / PostgreSQL (pg)
* **Cloud & Auth:** Firebase Admin, Google Cloud Generative AI
* **Utilities:** Multer (file uploads), Nodemailer, UUID, Dotenv

---

## 🚀 Getting Started

### Prerequisites
* Node.js 18+
* npm

### Installation

```bash
# Clone the repository
git clone https://github.com/infinity1306/Sentria-Samadhan.git

# Navigate to project directory
cd Sentria-Samadhan

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your Firebase and API keys
```

### Running Locally

```bash
# Start backend server
npm start

# Or run Vite dev server
npm run dev
```

---

## 📄 License

ISC License.
