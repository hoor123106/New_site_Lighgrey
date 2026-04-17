import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

// Note: Ensure the GID matches the "Industrial Bakeries" tab in your Google Sheet
const SHEET_URL =
    'https://docs.google.com/spreadsheets/d/1vYOk_nJd3TYtToQt1HOPMBnNoeOqp6h06QwFiO1yxT4/gviz/tq?tqx=out:csv&gid=211000945';

function escapeMDX(str) {
    if (!str) return '';
    return str.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
}

async function fetchAndGenerate() {
    console.log('Fetching Industrial Bakeries Sheet data...');
    const response = await fetch(SHEET_URL);
    const csvText = await response.text();

    if (!response.ok) {
        throw new Error(
            `Sheet fetch failed: ${response.status}\nFirst bytes: ${JSON.stringify(csvText.slice(0, 160))}`
        );
    }

    const records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
    });

    const contentDir = path.join(process.cwd(), 'src', 'content', 'industrial-bakeries');

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

        const title = getVal(['title', 'bakery title', 'heading', 'name']) || '';
        let rawSlug = getVal(['slug', 'url', 'id']) ||
            title.toLowerCase().replace(/[^a-z0-9]+/g, '-') ||
            '';

        const isPublished = getVal(['publish', 'published', 'status'])?.toLowerCase();
        if (isPublished !== 'y') {
            console.log(`Skipping unpublished bakery at index ${index} (Publish: ${isPublished})`);
            return;
        }

        if (!rawSlug && !title) {
            return;
        }

        let slug = rawSlug;
        if (slug.includes('/') || slug.startsWith('http')) {
            try {
                if (slug.startsWith('http')) {
                    slug = new URL(slug).pathname;
                }
                slug = slug.split('/').filter(Boolean).pop() || '';
            } catch (e) {
                slug = slug.split('/').filter(Boolean).pop() || '';
            }
        }

        slug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `bakery-${index}`;
        slug = slug.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();

        const frontmatter = {
            title: title,
            metaTitle: getVal(['meta title', 'seotitle', 'seo title']) || '',
            slug: slug,
            category: getVal(['category', 'type']) || '',
            metaDescription: getVal(['meta description', 'meta desc']) || '',
            heroTitle: getVal(['hero title', 'main title']) || '',
            heroSubtitle: getVal(['hero subtitle', 'sub title']) || '',
            feature1Image: getVal(['feature 1 image', 'feature1image']) ? `../../assets/images/industrail-bakeries/${getVal(['feature 1 image', 'feature1image'])}` : '',
            feature1Alt: getVal(['feature 1 alt', 'feature1alt']) || '',
            feature1Title: getVal(['feature 1 title', 'feature1title']) || '',
            feature1Description: getVal(['feature 1 description', 'feature1description']) || '',
            feature2Image: getVal(['feature 2 image', 'feature2image']) ? `../../assets/images/industrail-bakeries/${getVal(['feature 2 image', 'feature2image'])}` : '',
            feature2Alt: getVal(['feature 2 alt', 'feature2alt']) || '',
            feature2Title: getVal(['feature 2 title', 'feature2title']) || '',
            feature2Description: getVal(['feature 2 description', 'feature2description']) || '',
            feature3Image: getVal(['feature 3 image', 'feature3image']) ? `../../assets/images/industrail-bakeries/${getVal(['feature 3 image', 'feature3image'])}` : '',
            feature3Alt: getVal(['feature 3 alt', 'feature3alt']) || '',
            feature3Title: getVal(['feature 3 title', 'feature3title']) || '',
            feature3Description: getVal(['feature 3 description', 'feature3description']) || '',
            ourProcessSubtitle: getVal(['our process subtitle', 'process subtitle']) || '',
            ourProcessTitle: getVal(['our process title', 'process title']) || '',
            ourProcessDescription: getVal(['our process description', 'process description']) || '',
            cta1Icon: getVal(['cta 1 icon', 'cta1icon']) || '',
            cta1Title: getVal(['cta 1 title', 'cta1title']) || '',
            cta1Description: getVal(['cta 1 description', 'cta1description']) || '',
            cta2Icon: getVal(['cta 2 icon', 'cta2icon']) || '',
            cta2Title: getVal(['cta 2 title', 'cta2title']) || '',
            cta2Description: getVal(['cta 2 description', 'cta2description']) || '',
            cta3Icon: getVal(['cta 3 icon', 'cta3icon']) || '',
            cta3Title: getVal(['cta 3 title', 'cta3title']) || '',
            cta3Description: getVal(['cta 3 description', 'cta3description']) || '',
            footNote: getVal(['foot note', 'footnote']) || '',
        };

        let mdxContent = `---\n`;
        for (const [key, value] of Object.entries(frontmatter)) {
            mdxContent += `${key}: ${JSON.stringify(value)}\n`;
        }
        mdxContent += `---\n\n`;

        if (row['Content'] || row['Body']) {
            mdxContent += `${escapeMDX(row['Content'] || row['Body'])}\n\n`;
        }

        const filePath = path.join(contentDir, `${slug}.mdx`);
        fs.writeFileSync(filePath, mdxContent, 'utf-8');
        console.log(`Synced: ${slug}.mdx`);
    });

    console.log('Industrial Bakeries sync complete!');
}

fetchAndGenerate().catch(console.error);
