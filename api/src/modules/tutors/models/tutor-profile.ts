import mongoose, { Schema, Types, type Model } from 'mongoose';

export type TutorProfileStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED';

export interface TutorProfileFields {
  userId: Types.ObjectId;
  displayName: string;
  bio: string;
  subjectIds: Types.ObjectId[];
  status: TutorProfileStatus;
}

const tutorProfileSchema = new Schema<TutorProfileFields>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
    bio: { type: String, trim: true, maxlength: 5000, default: '' },
    subjectIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Subject',
      },
    ],
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'SUSPENDED'],
      required: true,
      default: 'DRAFT',
    },
  },
  {
    collection: 'tutorProfiles',
    timestamps: true,
    versionKey: '__v',
  },
);

tutorProfileSchema.index({ status: 1, updatedAt: -1 });

const existingModel = mongoose.models.TutorProfile as Model<TutorProfileFields> | undefined;

export const TutorProfile =
  existingModel ?? mongoose.model<TutorProfileFields>('TutorProfile', tutorProfileSchema);
