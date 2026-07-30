import { z } from 'zod';

export const ImportCmsSchema = z.object({
  schemaVersion: z.number().int().min(1),
  settings: z.record(z.string(), z.any()).optional().default({}),
  menu: z.array(z.any()).optional().default([]),
  home: z.array(z.any()).optional().default([]),
  pages: z.array(z.any()).optional().default([]),
  paymentMethods: z.array(z.any()).optional().default([]),
  consultationTypes: z.array(z.any()).optional().default([]),
  mediaLibrary: z.array(z.any()).optional().default([]),
});

export type ImportCmsDto = z.infer<typeof ImportCmsSchema>;
