import mongoose, { Schema, type Model } from 'mongoose';

export interface UniversityFields {
  name: string;
  isActive: boolean;
}

const universitySchema = new Schema<UniversityFields>(
  {
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, required: true, default: true },
  },
  {
    collection: 'universities',
    timestamps: true,
    versionKey: false,
  },
);

const existingModel = mongoose.models.University as Model<UniversityFields> | undefined;

export const University =
  existingModel ?? mongoose.model<UniversityFields>('University', universitySchema);
