import { z } from 'zod';

export const UpdateSettingsSchema = z.object({
  appName: z.string().optional(),
  heroTitle: z.string().optional(),
  heroSubtitle: z.string().optional(),
  splashText: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  hotline: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  workingHours: z.string().optional(),
  website: z.string().optional(),
  socials: z.object({
    facebook: z.string().optional(),
    instagram: z.string().optional(),
    youtube: z.string().optional(),
    twitter: z.string().optional(),
  }).optional(),
  zakatNisabEgp: z.number().optional(),
  donationReassurance: z.string().optional(),
  demoLabel: z.union([z.string(), z.boolean()]).optional(),
  stats: z.object({
    governorates: z.string().optional(),
    beneficiaries: z.string().optional(),
    yearsOfService: z.string().optional(),
  }).optional(),
  milestones: z.array(z.object({
    year: z.string(),
    label: z.string(),
  })).optional(),
}).strict();

export type UpdateSettingsDto = z.infer<typeof UpdateSettingsSchema>;
