interface Box {
	left: number;
	right: number;
	top: number;
	bottom: number;
	width: number;
	height: number;
	cx: number;
	cy: number;
}

interface Point {
	x: number;
	y: number;
}

interface Route {
	d: string;
	mid: Point;
	straight: boolean;
}

interface LayerLink {
	fromLayer: string;
	toLayer: string;
	protocols: { id: string; label: string }[];
}

interface EdgeLink {
	from: string;
	to: string;
	protocol: string;
}

const views = ["architecture", "api-contract", "request-flow"];
const svgNamespace = "http://www.w3.org/2000/svg";
const compactViewport = window.matchMedia("(max-width: 1199px)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const cornerRadius = 8;

const readJson = <T>(selector: string): T[] => {
	const raw = document.querySelector<HTMLScriptElement>(selector)?.textContent;
	return raw ? (JSON.parse(raw) as T[]) : [];
};

const roundedPath = (points: Point[]) => {
	const commands = [`M ${points[0].x} ${points[0].y}`];
	for (let index = 1; index < points.length - 1; index += 1) {
		const previous = points[index - 1];
		const corner = points[index];
		const next = points[index + 1];
		const incoming = Math.hypot(corner.x - previous.x, corner.y - previous.y);
		const outgoing = Math.hypot(next.x - corner.x, next.y - corner.y);
		const radius = Math.min(cornerRadius, incoming / 2, outgoing / 2);
		if (radius < 0.5) {
			commands.push(`L ${corner.x} ${corner.y}`);
			continue;
		}
		const before = {
			x: corner.x - ((corner.x - previous.x) / incoming) * radius,
			y: corner.y - ((corner.y - previous.y) / incoming) * radius,
		};
		const after = {
			x: corner.x + ((next.x - corner.x) / outgoing) * radius,
			y: corner.y + ((next.y - corner.y) / outgoing) * radius,
		};
		commands.push(`L ${before.x} ${before.y}`, `Q ${corner.x} ${corner.y} ${after.x} ${after.y}`);
	}
	const last = points[points.length - 1];
	commands.push(`L ${last.x} ${last.y}`);
	return commands.join(" ");
};

const midpoint = (points: Point[]): Point => {
	const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
	let remaining = lengths.reduce((total, length) => total + length, 0) / 2;
	for (let index = 0; index < lengths.length; index += 1) {
		if (remaining <= lengths[index] && lengths[index] > 0) {
			const ratio = remaining / lengths[index];
			return {
				x: points[index].x + (points[index + 1].x - points[index].x) * ratio,
				y: points[index].y + (points[index + 1].y - points[index].y) * ratio,
			};
		}
		remaining -= lengths[index];
	}
	return points[0];
};

const crosses = (start: Point, end: Point, box: Box) => {
	const inset = 2;
	const left = Math.min(start.x, end.x);
	const right = Math.max(start.x, end.x);
	const top = Math.min(start.y, end.y);
	const bottom = Math.max(start.y, end.y);
	return (
		right > box.left + inset &&
		left < box.right - inset &&
		bottom > box.top + inset &&
		top < box.bottom - inset
	);
};

const collisions = (points: Point[], obstacles: Box[]) =>
	points
		.slice(1)
		.reduce(
			(total, point, index) => total + obstacles.filter((box) => crosses(points[index], point, box)).length,
			0,
		);

const across = (a: Box, b: Box, fromX: number, toX: number) => {
	const top = Math.max(a.top, b.top);
	const bottom = Math.min(a.bottom, b.bottom);
	if (bottom - top >= 12) {
		const y = (top + bottom) / 2;
		return [
			{ x: fromX, y },
			{ x: toX, y },
		];
	}
	const channel = (fromX + toX) / 2;
	return [
		{ x: fromX, y: a.cy },
		{ x: channel, y: a.cy },
		{ x: channel, y: b.cy },
		{ x: toX, y: b.cy },
	];
};

const along = (a: Box, b: Box, fromY: number, toY: number) => {
	const left = Math.max(a.left, b.left);
	const right = Math.min(a.right, b.right);
	if (right - left >= 12) {
		const x = (left + right) / 2;
		return [
			{ x, y: fromY },
			{ x, y: toY },
		];
	}
	const channel = (fromY + toY) / 2;
	return [
		{ x: a.cx, y: fromY },
		{ x: a.cx, y: channel },
		{ x: b.cx, y: channel },
		{ x: b.cx, y: toY },
	];
};

const gutter = (a: Box, b: Box, side: "left" | "right", offset: number, limit: number) => {
	const outer = side === "left" ? Math.min(a.left, b.left) - offset : Math.max(a.right, b.right) + offset;
	const edge = Math.max(6, Math.min(outer, limit - 6));
	const fromX = side === "left" ? a.left : a.right;
	const toX = side === "left" ? b.left : b.right;
	return [
		{ x: fromX, y: a.cy },
		{ x: edge, y: a.cy },
		{ x: edge, y: b.cy },
		{ x: toX, y: b.cy },
	];
};

const route = (a: Box, b: Box, obstacles: Box[], offset: number, limit: number): Route => {
	const candidates: Point[][] = [];
	if (b.left - a.right >= 8) {
		candidates.push(across(a, b, a.right, b.left));
	}
	if (a.left - b.right >= 8) {
		candidates.push(across(a, b, a.left, b.right));
	}
	if (b.top - a.bottom >= 8) {
		candidates.push(along(a, b, a.bottom, b.top));
	}
	if (a.top - b.bottom >= 8) {
		candidates.push(along(a, b, a.top, b.bottom));
	}
	const sides: ("left" | "right")[] = b.cy >= a.cy ? ["right", "left"] : ["left", "right"];
	sides.forEach((side) => candidates.push(gutter(a, b, side, offset, limit)));
	const scored = candidates.map((points, order) => ({ points, order, score: collisions(points, obstacles) }));
	scored.sort((first, second) => first.score - second.score || first.order - second.order);
	const best = scored[0].points;
	return { d: roundedPath(best), mid: midpoint(best), straight: best.length === 2 };
};

const workspace = document.querySelector<HTMLElement>("[data-workspace]");

if (workspace) {
	const cards = Array.from(workspace.querySelectorAll<HTMLButtonElement>("[data-node-id]"));
	const panels = Array.from(workspace.querySelectorAll<HTMLElement>("[data-inspector-for]"));
	const layerPanels = Array.from(workspace.querySelectorAll<HTMLElement>("[data-layer-panel]"));
	const toggles = Array.from(workspace.querySelectorAll<HTMLButtonElement>("[data-layer-toggle]"));
	const count = workspace.querySelector<HTMLElement>("[data-result-count]");
	const inspector = workspace.querySelector<HTMLElement>("[data-inspector]");
	const search = document.querySelector<HTMLInputElement>("[data-search]");
	const tabs = Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-view-link]"));
	const viewPanels = Array.from(workspace.querySelectorAll<HTMLElement>("[data-view-panel]"));
	const map = workspace.querySelector<HTMLElement>("[data-map]");
	const layerPaths = workspace.querySelector<SVGGElement>("[data-layer-paths]");
	const focusPaths = workspace.querySelector<SVGGElement>("[data-focus-paths]");
	const labels = workspace.querySelector<HTMLElement>("[data-map-labels]");
	const layerLinks = readJson<LayerLink>("[data-layer-links]");
	const edgeLinks = readJson<EdgeLink>("[data-edges]");
	const enabledLayers = new Set(toggles.map((toggle) => toggle.dataset.layerToggle ?? ""));
	let selectedId = "";

	const measure = (element: Element): Box | null => {
		if (!map) {
			return null;
		}
		const frame = map.getBoundingClientRect();
		const rect = element.getBoundingClientRect();
		if (rect.width === 0) {
			return null;
		}
		const left = rect.left - frame.left;
		const top = rect.top - frame.top;
		return {
			left,
			top,
			right: left + rect.width,
			bottom: top + rect.height,
			width: rect.width,
			height: rect.height,
			cx: left + rect.width / 2,
			cy: top + rect.height / 2,
		};
	};

	const measureAll = (elements: Element[]) =>
		elements.flatMap((element) => {
			const box = measure(element);
			return box ? [{ element, box }] : [];
		});

	const layerBoxes = () =>
		measureAll(Array.from(map?.querySelectorAll("[data-box], .map-key") ?? []));

	const blockObstacles = () =>
		measureAll([...cards, ...Array.from(map?.querySelectorAll(".layer-heading > *, .system-header > *, .map-key") ?? [])]);

	const pathElement = (path: Route, protocol: string, className: string) => {
		const element = document.createElementNS(svgNamespace, "path");
		element.setAttribute("d", path.d);
		element.setAttribute("class", `${className} protocol-${protocol}`);
		element.setAttribute("marker-end", `url(#arrow-${protocol})`);
		return element;
	};

	const placeLabel = (path: Route, protocols: { id: string; label: string }[]) => {
		if (!labels || !map) {
			return;
		}
		const label = document.createElement("span");
		label.className = "connector-label";
		label.style.left = `${path.mid.x}px`;
		label.style.top = `${path.mid.y}px`;
		protocols.slice(0, 2).forEach((protocol) => {
			const line = document.createElement("span");
			line.className = `protocol-${protocol.id}`;
			line.textContent = protocol.label;
			label.appendChild(line);
		});
		labels.appendChild(label);
		const inset = label.offsetWidth / 2 + 4;
		label.style.left = `${Math.max(inset, Math.min(path.mid.x, map.clientWidth - inset))}px`;
	};

	const drawLayerLinks = () => {
		if (!layerPaths || !labels) {
			return;
		}
		layerPaths.replaceChildren();
		labels.replaceChildren();
		const boxes = layerBoxes();
		const boxOf = (id: string) => boxes.find((entry) => entry.element.getAttribute("data-box") === id);
		layerLinks.forEach((link) => {
			if (!enabledLayers.has(link.fromLayer) || !enabledLayers.has(link.toLayer)) {
				return;
			}
			const from = boxOf(link.fromLayer);
			const to = boxOf(link.toLayer);
			if (!from || !to) {
				return;
			}
			const obstacles = boxes.filter((entry) => entry !== from && entry !== to).map((entry) => entry.box);
			const path = route(from.box, to.box, obstacles, 8, map?.clientWidth ?? 0);
			layerPaths.appendChild(pathElement(path, link.protocols[0]?.id ?? "in-process", "layer-path"));
			if (path.straight) {
				placeLabel(path, link.protocols);
			}
		});
	};

	const drawFocusLinks = () => {
		if (!focusPaths) {
			return;
		}
		focusPaths.replaceChildren();
		const measured = blockObstacles();
		const blockOf = (id: string) => measured.find((entry) => (entry.element as HTMLElement).dataset?.nodeId === id);
		edgeLinks
			.filter((edge) => edge.from === selectedId || edge.to === selectedId)
			.forEach((edge, lane) => {
				const from = blockOf(edge.from);
				const to = blockOf(edge.to);
				if (!from || !to) {
					return;
				}
				const obstacles = measured.filter((entry) => entry !== from && entry !== to).map((entry) => entry.box);
				focusPaths.appendChild(pathElement(route(from.box, to.box, obstacles, 7 + lane * 6, map?.clientWidth ?? 0), edge.protocol, "focus-path"));
			});
	};

	const redraw = () => {
		drawLayerLinks();
		drawFocusLinks();
	};

	const select = (id: string, reveal: boolean) => {
		const card = cards.find((candidate) => candidate.dataset.nodeId === id);
		if (!card) {
			return;
		}
		selectedId = id;
		const related = new Set((card.dataset.related ?? "").split(",").filter(Boolean));
		cards.forEach((candidate) => {
			const isSelected = candidate.dataset.nodeId === id;
			candidate.setAttribute("aria-pressed", String(isSelected));
			candidate.classList.toggle("is-related", related.has(candidate.dataset.nodeId ?? ""));
		});
		panels.forEach((panel) => {
			const active = panel.dataset.inspectorFor === id;
			panel.hidden = !active;
			if (active) {
				const body = panel.querySelector<HTMLElement>("[data-inspector-body]");
				if (body) {
					body.scrollTop = 0;
				}
			}
		});
		if (inspector) {
			inspector.scrollTop = 0;
		}
		drawFocusLinks();
		if (reveal && compactViewport.matches) {
			const active = panels.find((panel) => panel.dataset.inspectorFor === id);
			active?.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
		}
	};

	const applyFilters = () => {
		const term = (search?.value ?? "").trim().toLowerCase();
		let visible = 0;
		cards.forEach((card) => {
			const layer = card.closest<HTMLElement>("[data-layer-panel]")?.dataset.layerPanel ?? "";
			const matches =
				enabledLayers.has(layer) && (term.length === 0 || (card.dataset.searchText ?? "").includes(term));
			card.classList.toggle("is-dim", !matches);
			if (matches) {
				visible += 1;
			}
		});
		layerPanels.forEach((panel) => {
			panel.classList.toggle("is-off", !enabledLayers.has(panel.dataset.layerPanel ?? ""));
		});
		if (count) {
			count.textContent = `${visible} of ${cards.length} components`;
		}
		redraw();
	};

	const applyView = () => {
		const requested = window.location.hash.replace("#", "");
		const view = views.includes(requested) ? requested : "architecture";
		workspace.dataset.view = view;
		viewPanels.forEach((panel) => {
			panel.hidden = panel.dataset.viewPanel !== view;
		});
		tabs.forEach((tab) => {
			if (tab.dataset.viewLink === view) {
				tab.setAttribute("aria-current", "page");
			} else {
				tab.removeAttribute("aria-current");
			}
		});
		redraw();
	};

	cards.forEach((card) => {
		card.addEventListener("click", () => select(card.dataset.nodeId ?? "", true));
	});

	workspace.querySelectorAll<HTMLButtonElement>("[data-select-node]").forEach((button) => {
		button.addEventListener("click", () => select(button.dataset.selectNode ?? "", false));
	});

	toggles.forEach((toggle) => {
		toggle.addEventListener("click", () => {
			const layer = toggle.dataset.layerToggle ?? "";
			const active = !enabledLayers.has(layer);
			if (active) {
				enabledLayers.add(layer);
			} else {
				enabledLayers.delete(layer);
			}
			toggle.setAttribute("aria-pressed", String(active));
			applyFilters();
		});
	});

	search?.addEventListener("input", applyFilters);
	window.addEventListener("hashchange", applyView);

	if (map && "ResizeObserver" in window) {
		new ResizeObserver(redraw).observe(map);
	}
	window.addEventListener("resize", redraw);
	document.fonts?.ready.then(redraw);

	const initial = cards.find((card) => card.getAttribute("aria-pressed") === "true");
	if (initial) {
		select(initial.dataset.nodeId ?? "", false);
	}
	applyView();
}

const navToggle = document.querySelector<HTMLButtonElement>("[data-nav-toggle]");
const navPanel = document.querySelector<HTMLElement>("[data-nav-panel]");

navToggle?.addEventListener("click", () => {
	const open = navToggle.getAttribute("aria-expanded") !== "true";
	navToggle.setAttribute("aria-expanded", String(open));
	navPanel?.classList.toggle("is-open", open);
});
