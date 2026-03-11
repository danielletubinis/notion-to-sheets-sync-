const { Client } = require("@notionhq/client");
const { google } = require("googleapis");

// ── Config ─────────────────────────────────────────────────────────────────────
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SHEET_TAB_NAME = "Notion Sync";

// ── Notion client ──────────────────────────────────────────────────────────────
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// ── Google Sheets client ───────────────────────────────────────────────────────
async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function richText(arr) {
  if (!arr || !arr.length) return "";
  return arr.map((t) => t.plain_text).join("");
}

function dateStr(dateObj) {
  if (!dateObj || !dateObj.start) return "";
  return dateObj.start;
}

function selectName(obj) {
  if (!obj) return "";
  return obj.name || "";
}

function peopleNames(arr) {
  if (!arr || !arr.length) return "";
  return arr.map((p) => p.name || p.id).join(", ");
}

function numberVal(val) {
  if (val === null || val === undefined) return "";
  return val;
}

// ── Fetch all pages from Notion (handles pagination) ──────────────────────────
async function fetchAllNotionRows() {
  const rows = [];
  let cursor = undefined;

  do {
    const response = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      start_cursor: cursor,
      page_size: 100,
    });
    rows.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return rows;
}

// ── Map a Notion page to a flat row ───────────────────────────────────────────
function mapRow(page) {
  const p = page.properties;

  const get = (names) => {
    for (const name of names) {
      if (p[name] !== undefined) return p[name];
    }
    return null;
  };

  // Study/Cohort
  const studyCohortProp = get(["Study/Cohort", "Study", "Cohort", "Name", "Task"]);
  let studyCohort = "";
  if (studyCohortProp) {
    if (studyCohortProp.type === "title") studyCohort = richText(studyCohortProp.title);
    else if (studyCohortProp.type === "rich_text") studyCohort = richText(studyCohortProp.rich_text);
    else if (studyCohortProp.type === "select") studyCohort = selectName(studyCohortProp.select);
  }

  // Goal
  const goalProp = get(["Goal", "Goals"]);
  let goal = "";
  if (goalProp) {
    if (goalProp.type === "rich_text") goal = richText(goalProp.rich_text);
    else if (goalProp.type === "select") goal = selectName(goalProp.select);
    else if (goalProp.type === "title") goal = richText(goalProp.title);
  }

  // Assignee
  const assigneeProp = get(["Assignee", "Assignees", "Assigned to", "Owner"]);
  let assignee = "";
  if (assigneeProp && assigneeProp.type === "people") {
    assignee = peopleNames(assigneeProp.people);
  }

  // Task Start Date
  const startProp = get(["Task Start Date", "Start Date", "Start", "Date Start"]);
  let startDate = "";
  if (startProp && startProp.type === "date") startDate = dateStr(startProp.date);

  // Due Date
  const dueProp = get(["Due Date", "Due", "Deadline", "End Date"]);
  let dueDate = "";
  if (dueProp && dueProp.type === "date") dueDate = dateStr(dueProp.date);

  // Estimated Hours
  const hoursProp = get(["Estimated Hours", "Est. Hours", "Hours", "Estimate"]);
  let estimatedHours = "";
  if (hoursProp) {
    if (hoursProp.type === "number") estimatedHours = numberVal(hoursProp.number);
    else if (hoursProp.type === "rich_text") estimatedHours = richText(hoursProp.rich_text);
  }

  return [
    studyCohort,
    goal,
    assignee,
    startDate,
    dueDate,
    estimatedHours,
    page.url,
    new Date().toISOString().slice(0, 10),
  ];
}

// ── Ensure the tab exists, create if not ──────────────────────────────────────
async function ensureTab(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existing = meta.data.sheets.map((s) => s.properties.title);

  if (!existing.includes(SHEET_TAB_NAME)) {
    console.log(`Creating tab: ${SHEET_TAB_NAME}`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: SHEET_TAB_NAME } } }],
      },
    });
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Starting Notion -> Google Sheets sync...");

  const pages = await fetchAllNotionRows();
  console.log(`Fetched ${pages.length} rows from Notion`);

  const dataRows = pages.map(mapRow);

  const sheets = await getSheetsClient();
  await ensureTab(sheets);

  const header = [
    "Study/Cohort",
    "Goal",
    "Assignee",
    "Task Start Date",
    "Due Date",
    "Estimated Hours",
    "Notion URL",
    "Last Synced",
  ];
  const values = [header, ...dataRows];

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_TAB_NAME}`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_TAB_NAME}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  console.log(`Synced ${dataRows.length} rows to "${SHEET_TAB_NAME}" tab`);
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
