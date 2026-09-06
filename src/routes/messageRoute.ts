import express from "express";

const router = express.Router();

import {createMessage, getMessages} from "../controller/messageController";

import { authMiddleware } from "../middleware/authmiddleware";

router.post("/send", authMiddleware, createMessage);

router.get( "/:chatId", authMiddleware, getMessages);

export default router;