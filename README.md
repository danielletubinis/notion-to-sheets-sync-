[README.md](https://github.com/user-attachments/files/25902347/README.md)
# Notion → Google Sheets Daily Sync

A GitHub Action that pulls data from a Notion database and writes it to a new tab in a Google Sheet, running daily on a schedule.

## What it syncs

| Column | Notion Field |
|---|---|
| Study/Cohort | Title or select field |
| Goal | Rich text or select field |
| Assignee | People field |
| Task Start Date | Date field |
| Due Date | Date field |
| Estimated Hours | Number field |
| Notion URL | Auto-populated |
| Last Synced | Auto-populated |

The script auto-creates the **"Notion Sync"** tab if it doesn't exist, then clears and rewrites it on every run.

---

## Setup

### Step 1 — Create a Notion Integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **+ New integration**
3. Name it (e.g., "Sheets Sync"), select your workspace, click **Submit**
4. Copy the **Internal Integration Token** — this is your `NOTION_API_KEY`
5. Open your Notion database → click **...** (top right) → **Connections** → add your integration

### Step 2 — Create a Google Service Account

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Enable the **Google Sheets API**: APIs & Services → Enable APIs → search "Google Sheets API"
4. Go to **IAM & Admin → Service Accounts** → Create service account
5. Name it (e.g., "notion-sync"), click through to finish
6. Click the service account → **Keys** tab → **Add Key → Create new key → JSON**
7. Download the JSON file — this is your `GOOGLE_SERVICE_ACCOUNT_JSON`
8. Copy the service account's email address (looks like `name@project.iam.gserviceaccount.com`)
9. **Share the Google Sheet** with that email address (Editor access)

### Step 3 — Add GitHub Secrets

In your GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**

Add these four secrets:

| Secret Name | Value |
|---|---|
| `NOTION_API_KEY` | Your Notion integration token |
| `NOTION_DATABASE_ID` | The Notion database ID (from the URL) |
| `GOOGLE_SPREADSHEET_ID` | The Google Sheet ID (from the URL) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The full contents of the JSON key file |

**Finding IDs from URLs:**
- Notion DB: `notion.so/workspace/[DATABASE_ID]?v=...` — copy the part before `?v=`
- Google Sheet: `docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit`

### Step 4 — Push to GitHub & Test

```bash
git init
git add .
git commit -m "Initial commit: Notion to Sheets sync"
git remote add origin https://github.com/YOUR_USERNAME/notion-to-sheets-sync.git
git push -u origin main
```

Then go to **Actions** tab in GitHub → select the workflow → click **Run workflow** to trigger it manually and verify it works.

---

## Schedule

The sync runs daily at **6:00 AM UTC** by default. To change the time, edit the `cron` line in `.github/workflows/sync.yml`:

```yaml
- cron: "0 6 * * *"   # 6am UTC daily
- cron: "0 14 * * *"  # 2pm UTC daily
- cron: "0 9 * * 1-5" # 9am UTC weekdays only
```

Use [crontab.guru](https://crontab.guru) to build your preferred schedule.

---

## Troubleshooting

- **"Could not find database"** — Make sure your Notion integration is added as a connection to the database
- **"The caller does not have permission"** — Make sure the service account email has Editor access to the Google Sheet
- **Columns show blank** — The script tries common field name variations. If your Notion fields have different names, update the `get([...])` arrays in `scripts/sync.js`
