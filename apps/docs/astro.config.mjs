import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import { workspaceLinks } from "./src/data/architecture";
import markdownLinks from "./src/plugins/markdown-links.mjs";

const decisionsLink = "/decisions/";

const documentationItems = workspaceLinks.map(({ label, href }) =>
	href === decisionsLink
		? { label, collapsed: true, items: [{ autogenerate: { directory: "decisions" } }] }
		: { label, link: href },
);

export default defineConfig({
	site: process.env.SITE_URL ?? "https://hotels.example.com",
	integrations: [
		markdownLinks(),
		starlight({
			title: "Hotel Management System",
			favicon: "/brand-mark.svg",
			description:
				"Architecture, API contract, domain rules and delivery notes for the hotel management system.",
			customCss: ["./src/styles/site.css", "./src/styles/custom.css"],
			components: {
				Header: "./src/components/starlight/Header.astro",
				Sidebar: "./src/components/starlight/Sidebar.astro",
				PageTitle: "./src/components/starlight/PageTitle.astro",
				ThemeProvider: "./src/components/starlight/Empty.astro",
				ThemeSelect: "./src/components/starlight/Empty.astro",
				MobileMenuFooter: "./src/components/starlight/Empty.astro",
			},
			sidebar: [
				{ label: "Architecture", items: [{ label: "Architecture map", link: "/" }] },
				{ label: "Documentation", items: documentationItems },
			],
		}),
	],
});
