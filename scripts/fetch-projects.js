import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const SHEET_URL =
    'https://docs.google.com/spreadsheets/d/1vYOk_nJd3TYtToQt1HOPMBnNoeOqp6h06QwFiO1yxT4/gviz/tq?tqx=out:csv&gid=928623975';

function escapeMDX(str) {
    if (!str) return '';
    return str.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
}

async function fetchAndGenerate() {
    console.log('Fetching Projects Sheet data...');
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

    const contentDir = path.join(process.cwd(), 'src', 'content', 'projects');

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
        // Robust Column Detection
        const getVal = (keys) => {
            const key = Object.keys(row).find(k => keys.includes(k.trim().toLowerCase()));
            return key ? row[key]?.trim() : null;
        };

        let title = getVal(['project name', 'title', 'name']) || '';
        let rawSlug = getVal(['slug', 'url', 'id', 'product_page_url']) || '';
        const imageFile = getVal(['feature 1 image', 'featured image', 'image']) || '';
        const isPublished = getVal(['publish', 'published', 'status'])?.toLowerCase();

        // ONLY fetch if Publish column is 'y'
        if (isPublished !== 'y') {
            console.log(`Skipping unpublished project at index ${index} (Publish: ${isPublished})`);
            return;
        }

        // If title is "Title" or empty, try fallback to image name
        if (title.toLowerCase() === 'title' || !title) {
            if (imageFile && imageFile.toLowerCase() !== 'featured image') {
                title = imageFile.split('.')[0].replace(/[-_]+/g, ' ').toUpperCase();
                if (!rawSlug || rawSlug.toLowerCase() === 'slug') {
                    rawSlug = imageFile.split('.')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-');
                }
            }
        }

        if ((!rawSlug || rawSlug.toLowerCase() === 'slug') && (!title || title.toLowerCase() === 'title' || title.toLowerCase() === 'featured image')) {
            console.log(`Skipping secondary header row at index ${index}`);
            return;
        }

        // Additional skip: if image is just "Featured Image" and title is generic
        if (imageFile === 'Featured Image' || title === 'FEATURED IMAGE') {
            console.log(`Skipping generic/placeholder row at index ${index}`);
            return;
        }

        // Extract last part of path if it's a URL or contains slashes
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

        // Ensure slug is not empty after extraction
        slug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `project-${index}`;

        // Final clean
        slug = slug.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();

        // Frontmatter
        const frontmatter = {
            title: title,
            metaTitle: getVal(['meta title', 'seotitle', 'seo title']) || title,
            slug: slug,
            category: getVal(['category', 'type']) || '',
            metaDescription: getVal(['meta description', 'meta desc']) || '',
            location: getVal(['location', 'place']) || '',
            description: getVal(['description', 'excerpt']) || '',
            image: getVal(['feature 1 image', 'featured image', 'image']) ? `../../assets/images/${getVal(['feature 1 image', 'featured image', 'image'])}` : '',
            imageAlt: getVal(['featured alt', 'image alt', 'feature 1 alt']) || title,
            feature1Image: getVal(['feature 1 image']) ? `../../assets/images/${getVal(['feature 1 image'])}` : '',
            feature2Image: getVal(['feature 2 image']) ? `../../assets/images/${getVal(['feature 2 image'])}` : '',
            feature3Image: getVal(['feature 3 image']) ? `../../assets/images/${getVal(['feature 3 image'])}` : '',
        };

        // Add all other keys to frontmatter to ensure completeness (passthrough)
        Object.entries(row).forEach(([key, value]) => {
            const normalizedKey = key.trim().toLowerCase();
            const standardKeys = ['project name', 'title', 'slug', 'meta title', 'meta description', 'location', 'description', 'feature 1 image', 'featured alt', 'category'];
            if (!standardKeys.includes(normalizedKey)) {
                // Use original key name but trim it
                frontmatter[key.trim()] = value;
            }
        });

        // MDX file generation
        let mdxContent = `---\n`;
        for (const [key, value] of Object.entries(frontmatter)) {
            if (value !== null && value !== undefined) {
                mdxContent += `${key}: ${JSON.stringify(value)}\n`;
            }
        }
        mdxContent += `---\n\n`;

        // Body content - only append if different from description and title
        const bodyContent = getVal(['content', 'body', 'description']) || '';
        if (bodyContent && bodyContent !== frontmatter.description && bodyContent !== title) {
            mdxContent += `${escapeMDX(bodyContent)}\n\n`;
        }

        const filePath = path.join(contentDir, `${slug}.mdx`);
        fs.writeFileSync(filePath, mdxContent, 'utf-8');
        console.log(`Synced Project: ${slug}.mdx`);
    });

    console.log('Projects sync complete!');
}

fetchAndGenerate().catch(console.error);
