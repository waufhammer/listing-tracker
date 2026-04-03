# Listing Activity Tracker

A Compass-style listing activity dashboard for real estate agents. Your VA logs all showing activity in Airtable; clients get a clean, shareable link to view their listing's performance.

---

## How It Works

- **`yoursite.com/admin`** — Password-protected VA portal. Create listings, log activity, update view counts.
- **`yoursite.com/listing/[unique-id]`** — Public client dashboard. No login required. Share via link.

---

## Step 1 — Set Up Airtable (5 minutes)

1. Go to [airtable.com](https://airtable.com) and create a free account (if you don't have one).
2. Create a new **Base** — name it `Listing Tracker` (or anything you like).
3. You need **two tables** inside that base. Delete the default table and create these:

### Table 1: `Listings`

Create these fields exactly (field names are case-sensitive):

| Field Name | Field Type |
|---|---|
| `Property Address` | Single line text ← rename the default "Name" field |
| `Listing Date` | Date |
| `List Price` | Single line text |
| `Status` | Single select → add options: Active, Coming Soon, Under Contract, Sold, Withdrawn |
| `Public Token` | Single line text |
| `Zillow URL` | URL |
| `Redfin URL` | URL |
| `Zillow Views` | Number |
| `Redfin Views` | Number |
| `Zillow Views Updated` | Date |
| `Redfin Views Updated` | Date |

### Table 2: `Activity`

Create a second table named `Activity` with these fields:

| Field Name | Field Type |
|---|---|
| `Date` | Date |
| `Type` | Single select — add: Buyer Showing, Open House, Agent Preview |
| `Agent Name` | Single line text |
| `Follow Up Text Sent` | Checkbox |
| `Agent Requested Buyer Packet` | Checkbox |
| `Feedback` | Long text |
| `Open House Groups` | Number |
| `Listing` | Link to another record → link to the **Listings** table |

---

## Step 2 — Get Your Airtable API Key

1. Go to [airtable.com/create/tokens](https://airtable.com/create/tokens)
2. Click **"Create new token"**
3. Give it a name (e.g. `listing-tracker`)
4. Under **Scopes**, add: `data.records:read` and `data.records:write`
5. Under **Access**, select your base (`Listing Tracker`)
6. Click Create — **copy the token now** (you won't see it again)

**Find your Base ID:**
- Open your Airtable base in the browser
- The URL looks like: `airtable.com/appXXXXXXXXXXXXXX/tbl...`
- `appXXXXXXXXXXXXXX` is your Base ID — copy it

---

## Step 3 — Deploy to Vercel (5 minutes)

1. Upload this project folder to a GitHub repository (go to github.com → New repo → upload files)
2. Go to [vercel.com](https://vercel.com) → New Project → import your GitHub repo
3. On the **Environment Variables** screen, add all of the following:

```
AIRTABLE_API_KEY          = patXXXXXXXXXXXXXX   (your token from Step 2)
AIRTABLE_BASE_ID          = appXXXXXXXXXXXXXX   (your base ID from Step 2)
AIRTABLE_LISTINGS_TABLE   = Listings
AIRTABLE_ACTIVITY_TABLE   = Activity

ADMIN_PASSWORD            = (choose a password for you/your VA)
ADMIN_SECRET              = (type any long random string, e.g. "xK9mQ2pL7nR4wV8j")

AGENT_NAME                = Will Aufhammer
AGENT_COMPANY             = Aufhammer Homes
AGENT_PHONE               = 206.604.4992
AGENT_EMAIL               = will.aufhammer@compass.com
AGENT_PHOTO_URL           = (optional: paste a direct URL to your headshot)

NEXT_PUBLIC_BASE_URL      = https://your-project.vercel.app
```

4. Click **Deploy** — Vercel will build and deploy automatically.
5. Once deployed, update `NEXT_PUBLIC_BASE_URL` to your actual Vercel URL, then redeploy.

---

## Day-to-Day Usage for Your VA

### Creating a New Listing
1. Go to `yoursite.com/admin` and sign in
2. Click the green **"New Listing"** button
3. Fill in: Address, Listing Date, List Price, Status, and optionally Zillow/Redfin URLs
4. Click **"Create Listing"**
5. A client link appears immediately — copy it and send to your client

### Logging Activity
1. From `/admin`, click **"Manage →"** next to the listing
2. Click **"Log Activity"** (green button in the Activity Log section)
3. Fill in: Date, Type, Agent Name, feedback, checkboxes
4. Click **"Save Activity"**

### Updating Zillow/Redfin Views
1. Go to Manage Listing page
2. In the left column under **"Online Views"**, type in the current view counts
3. Click **"Update View Counts"** — today's date is saved automatically

---

## Running Locally (for development)

```bash
# Install dependencies
npm install

# Copy env file and fill in your values
cp .env.example .env.local

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
app/
  admin/
    login/          → VA login page
    page.js         → All listings overview
    listing/[id]/   → Manage individual listing
  listing/[token]/  → Public client dashboard
  api/
    auth/           → Login/logout
    listings/       → Create & update listings
    activity/       → Log & edit activity
lib/
  airtable.js       → All Airtable API calls
  auth.js           → Session cookie utilities
components/
  ActivityManager   → Admin activity log (add/edit/delete)
  ActivityLogTab    → Client-facing read-only activity table
  ClientDashboardTabs → Tab switcher (Activity / Online Views)
  ListingEditor     → Admin listing details + views form
  NewListingModal   → Create new listing modal
  CopyLinkButton    → Clipboard copy button
  LogoutButton      → Signs out of admin
middleware.js       → Protects /admin routes
```
