import type { UserIntegrationPreferenceRepository } from "../../infrastructure/repositories/user-integration-preference.repository";

type Deps = {
  repo: UserIntegrationPreferenceRepository;
};

export type IntegrationPreferencesService = ReturnType<
  typeof createIntegrationPreferencesService
>;

export function createIntegrationPreferencesService({ repo }: Deps) {
  return {
    async get(userId: string): Promise<{ autoSaveToDrive: boolean }> {
      const row = await repo.findByUserId(userId);
      return { autoSaveToDrive: row?.autoSaveToDrive ?? false };
    },

    async setAutoSave(userId: string, value: boolean): Promise<void> {
      await repo.upsertAutoSave(userId, value);
    },
  };
}
