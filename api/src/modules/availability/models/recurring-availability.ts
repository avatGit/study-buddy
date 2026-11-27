import mongoose, { Schema, Types, type Model } from 'mongoose';

export interface RecurringAvailabilityFields {
  tutorProfileId: Types.ObjectId;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timeZone: string;
}

const recurringAvailabilitySchema = new Schema<RecurringAvailabilityFields>(
  {
    tutorProfileId: {
      type: Schema.Types.ObjectId,
      ref: 'TutorProfile',
      required: true,
    },
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    timeZone: { type: String, required: true },
  },
  {
    collection: 'recurringAvailabilities',
    timestamps: true,
    versionKey: false,
  },
);

recurringAvailabilitySchema.index({ tutorProfileId: 1, dayOfWeek: 1, startTime: 1 });

const existingModel = mongoose.models.RecurringAvailability as
  | Model<RecurringAvailabilityFields>
  | undefined;

export const RecurringAvailability =
  existingModel ??
  mongoose.model<RecurringAvailabilityFields>('RecurringAvailability', recurringAvailabilitySchema);
