import jwt from "jsonwebtoken"
import dotenv from "dotenv"
import { get } from "axios";
import { getDb } from "./db/mongo";
import { ObjectId } from "mongodb";


dotenv.config();

export type TokenPayLoad = {
    userId: string
}

const SUPER_SECRET = process.env.SUPER_SECRET;

export const signToken = (userId: string) => {
    return jwt.sign({ userId}, SUPER_SECRET!, { expiresIn: "1h"})
}

export const verifyToken = (token: string):TokenPayLoad | null => {
    try {
        return jwt.verify(token, SUPER_SECRET!) as TokenPayLoad
    } catch {
        return null
    }
};

export const getUserFomToken = async(token: string) => {
    const payload = verifyToken(token);
    if(!payload) return null;

    const db = getDb();
    return await db.collection("Users").findOne({
    _id: new ObjectId(payload.userId)
    })
}