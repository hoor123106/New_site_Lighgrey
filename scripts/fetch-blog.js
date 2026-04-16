import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1vYOk_nJd3TYtToQt1HOPMBnNoeOqp6h06QwFiO1yxT4/gviz/tq?tqx=out:csv&gid=875844860';

function sanitizeContent(str) {
    if (!str) return '';
    // Remove local markdown images that break the build (e.g. ![](images/...))
    let out = str.replace(/!\[.*?\]\(images\/.*?\)/gi, '');
    return out;
}

function escapeMDX(str) {
    if (!str) return '';
    return str.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
}

async function fetchAndGenerate() {
    console.log('Fetching Blog Sheet data...');
    const response = await fetch(SHEET_URL);
    const csvText = await response.text();

    if (!response.ok) {
        throw new Error(`Sheet fetch failed: ${response.status}`);
    }

    const records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
    });

    const contentDir = path.join(process.cwd(), 'src', 'content', 'blog');

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

        const title = getVal(['title', 'article title', 'name']) || '';
        let rawSlug = getVal(['slug', 'url', 'product_page_url']) || title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || '';

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

        slug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `blog-${index}`;
        slug = slug.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();

        // Image Mapping
        const imgFeaturedName = getVal(['image featured', 'featured image', 'image file name', 'image']);
        // The user says images are in src/assets/images
        const imageFeatured = imgFeaturedName ? `../../assets/images/${imgFeaturedName}` : '';
        const imageAlt = getVal(['image alt', 'alt text']) || title;

        const frontmatter = {
            title: title,
            metaTitle: getVal(['meta title', 'seotitle', 'seo title']) || title,
            slug: slug,
            date: getVal(['date']) || '',
            metaDescription: getVal(['meta description', 'meta desc']) || '',
            imageFeatured: imageFeatured,
            imageAlt: imageAlt,
            categories: getVal(['categories', 'category']) || '',
            tags: getVal(['tags']) || '',
            status: getVal(['status']) || '',
            authorId: getVal(['author id']) || '',
            authorName: getVal(['author name']) || '',
            // Optional features if they exist in sheet
            feature1Image: getVal(['feature 1 image', 'feature1image']) ? `../../assets/images/${getVal(['feature 1 image', 'feature1image'])}` : '',
            feature1Alt: getVal(['feature 1 alt', 'feature1alt']) || '',
            feature2Image: getVal(['feature 2 image', 'feature2image']) ? `../../assets/images/${getVal(['feature 2 image', 'feature2image'])}` : '',
            feature2Alt: getVal(['feature 2 alt', 'feature2alt']) || '',
            feature3Image: getVal(['feature 3 image', 'feature3image']) ? `../../assets/images/${getVal(['feature 3 image', 'feature3image'])}` : '',
            feature3Alt: getVal(['feature 3 alt', 'feature3alt']) || '',
        };

        let mdxContent = `---\n`;
        for (const [key, value] of Object.entries(frontmatter)) {
            if (value !== null && value !== undefined) {
                mdxContent += `${key}: ${JSON.stringify(value)}\n`;
            }
        }
        mdxContent += `---\n\n`;

        if (row['Content'] || row['Body']) {
            const cleaned = sanitizeContent(row['Content'] || row['Body']);
            mdxContent += `${escapeMDX(cleaned)}\n\n`;
        }

        const filePath = path.join(contentDir, `${slug}.mdx`);
        fs.writeFileSync(filePath, mdxContent, 'utf-8');
        console.log(`Synced: ${slug}.mdx`);
    });

    console.log('Blog sync complete!');
}

fetchAndGenerate().catch(console.error);
