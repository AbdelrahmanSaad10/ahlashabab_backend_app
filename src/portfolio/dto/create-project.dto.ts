import { z } from 'zod';

const ProjectStageSchema = z.object({
  label: z.string({ required_error: 'اسم المرحلة مطلوب' }).min(1, 'اسم المرحلة مطلوب'),
  done: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional().default(0),
});

export const CreateProjectSchema = z.object({
  title: z
    .string({ required_error: 'عنوان المشروع مطلوب' })
    .min(1, 'عنوان المشروع مطلوب'),
  description: z.string().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  timeline: z.string().optional(),
  targetAmount: z.number().int().min(0).optional(),
  raisedAmount: z.number().int().min(0).optional().default(0),
  supporters: z.number().int().min(0).optional().default(0),
  coverUrl: z.string().url().optional(),
  published: z.boolean().optional().default(false),
  stages: z.array(ProjectStageSchema).optional(),
});

export type CreateProjectDto = z.infer<typeof CreateProjectSchema>;
