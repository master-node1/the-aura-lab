import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Credentials extends Document {
    @Prop({
        type: String,
        required: true,
    })
    password: string;

    @Prop({
        type: String,
        required: true,
        unique: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        index: true,
    })
    email: string;

    @Prop({
        type: String,
        required: true,
        unique: true,
        match: /^[6-9]\d{9}$/, // Indian mobile example
        index: true,
    })
    mobile: string;


    @Prop({
        type: String,
        required: true,
        unique: true,
        index: true,
    })
    username: string;

    // Optional fields — if needed later
    @Prop({ type: String })
    profileId?: string;

    @Prop({ type: String })
    accountId?: string;

    @Prop({ type: String, default: 'active' }) // active / inactive
    isActive?: string;
}

export const CredentialsSchema = SchemaFactory.createForClass(Credentials);

// Additional compound indexes (improves search further)
CredentialsSchema.index({ email: 1, mobile: 1 });
CredentialsSchema.index({ email: 1, username: 1 });
CredentialsSchema.index({ mobile: 1, username: 1 });
