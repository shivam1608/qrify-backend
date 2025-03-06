import { Context } from 'hono'
import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import { GoogleSheetsService } from '../services/sheets'
import { generateHash } from '../services/qr-service'

const prisma = new PrismaClient()
const sheetsService = new GoogleSheetsService()


export async function createEvent(c: Context) {
  try {
    const userId = c.get('jwtPayload').id
    const formData = await c.req.formData()
    
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const expiresAt = formData.get('expiresAt') as string
    const file = formData.get('file') as File

    if (!name || !description || !expiresAt || !file) {
      c.status(400)
      return c.json({ message: 'Missing required fields' })
    }

    const parsedExpiresAt = new Date(expiresAt)
    if (isNaN(parsedExpiresAt.getTime())) {
      c.status(400)
      return c.json({ message: 'Invalid date format for expiresAt' })
    }

    // Read Excel file
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data : any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

    // Function to check if all values in a column are unique
    const isUniqueColumn = (columnData: any[]) => {
      const valuesSet = new Set(columnData)
      return valuesSet.size === columnData.length
    }

    // Find a column with all unique values
    let uniqueColumnFound = false
    for (let colIndex = 0; colIndex < data[0].length; colIndex++) {
      const columnData = data.map(row => row[colIndex])
      if (isUniqueColumn(columnData)) {
        uniqueColumnFound = true
        break
      }
    }

    if (!uniqueColumnFound) {
      return c.json({ message: 'Invalid file, no unique parameters found' }, 400)
    }

    // Create Google Sheet only if a unique column is found
    const { sheetId, sheetName: googleSheetName } = await sheetsService.createSheet(name, data as any[][])

    // Share the sheet
    if (process.env.OWNER_EMAIL) {
      await sheetsService.shareSheet(sheetId, process.env.OWNER_EMAIL)
    }

    // Create event in database
    const event = await prisma.event.create({
      data: {
        name,
        description,
        expiresAt: parsedExpiresAt,
        sheetId,
        sheetName: googleSheetName,
        userId
      },
      include: {
        createdBy: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    return c.json(event)
  } catch (error) {
    console.error('Error creating event:', error)
    c.status(500)
    return c.json({ message: 'Internal Server Error' })
  }
}


export async function getEvents(c: Context) {
  try {
    const userId = c.get('jwtPayload').id

    // Extract the 'status' query parameter, default to 'active'
    const status = c.req.query('status') || 'active'

    // Define the condition for filtering events based on the status
    let whereCondition: Record<string, any> = {
      userId
    }

    if (status === 'active') {
      // Only active events (not expired)
      whereCondition.expiresAt = {
        gt: new Date() // Events with a future expiry date
      }
    } else if (status === 'expired') {
      // Only expired events
      whereCondition.expiresAt = {
        lt: new Date() // Events with an expired date
      }
    }

    // Fetch events based on the where condition
    const events = await prisma.event.findMany({
      where: whereCondition,
      include: {
        createdBy: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        expiresAt: 'asc'
      }
    })

    return c.json(events)
  } catch (error) {
    console.error('Error fetching events:', error)
    c.status(500)
    return c.json({ message: 'Internal Server Error' })
  }
}



export async function deleteEvent(c: Context) {
  try {
    const userId = c.get('jwtPayload').id
    const eventId = c.req.param('id') // Get event ID from the URL parameter

    if (!eventId) {
      c.status(400)
      return c.json({ message: 'Event ID is required' })
    }

    // Fetch the event to ensure it exists and belongs to the user
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        createdBy: true
      }
    })

    if (!event) {
      c.status(404)
      return c.json({ message: 'Event not found' })
    }

    // Check if the user is the creator of the event
    if (event.userId !== userId) {
      c.status(403)
      return c.json({ message: 'You do not have permission to delete this event' })
    }

    // Delete the event
    await prisma.event.delete({
      where: { id: eventId }
    })

    return c.json({ message: 'Event deleted successfully' })
  } catch (error) {
    console.error('Error deleting event:', error)
    c.status(500)
    return c.json({ message: 'Internal Server Error' })
  }
}



export async function getEventDetails(c: Context) {
  try {
    // Get the eventId from the URL parameter (GET request with /event/:id)
    const { id: eventId } = c.req.param()  // Extract eventId from the route parameters

    // Fetch the event from the database
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        sheetId: true,
        sheetName: true
      }
    })

    if (!event) {
      c.status(404)
      return c.json({ message: 'Event not found' })
    }

    // Retrieve Google Sheet data using the GoogleSheetsService
    const sheetData: any[][] = await sheetsService.getSheetData(event.sheetId)  // Use the method from the service
    
    // Function to check if all values in a column are unique
    const isUniqueColumn = (columnData: any[]) => {
      const valuesSet = new Set(columnData)
      return valuesSet.size === columnData.length
    }

    // Find unique columns and identify email column
    let uniqueColumns: number[] = []
    let emailColumnFound = false
    let emailColumnIndex = -1

    const firstRow = sheetData[0]  // First row (header row) of the sheet
    const columnData = sheetData.map(row => row) // Entire sheet data for checking

    for (let colIndex = 0; colIndex < firstRow.length; colIndex++) {
      const columnValues = columnData.map(row => row[colIndex])

      // Check for uniqueness in this column
      if (isUniqueColumn(columnValues)) {
        uniqueColumns.push(colIndex + 1)  // Store the column number (1-based index)
      }

      // Check if the column contains email addresses using regex
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA0-9]{2,}$/i
      if (!emailColumnFound && columnValues.some(value => emailRegex.test(String(value)))) {
        emailColumnFound = true
        emailColumnIndex = colIndex + 1  // Store the email column index (1-based)
      }
    }

    // Return the response, emailColumnIndex will be -1 if no email column was found
    const googleSheetLink = `https://docs.google.com/spreadsheets/d/${event.sheetId}`
    
    return c.json({
      googleSheetLink,
      uniqueColumns,
      firstRow,
      emailColumnIndex
    })
  } catch (error) {
    console.error('Error fetching event details:', error)
    c.status(500)
    return c.json({ message: 'Internal Server Error' })
  }
}

export async function searchRows(c: Context) {
  try {
    // Get the eventId from the route parameter (POST request with /event/:id)
    const { id: eventId } = c.req.param();

    // Get the request body containing the QR code payload
    const { event_id, data, hash } = await c.req.json();

    // Validate the data and hash (check if it's valid)
    if (!hash || !data || data.length === 0) {
      c.status(400);
      return c.json({ message: 'Invalid QR code data' });
    }

    // Ensure the event_id matches the provided eventId from the route
    if (event_id !== eventId) {
      c.status(400);
      return c.json({ message: 'Event ID mismatch' });
    }

    // Generate the hash from the QR code data
    const generatedHash = generateHash(eventId, data); // Concatenate data values for hash generation

    // Compare the hashes to ensure the data is valid
    if (generatedHash !== hash) {
      c.status(400);
      return c.json({ message: 'Invalid QR code' });
    }

    // Fetch the event from the database
    const event = await prisma.event.findUnique({
      where: { id: eventId, },
      select: {
        name: true,
        sheetId: true,
        sheetName: true
      },
    });

    if (!event) {
      c.status(404);
      return c.json({ message: 'Event not found' });
    }

    // Retrieve Google Sheet data using the GoogleSheetsService
    const sheetsService = new GoogleSheetsService();
    const sheetData: any[][] = await sheetsService.getSheetData(event.sheetId);

    // Function to check if a row matches all values from QR data
    const doesRowMatchQRData = (row: any[], qrDataValues: string[]) => {
      return qrDataValues.every(value => row.some(cell => String(cell).trim().toLowerCase() === String(value).trim().toLowerCase()));
    };

    // Find the rows that match the QR data and store row numbers
    const matchingRows: { rowNumber: number; rowData: any[] }[] = [];

    // Loop through all rows and check for a match
    for (let rowIndex = 0; rowIndex < sheetData.length; rowIndex++) {
      const row = sheetData[rowIndex];

      // Search for the QR data in the row
      if (doesRowMatchQRData(row, data)) {
        matchingRows.push({
          rowNumber: rowIndex + 1,  // Store the 1-based row index
          rowData: row
        });
      }
    }

    // Return the response with matching rows and their row numbers
    if (matchingRows.length > 0) {
       matchingRows[0].rowData.push(event.name);
      return c.json({
        message: 'Rows found successfully',
        matchingRows
      });
    } else {
      return c.json({
        message: 'No rows found'
      });
    }
  } catch (error) {
    console.error('Error searching rows:', error);
    c.status(500);
    return c.json({ message: 'Internal Server Error' });
  }
}




export async function highlightRow(c: Context) {
  try {
    // Get the eventId from the route parameter (PATCH request with /event/:id)
    const { id: eventId } = c.req.param()

    // Get the request body containing the rowNumber and color
    const { rowNumber, config } = await c.req.json()

    // Fetch the event from the database
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        sheetId: true,
        sheetName: true
      }
    })

    if (!event) {
      c.status(404)
      return c.json({ message: 'Event not found' })
    }

    // Retrieve Google Sheet data using the GoogleSheetsService
    const sheetData: any[][] = await sheetsService.getSheetData(event.sheetId)  // Use the method from the service

    // Check if rowNumber is valid
    if (rowNumber < 1 || rowNumber > sheetData.length) {
      c.status(400)
      return c.json({ message: 'Invalid row number' })
    }

    // Get the target row (convert rowNumber to 0-based index)
    const targetRow = sheetData[rowNumber - 1]

    // Call the Google Sheets API to apply the background color to the entire row
    await sheetsService.updateRowColor(event.sheetId, rowNumber - 1, config.color)

    // Return a success response
    return c.json({
      message: 'Row highlighted successfully',
      rowNumber,
      color: config.color
    })
  } catch (error) {
    console.error('Error highlighting row:', error)
    c.status(500)
    return c.json({ message: 'Internal Server Error' })
  }
}