import { Request, Response } from "express";
import { and, eq, inArray, sql,desc,ne} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db/postgresconfig";
import { chats } from "../model/chats";
import { chatMembers } from "../model/chat_members";
import { users } from "../model/users";
const otherMember = alias(chatMembers, "other_member");

export const createPrivateChat = async (
    req: Request,
    res: Response
) => {
    try {
        // Logged-in user
        const currentUserId = req.user?.id;

        // User we want to chat with
        const { userId } = req.body;

        // Validate userId
        const targetUserId = userId;

        // if (!targetUserId || typeof targetUserId !== "string") {
        //     return res.status(400).json({
        //         message: "Valid userId is required",
        //     });
        // }
        // Don't allow user to create a chat with themselves
        if (currentUserId === targetUserId) {
            return res.status(400).json({
                message: "You cannot create a chat with yourself",
            });
        }

        // Check whether private chat already exists
        const existingChat = await db
            .select({
                chatId: chatMembers.chatId,
                type: chats.type,
                createdAt: chats.createdAt,
            })
            .from(chatMembers)
            .innerJoin(
                chats,
                eq(chatMembers.chatId, chats.id)
            )
            .where(
                and(
                    eq(chats.type, "private"),
                    inArray(chatMembers.userId, [
                        currentUserId,
                        targetUserId,
                    ])
                )
            )
            .groupBy(
                chatMembers.chatId,
                chats.id,
                chats.type,
                chats.createdAt
            )
            .having(
                sql`count(distinct ${chatMembers.userId}) = 2`
            )
            .limit(1);

        // Chat already exists
        if (existingChat.length > 0) {
            const chat = existingChat[0];

            // Get the other user's information
            const [otherUser] = await db
                .select({
                    id: users.id,
                    username: users.username,
                    fullName: users.fullName,
                })
                .from(chatMembers)
                .innerJoin(
                    users,
                    eq(chatMembers.userId, users.id)
                )
                .where(
                    and(
                        eq(chatMembers.chatId, chat!.chatId),
                        eq(users.id, targetUserId)
                    )
                )
                .limit(1);

            return res.status(200).json({
                message: "Private chat already exists",
                chat: {
                    id: chat!.chatId,
                    type: chat!.type,
                    createdAt: chat!.createdAt,
                    user: otherUser,
                },
            });
        }

        // Create chat + members together
        const result = await db.transaction(async (tx) => {
            // Create private chat
            const [newChat] = await tx
                .insert(chats)
                .values({
                    type: "private",
                    createdBy: currentUserId,
                })
                .returning({
                    id: chats.id,
                    type: chats.type,
                    createdAt: chats.createdAt,
                });

            // Add both users to chat
            await tx.insert(chatMembers).values([
                {
                    chatId: newChat!.id,
                    userId: currentUserId,
                },
                {
                    chatId: newChat!.id,
                    userId: targetUserId,
                },
            ]);

            // Get target user's information
            const [otherUser] = await tx
                .select({
                    id: users.id,
                    username: users.username,
                    fullName: users.fullName,
                })
                .from(users)
                .where(eq(users.id, targetUserId))
                .limit(1);

            return {
                ...newChat,
                user: otherUser,
            };
        });

        return res.status(201).json({
            message: "Private chat created successfully",
            chat: result,
        });
    } catch (error) {
        console.error("Create private chat error:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
};


export const createGroupChat = async (
    req: Request,
    res: Response
) => {
    try {
        // Logged-in user
        const currentUserId = req.user?.id;

        if (!currentUserId) {
            return res.status(401).json({
                message: "Authentication required",
            });
        }

        // Group details
        const { groupName, memberUsernames } = req.body;

        // Validate group name
        if (!groupName || typeof groupName !== "string" || !groupName.trim()) {
            return res.status(400).json({
                message: "Valid group name is required",
            });
        }

        // Validate members
        if (
            !Array.isArray(memberUsernames) ||
            memberUsernames.length === 0
        ) {
            return res.status(400).json({
                message: "At least one member is required",
            });
        }

        // Remove duplicate usernames
        const uniqueUsernames = [
            ...new Set(memberUsernames),
        ];

        // Find users using usernames
        const groupUsers = await db
            .select({
                id: users.id,
                username: users.username,
                fullName: users.fullName,
            })
            .from(users)
            .where(
                inArray(users.username, uniqueUsernames)
            );

        // Check whether all users exist
        if (groupUsers.length !== uniqueUsernames.length) {
            return res.status(404).json({
                message: "One or more users were not found",
            });
        }

        // Don't allow creator to add themselves
        const containsCurrentUser = groupUsers.some(
            (user) => user.id === currentUserId
        );

        if (containsCurrentUser) {
            return res.status(400).json({
                message: "You cannot add yourself as a member",
            });
        }

        // Create group + members together
        const result = await db.transaction(async (tx) => {
            // Create group chat
            const [newChat] = await tx
                .insert(chats)
                .values({
                    type: "group",
                    name: groupName.trim(),
                    createdBy: currentUserId,
                })
                .returning({
                    id: chats.id,
                    type: chats.type,
                    name: chats.name,
                    createdAt: chats.createdAt,
                });

            // Create member list
            const members = [
                {
                    chatId: newChat!.id,
                    userId: currentUserId,
                },
                ...groupUsers.map((user) => ({
                    chatId: newChat!.id,
                    userId: user.id,
                })),
            ];

            // Add members to group
            await tx
                .insert(chatMembers)
                .values(members);

            return {
                ...newChat,
                members: [
                    {
                        id: currentUserId,
                        role: "admin",
                    },
                    ...groupUsers.map((user) => ({
                        id: user.id,
                        username: user.username,
                        fullName: user.fullName,
                        role: "member",
                    })),
                ],
            };
        });

        return res.status(201).json({
            message: "Group created successfully",
            chat: result,
        });
    } catch (error) {
        console.error("Create group chat error:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
};

export const getUserChats = async (
  req: Request,
  res: Response
) => {
  try {
    const currentUserId = req.user!.id;

    const userChats = await db
      .select({
        id: chats.id,
        type: chats.type,
        name: chats.name,
        createdAt: chats.createdAt,
        updatedAt: chats.updatedAt,
        userId: users.id,
        username: users.username,
        fullName: users.fullName,
      })
      .from(chatMembers)
      .innerJoin(
        chats,
        eq(chatMembers.chatId, chats.id)
      )
      .leftJoin(
        otherMember,
        and(
          eq(otherMember.chatId, chats.id),
          ne(otherMember.userId, currentUserId),
          eq(chats.type, "private")
        )
      )
      .leftJoin(
        users,
        eq(otherMember.userId, users.id)
      )
      .where(
        eq(chatMembers.userId, currentUserId)
      )
      .orderBy(desc(chats.createdAt));

    const formattedChats = userChats.map((chat) => ({
      id: chat.id,
      type: chat.type,
     userId: chat.userId||null,
    //   name: chat.name,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      
      name: chat.type === "private" ? chat.fullName || chat.username : chat.name,
    }));

    return res.status(200).json({
      chats: formattedChats,
    });
  } catch (error) {
    console.error("Get user chats error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const getLastSeen = async (userId: string) => {
  const result = await db
    .select({
      last_seen: users.last_seen,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return result[0]?.last_seen ?? null;
};