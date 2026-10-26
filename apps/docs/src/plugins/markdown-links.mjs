import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootIndexRoute = "/overview/";
const rootIndexFile = "index.md";
const externalOrAbsolute = /^([a-z][a-z0-9+.-]*:|[/#])/i;
const markdownTarget = /^([^?#]*\.md)([?#].*)?$/;
const markdownHref = /href="([^"]*\.md(?:[?#][^"]*)?)"/g;

function routeOf(relativePath) {
	const withoutExtension = relativePath.replace(/\.md$/, "");
	if (withoutExtension === "index") {
		return rootIndexRoute;
	}
	if (withoutExtension.endsWith("/index")) {
		return `/${withoutExtension.slice(0, -"/index".length)}/`;
	}
	return `/${withoutExtension}/`;
}

function sourceOf(route) {
	if (route === rootIndexRoute) {
		return rootIndexFile;
	}
	return `${route.replace(/^\/|\/$/g, "")}.md`;
}

export function rewriteMarkdownHref(href, pageRoute) {
	if (externalOrAbsolute.test(href)) {
		return href;
	}
	const match = href.match(markdownTarget);
	if (!match) {
		return href;
	}
	const sourceDirectory = path.posix.dirname(sourceOf(pageRoute));
	const target = path.posix.normalize(path.posix.join(sourceDirectory, match[1]));
	if (target.startsWith("..")) {
		return href;
	}
	return routeOf(target) + (match[2] ?? "");
}

async function htmlFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map((entry) => {
			const full = path.join(directory, entry.name);
			return entry.isDirectory() ? htmlFiles(full) : entry.name.endsWith(".html") ? [full] : [];
		}),
	);
	return nested.flat();
}

export default function markdownLinks() {
	return {
		name: "markdown-links",
		hooks: {
			"astro:build:done": async ({ dir }) => {
				const outDirectory = fileURLToPath(dir);
				for (const file of await htmlFiles(outDirectory)) {
					const relative = path.relative(outDirectory, file).split(path.sep).join("/");
					const route = `/${relative.replace(/index\.html$/, "")}`;
					const html = await readFile(file, "utf8");
					const rewritten = html.replace(markdownHref, (_, href) => `href="${rewriteMarkdownHref(href, route)}"`);
					if (rewritten !== html) {
						await writeFile(file, rewritten);
					}
				}
			},
		},
	};
}
