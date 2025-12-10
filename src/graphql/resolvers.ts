import { IResolvers } from "@graphql-tools/utils";
import { getDb } from "../db/mongo";
import { Collection, ObjectId } from "mongodb";
import { signToken } from "../auth";
import { validate } from "graphql";
import { createUser, validateUser } from "../collections/users";
import { Projects } from "../types/Projects";
import { Task } from "../types/Task";
import { AuthPayload } from "../types/Authpayload";
import { User } from "../types/Users";


const COLLECTION_USERS = "Users";
const COLLECTION_PROJECTS = "Projects";
const COLLECTION_TASKS = "Task";

export const resolvers: IResolvers = {
    Query: {

        me: async(_, __, {user}) => {

            if(!user) throw new Error("No estás autenticado");
            
            return {
                id: user._id.toString(),
                ...user
            }
        },
         
        myProjects: async(_) => {

            const db = getDb();
            return db.collection(COLLECTION_PROJECTS).find().toArray();
        },
        projectDetails : async (_, {projectId}: {projectId:string}) => {

            const db = getDb();
            return db.collection(COLLECTION_PROJECTS).findOne({projectId: new ObjectId(projectId)})

        },

        users: async(_) => {

            const db = getDb();
            return db.collection(COLLECTION_USERS).find().toArray();
        }        
    },

    Projects:{
        tasks: async(parent: Projects) => {

            const db = getDb();
            return await db.collection<Task>(COLLECTION_TASKS).find({projectId: parent._id}).toArray();
        },
        members: async(parent: Projects) => {

            const db = getDb();
            return await db.collection<User>(COLLECTION_USERS).find({$in: parent.members}).toArray();
        }
    },


    Mutation:{

        register: async ( _,{ username, email, password }: { username: string, email: string; password: string }) => {

            const userId = await createUser(username, email, password);
            const token = signToken(userId);
            const payload : AuthPayload= {
                token
            }
            return payload;
        },

        login: async (_,{ email, password }: { email: string; password: string }) => {

            const user = await validateUser(email, password);
            if (!user) throw new Error("Las credenciales son incorrectas");
            const token = signToken(user._id.toString());

            const payload : AuthPayload= {
                token
            }
            return payload;
        },

        // Crear un proyecto asociado al usuario
        createProject: async(_, {name, startDate, endDate, members, description},{user})=>{

           if(!user) throw new Error("Las credenciales son incorrectas");
            const db = getDb();
            
            const nuevoProyecto : Projects = {
                name,
                description,
                startDate,
                endDate,
                owner: user._id,
                members

            }

            const z = await db.collection<Projects>(COLLECTION_PROJECTS).insertOne(nuevoProyecto);
            return await db.collection<Projects>(COLLECTION_PROJECTS).findOne({_id: z.insertedId})
        },

        // Actualizar el proyecto asociado al usuario
        updateProject: async(_,{id, name, startDate, endDate, description, members},{user} )=>{

            if(!user) throw new Error("No tienes credenciales correctas");
            const db = getDb();

            let proyecto = await db.collection<Projects>(COLLECTION_PROJECTS).findOne({_id: new ObjectId(id)});
            if(!proyecto) throw new Error("No existe el proyecto")
            if(proyecto.owner.toString() !== user._id.toString()) throw new Error("No eres el owner del proyecto")
            id = proyecto._id;

            if(!description) description = proyecto.description;
            if(!members) members = proyecto.members;
            if(!name) name = proyecto.name;
            if(!startDate) startDate = proyecto.startDate;
            if(!endDate) endDate = proyecto.endDate;
            

            await db.collection<Projects>(COLLECTION_PROJECTS).updateOne({_id: id}, {$set: {
                 name, startDate, endDate, description, members
            }});
            
            return await db.collection(COLLECTION_PROJECTS).findOne({_id: id})

        },

        // Añadir miembro a proyecto del usuario
        addMember: async(_, {projectId, userId}, {user}) =>{

            if(!user) throw new Error("Las credenciales son incorrectas");
            const db = getDb();

            let proyecto = await db.collection<Projects>(COLLECTION_PROJECTS).findOne({_id: projectId});
            if(!proyecto) throw new Error("No existe el proyecto")
            if(proyecto.owner.toString() !== user._id.toString()) throw new Error("TÚ no eres el owner del proyecto")

            proyecto?.members?.push(new ObjectId(userId));

            await db.collection(COLLECTION_PROJECTS).updateOne({_id: new ObjectId(projectId)}, {$set: {members: proyecto.members}})
            return await db.collection(COLLECTION_PROJECTS).findOne({_id: proyecto._id})
        },

        // Crear  tarea dentro del proyecto del usuario
        createTask: async(_, {projectId, title, status, priority, dueDate, assignedTo},{user}) =>{

            if(!user) throw new Error("Las credenciales son incorrectas");
            const db = getDb();

            let proyecto = await db.collection<Projects>(COLLECTION_PROJECTS).findOne({_id: new ObjectId(projectId)});
            if(!proyecto) throw new Error("No existe el proyecto")
            if(!proyecto.members){
                
                if(proyecto.owner.toString() !== user._id.toString()){

                     throw new Error("TÚ no eres owner ni tampoco miembro")
                }

                if(status !== "PENDING" && status !== "IN_PROGRESS" && status !== "COMPLETED"){

                status = "PENDING"
                }

                if(priority != "LOW" && priority != "MEDIUM" && priority != "HIGH"){

                    throw new Error("La prioridad no es correcta")
                }

                const newTask: Task = {
                    title,
                    status,
                    priority, 
                    dueDate,
                    projectId,
                    assignedTo
                }

                const z = await db.collection(COLLECTION_TASKS).insertOne(newTask);
                return await db.collection(COLLECTION_TASKS).findOne({_id: z.insertedId})
            }

            const esMiembro = proyecto.members!.some((n) => user._id === n)
            if((proyecto.owner.toString() !== user._id.toString()) && (!esMiembro)) throw new Error("Tú no eres owner y tampoco miembro")
            
            if(status !== "PENDING" && status !== "IN_PROGRESS" && status !== "COMPLETED"){

                status = "PENDING"
            }

            if(priority != "LOW" && priority != "MEDIUM" && priority != "HIGH"){

                throw new Error("La prioridad es incorrecta")
            }

            const newTask: Task = {
                title,
                status,
                priority, 
                dueDate,
                projectId,
                assignedTo
            }
            const z = await db.collection(COLLECTION_TASKS).insertOne(newTask);
            return await db.collection(COLLECTION_TASKS).findOne({_id: z.insertedId})

        },

        // Actualizar estado de una tarea del usuario 
        updateTaskStatus: async(_, {taskId, taskStatus}, {user}) =>{

            if(!user) throw new Error("Las credenciales son incorrectas");
            const db = getDb();

            let task = await db.collection<Task>(COLLECTION_TASKS).findOne({_id: new ObjectId(taskId)})
            if(!task) throw new Error("No existe el task");

            if(taskStatus !== "PENDING" && taskStatus !== "IN_PROGRESS" && taskStatus!== "COMPLETED"){

                taskStatus = "PENDING"
            }

            await db.collection(COLLECTION_TASKS).updateOne({_id: new ObjectId(taskId)}, {$set: {status: taskStatus}})
            return await db.collection(COLLECTION_TASKS).findOne({_id: new ObjectId(taskId)})

        },
        
        // Eliminar proyecto y sus tareas si el usuario es owner
        deleteProject: async(_, {id}, {user}) => {
            if(!user) throw new Error("Las credenciales son incorrectas");
            const db = getDb();

            let proyecto= await db.collection<Projects>(COLLECTION_PROJECTS).findOne({_id: new ObjectId(id)});
            if(!proyecto) throw new Error("No existe el proyecto");
            if(proyecto.owner.toString() !== user._id.toString()) throw new Error("TÚ no eres owner del proyecto");

            await db.collection(COLLECTION_PROJECTS).deleteOne({_id: new ObjectId(id)});
            await db.collection(COLLECTION_TASKS).deleteMany({projectId: new ObjectId(id)})

            return proyecto;
        }

    }

}