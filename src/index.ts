import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { jwt } from 'hono/jwt'  // For verifying the JWT
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwtLib from 'jsonwebtoken' // For signing the JWT
import { publicRoutes } from './routes/public'
import { eventRoutes } from './routes/events'
import { QrRouter } from './routes/qrcodes'

const app = new Hono()
const prisma = new PrismaClient()

// Public routes (no auth required)
app.route('/', publicRoutes)

// Auth route (Login)
app.post('/auth/login', async (c) => {
  const { email, password } = await c.req.json()

  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    return c.json({ message: 'Invalid credentials' }, 401)
  }

  const isValidPassword = await bcrypt.compare(password, user.password)
  if (!isValidPassword) {
    return c.json({ message: 'Invalid credentials' }, 401)
  }

  // Sign JWT using jsonwebtoken library
  const token = jwtLib.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET || 'your-secret-key', // Secret key
    { expiresIn: '1h' } // Optional: Set token expiration
  )

  return c.json({ token })
})

// Protected routes using JWT middleware (with verification)
app.use('/api/*', jwt({
  secret: process.env.JWT_SECRET || 'your-secret-key'
}))

// Protected API routes
app.route('/api/events', eventRoutes);
app.route("/api/qrcodes" , QrRouter);

const port = 3000
console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port
})
