import { z } from 'zod';

export const appInfoSchema = z.strictObject({
  name: z.literal('Anki Vocabulary Studio'),
  version: z.string().min(1),
});

export type AppInfo = z.infer<typeof appInfoSchema>;

export interface DesktopApi {
  getAppInfo(): Promise<AppInfo>;
}
