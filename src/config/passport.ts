import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { db } from "../db/postgresconfig";
import { users } from "../model/users";
import { eq } from "drizzle-orm";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
    },

    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const googleId = profile.id;

        if (!email) {
          return done(new Error("Google account does not have an email"));
        }

        // Check whether this Google account already exists
        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.googleId, googleId));

        if (existingUser.length > 0) {
          return done(null, existingUser[0]);
        }

        // Check whether the email already belongs to a user
        const existingEmailUser = await db
          .select()
          .from(users)
          .where(eq(users.email, email));

        if (existingEmailUser.length > 0) {
          // We'll handle account linking properly later
          return done(
            new Error("An account with this email already exists")
          );
        }

        // Create new Google user
        const [newUser] = await db
          .insert(users)
          .values({
            email,
            googleId,
            password: null,
          })
          .returning();

        return done(null, newUser);
      } catch (error) {
        return done(error as Error);
      }
    }
  )
);

export default passport;