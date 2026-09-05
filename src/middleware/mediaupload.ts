import { Request, Response } from "express";
import crypto from "crypto";
import supabase from "../config/supabase";

export const uploadFile = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({
                success: false,
                message: "File is required",
            });
            return;
        }

        const file = req.file;

        const extension = file.originalname.includes(".")
            ? `.${file.originalname.split(".").pop()}`
            : "";

        const uniqueFileName = `${crypto.randomUUID()}${extension}`;

        const filePath = `uploads/${uniqueFileName}`;

        const { data, error } = await supabase.storage
            .from(process.env.SUPABASE_BUCKET!)
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: false,
            });

        if (error) {
            console.error("Supabase upload error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to upload file",
            });
            return;
        }

        res.status(201).json({
            success: true,
            message: "File uploaded successfully",
            file: {
                path: data.path,
                fileName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
            },
        });
    } catch (error) {
        console.error("Upload error:", error);

        res.status(500).json({
            success: false,
            message: "Something went wrong while uploading file",
        });
    }
};