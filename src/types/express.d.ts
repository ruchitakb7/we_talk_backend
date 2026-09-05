import "passport";

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      username: string | null;
      fullName: string;
      profileimg: string | null;
    }
  }
}

export {};