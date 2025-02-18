import { Hono } from 'hono'
import { createEvent, deleteEvent, getEventDetails, getEvents, highlightRow, searchRows } from '../controllers/events'

const router = new Hono()

router.post('/', createEvent)
router.post("/:id" , searchRows);
router.patch(":id" , highlightRow);
router.get('/', getEvents);
router.get("/:id" , getEventDetails);
router.delete('/:id', deleteEvent) 

export { router as eventRoutes }