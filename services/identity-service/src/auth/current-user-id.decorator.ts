import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { USER_ID_HEADER } from './jwt.strategy';

/** The authenticated user's ID, read from the x-user-id header set by the JWT strategy. */
export const CurrentUserId = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const userId = context.switchToHttp().getRequest<Request>().headers[USER_ID_HEADER];
  if (typeof userId !== 'string') throw new UnauthorizedException();
  return userId;
});
