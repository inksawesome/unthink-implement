import { TokenPayload } from '../utils/auth.utils';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}
