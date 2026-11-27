import mongoose, { Schema, Types, type Model } from 'mongoose';

export interface SubjectFields {
  name: string;
  normalizedName: string;
  code?: string;
  universityId: Types.ObjectId | null;
  isActive: boolean;
}

const subjectSchema = new Schema<SubjectFields>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    normalizedName: { type: String, required: true, maxlength: 120 },
    code: { type: String, trim: true, maxlength: 32 },
    universityId: {
      type: Schema.Types.ObjectId,
      ref: 'University',
      default: null,
    },
    isActive: { type: Boolean, required: true, default: true },
  },
  {
    collection: 'subjects',
    timestamps: true,
    versionKey: false,
  },
);

subjectSchema.pre('validate', function normalizeSubjectName() {
  this.normalizedName = normalizeSubjectNameValue(this.name);
});

subjectSchema.index({ universityId: 1, normalizedName: 1 }, { unique: true });

export function normalizeSubjectNameValue(name: string): string {
  return name.normalize('NFKC').trim().toLowerCase();
}

const existingModel = mongoose.models.Subject as Model<SubjectFields> | undefined;

export const Subject = existingModel ?? mongoose.model<SubjectFields>('Subject', subjectSchema);
