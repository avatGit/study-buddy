import mongoose, { Schema, Types, type Model } from 'mongoose';

export type TutorProfileStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED';

export interface TutorProfileFields {
  userId: Types.ObjectId;
  displayName: string;
  bio: string;
  subjectIds: Types.ObjectId[];
  status: TutorProfileStatus;
  averageRating: number;
  reviewCount: number;
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
    averageRating: {
      type: Number,
      required: true,
      min: 0,
      max: 5,
      default: 0,
    },
    reviewCount: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
      default: 0,
    },
  },
  {
    collection: 'tutorProfiles',
    timestamps: true,
    versionKey: '__v',
  },
);

tutorProfileSchema.index({ status: 1, updatedAt: -1 });
tutorProfileSchema.index({ status: 1, subjectIds: 1 });
tutorProfileSchema.index({ status: 1, averageRating: -1, reviewCount: -1, _id: 1 });
tutorProfileSchema.index({ status: 1, createdAt: -1, _id: -1 });
tutorProfileSchema.index({ status: 1, displayName: 1, _id: 1 });

const existingModel = mongoose.models.TutorProfile as Model<TutorProfileFields> | undefined;

export const TutorProfile =
  existingModel ?? mongoose.model<TutorProfileFields>('TutorProfile', tutorProfileSchema);
