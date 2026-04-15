/**
 * 共有リンクのタイプ:
 *   org_members        → 同じ組織のメンバーのみ閲覧可能（ログイン必須）
 *   password_protected → パスワードが一致すれば誰でも閲覧可能（ログイン不要）
 */
export type ShareLinkType = "org_members" | "password_protected";
