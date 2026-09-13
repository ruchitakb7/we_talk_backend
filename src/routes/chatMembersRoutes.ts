import {Router} from "express";

import { authMiddleware } from "../middleware/authmiddleware";
import { adminChatMiddleware } from "../middleware/chatrolecheckmiddleware";
import { addChatMember, removeChatMember, toggleMemberRole, leaveGroup } from "../controller/chatMembersController";

const router = Router();


router.post("/:chatId/", authMiddleware, adminChatMiddleware, addChatMember);

router.delete("/:chatId/leave",authMiddleware,leaveGroup);

router.delete("/:chatId/:userId", authMiddleware, adminChatMiddleware, removeChatMember);

router.patch("/:chatId/:userId/role", authMiddleware, adminChatMiddleware, toggleMemberRole);





export default router;