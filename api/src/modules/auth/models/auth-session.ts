import mongoose, { Schema, Types, type Model } from 'mongoose';

export interface AuthSessionFields {
  userId: Types.ObjectId;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

const authSessionSchema = new Schema<AuthSessionFields>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'authSessions',
    timestamps: true,
    versionKey: false,
  },
);

authSessionSchema.index({ refreshTokenHash: 1 }, { unique: true });
authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const existingModel = mongoose.models.AuthSession as Model<AuthSessionFields> | undefined;

export const AuthSession =
  existingModel ?? mongoose.model<AuthSessionFields>('AuthSession', authSessionSchema);
