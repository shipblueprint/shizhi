import type { Order } from "./domain";

export type ReceiptState = {
  eyebrow: string;
  heading: string;
  message: string;
};

const PENDING: ReceiptState = {
  eyebrow: "付款确认中",
  heading: "我们还没有确认这笔付款。",
  message:
    "支付服务商确认付款后，下载链接会发送到结账邮箱。如果已经完成付款，请稍后再查看。如果取消或付款失败，不会发送下载链接。",
};

const CONFIRMED: ReceiptState = {
  eyebrow: "付款已确认",
  heading: "谢谢，付款已确认。",
  message:
    "下载链接已发送到结账时填写的邮箱。请检查收件箱和垃圾邮件目录。链接有有效期和下载次数限制。",
};

const REFUNDED: ReceiptState = {
  eyebrow: "已退款",
  heading: "这笔订单已退款。",
  message: "退款订单不再提供下载权限。如对退款有疑问，请携带订单号和付款邮箱联系支持。",
};

const FAILED: ReceiptState = {
  eyebrow: "付款失败",
  heading: "这笔付款没有完成。",
  message: "付款失败不会发送下载链接。你可以重新下单，或联系支持。",
};

const UNKNOWN: ReceiptState = {
  eyebrow: "未找到订单",
  heading: "找不到这个订单号。",
  message: "请核对收据邮件中的订单号。如果已经付款但没有收到收据，请携带付款邮箱联系支持。",
};

export function buildReceiptState(order: Order | null): ReceiptState {
  if (!order) return UNKNOWN;
  switch (order.status) {
    case "paid":
      return CONFIRMED;
    case "pending":
      return PENDING;
    case "refunded":
      return REFUNDED;
    case "failed":
      return FAILED;
    default:
      return UNKNOWN;
  }
}
