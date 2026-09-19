import { UserModel } from './auth.model';
import { hashPassword, comparePasswords } from '../../utils/hash';
import { generateToken } from '../../utils/jwt';
import { UnauthorizedError, ConflictError, BadRequestError } from '../../common/errors';

export class AuthService {
  static async login(email: string, password: string) {
    const user = await UserModel.findOne({ email });

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Your account has been disabled');
    }

    const isMatch = await comparePasswords(password, user.passwordHash);

    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const token = generateToken({
      id: user._id.toString(),
      role: user.role,
    });

    return {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  static async getCurrentUser(userId: string) {
    const user = await UserModel.findById(userId).select('-passwordHash');
    if (!user) {
      throw new UnauthorizedError('User not found');
    }
    return user;
  }

  static async seedInitialOwner(
    name: string,
    email: string,
    password: string,
    adminSecret: string,
    expectedSecret: string
  ) {
    if (adminSecret !== expectedSecret) {
      throw new BadRequestError('Invalid admin secret');
    }

    const count = await UserModel.countDocuments({ role: 'owner' });
    if (count > 0) {
      throw new ConflictError('Owner already exists');
    }

    const passwordHash = await hashPassword(password);

    const user = await UserModel.create({
      name,
      email,
      passwordHash,
      role: 'owner',
    });

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}
