import { google } from 'googleapis'
import { hexToColorObject } from '../lib/helper'

export class GoogleSheetsService {
  private auth
  private drive
  private sheets

  constructor() {
    const SCOPES = ['https://www.googleapis.com/auth/drive']

    this.auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      undefined,
      process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      SCOPES
    )

    this.drive = google.drive({ version: 'v3', auth: this.auth })
    this.sheets = google.sheets({ version: 'v4', auth: this.auth })
  }

  async createSheet(title: string, data: any[][]) {
    try {
      const spreadsheet = await this.sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title,
          },
        },
      })

      const sheetId = spreadsheet.data.spreadsheetId
      const sheetName = spreadsheet.data.sheets?.[0].properties?.title

      if (!sheetId || !sheetName) {
        throw new Error('Failed to create sheet')
      }

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: 'A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: data,
        },
      })

      return { sheetId, sheetName }
    } catch (error) {
      console.error('Error creating Google Sheet:', error)
      throw error
    }
  }

  async shareSheet(sheetId: string, email: string) {
    try {
      await this.drive.permissions.create({
        fileId: sheetId,
        requestBody: {
          role: 'writer',
          type: 'user',
          emailAddress: email,
        },
      })
    } catch (error) {
      console.error('Error sharing sheet:', error)
      throw error
    }
  }

  // New method to get data from a Google Sheet
  async getSheetData(sheetId: string, range: string = 'A1:Z1000') {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range,
      })

      if (!response.data.values) {
        throw new Error('No data found in the sheet')
      }

      return response.data.values  // Returns the values as a 2D array
    } catch (error) {
      console.error('Error retrieving sheet data:', error)
      throw error
    }
  }

  async updateRowColor(sheetId: string, rowNumber: number, color: string) {
    try {
      // Convert hex color to Google Sheets format
      const colorObject = hexToColorObject(color);
  
      const request = {
        spreadsheetId: sheetId,
        requestBody: {
          requests: [
            {
              updateCells: {
                rows: [
                  {
                    values: new Array(26).fill({
                      userEnteredFormat: {
                        backgroundColor: colorObject,
                      },
                    }),
                  },
                ],
                fields: "userEnteredFormat(backgroundColor)",
                start: {
                  rowIndex: rowNumber,
                  columnIndex: 0,
                },
              },
            },
          ],
        },
      };
  
      await this.sheets.spreadsheets.batchUpdate(request);
    } catch (error) {
      console.error("Error highlighting row:", error);
      throw error;
    }
  }
  
  
}
