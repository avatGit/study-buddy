import mongoose, { Schema, Types, type Model } from 'mongoose';

export type UserRole = 'USER' | 'ADMIN';

export interface UserFields {
  email: string;
  passwordHash: string;
  role: UserRole;
  universityId?: Types.ObjectId | null;
}

const userSchema = new Schema<UserFields>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['USER', 'ADMIN'],
      default: 'USER',
      required: true,
    },
    universityId: {
      type: Schema.Types.ObjectId,
      ref: 'University',
      default: null,
    },
  },
  {
    collection: 'users',
    timestamps: true,
    versionKey: false,
  },
);

userSchema.index({ email: 1 }, { unique: true });

const existingModel = mongoose.models.User as Model<UserFields> | undefined;

export const User = existingModel ?? mongoose.model<UserFields>('User', userSchema);
