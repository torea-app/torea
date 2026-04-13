import { useEffect, useState } from "react";

export default function App() {
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
    // TODO: implement tab save logic with auth + API
    console.log("Saving tab:", tabInfo);
  };

  return (
    <div style={{ width: 320, padding: 16, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 16, fontWeight: "bold", marginBottom: 12 }}>
        ScreenBase
      </h1>
      {tabInfo ? (
        <>
          <p style={{ fontSize: 13, marginBottom: 4, fontWeight: 500 }}>
            {tabInfo.title}
          </p>
          <p
            style={{
              fontSize: 11,
              color: "#666",
              marginBottom: 16,
              wordBreak: "break-all",
            }}
          >
            {tabInfo.url}
          </p>
          <button
            type="button"
            onClick={handleSaveTab}
            style={{
              width: "100%",
              padding: "8px 16px",
              backgroundColor: "#000",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            このタブを保存
          </button>
        </>
      ) : (
        <p style={{ color: "#666", fontSize: 13 }}>タブ情報を取得中...</p>
      )}
    </div>
  );
}
