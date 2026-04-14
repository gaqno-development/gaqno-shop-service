import { Module, Global } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

@Global()
@Module({
  providers: [
    {
      provide: "DATABASE",
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const connectionString = configService.get<string>("DATABASE_URL");
        const client = postgres(connectionString!);
        return drizzle(client, { schema });
      },
    },
  ],
  exports: ["DATABASE"],
})
export class DatabaseModule {}
