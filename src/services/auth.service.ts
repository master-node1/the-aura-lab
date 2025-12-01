import {
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CreateCredentialsDTO } from 'src/dto/createCredentials.dto';
import { InterfaceAuthService } from './interface.auth.service';
import { instanceToPlain } from 'class-transformer';
import * as bcrypt from 'bcrypt';
import { LoginDTO } from 'src/dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { UpdateCredentialsDTO } from 'src/dto/updateCredentials.dto';

import { Credentials } from '../model/credentials.model';



@Injectable()
export class AuthService implements InterfaceAuthService {
  constructor(
    @InjectModel(Credentials.name)
    private readonly credentialsModel: Model<Credentials>,
    private jwtService: JwtService,
  ) {}

  /**
   * return encrypted password value
   * @param password 
   * @returns 
   */
  private async hashPassword(password: string) {
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  }

  /**
     * this service method verifies the user JWT token
     */
  private async verifyToken(token: string) {
    await this.jwtService.verify(token);
  }

  private async findCredentials(query: any) {
    // this method returns the credentials based on id
    return await this.credentialsModel.findOne({ where: { query.key: query.value } });
  }

  async createAuthCredentials(data: CreateCredentialsDTO): Promise<any> {
    /**
     * this service method is to create credentials whenever a event is raised
     * during profile creation
     */
    const plainData = await instanceToPlain(data);
    const { password, profileId, mobile, email, username } = plainData;
    const hash = await this.hashPassword(password);
    const dataToSave = {
      mobile: mobile,
      profileId: profileId,
      email: email,
      password: hash,
      username: username,
    };
    // create the credentials record in DB
    const dbData = await this.credentialsModel.create(dataToSave);
    console.log('dbData', dbData);
    return {
      status_code: 201,
      message: 'Credentials created successfully',
      data: dbData,
    };
  }

  /**
   * this service method is to update the password
   */
  async updateAuthCredentials(
    updateAuthCredentialsDto: UpdateCredentialsDTO,
  ): Promise<any> {
    const { email, password, profileId, accountId } = updateAuthCredentialsDto;
    const existingAuthCredentials = await this.credentialsModel.findOne({
      where: {
        email: email,
        profileId: profileId,
        accountId: accountId,
      },
    });

    if (existingAuthCredentials == null) return null;
    const hash = await this.hashPassword(password);
    existingAuthCredentials['password'] = hash;
    await existingAuthCredentials.save();
    // return plainToInstance(UpdateCredentialsDTO, existingAuthCredentials.toJSON());
    console.log(
      'existingAuthCredentials = ',
      JSON.stringify(existingAuthCredentials),
    );
    return existingAuthCredentials;
  }
  
  /**
   * 
   * @param payload 
   * @returns 
   */
  async forgotPassword(payload: ForgotPasswordDTO) {
    // this service method verifies the passed email address and sends to notification server

    const { email, mobile } = payload;
    const query = {};
    if(email) {
        query.key = 'email';
        query.value = email;
    } else if (mobile) {
        query.key = 'mobile';
        query.value = mobile;
    } else {
        throw Error("Invalid JSON!")
    }
    const { isActive, profileId } = await this.findCredentials(query);
    if (isActive == 'inactive')
      return {
        status_code: 401,
        message: 'Profile is in-active, to reset the password',
        data: null,
    };

    const token = uuidv4();
    const current_date = new Date();
    current_date.setMinutes(current_date.getMinutes() + 15);

    // save to ForgotPassword table
    await this.credentialsModel.create({
      email: email,
      profileId: profileId,
      mobile: mobile,
      is_token_validated: false,
      token: token,
      expires_on: current_date,
    });
    return {
      status_code: 200,
      message: 'Password reset mail sent successfully',
      data: null,
    };
  }

  /**
   * 
   * @param loginData 
   * @returns 
   */
  async loginToAccount(loginData: LoginDTO): Promise<LoginResponseDTO> {
    const plainData = instanceToPlain(loginData);
    const { email, password } = plainData;
    // fetch the record by email
    const credentialRecord = await this.findCredentials({ key: "email", value: email });
    // if not found return 404
    if (credentialRecord == null)
      return {
        status_code: 404,
        message: 'No such profile found to login',
        data: null,
      };

    // compare the given password and hash password
    const isMatch = await bcrypt.compare(password, credentialRecord.password);

    // if the password didn't match return error response
    if (isMatch == false)
      return {
        status_code: 401,
        message: 'Incorrect password',
        data: null,
      };

    const rbac = {}; // fetch rbac from rbac service using grpc
    const gToken = "XXXXXX"; // generate token using jwt token is combination of {rbac, username}
    return {
      status_code: 200,
      message: 'Login successful!',
      data: {
        token: gToken,
        username: credentialRecord.username,
      },
    };
  }
}
