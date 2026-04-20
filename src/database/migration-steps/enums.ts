import type postgres from "postgres";

export type SqlClient = ReturnType<typeof postgres>;

export async function createEnums(sql: SqlClient): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  await sql`CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')`;
  await sql`CREATE TYPE payment_status AS ENUM ('pending', 'approved', 'authorized', 'in_process', 'in_mediation', 'rejected', 'cancelled', 'refunded', 'charged_back')`;
  await sql`CREATE TYPE payment_method AS ENUM ('credit_card', 'debit_card', 'pix', 'boleto', 'wallet')`;
}
