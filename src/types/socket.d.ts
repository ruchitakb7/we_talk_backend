import "socket.io/dist/socket";

declare module "socket.io/dist/socket" {
  interface Socket {
    user: {
      id: string;
      email: string;
      username: string | null;
      fullName: string;
      profileimg: string | null;
    };
  }
}

export {};