# Qrify Backend 📷

Qrify Backend is a backend application designed for generating and managing QR codes for events. It processes event data from Excel sheets, publishes them to Google Sheets, and allows real-time attendance marking via the Qrify App.


### Android App
[Qrify App](https://github.com/shivam1608/Qrify)

## ✨ Features

- Generate QR codes for events from Excel sheets.
- Publish event data to Google Sheets.
- Sync QR scans with Google Sheets for real-time attendance tracking.
- API routes for event management and QR code operations.
- Admin user creation for managing events and QR codes.

## Technology Stack

- **Programming Language:** TypeScript
- **Database Management:** Prisma ORM
- **Frameworks/Libraries:** Hono (for API handling)

## Setup Instructions

### Prerequisites

Ensure you have the following installed:

- [Bun](https://bun.sh/)
- [Docker](https://www.docker.com/) (optional for containerized deployment)
- Node.js (if using an alternative runtime)

### Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/shivam1608/qrify-backend-main.git
   cd qrify-backend-main
   ```

2. Install dependencies:
   ```sh
   bun install
   ```

3. Set up the database:
   ```sh
   bun prisma migrate dev
   ```

4. Start the server:
   ```sh
   bun run dev
   ```

### Creating an Admin User

To create an admin user, run the `scripts/create_user.ts` script:

```sh
bun run scripts/create_user.ts
```

This script will prompt you to enter:

- **Email**: The email of the admin user.
- **Password**: A secure password for authentication.
- **Name**: The name of the admin user.

Once the details are provided, the user will be created in the database.

## 📁 Directory Structure

```
qrify-backend-main/
│── prisma/               # Database schema and migrations
│── scripts/              # Custom scripts (e.g., user creation)
│── src/                  # Main source code
│   ├── controllers/      # Handles business logic
│   ├── routes/           # API route definitions
│   ├── services/         # Service layer (QR, sheets handling)
│   ├── lib/              # Utility functions
│   ├── index.ts          # Entry point
│── types/                # TypeScript type definitions
│── Dockerfile            # Docker container setup
│── package.json          # Project metadata and scripts
│── tsconfig.json         # TypeScript configuration
│── .gitignore            # Git ignored files
│── bun.lockb             # Dependency lock file
```

## API Endpoints

### QR Code Routes
- **`POST /qrcodes/generate`** - Generates a QR code for an event.
- **`GET /qrcodes/:id`** - Retrieves details of a specific QR code.

### Event Routes
- **`POST /events/create`** - Creates a new event from an Excel file.
- **`GET /events/:id`** - Fetches event details.
- **`GET /events`** - Lists all events.

### Public Routes
- **`GET /public/events`** - Fetches public event details.
- **`POST /public/scan`** - Marks attendance by scanning a QR code.

## Open Source Project 
Author : Shivzee
<br />
IDE Used : VS Code
<br />
[Buy me a coffee](https://buymeacoffee.com/shivzee)
