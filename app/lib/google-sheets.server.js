// app/lib/google-sheets.server.js
import { GoogleSpreadsheet } from "google-spreadsheet";
import { GoogleAuth } from "google-auth-library"; // <-- ВИКОРИСТОВУЄМО ІНШИЙ ІМПОРТ

// Перевіряємо наявність необхідних змінних середовища
if (
  !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
  !process.env.GOOGLE_PRIVATE_KEY ||
  !process.env.GOOGLE_SHEET_ID
) {
  throw new Error(
    "Google Sheets API credentials are not configured in environment variables.",
  );
}

const auth = new GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);

export async function validateLicenseKey(keyToValidate) {
  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    const licenseRow = rows.find((row) => row.get("Key") === keyToValidate);

    console.log(`[Google Sheeets]:`, licenseRow, rows);

    if (!licenseRow) {
      console.log(
        `[License Check] Key "${keyToValidate}" not found in Google Sheet.`,
      );
      return { valid: false, reason: "not_found" };
    }

    const expirationDateStr = licenseRow.get("ExpirationDate");
    const expirationDate = new Date(expirationDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Встановлюємо час на початок дня для коректного порівняння

    if (expirationDate < today) {
      console.log(
        `[License Check] Key "${keyToValidate}" has expired on ${expirationDateStr}.`,
      );
      return { valid: false, reason: "expired" };
    }

    console.log(
      `[License Check] Key "${keyToValidate}" is valid until ${expirationDateStr}.`,
    );
    return { valid: true, expirationDate: expirationDateStr };
  } catch (error) {
    console.error("Error accessing Google Sheet:", error);
    return { valid: false, reason: "api_error" };
  }
}
