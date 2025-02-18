import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import readline from 'readline'

const prisma = new PrismaClient()
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

async function addUser() {
  try {
    // Collect user input via the command line
    const email = await new Promise<string>(resolve => {
      rl.question('Enter email: ', resolve)
    })

    const password = await new Promise<string>(resolve => {
      rl.question('Enter password: ', resolve)
    })

    const name = await new Promise<string>(resolve => {
      rl.question('Enter name: ', resolve)
    })

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create the user in the database
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name
      }
    })

    console.log('User created successfully:', {
      id: user.id,
      email: user.email,
      name: user.name
    })
  } catch (error) {
    console.error('Error creating user:', error)
  } finally {
    await prisma.$disconnect()
    rl.close()
  }
}

addUser()
