import { ObjectId } from "mongodb";
import { getDb } from "../db/mongo";
import bcrypt from "bcryptjs";

const COLLECTION_PROJECTS = "Projects";
const COLLECTION_USERS = "Users";
const COLLECTION_TASKS = "Task";

export const createUser = async (username: string, email: string, password: string) => {
    const db = getDb();
    const laPasswordEncpripta = await bcrypt.hash(password,10);

    const result = await db.collection(COLLECTION_USERS).insertOne({
        username,
        email,
        password: laPasswordEncpripta,
        createdAt: Date.now()
    });

    return result.insertedId.toString();
};

export const validateUser = async (email: string, password: string) => {
    const db = getDb();
    const user = await db.collection(COLLECTION_USERS).findOne({ email});

    if(!user) return null
    const deLasDosVenus = await bcrypt.compare(password, user.password);
    if(!deLasDosVenus) return null;
    
    return user;
}

export const findUserById = async (id: string) => {
    const db = getDb();
    return await db.collection(COLLECTION_USERS).findOne({ _id: new ObjectId(id)})
    
}