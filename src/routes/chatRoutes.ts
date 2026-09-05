import express from "express";

import {createPrivateChat, getUserChats, createGroupChat} from "../controller/chatController";

import { authMiddleware } from "../middleware/authmiddleware";

const router = express.Router();

router.post("/private",authMiddleware,createPrivateChat);

router.get("/", authMiddleware, getUserChats);

router.post("/group",authMiddleware,createGroupChat);

export default router;