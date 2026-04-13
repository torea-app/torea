import { organization } from "@screenbase/db/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

export function createOrganizationRepository(d1: D1Database) {
  const db = drizzle(d1);

  return {
    /** 組織名を取得（見つからない場合は空文字を返す） */
    async findNameById(orgId: string): Promise<string> {
      const row = await db
        .select({ name: organization.name })
        .from(organization)
        .where(eq(organization.id, orgId))
        .get();
      return row?.name ?? "";
    },
  };
}
