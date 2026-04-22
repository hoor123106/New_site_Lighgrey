import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

// Note: Ensure the GID matches the "Products" tab in your Google Sheet
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1vYOk_nJd3TYtToQt1HOPMBnNoeOqp6h06QwFiO1yxT4/gviz/tq?tqx=out:csv&gid=1404671133';

function escapeMDX(str) {
    if (!str) return '';
    return str.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
}

async function fetchAndGenerate() {
    console.log('Fetching Products Sheet data...');
    const response = await fetch(SHEET_URL);
    const csvText = await response.text();

    if (!response.ok) {
        throw new Error(`Sheet fetch failed: ${response.status}`);
    }

    const records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
    });

    const contentDir = path.join(process.cwd(), 'src', 'content', 'products');

    if (fs.existsSync(contentDir)) {
        console.log('Cleaning old MDX files for sync...');
        const files = fs.readdirSync(contentDir);
        for (const file of files) {
            if (file.endsWith('.mdx')) {
                fs.unlinkSync(path.join(contentDir, file));
            }
        }
    } else {
        fs.mkdirSync(contentDir, { recursive: true });
    }

    records.forEach((row, index) => {
        const getVal = (keys) => {
            const key = Object.keys(row).find(k => keys.includes(k.trim().toLowerCase()));
            return key ? row[key]?.trim() : null;
        };

        const title = getVal(['name', 'title', 'product name']) || '';
        let rawSlug = getVal(['slug', 'url']) || title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || '';

        const isPublished = getVal(['publish', 'published', 'status'])?.toLowerCase();
        if (isPublished !== 'y') {
            console.log(`Skipping unpublished product at index ${index} (Publish: ${isPublished})`);
            return;
        }

        if (!rawSlug && !title) return;

        let slug = rawSlug;
        if (slug.includes('/') || slug.startsWith('http')) {
            try {
                if (slug.startsWith('http')) slug = new URL(slug).pathname;
                slug = slug.split('/').filter(Boolean).pop() || '';
            } catch (e) {
                slug = slug.split('/').filter(Boolean).pop() || '';
            }
        }

        slug = slug.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();

        // Exact pattern mapping like fetch-industrial-bakeries.js
        const frontmatter = {
            serial: getVal(['serial', 'no']) || '',
            title: title,
            metaTitle: getVal(['meta title', 'seotitle', 'seo title']) || title,
            slug: slug,
            category: getVal(['category', 'type']) || '',
            description: getVal(['description', 'product description', 'category description']) || '',
            metaDescription: getVal(['meta description', 'meta desc']) || '',
            image: getVal(['image', 'featured image']) ? `../../assets/images/${getVal(['image', 'featured image'])}` : '',
            imageAlt: title,
            material: getVal(['material']) || '',
            options: getVal(['options']) || '',
            related1: getVal(['related 1']) || '',
            related2: getVal(['related 2']) || '',
            related3: getVal(['related 3']) || '',
            // Spread all row columns to ensure everything is captured
            ...row 
        };

        let mdxContent = `---\n`;
        for (const [key, value] of Object.entries(frontmatter)) {
            if (value !== null && value !== undefined) {
                mdxContent += `${key}: ${JSON.stringify(value)}\n`;
            }
        }
        mdxContent += `---\n\n`;

        // Body Content
        const bodyContent = getVal(['content', 'body', 'category description', 'description']) || '';
        if (bodyContent) {
            mdxContent += `${escapeMDX(bodyContent)}\n\n`;
        }

        const filePath = path.join(contentDir, `${slug}.mdx`);
        fs.writeFileSync(filePath, mdxContent, 'utf-8');
        console.log(`Synced Product: ${slug}.mdx`);
    });

    console.log('Products sync complete!');
}

fetchAndGenerate().catch(console.error);
