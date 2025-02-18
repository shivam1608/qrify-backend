import { Hono } from 'hono'

const router = new Hono()

router.get('/', (c) => {
  return c.json({
    message: 'Welcome to the API',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString()
  })
})

router.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  })
})

export { router as publicRoutes }