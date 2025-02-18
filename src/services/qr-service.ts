import fs from "fs";
import path from "path";
import crypto from "crypto";
import nodemailer from "nodemailer";
import archiver from "archiver";
import QRCode from "qrcode";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SECRET_KEY = process.env.SECRET_KEY || "your-secret-key";
const logFilePath = path.join(__dirname, "log.txt");

// Log failed email deliveries
export function logFailedEmail(email: string, reason: string) {
  const logEntry = `[${new Date().toISOString()}] Failed to send email to ${email}: ${reason}\n`;
  fs.appendFileSync(logFilePath, logEntry);
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

// Generate a secure HMAC SHA-256 hash
export function generateHash(eventId: string, data: any): string {
  const hmac = crypto.createHmac("sha256", SECRET_KEY);
  hmac.update(eventId + JSON.stringify(data));
  return hmac.digest("hex");
}

// Generate QR code data
export async function generateQRCodeData(eventId: string, data: any[], outputPath: string) {
  const qrPayload = {
    event_id: eventId,
    data,
    hash: generateHash(eventId, data),
  };

  await QRCode.toFile(outputPath, JSON.stringify(qrPayload));
}

// Send QR codes via email
export async function sendEmailsWithQRCodes(emailList: { email: string; qrPath: string }[]) {
  try {
    // Fetch the single SMTP configuration from the database (assumed to be the only one)
    const smtpConfig = await prisma.smtpConfig.findFirst(); // Using `findFirst()` as there's only one config

    if (!smtpConfig) {
      console.error('SMTP configuration not found');
      return;
    }

    // Create the email transporter using the SMTP config from the database
    const transporter = nodemailer.createTransport({
      service: smtpConfig.service, 
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
      host: smtpConfig.host,
      port: smtpConfig.port,
    });

    for (const { email, qrPath } of emailList) {
      try {
        await transporter.sendMail({
          from: smtpConfig.user, // From the SMTP user
          to: email,
          subject: "Your Event QR Code",
          text: "Please find your QR code attached.",
          attachments: [{ filename: path.basename(qrPath), path: qrPath }],
        });

        console.log(`✅ Email sent to ${email}`);
      } catch (error: any) {
        console.error(`❌ Failed to send email to ${email}: ${error.message}`);
        logFailedEmail(email, error.message); // Assuming you have a logFailedEmail function
      }
    }
  } catch (error) {
    console.error('Error retrieving SMTP config or sending emails:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Create a ZIP file of all QR codes
export async function generateQRZip(qrCodes: { fileName: string; filePath: string }[], zipPath: string) {
  return new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve());
    archive.on("error", (err) => reject(err));

    archive.pipe(output);

    for (const { fileName, filePath } of qrCodes) {
      archive.file(filePath, { name: fileName });
    }

    archive.finalize();
  });
}

