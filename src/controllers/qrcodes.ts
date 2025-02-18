import { Context } from 'hono';
import path from "path";
import fs from "fs";
import { PrismaClient } from '@prisma/client';
import { GoogleSheetsService } from '../services/sheets';
import { generateQRCodeData, generateQRZip, isValidEmail, sendEmailsWithQRCodes } from '../services/qr-service';

const prisma = new PrismaClient();

// API route for generating QR codes
export async function generateQRCodes(c: Context) {
    try {
        const { id: eventId } = c.req.param();
        const { type = "download" } = c.req.query(); // Default to "download" if no type is specified

        if (!["download", "sendmail"].includes(type)) {
            c.status(400);
            return c.json({ message: "Invalid request type" });
        }

        // Fetch event details
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: { sheetId: true },
        });

        if (!event) {
            c.status(404);
            return c.json({ message: "Event not found" });
        }

        // Fetch sheet data
        const sheetsService = new GoogleSheetsService();
        const sheetData = await sheetsService.getSheetData(event.sheetId);

        if (sheetData.length === 0) {
            c.status(400);
            return c.json({ message: "Sheet is empty" });
        }

        // Find email column
        const firstRow = sheetData[0];
        let emailColumnIndex = firstRow.findIndex((cell) => /email/i.test(cell));

        if (type === "sendmail" && emailColumnIndex === -1) {
            c.status(400);
            return c.json({ message: "No email column found in sheet" });
        }

        // Identify unique columns (columns with no repeating values)
        const uniqueColumns: number[] = [];
        const columnValues: Record<number, Set<string>> = {}; // Track values in each column

        // Loop through each row to gather values for each column
        for (let rowIndex = 1; rowIndex < sheetData.length; rowIndex++) {
            const row = sheetData[rowIndex];
            row.forEach((cell, columnIndex) => {
                if (!columnValues[columnIndex]) {
                    columnValues[columnIndex] = new Set();
                }
                columnValues[columnIndex].add(String(cell).trim());
            });
        }

        // Identify columns that have unique values (i.e., no repeats)
        for (const [columnIndex, values] of Object.entries(columnValues)) {
            const columnIndexNum = Number(columnIndex);
            const columnData = sheetData.map((row) => String(row[columnIndexNum]).trim());

            // If the set of values in the column matches the total rows, it's unique
            if (new Set(columnData).size === columnData.length) {
                uniqueColumns.push(columnIndexNum);
            }
        }

        if (uniqueColumns.length === 0) {
            c.status(400);
            return c.json({ message: "No unique columns found" });
        }

        // Generate a unique folder name using a random string
        const uniqueFolder = `qrcodes_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        const qrDir = path.join(__dirname, "temp", uniqueFolder);

        // Create the directory if it doesn't exist
        if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });

        const qrCodes: { email?: string; fileName: string; filePath: string }[] = [];

        // Generate QR codes for each row, using only unique columns
        for (let i = 1; i < sheetData.length; i++) {
            const row = sheetData[i];
            const uniqueValues = uniqueColumns.map((colIndex) => row[colIndex]);

            // Ensure there is at least one unique value
            if (uniqueValues.length === 0) continue;

            const fileName = `qr_${i}.png`;
            const filePath = path.join(qrDir, fileName);

            await generateQRCodeData(eventId, uniqueValues, filePath);

            // Add QR code details to array
            if (emailColumnIndex !== -1 && isValidEmail(row[emailColumnIndex])) {
                qrCodes.push({
                    email: row[emailColumnIndex],
                    fileName, // Added fileName
                    filePath, // Added filePath
                });
            } else {
                qrCodes.push({
                    fileName, // Added fileName
                    filePath, // Added filePath
                });
            }
        }

        if (type === "sendmail") {
            // Filter and map QR codes with emails
            const validEmails = qrCodes
                .filter((q) => q.email) // Filter to only those with email
                .map((q) => ({
                    email: q.email!,
                    qrPath: q.filePath, // Map filePath to qrPath
                }));

            await sendEmailsWithQRCodes(validEmails);
            return c.json({ message: "Emails sent successfully" });
        }

        // If type is "download", create a ZIP file
        const zipPath = path.join(__dirname, "temp", uniqueFolder, "qrcodes.zip");
        await generateQRZip(qrCodes, zipPath); // qrCodes now has fileName and filePath

        // Send ZIP file to the client
        c.header("Content-Disposition", "attachment; filename=qrcodes.zip");
        c.header("Content-Type", "application/zip");
        return c.body(fs.readFileSync(zipPath));

    } catch (error) {
        console.error("Error in QR generation:", error);
        c.status(500);
        return c.json({ message: "Internal Server Error" });
    } finally {
        // Cleanup: Remove the generated folder and files after processing
        const tempDir = path.join(__dirname, "temp");
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }
}
