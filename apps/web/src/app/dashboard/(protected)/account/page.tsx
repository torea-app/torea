import { PageHeader } from "@/components/page-header";
import { AccountContainer } from "./_containers/account-container";

export default function AccountPage() {
  return (
    <>
      <PageHeader items={[{ label: "アカウント設定" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <AccountContainer />
      </div>
    </>
  );
}
