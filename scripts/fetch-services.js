import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1vYOk_nJd3TYtToQt1HOPMBnNoeOqp6h06QwFiO1yxT4/gviz/tq?tqx=out:csv&gid=947153397';

function escapeMDX(str) {
    if (!str) return '';
    return str.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
}

async function fetchAndGenerate() {
    console.log('Fetching Services data...');
    const response = await fetch(SHEET_URL);
    const csvText = await response.text();

    if (!response.ok) {
        throw new Error(`Sheet fetch failed: ${response.status}`);
    }

    const records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
    });

    const contentDir = path.join(process.cwd(), 'src', 'content', 'services');

    if (fs.existsSync(contentDir)) {
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

        const title = getVal(['title', 'service title', 'name']) || '';
        let slug = getVal(['slug', 'url']) || title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `service-${index}`;
        slug = slug.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();

        const frontmatter = {
            title: title,
            slug: slug,
            category: getVal(['category']) || 'Service',
            metaDescription: getVal(['meta description']) || '',
            heroTitle: getVal(['hero title']) || title,
            heroSubtitle: getVal(['hero subtitle']) || '',
            feature1Image: getVal(['feature 1 image']) || '',
            feature1Title: getVal(['feature 1 title']) || '',
            feature1Description: getVal(['feature 1 description']) || '',
            feature2Image: getVal(['feature 2 image']) || '',
            feature2Title: getVal(['feature 2 title']) || '',
            feature2Description: getVal(['feature 2 description']) || '',
            feature3Image: getVal(['feature 3 image']) || '',
            feature3Title: getVal(['feature 3 title']) || '',
            feature3Description: getVal(['feature 3 description']) || '',
            ourProcessSubtitle: getVal(['our process subtitle']) || '',
            ourProcessTitle: getVal(['our process title']) || '',
            ourProcessDescription: getVal(['our process description']) || '',
            cta1Icon: getVal(['cta 1 icon']) || '',
            cta1Title: getVal(['cta 1 title']) || '',
            cta1Description: getVal(['cta 1 description']) || '',
            cta2Icon: getVal(['cta 2 icon']) || '',
            cta2Title: getVal(['cta 2 title']) || '',
            cta2Description: getVal(['cta 2 description']) || '',
            cta3Icon: getVal(['cta 3 icon']) || '',
            cta3Title: getVal(['cta 3 title']) || '',
            cta3Description: getVal(['cta 3 description']) || '',
            footNote: getVal(['foot note']) || '',
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
        console.log(`Synced Service: ${slug}.mdx`);
    });
}

fetchAndGenerate().catch(console.error);