import express from "express";

import {createPrivateChat, getUserChats, createGroupChat, getChatDetails,updateGroupDetails} from "../controller/chatController";

import { authMiddleware } from "../middleware/authmiddleware";
import { adminChatMiddleware } from "../middleware/chatrolecheckmiddleware";

const router = express.Router();

router.post("/private",authMiddleware,createPrivateChat);

router.get("/", authMiddleware, getUserChats);

router.post("/group",authMiddleware,createGroupChat);

router.get("/:chatId/details",authMiddleware,getChatDetails);

router.patch( "/:chatId", authMiddleware, adminChatMiddleware, updateGroupDetails);

export default router;