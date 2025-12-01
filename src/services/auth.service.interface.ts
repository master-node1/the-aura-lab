import { CreateCredentialsDTO } from 'src/dto/createCredentials.dto';
import { ForgotPasswordDTO } from 'src/dto/forgotPassword.dto';
import { LoginDTO } from 'src/dto/login.dto';
import { LoginResponseDTO } from 'src/dto/loginResponse.dto';
import { ResponseDTO } from 'src/dto/response.dto';
import { UpdateCredentialsDTO } from 'src/dto/updateCredentials.dto';

export interface InterfaceAuthService {
  createAuthCredentials(
    campaignDraftData: CreateCredentialsDTO,
  ): Promise<ResponseDTO>;
  loginToAccount(loginData: LoginDTO): Promise<LoginResponseDTO>;
  updateAuthCredentials(
    updateAuthCredentialsDto: UpdateCredentialsDTO,
  ): Promise<any>;
  forgotPassword(data: ForgotPasswordDTO): Promise<any>;
}
