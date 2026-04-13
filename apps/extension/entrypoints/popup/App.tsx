import { Button } from "@screenbase/ui/components/ui/button";
import { useEffect, useState } from "react";
import { authClient } from "../../lib/auth-client";

const WEB_URL = import.meta.env.VITE_WEB_URL ?? "https://3001.mydevbox.pp.ua";

function LoginView() {
  const handleLogin = () => {
    browser.tabs.create({ url: `${WEB_URL}/sign-in` });
  };

  return (
    <div className="w-80 bg-background p-4 text-foreground">
      <h1 className="mb-3 font-bold text-base">ScreenBase</h1>
      <p className="mb-4 text-muted-foreground text-sm">
        ログインして利用を開始してください。
      </p>
      <Button className="w-full" onClick={handleLogin}>
        ログイン
      </Button>
    </div>
  );
}

function MainView({ user }: { user: { name: string; email: string } }) {
  const [tabInfo, setTabInfo] = useState<{
    title?: string;
    url?: string;
  } | null>(null);

  useEffect(() => {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const tab = tabs[0];
      if (tab) {
        setTabInfo({ title: tab.title, url: tab.url });
      }
    });
  }, []);

  const handleSaveTab = async () => {
    if (!tabInfo) return;
    // TODO: implement tab save logic with API
    console.log("Saving tab:", tabInfo);
  };

  const handleLogout = async () => {
    await authClient.signOut();
  };

  return (
    <div className="w-80 bg-background p-4 text-foreground">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="font-bold text-base">ScreenBase</h1>
        <Button variant="ghost" size="xs" onClick={handleLogout}>
          ログアウト
        </Button>
      </div>

      <div className="mb-4 rounded-md border p-3">
        <p className="font-medium text-sm">{user.name}</p>
        <p className="text-muted-foreground text-xs">{user.email}</p>
      </div>

      {tabInfo ? (
        <>
          <p className="mb-1 truncate font-medium text-sm">{tabInfo.title}</p>
          <p className="mb-4 break-all text-muted-foreground text-xs">
            {tabInfo.url}
          </p>
          <Button className="w-full" onClick={handleSaveTab}>
            このタブを保存
          </Button>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">タブ情報を取得中...</p>
      )}
    </div>
  );
}

export default function App() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="w-80 bg-background p-4 text-foreground">
        <p className="text-muted-foreground text-sm">読み込み中...</p>
      </div>
    );
  }

  if (!session) {
    return <LoginView />;
  }

  return <MainView user={session.user} />;
}
