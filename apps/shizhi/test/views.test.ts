import { describe, expect, it } from "vitest";
import { createHarness } from "./helpers";

describe("China storefront shell", () => {
  it("renders a branded Chinese home page from real catalog data", async () => {
    const { app } = createHarness();
    const response = await app.request("/");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<html lang="zh-CN">');
    expect(html).toContain('<meta name="description"');
    expect(html).toContain("把 AI 做出来");
    expect(html).toContain("浏览全部商品");
    expect(html).toContain("人民币结算");
    expect(html).toContain("支付宝");
    expect(html).toContain("免费");
    expect(html).toContain('class="home-family-grid"');
    expect(html).toContain('href="/courses"');
    expect(html).toContain('href="/books"');
    expect(html).toContain('href="/templates"');
    expect(html).not.toContain('class="product-grid"');
    expect(html).not.toContain('href="#"');
    expect(html).not.toContain("example.com");
  });

  it("renders one offer-level page per family", async () => {
    const { app } = createHarness();

    const books = await app.request("/books");
    const booksHtml = await books.text();
    expect(books.status).toBe(200);
    expect(booksHtml).toContain("电子书");
    expect(booksHtml).toContain('class="product-card offer-card"');
    expect(booksHtml).toContain("/product/book-guide-ebook-cny");
    expect(booksHtml).toContain('aria-current="page"');
    expect(booksHtml).not.toContain('href="/store#');

    const courses = await app.request("/courses");
    const coursesHtml = await courses.text();
    expect(courses.status).toBe(200);
    expect(coursesHtml).toContain("课程");
    expect(coursesHtml).toContain('class="product-card offer-card"');

    const templates = await app.request("/templates");
    const templatesHtml = await templates.text();
    expect(templates.status).toBe(200);
    expect(templatesHtml).toContain("模板");
    expect(templatesHtml).toContain('class="product-card offer-card"');
  });

  it("groups the catalog by family and links every card", async () => {
    const { app } = createHarness();
    const html = await (await app.request("/store")).text();

    expect(html).toContain('id="course"');
    expect(html).toContain('id="book"');
    expect(html).toContain('id="template"');
    expect(html).toContain('class="product-grid"');
    expect(html).toContain("/product/book-guide-ebook-cny");
    expect(html).not.toContain("电子书 · 电子书");
  });

  it("renders product facts, delivery terms, and checkout in one page", async () => {
    const { app } = createHarness();
    const html = await (
      await app.request("/product/book-guide-ebook-cny")
    ).text();

    expect(html).toContain("接收下载链接的邮箱");
    expect(html).toContain("使用支付宝支付");
    expect(html).toContain("交付说明");
    expect(html).toContain("退款政策");
    expect(html).toContain('href="/refund"');
    expect(html).toContain("类型");
    expect(html).not.toContain("电子书 · 电子书");
    expect(html).not.toContain('href="#"');
  });

  it("offers an order lookup from the footer", async () => {
    const { app } = createHarness();
    const html = await (await app.request("/")).text();

    expect(html).toContain('action="/thanks"');
    expect(html).toContain('name="order"');
    expect(html).toContain("查询订单");
  });
});
