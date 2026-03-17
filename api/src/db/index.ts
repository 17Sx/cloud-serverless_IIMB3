import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as authSchema from "../../auth-schema";

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, { ssl: false });

export const db = drizzle(client, { schema: { ...schema, ...authSchema } });
export { client };
