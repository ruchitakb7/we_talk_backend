import { Router } from "express";
import { signup, googleCallback, login,updateUserProfile, authMe, checkUsernameAvailability} from "./../controller/authcontroller";
import { authMiddleware } from "../middleware/authmiddleware";
import passport from "../config/passport";

const router = Router();

router.post("/signup", signup);

router.post("/login", login);

router.get("/me", authMiddleware, authMe);

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
  }),
  googleCallback
);


router.get(
  "/username/check",
  authMiddleware,
  checkUsernameAvailability
);


router.patch(
  "/profile",
  authMiddleware,
  updateUserProfile
);

export default router;