import { Hono } from "hono";
import { generateQRCodes } from "../controllers/qrcodes";


const router = new Hono();


router.get("/:id" , generateQRCodes);


export {router as QrRouter}