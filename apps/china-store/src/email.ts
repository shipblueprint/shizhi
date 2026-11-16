import { ses } from "tencentcloud-sdk-nodejs-ses";
import type { DeliveryLink, EmailSender } from "./domain";
import { escapeHtml } from "./views";

export type TencentEmailConfig = {
  secretId: string;
  secretKey: string;
  region: string;
  fromEmail: string;
  replyTo?: string;
  client?: {
    SendEmail(input: {
      FromEmailAddress: string;
      Subject: string;
      Destination: string[];
      ReplyToAddresses?: string;
      Simple: { Html: string };
      TriggerType?: number;
    }): Promise<unknown>;
  };
};

function encodeSimpleHtml(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

export function createTencentEmail(config: TencentEmailConfig): EmailSender {
  const client =
    config.client ??
    new ses.v20201002.Client({
      credential: {
        secretId: config.secretId,
        secretKey: config.secretKey,
      },
      region: config.region,
      profile: {
        httpProfile: { endpoint: "ses.tencentcloudapi.com" },
      },
    });

  async function send(
    to: string,
    subject: string,
    body: string
  ): Promise<void> {
    await client.SendEmail({
      FromEmailAddress: config.fromEmail,
      Subject: subject,
      Destination: [to],
      ReplyToAddresses: config.replyTo,
      Simple: { Html: encodeSimpleHtml(body) },
      TriggerType: 1,
    });
  }

  return {
    async sendDownload({ to, title, url }: DeliveryLink): Promise<void> {
      const safeTitle = escapeHtml(title);
      const safeUrl = escapeHtml(url);
      await send(
        to,
        `你的下载链接：${title}`,
        `<p>感谢购买。</p>
<p><a href="${safeUrl}">下载 ${safeTitle}</a></p>
<p>该链接有有效期和下载次数限制。如果链接失效，请使用订单号和付款邮箱申请补发。</p>`
      );
    },

    async sendAccess({
      to,
      title,
      url,
    }: Omit<DeliveryLink, "url"> & { url?: string }): Promise<void> {
      const access = url
        ? `<p><a href="${escapeHtml(url)}">获取 ${escapeHtml(title)}</a></p>`
        : `<p>我们会通过该商品配置的渠道发送访问方式。</p>`;
      await send(
        to,
        `购买已确认：${title}`,
        `<p>感谢购买。</p>
<p>你购买的 <strong>${escapeHtml(title)}</strong> 已确认。</p>
${access}`
      );
    },
  };
}
