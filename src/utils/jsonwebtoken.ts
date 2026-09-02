import jwt from "jsonwebtoken";
import { Response } from "express";

export const setAuthCookie = (res: Response, userId: string) => {
  const token = jwt.sign(
    {
      userId,
    },
    process.env.JWT_SECRET!,
    {
      expiresIn: "1d",
    }
  );

  console

  res.cookie("accessToken", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 24 * 60 * 60 * 1000,
  });
};