import { IsString, MinLength } from "class-validator";

export class GoogleOauthDto {
  @IsString({ message: "accessToken deve ser uma string" })
  @MinLength(10, { message: "accessToken inválido" })
  accessToken: string;
}
