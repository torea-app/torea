import { member, organization } from "@screenbase/db/schema";
import { and, eq } from "drizzle-orm";
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

    /**
     * 指定ユーザーが指定組織のメンバーかどうかを確認する。
     * org_members 型共有リンクの視聴認可チェックに使用。
     */
    async isMemberOf(userId: string, organizationId: string): Promise<boolean> {
      const row = await db
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.userId, userId),
            eq(member.organizationId, organizationId),
          ),
        )
        .get();
      return row !== undefined;
    },
  };
}
