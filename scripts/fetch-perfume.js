import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

// Perfume sheet (CSV)
const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1bhCrjroy7IO4dcnbA5oDzn3ylJ_4xk4dyEbJ4c1LNWk/gviz/tq?tqx=out:csv&gid=1876307699';

function escapeMDX(str) {
  if (!str) return '';
  return str.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
}

function sanitizeHtmlForMDX(str) {
  if (!str) return '';
  let out = str.replace(/<!--\s*\/?wp:[^>]*-->\s*/g, '');
  out = out.replace(/<!DOCTYPE[^>]*>\s*/gi, '');
  out = out.replace(/<img\b([^>]*)>/gi, (match, attrs) => (match.endsWith('/>') ? match : `<img${attrs} />`));
  out = out.replace(/<br\b([^>]*)>/gi, (match, attrs) => (match.endsWith('/>') ? match : `<br${attrs} />`));
  out = out.replace(/<hr\b([^>]*)>/gi, (match, attrs) => (match.endsWith('/>') ? match : `<hr${attrs} />`));
  return out;
}

function slugFromUrl(url) {
  if (!url) return null;
  try {
    const urlObj = new URL(url.trim());
    const parts = urlObj.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || null;
  } catch (e) {
    const parts = url.trim().split('/').filter(Boolean);
    return parts[parts.length - 1] || null;
  }
}

async function fetchAndGenerate() {
  console.log('Fetching Perfume Sheet data...');
  const response = await fetch(SHEET_URL);
  const csvText = await response.text();

  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
  });

  const contentDir = path.join(process.cwd(), 'src', 'content', 'perfume');

  if (fs.existsSync(contentDir)) {
    console.log('Cleaning old perfume MDX files...');
    const files = fs.readdirSync(contentDir);
    for (const file of files) {
      if (file.endsWith('.mdx')) fs.unlinkSync(path.join(contentDir, file));
    }
  } else {
    fs.mkdirSync(contentDir, { recursive: true });
  }

  let created = 0;
  let skipped = 0;

  records.forEach((row, index) => {
    // Skip fully empty rows (common in sheets)
    const hasAny =
      Object.values(row || {}).some((v) => typeof v === 'string' ? v.trim() : Boolean(v));
    if (!hasAny) {
      skipped++;
      return;
    }

    let slug = slugFromUrl(row['product_page_url'] || row['product_page_url '] || row['Product Page URL'] || row['Permalink']);

    if (!slug) {
      const name = row['perfume_name'] || row['Perfume Name'] || row['product_name'] || row['Product Name'] || row['Title'] || '';
      slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    const isPublished = (row.Publish || row.publish || row.Status || row.status)?.toString().trim().toLowerCase();
    if (isPublished && isPublished !== 'y' && isPublished !== 'publish') {
      console.log(`Skipping unpublished perfume at index ${index} (Publish: ${isPublished})`);
      skipped++;
      return;
    }

    if (!slug) {
      slug = `perfume-${index}`;
    }

    
    slug = slug.replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();

    // Optional publish filter if present
    const status = (row['Status'] || row['status'] || 'publish').toString();
    if (status && status.trim() && status.trim() !== 'publish') {
      skipped++;
      return;
    }

    const frontmatter = {
      perfumeName: row['perfume_name'] || row['Perfume Name'] || row['product_name'] || row['Product Name'] || row['Title'] || '',
      slug,
      year: row['year'] || row['Year'] || '',
      use: row['use'] || row['Use'] || '',
      productPageUrl: row['product_page_url'] || row['Product Page URL'] || '',
      imageUrl: row['image-url'] || row['image_url'] || row['Image URL'] || row['image'] || '',
      collectionName: row['collection_name'] || row['collection_name '] || row['Collection Name'] || '',
      brandName: row['brand_name'] || row['brand'] || row['Brand'] || '',
      topNotes: row['Top Notes'] || row['top_notes'] || '',
      middleNotes: row['Middle Notes'] || row['middle_notes'] || '',
      baseNotes: row['Base Notes'] || row['base_notes'] || '',
      pros: row['Pros'] || row['pros'] || '',
      cons: row['Cons'] || row['cons'] || '',
      openingSentence: row['Opening Sentence'] || row['opening_sentence'] || '',
    };

    const cleanFrontmatter = Object.fromEntries(
      Object.entries(frontmatter).filter(([_, v]) => v && v.toString().trim() !== '')
    );

    let mdxContent = `---\n`;
    for (const [key, value] of Object.entries(cleanFrontmatter)) {
      mdxContent += `${key}: ${JSON.stringify(value.toString())}\n`;
    }
    mdxContent += `---\n\n`;

    const bodyContent = row['Content'] || row['content'] || row['body'] || row['Body'] || '';
    if (bodyContent) {
      const cleaned = sanitizeHtmlForMDX(bodyContent);
      mdxContent += `${escapeMDX(cleaned)}\n\n`;
    }

    const filePath = path.join(contentDir, `${slug}.mdx`);
    fs.writeFileSync(filePath, mdxContent, 'utf-8');
    console.log(`Created: ${slug}.mdx`);
    created++;
  });

  console.log(`\n Perfume sync complete. Created: ${created}, Skipped: ${skipped}`);
}

fetchAndGenerate().catch(console.error);