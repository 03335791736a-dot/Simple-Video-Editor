# Simple Video Editor — Secure User Access & Authentication System

## 1. System Overview

This application implements a multi-factor user-access and authentication architecture designed specifically for a local Windows 10 desktop application built with Electron, React, and local FFmpeg processing.

### Core Security Principles
1. **Google Account Identity**: Users authenticate with their personal Google/Gmail accounts.
2. **Individual Access Password**: Each authorized Google account is assigned an individual access password (e.g. `A7K9-X2P4-M8Q1`).
3. **One-to-One Binding**: One person's password **NEVER** works for another person's Gmail account.
4. **No Plaintext Passwords**: Passwords are never saved in plaintext on disk, in Firestore, or in the frontend client. They are hashed using Node.js native `crypto.scrypt` with a cryptographically random 16-byte salt.
5. **Zero Cloud Media Processing**: All video, audio, and image processing remains 100% local on the user's computer via FFmpeg and Electron. No media files are ever transmitted to any external server.

---

## 2. Authentication Flow

### Step 1: Sign in with Google
- The user is presented with the **"Sign in to Simple Video Editor"** screen.
- User clicks **"Continue with Google"** (Firebase `GoogleAuthProvider` popup).

### Step 2: Read Authenticated Gmail
- The application retrieves the verified email address directly from Google authentication.

### Step 3: Server-Side Authorization & Status Check
- The backend verifies if the Gmail address is in the authorized users database:
  - **If NOT Authorized**: The screen displays **"Access Denied: Your Google account is not authorized to use this application."** Displays the signed-in email address and a **"Sign out"** button. The editor remains completely locked.
  - **If Disabled**: The screen displays **"Account Disabled: Your account has been disabled by the administrator."** Access is refused.
  - **If Authorized & Active**: The user proceeds to Step 4.

### Step 4: Individual Password Entry
- The user is prompted: **"Welcome, [Name] — Enter your access password"**.
- User enters their individual password.

### Step 5: Salted Hash Verification
- The backend verifies the password against the salted scrypt hash tied to that specific Gmail account:
  - **If Incorrect**: Displays **"Incorrect password"**. Editor remains locked.
  - **If Correct**: Generates an authorized session token and unlocks the full video editor interface.

---

## 3. Administrator Dashboard

Administrators (configured via `ADMIN_EMAIL` in environment) have full management capabilities:
- **User List**: View Name, Gmail, Status (`ACTIVE` / `DISABLED`), Role (`admin` / `user`), Created Date, and Last Access.
- **Authorize User**: Enter any Gmail address to authorize that account.
- **Generate / Reset Password**: Generates a secure, random password (format: `A7K9-X2P4-M8Q1`). 
  - The generated password is displayed **ONCE** in a secure modal with a quick-copy button.
  - The server hashes the password immediately with a fresh salt and discards the plaintext.
  - Any previous password and active sessions are instantly invalidated.
- **Enable / Disable User**: Instantly toggles access without deleting user history. Disabled users cannot unlock the editor.
- **Delete User**: Permanently revokes authorization and invalidates active sessions.

---

## 4. Pre-Configured Test Accounts

For instant testing and evaluation without needing immediate Google Cloud credentials, the application includes pre-seeded test accounts:

| Google Account | Password | Role | Expected Status |
| :--- | :--- | :--- | :--- |
| `03335791736a@gmail.com` | *None (Google Sign-In Only)* | Admin | Authorized / Full Dashboard Access Immediately |
| `admin@gmail.com` | *None (Google Sign-In Only)* | Admin | Authorized / Full Dashboard Access Immediately |
| `user1@gmail.com` | `A7K9-X2P4` | User | Authorized / Individual Password Unlock |
| `user2@gmail.com` | `B8M3-Q7L1` | User | Authorized / Individual Password Unlock |
| `user3@gmail.com` | `C4R9-N5K2` | User | Authorized / Individual Password Unlock |
| `unauthorized@gmail.com` | Any | None | **Access Denied** |

### Test Matrix Scenarios
1. **Valid Login**: Sign in as `user1@gmail.com` + enter `A7K9-X2P4` -> **Editor Unlocked**.
2. **Cross-Account Password Rejection**: Sign in as `user1@gmail.com` + enter `B8M3-Q7L1` -> **"Incorrect password"**.
3. **Cross-Account Password Rejection**: Sign in as `user2@gmail.com` + enter `A7K9-X2P4` -> **"Incorrect password"**.
4. **Unauthorized Account**: Sign in with any unlisted Gmail -> **"Access Denied"**.
5. **Disabled Account**: Admin sets `user2@gmail.com` to `Disabled` -> User is immediately blocked.
6. **Password Reset**: Admin resets password for `user1@gmail.com` -> Old password `A7K9-X2P4` no longer works; only the newly generated password works.

---

## 5. Offline Windows Desktop Packaging

To package the application as a standalone Windows 10 desktop executable:

```bash
# 1. Build frontend and server bundles
npm run build

# 2. Package Windows 64-bit installer with electron-builder
npm run dist:win
```

The output installer will be located in:
`dist/SimpleVideoEditorSetup.exe`
