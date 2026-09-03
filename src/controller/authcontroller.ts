import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import "dotenv/config";
import { db } from "../db/postgresconfig";
import { users } from "./../model/users";
import { generateUsername } from "../utils/generateUsername";
import { setAuthCookie } from "../utils/jsonwebtoken";

export const googleCallback = (
  req: Request,
  res: Response
) => {
  try {
    const user = req.user as {
      id: string;
    };

    setAuthCookie(res, user.id);

    return res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  } catch (error) {
    console.error("Google callback error:", error);

    return res.status(500).json({
      message: "Google authentication failed",
    });
  }
};

export const signup = async (req: Request, res: Response) => {
  try {
   
    const { fullName,email, password } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({
        message: "Email, password, and full name are required",
      });
    }

    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (existingUser.length > 0) {
      return res.status(409).json({
        message: "User with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

     const username = generateUsername(email);

    const [newUser] = await db
      .insert(users)
      .values({
        email,
        password: hashedPassword,
        fullName,
        username,
      })
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        fullName: users.fullName,
        createdAt: users.createdAt,
      });

    // 6. Send response
    return res.status(201).json({
      message: "User created successfully",
      user: newUser,
    });
  } catch (error) {
    console.error("Signup error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};


export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (result.length === 0) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // IMPORTANT: create user variable here
    const user = result[0]!;

    if (!user.password) {
      return res.status(400).json({
        message: "This account uses Google login",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Now user definitely exists
    setAuthCookie(res, user.id);

    return res.status(200).json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Login failed",
    });
  }
};


export const authMe = async (req: Request, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    console.error("Auth me error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};



export const checkUsernameAvailability = async (
  req: Request,
  res: Response
) => {
  try {
    const username = String(req.query.username || "")
      .trim()
      .toLowerCase();

    if (!username) {
      return res.status(400).json({
        available: false,
        message: "Username is required",
      });
    }

    if (username.length < 3) {
      return res.status(400).json({
        available: false,
        message: "Username must contain at least 3 characters",
      });
    }

    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existingUser.length === 0) {
      return res.json({
        available: true,
      });
    }

    // If this is the logged-in user's own username,
    // it is still available for them.
    if (existingUser[0].id === req.user?.id) {
      return res.json({
        available: true,
      });
    }

    return res.json({
      available: false,
      message: "Username already taken",
    });
  } catch (error) {
    console.error("Check username error:", error);

    return res.status(500).json({
      available: false,
      message: "Unable to check username availability",
    });
  }
};



export const updateUserProfile = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user?.id;

    const {
      username,
      password,
      profileimg,
      fullName,
    } = req.body;

    const updateData: {
      username?: string;
      password?: string;
      profileimg?: string | null;
      fullName?: string;
    } = {};

    // Username
    if (username !== undefined) {
      const trimmedUsername = String(username)
        .trim()
        .toLowerCase();

      if (!trimmedUsername) {
        return res.status(400).json({
          message: "Username cannot be empty",
        });
      }

      if (trimmedUsername.length < 3) {
        return res.status(400).json({
          message:
            "Username must contain at least 3 characters",
        });
      }

      updateData.username = trimmedUsername;
    }

    // Password
    if (password !== undefined) {
      if (typeof password !== "string" || password.length < 8) {
        return res.status(400).json({
          message:
            "Password must contain at least 8 characters",
        });
      }

      updateData.password = await bcrypt.hash(password, 10);
    }

    // Profile image
    if (profileimg !== undefined) {
      updateData.profileimg = profileimg;
    }

    if (fullName !== undefined) {
      const trimmedFullName = String(fullName).trim();
      if (!trimmedFullName) {
        return res.status(400).json({
          message: "Full name cannot be empty",
        });
      }
      updateData.fullName = trimmedFullName;
    }

    // Nothing to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: "No fields provided for update",
      });
    }

    const updatedUser = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
        profileimg: users.profileimg,
      });

    if (updatedUser.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser[0],
    });
  } catch (error: any) {
    console.error("Update profile error:", error);

    // PostgreSQL unique username violation
    if (error?.code === "23505") {
      return res.status(409).json({
        message: "Username already taken",
      });
    }

    return res.status(500).json({
      message: "Unable to update profile",
    });
  }
};



export const logout = async (req: Request, res: Response) => {
  try {
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);

    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};