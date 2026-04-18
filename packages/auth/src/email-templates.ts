/**
 * HTML email templates for authentication flows.
 *
 * All user-supplied values are escaped via {@link escapeHtml} to prevent
 * XSS / HTML-injection in email clients.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function verificationEmailHtml(userName: string, url: string): string {
  const safeName = escapeHtml(userName);
  const safeUrl = escapeHtml(url);

  return `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background-color:#ffffff;border-radius:8px;overflow:hidden;">
    <div style="padding:32px 24px;">
      <h2 style="margin:0 0 24px;font-size:20px;color:#18181b;">メールアドレスの確認</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46;">${safeName} 様</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46;">Torea へのご登録ありがとうございます。</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3f3f46;">以下のボタンをクリックして、メールアドレスの確認を完了してください。</p>
      <p style="text-align:center;margin:32px 0;">
        <a href="${safeUrl}" style="display:inline-block;padding:12px 32px;background-color:#18181b;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;">
          メールアドレスを確認する
        </a>
      </p>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#a1a1aa;">
        このリンクは24時間有効です。<br/>
        心当たりがない場合は、このメールを無視してください。
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}

export function existingUserSignUpEmailHtml(
  userName: string,
  loginUrl: string,
): string {
  const safeName = escapeHtml(userName);
  const safeUrl = escapeHtml(loginUrl);

  return `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background-color:#ffffff;border-radius:8px;overflow:hidden;">
    <div style="padding:32px 24px;">
      <h2 style="margin:0 0 24px;font-size:20px;color:#18181b;">アカウント登録について</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46;">${safeName} 様</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46;">このメールアドレスで新規登録が試みられましたが、すでにアカウントが登録されています。</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3f3f46;">以下のボタンからログインしてください。</p>
      <p style="text-align:center;margin:32px 0;">
        <a href="${safeUrl}" style="display:inline-block;padding:12px 32px;background-color:#18181b;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;">
          ログインする
        </a>
      </p>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#a1a1aa;">
        パスワードをお忘れの場合は、ログインページの「パスワードを忘れた方」からリセットできます。<br/>
        心当たりがない場合は、このメールを無視してください。
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}

export function resetPasswordEmailHtml(userName: string, url: string): string {
  const safeName = escapeHtml(userName);
  const safeUrl = escapeHtml(url);

  return `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background-color:#ffffff;border-radius:8px;overflow:hidden;">
    <div style="padding:32px 24px;">
      <h2 style="margin:0 0 24px;font-size:20px;color:#18181b;">パスワードのリセット</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46;">${safeName} 様</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3f3f46;">パスワードリセットのリクエストを受け付けました。以下のボタンをクリックして、新しいパスワードを設定してください。</p>
      <p style="text-align:center;margin:32px 0;">
        <a href="${safeUrl}" style="display:inline-block;padding:12px 32px;background-color:#18181b;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;">
          パスワードをリセットする
        </a>
      </p>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#a1a1aa;">
        このリンクは1時間有効です。<br/>
        心当たりがない場合は、このメールを無視してください。パスワードは変更されません。
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}
