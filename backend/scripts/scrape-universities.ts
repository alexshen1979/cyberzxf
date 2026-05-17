/**
 * 从学信网抓取全国高校列表
 * 使用 puppeteer-extra + stealth 插件绕过反爬保护
 */
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { PrismaClient } from '@prisma/client';

puppeteer.use(StealthPlugin());

const prisma = new PrismaClient();

const BASE_URL = 'https://gaokao.chsi.com.cn/sch/search--ss-on,option-qg,searchType-1,start-START.dhtml';
const PAGE_SIZE = 20;

async function scrapeAll() {
  console.log('启动浏览器（stealth 模式）...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
  });

  const page = await browser.newPage();

  // 隐藏 webdriver 特征
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1920, height: 1080 });

  let start = 0;
  let totalSaved = 0;
  const maxPages = 150;

  for (let p = 0; p < maxPages; p++) {
    const url = BASE_URL.replace('START', String(start));
    console.log(`\n第 ${p + 1} 页 (start=${start})`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      // 等待 JS 渲染
      await new Promise(r => setTimeout(r, 5000));

      // 打印页面标题和 body 内容长度，帮助调试
      const bodyLen = await page.evaluate(() => document.body.innerText.length);
      const title = await page.evaluate(() => document.title);
      console.log(`  标题: "${title}", body 文字长度: ${bodyLen}`);

      if (bodyLen < 100) {
        // 可能是反爬页面，截图看看
        await page.screenshot({ path: `debug-page-${p}.png`, fullPage: true });
        console.log(`  ⚠️  页面内容过短，已保存截图 debug-page-${p}.png`);
        console.log('  可能是反爬页面，跳过…');
        break;
      }

      // 提取学校数据
      const universities: Array<{
        name: string; code: string; type: string; level: string;
        province: string; city: string; is985: boolean; is211: boolean;
        isDoubleFirst: boolean; properties: string;
      }> = await page.evaluate(() => {
        const results: any[] = [];

        // 学信网院校列表表格
        const rows = document.querySelectorAll('.yxk-table tbody tr, .ch-table tbody tr, table tbody tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length < 3) return;
          const name = cells[1]?.textContent?.trim() || cells[0]?.textContent?.trim() || '';
          if (!name || name.length < 2) return;

          const html = row.innerHTML || '';
          results.push({
            name,
            code: cells[0]?.textContent?.trim() || '',
            type: cells[2]?.textContent?.trim() || '',
            level: cells[3]?.textContent?.trim() || '',
            province: cells[4]?.textContent?.trim() || '',
            city: cells[5]?.textContent?.trim() || '',
            is985: html.includes('985'),
            is211: html.includes('211'),
            isDoubleFirst: html.includes('双一流'),
            properties: cells[6]?.textContent?.trim() || '',
          });
        });

        // 备选：提取链接
        if (results.length === 0) {
          const links = document.querySelectorAll('a');
          links.forEach(link => {
            const name = link.textContent?.trim() || '';
            const href = link.getAttribute('href') || '';
            if (name.length >= 4 && name.length <= 30 && href.includes('sch')) {
              results.push({
                name, code: '', type: '', level: '', province: '', city: '',
                is985: false, is211: false, isDoubleFirst: false, properties: '',
              });
            }
          });
        }

        return results;
      });

      console.log(`  找到 ${universities.length} 所学校`);

      if (universities.length === 0) {
        console.log('  无数据，停止分页');
        break;
      }

      // 保存
      for (const u of universities) {
        try {
          await prisma.university.upsert({
            where: { code: u.code || `__name_${u.name}` },
            update: {
              name: u.name, type: u.type || null, level: u.level || null,
              province: u.province || null, city: u.city || null,
              is985: u.is985, is211: u.is211,
              isDoubleFirst: u.isDoubleFirst, properties: u.properties || null,
            },
            create: {
              name: u.name, code: u.code || null, type: u.type || null,
              level: u.level || null, province: u.province || null,
              city: u.city || null, is985: u.is985, is211: u.is211,
              isDoubleFirst: u.isDoubleFirst, properties: u.properties || null,
            },
          });
          totalSaved++;
        } catch (e: any) {
          console.warn(`  ⚠️  ${u.name}: ${e.message}`);
        }
      }

      console.log(`  ✓ 已保存 ${totalSaved} 所`);
    } catch (err: any) {
      console.error(`  ✗ 失败: ${err.message}`);
    }

    start += PAGE_SIZE;
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
  }

  await browser.close();
  console.log(`\n✅ 完成！共 ${totalSaved} 所高校`);
  await prisma.$disconnect();
}

scrapeAll().catch(e => {
  console.error('失败:', e);
  process.exit(1);
});
