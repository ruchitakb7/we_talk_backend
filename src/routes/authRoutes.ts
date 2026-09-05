import { Router } from "express";
import { signup, googleCallback, login,updateUserProfile, authMe, logout,searchUsers,
  checkUsernameAvailability} from "./../controller/authcontroller";
import { authMiddleware } from "../middleware/authmiddleware";
import passport from "../config/passport";
import upload from "../middleware/upload";
import { uploadFile } from "../middleware/mediaupload";

const router = Router();

router.post("/logout", logout);

router.post("/signup", signup);

router.post("/login", login);

router.get("/me", authMiddleware, authMe);

router.get("/google",passport.authenticate("google", {scope: ["profile", "email"],}));

router.get("/google/callback",passport.authenticate("google", {session: false,}),googleCallback);


router.get("/username/check",authMiddleware,checkUsernameAvailability);

router.get("/search", authMiddleware, searchUsers);

router.patch("/profile",authMiddleware,updateUserProfile);


router.post("/files/upload",authMiddleware,upload.single("file"),uploadFile
);



export default router;