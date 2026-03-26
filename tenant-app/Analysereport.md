# ACIS Version 5.0 Project Analysis and Handover

## Introduction

This document provides a comprehensive analysis of the ACIS Version 5.0 project, intended to facilitate a smooth handover to the new development team. The project consists of two main applications: a `developer-app` for administration and a `tenant-app` for client-side operations.

## Project Structure

The repository is a monorepo containing two separate React applications:

1. `developer-app/`: A web-based portal for developers and administrators to manage tenants, support tickets, and system health.
2. `tenant-app/`: A multi-platform application for tenants to manage their financial documents, clients, and other business operations.

---

## 1. Developer App (`developer-app/`)

### 1.1. Overview

The `developer-app` is a web application built with React and Vite. It serves as a centralized dashboard for system administrators to oversee the entire ACIS Version 5.0 ecosystem.

### 1.2. Technical Stack

* **Framework:** React (v18.2.0) with Vite
* **Routing:** `react-router-dom` (v6.23.1)
* **Styling:** Tailwind CSS (v3.4.4)
* **Backend Integration:** Firebase (v10.12.0) for authentication and data.
* **UI Components:** `lucide-react` for icons.

### 1.3. Key Features

* **Authentication:** Secure login for developers using Google Sign-In, with access control checks.
* **Dashboard:** A high-level overview of system metrics, including active tenants, support tickets, and database health. (Currently uses static data).
* **Tenant Management:**
  * View a list of all tenants.
  * Register new tenants via a detailed onboarding form.
  * Suspend or edit existing tenant information (UI present, functionality to be fully implemented).
* **Ticket Management:**
  * A support desk interface to view and manage client-submitted tickets. (Currently uses static data).

### 1.4. Application Flow

1. The user visits the landing page.
2. The user navigates to the `/login` page and authenticates using Google.
3. The application verifies the user's developer credentials with Firebase.
4. Upon successful authentication, the user is redirected to the `/dashboard`.
5. From the dashboard, the user can navigate to manage tenants or support tickets.

### 1.5. Getting Started

1. Navigate to the `developer-app` directory: `cd developer-app`
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev`

---

## 2. Tenant App (`tenant-app/`)

### 2.1. Overview

The `tenant-app` is a comprehensive, multi-platform application designed for the end-users (tenants). It supports web, desktop (via Electron), and mobile (via Capacitor) deployments. This application is the primary interface for tenants to manage their business operations within the ACIS Version 5.0 system.

### 2.2. Technical Stack

* **Framework:** React (v19.2.0) with Vite
* **Platforms:**
  * Web (PWA enabled with `vite-plugin-pwa`)
  * Desktop: `electron` (v40.8.0) and `electron-builder`
  * Mobile: `@capacitor/android` (v8.1.0)
* **Routing:** `react-router-dom` (v7.13.1)
* **Styling:** Tailwind CSS (v4.2.1)
* **Backend Integration:** Firebase (v12.9.0)
* **Document Generation:** `jspdf` and `jspdf-autotable` for creating PDF invoices.
* **Emailing:** `nodemailer` for sending emails.

### 2.3. Key Features

* **Multi-Tenancy:** The application is architected to serve multiple tenants, with tenant-specific data isolation. The tenant is identified via the URL (`/t/:tenantId/...`).
* **Authentication:** Users log in to their specific tenant environment.
* **Dashboard:** Provides an overview of the tenant's business activities.
* **Financial Management:**
  * Daily transaction tracking.
  * Invoice management (placeholder).
  * Expense tracking (placeholder).
* **Client Management:**
  * Onboarding new clients.
  * Managing client details and their dependents.
* **Portal Management:** A system to manage and interact with various external portals.
* **Cross-Platform Support:** A single codebase that builds for web, desktop, and mobile, providing a consistent user experience.
* **Other Features:** Notifications, user profile management, settings, and a chat-based help system.

### 2.4. Application Flow

1. The user navigates to a tenant-specific URL (e.g., `/t/tenant-abc/login`).
2. The application loads the branding and configuration for the specified tenant.
3. The user authenticates.
4. Upon successful login, the user is presented with the main application layout, starting with the dashboard.
5. The user can then access various modules like `Daily Transactions`, `Client Onboarding`, etc., to manage their business operations.

### 2.5. Getting Started

1. Navigate to the `tenant-app` directory: `cd tenant-app`
2. Install dependencies: `npm install`
3. Run the development server (for web): `npm run dev`
4. To build the desktop application: `npm run electron:build`

## Conclusion

The ACIS Version 5.0 project is a robust system with a clear separation of concerns between the administrative and client-facing applications. The use of modern technologies like React, Vite, and Tailwind CSS ensures a maintainable and scalable codebase. The multi-platform nature of the `tenant-app` is a key strength, allowing for a wide reach.

The new team should focus on:

1. Replacing the mock data in the `developer-app` with live data from Firebase.
2. Implementing the remaining placeholder modules in the `tenant-app`.
3. Familiarizing themselves with the Firebase schema and security rules.
4. Understanding the build and deployment processes for all target platforms (web, desktop, mobile).

