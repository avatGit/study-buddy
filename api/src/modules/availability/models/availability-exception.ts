import mongoose, { Schema, Types, type Model } from 'mongoose';

export type AvailabilityExceptionKind = 'BLOCK_DAY' | 'BLOCK_TIME';

export interface AvailabilityExceptionFields {
  tutorProfileId: Types.ObjectId;
  date: string;
  kind: AvailabilityExceptionKind;
  timeZone: string;
  startTime?: string;
  endTime?: string;
}

const availabilityExceptionSchema = new Schema<AvailabilityExceptionFields>(
  {
    tutorProfileId: {
      type: Schema.Types.ObjectId,
      ref: 'TutorProfile',
      required: true,
    },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    kind: { type: String, required: true, enum: ['BLOCK_DAY', 'BLOCK_TIME'] },
    timeZone: { type: String, required: true },
    startTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  },
  {
    collection: 'availabilityExceptions',
    timestamps: true,
    versionKey: false,
  },
);

availabilityExceptionSchema.index({ tutorProfileId: 1, date: 1 });

const existingModel = mongoose.models.AvailabilityException as
  | Model<AvailabilityExceptionFields>
  | undefined;

export const AvailabilityException =
  existingModel ??
  mongoose.model<AvailabilityExceptionFields>('AvailabilityException', availabilityExceptionSchema);
