import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateSmtpConfig() {
  try {
    // Delete the existing SMTP configuration
    await prisma.smtpConfig.deleteMany({});

    // Create a new SMTP configuration
    const smtpConfig = await prisma.smtpConfig.create({
      data: {
        service: 'gmail',
        user: 'your-email@gmail.com', // Update with your email
        pass: 'your-password', // Update with your password
        host: 'smtp.gmail.com',
        port: 587,
      },
    });

    console.log('SMTP configuration updated:', smtpConfig);
  } catch (error) {
    console.error('Error updating SMTP configuration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateSmtpConfig();
