export type LayerId =
	| "delivery"
	| "api"
	| "application"
	| "domain"
	| "infrastructure"
	| "data";

export type NodeStatus = "implemented" | "planned";

export type EdgeProtocol =
	| "https"
	| "container"
	| "in-process"
	| "sql"
	| "identity";

export interface ApiEndpoint {
	method: "GET" | "POST" | "PUT" | "DELETE";
	path: string;
	policy: string;
	success: string;
	failures: string;
}

export interface ArchitectureNode {
	id: string;
	label: string;
	kind: string;
	layer: LayerId;
	status: NodeStatus;
	summary: string;
	responsibilities: string[];
	expectations: string[];
	data: string;
	endpoints?: ApiEndpoint[];
}

export interface ArchitectureEdge {
	from: string;
	to: string;
	label: string;
	protocol: EdgeProtocol;
}

export interface RequestFlowStep {
	title: string;
	detail: string;
}

export type Accent = "cyan" | "violet" | "emerald";

export interface DocLink {
	label: string;
	href: string;
}

export interface LayerDescriptor {
	id: LayerId;
	title: string;
	responsibility: string;
	accent: Accent;
	badges: string[];
	docs: DocLink[];
}

export interface WorkspaceLink extends DocLink {
	description: string;
}


export const workspaceLinks: WorkspaceLink[] = [
	{ label: "Overview", href: "/overview/", description: "Status of the system and where to go next" },
	{ label: "Architecture", href: "/architecture/", description: "Layers, rules and boundaries" },
	{ label: "Security and authentication", href: "/authentication/", description: "Identity, tokens and sessions" },
	{ label: "Hotel API", href: "/hotel-api/", description: "HTTP contract of the hotel resources" },
	{ label: "Hotel images", href: "/hotel-images/", description: "Up to three strict lossless images per hotel and their limits" },
	{ label: "Hotel domain", href: "/hotel-domain/", description: "Rules of hotels and ratings" },
	{ label: "Development", href: "/development/", description: "Run, build and test" },
	{ label: "Agents", href: "/agents/", description: "How instructions and skills are loaded" },
	{ label: "Decisions (ADRs)", href: "/decisions/", description: "Why the system is built this way" },
];

export const dotnetArea: { title: string; subtitle: string; mark: string; layers: LayerId[] } = {
	title: "ASP.NET Core API",
	subtitle: "Clean architecture",
	mark: ".NET",
	layers: ["api", "application", "domain", "infrastructure"],
};

export const protocolLabels: Record<EdgeProtocol, string> = {
	https: "HTTPS",
	container: "Docker Compose",
	"in-process": "In-process",
	sql: "SQL · Npgsql",
	identity: "Identity",
};

export const layers: LayerDescriptor[] = [
	{
		id: "api",
		title: "API",
		responsibility: "Translates HTTP into use cases and enforces authentication and authorization.",
		accent: "cyan",
		badges: ["ASP.NET Core", "JWT bearer"],
		docs: [
			{ label: "Hotel API", href: "/hotel-api/" },
			{ label: "Hotel images", href: "/hotel-images/" },
			{ label: "Authentication", href: "/authentication/" },
			{ label: "ADR-004 RBAC through policies", href: "/decisions/adr-004-rbac-through-policies/" },
			{ label: "ADR-013 Hotel HTTP contract", href: "/decisions/adr-013-hotel-http-contract/" },
			{ label: "ADR-015 Strict lossless hotel images", href: "/decisions/adr-015-strict-lossless-hotel-images/" },
			{ label: "ADR-017 Up to three images per hotel", href: "/decisions/adr-017-up-to-three-images-per-hotel/" },
			{ label: "ADR-018 Nightly price and discount", href: "/decisions/adr-018-nightly-price-and-discount/" },
		],
	},
	{
		id: "application",
		title: "Application",
		responsibility: "Orchestrates the use cases and declares the ports the infrastructure must satisfy.",
		accent: "violet",
		badges: ["Use cases", "Ports"],
		docs: [
			{ label: "ADR-001 Clean Architecture", href: "/decisions/adr-001-clean-architecture/" },
			{ label: "ADR-003 Application services over CQRS", href: "/decisions/adr-003-application-services-over-cqrs/" },
			{ label: "ADR-012 Identity, JWT and sessions", href: "/decisions/adr-012-identity-jwt-and-revocable-sessions/" },
			{ label: "ADR-015 Strict lossless hotel images", href: "/decisions/adr-015-strict-lossless-hotel-images/" },
			{ label: "ADR-017 Up to three images per hotel", href: "/decisions/adr-017-up-to-three-images-per-hotel/" },
		],
	},
	{
		id: "domain",
		title: "Domain",
		responsibility: "Owns the rules of hotels, ratings and accounts. It depends on nothing.",
		accent: "emerald",
		badges: ["Business rules"],
		docs: [
			{ label: "Hotel domain rules", href: "/hotel-domain/" },
			{ label: "ADR-010 Hotel scores", href: "/decisions/adr-010-hotel-scores/" },
			{ label: "ADR-018 Nightly price and discount", href: "/decisions/adr-018-nightly-price-and-discount/" },
		],
	},
	{
		id: "infrastructure",
		title: "Infrastructure",
		responsibility: "Implements the ports with PostgreSQL, ASP.NET Core Identity, Magick.NET and the local filesystem.",
		accent: "cyan",
		badges: ["EF Core", "Npgsql", "Identity", "Magick.NET"],
		docs: [
			{ label: "ADR-011 PostgreSQL persistence", href: "/decisions/adr-011-postgresql-persistence/" },
			{ label: "ADR-012 Identity, JWT and sessions", href: "/decisions/adr-012-identity-jwt-and-revocable-sessions/" },
			{ label: "ADR-015 Strict lossless hotel images", href: "/decisions/adr-015-strict-lossless-hotel-images/" },
			{ label: "ADR-017 Up to three images per hotel", href: "/decisions/adr-017-up-to-three-images-per-hotel/" },
			{ label: "ADR-018 Nightly price and discount", href: "/decisions/adr-018-nightly-price-and-discount/" },
			{ label: "ADR-006 Local storage over Cloudflare R2", href: "/decisions/adr-006-local-storage-over-cloudflare-r2/" },
		],
	},
	{
		id: "data",
		title: "Data",
		responsibility: "Stores the state the system owns, with the constraints the domain requires.",
		accent: "emerald",
		badges: ["PostgreSQL 17", "Image volume"],
		docs: [
			{ label: "ADR-002 PostgreSQL", href: "/decisions/adr-002-postgresql-over-sql-server-and-sqlite/" },
			{ label: "ADR-011 PostgreSQL persistence", href: "/decisions/adr-011-postgresql-persistence/" },
			{ label: "ADR-006 Local storage over Cloudflare R2", href: "/decisions/adr-006-local-storage-over-cloudflare-r2/" },
			{ label: "ADR-017 Up to three images per hotel", href: "/decisions/adr-017-up-to-three-images-per-hotel/" },
			{ label: "ADR-018 Nightly price and discount", href: "/decisions/adr-018-nightly-price-and-discount/" },
		],
	},
	{
		id: "delivery",
		title: "Delivery",
		responsibility: "Runs the API and the database with the same definition in every environment, and holds the Angular client: the public catalog and the guarded administration area.",
		accent: "violet",
		badges: ["Docker Compose", "Angular"],
		docs: [
			{ label: "Development", href: "/development/" },
			{ label: "ADR-016 Angular frontend stack", href: "/decisions/adr-016-angular-frontend-stack/" },
			{ label: "ADR-019 Admin session storage", href: "/decisions/adr-019-admin-session-storage/" },
			{ label: "ADR-005 Docker Compose and manual execution", href: "/decisions/adr-005-docker-compose-and-manual-execution/" },
		],
	},
];

export const nodes: ArchitectureNode[] = [
	{
		id: "compose",
		label: "Docker Compose",
		kind: "Container orchestration",
		layer: "delivery",
		status: "implemented",
		summary:
			"Starts the API and PostgreSQL 17 from one definition, with a development overlay and a production overlay.",
		responsibilities: [
			"Builds the API image and runs it as a non-root user.",
			"Mounts a persistent volume for the hotel images, writable by that user.",
			"Applies the migrations with a one-shot migrator before the API starts.",
			"Keeps the PostgreSQL port unpublished in production.",
		],
		expectations: [
			"Development binds the database to loopback; production publishes only the API.",
			"Secrets arrive from the environment; no credential is written in the repository.",
		],
		data: "Volumes (database and hotel images) and environment variables only. It stores no domain state.",
	},
	{
		id: "composition-root",
		label: "Program.cs",
		kind: "Composition root",
		layer: "api",
		status: "implemented",
		summary:
			"The single place where the layers are wired: persistence, Identity, authentication, policies and the controllers.",
		responsibilities: [
			"Registers the DbContext, the Identity stores and the session store.",
			"Registers the image optimizer, the file storage and the startup check of the image directory.",
			"Configures the JWT bearer authentication and the five authorization policies.",
			"Publishes the controllers and the health endpoint.",
		],
		expectations: [
			"The API refuses to start in production without a signing key of at least 32 characters.",
			"The first administrator is provisioned from the environment, never from a request.",
			"The API refuses to start in production without an absolute, writable image directory outside the application folder.",
		],
		data: "Reads the connection string, the signing key, the administrator pair and the image directory from the environment.",
	},
	{
		id: "auth-controller",
		label: "AuthenticationController",
		kind: "HTTP endpoints",
		layer: "api",
		status: "implemented",
		summary:
			"Registration, sign in, the signed-in account and the sign out of the sessions.",
		responsibilities: [
			"Answers 201 for a registration and 409 for a duplicate account.",
			"Answers 200 with an access token for a correct sign in and 401 otherwise.",
			"Revokes the session behind the token on sign out.",
		],
		expectations: [
			"A registration always creates an account with the User role.",
			"An invalid field is answered with 400 and the name of the field.",
		],
		data: "Accounts and sessions live in PostgreSQL.",
		endpoints: [
			{
				method: "POST",
				path: "/api/auth/register",
				policy: "anonymous",
				success: "201 with the created account",
				failures: "400 invalid input, 409 duplicate account",
			},
			{
				method: "POST",
				path: "/api/auth/login",
				policy: "anonymous",
				success: "200 with the access token",
				failures: "400 invalid input, 401 wrong credentials",
			},
			{
				method: "GET",
				path: "/api/auth/me",
				policy: "authenticated",
				success: "200 with the signed-in account",
				failures: "401 missing or invalid token",
			},
			{
				method: "POST",
				path: "/api/auth/logout",
				policy: "authenticated",
				success: "204 with no body",
				failures: "401 missing or invalid token",
			},
		],
	},
	{
		id: "hotels-controller",
		label: "HotelsController",
		kind: "HTTP endpoints",
		layer: "api",
		status: "implemented",
		summary:
			"The administrative CRUD of the hotels, plus the filtered and paginated listing.",
		responsibilities: [
			"Reads the hotels for both roles.",
			"Creates, updates and deletes a hotel for the Administrator role only.",
			"Shows or hides a hotel on the public catalog with PUT /api/hotels/{id}/status and a required boolean isActive, for the Administrator role only.",
			"Answers the listing with the items, the page and the totals, filtered by name, minimum rating and maximum nightly price.",
			"Includes the primary image metadata, or null, and the images of every position in every hotel it returns.",
			"Accepts the optional pricePerNight and discountPercent on create and update, and returns a pricing block in USD, or null, in every hotel.",
		],
		expectations: [
			"A rejected write leaves the stored hotel exactly as it was.",
			"The listing order is the creation timestamp and then the identifier.",
			"Updating the descriptive details never changes the images of the hotel.",
			"An update replaces the whole details, so an update without the pricing fields clears the pricing.",
			"Create and update never change isActive; new hotels start active and only the status route changes the state, idempotently.",
			"An invalid price or discount is answered with 400 and the field pricePerNight or discountPercent; a maxPrice that is not a positive number is answered with 400.",
		],
		data: "Reads and writes the hotels table through the hotel service.",
		endpoints: [
			{
				method: "GET",
				path: "/api/hotels",
				policy: "hotels.read",
				success: "200 with a page of hotels",
				failures: "400 invalid query, 401 missing or invalid token",
			},
			{
				method: "GET",
				path: "/api/hotels/{id}",
				policy: "hotels.read",
				success: "200 with the hotel",
				failures: "404 unknown hotel, 401 missing or invalid token",
			},
			{
				method: "POST",
				path: "/api/hotels",
				policy: "hotels.create",
				success: "201 with the created hotel",
				failures: "400 invalid input, 403 forbidden role, 401 missing or invalid token",
			},
			{
				method: "PUT",
				path: "/api/hotels/{id}",
				policy: "hotels.update",
				success: "200 with the updated hotel",
				failures: "400 invalid input, 404 unknown hotel, 403 forbidden role, 401 missing or invalid token",
			},
			{
				method: "PUT",
				path: "/api/hotels/{id}/status",
				policy: "hotels.update",
				success: "200 with the hotel and its new isActive",
				failures: "400 missing or non-boolean isActive, 404 unknown hotel, 403 forbidden role, 401 missing or invalid token",
			},
			{
				method: "DELETE",
				path: "/api/hotels/{id}",
				policy: "hotels.delete",
				success: "204 with no body",
				failures: "404 unknown hotel, 403 forbidden role, 401 missing or invalid token",
			},
		],
	},
	{
		id: "ratings-controller",
		label: "HotelRatingsController",
		kind: "HTTP endpoints",
		layer: "api",
		status: "implemented",
		summary:
			"Records the rating of the signed-in account for one hotel and returns the summary after the write, and returns the score of that account alone.",
		responsibilities: [
			"Reads the account from the validated token, never from the request body.",
			"Replaces the previous rating of the same account for the same hotel.",
			"Answers the own score of the caller, or null when the caller has not rated the hotel.",
		],
		expectations: [
			"The score is a decimal between 1 and 5, both included.",
			"Rating again moves the average and never grows the number of votes.",
			"The own score answer carries only the score, never another account or a user identifier.",
		],
		data: "Reads and writes the hotel_ratings table through the hotel service.",
		endpoints: [
			{
				method: "POST",
				path: "/api/hotels/{id}/ratings",
				policy: "hotels.rate",
				success: "200 with the rating summary",
				failures: "400 score outside 1 to 5, 404 unknown hotel, 401 missing or invalid token",
			},
			{
				method: "GET",
				path: "/api/hotels/{id}/ratings/me",
				policy: "hotels.rate",
				success: "200 with the score of the caller, or a null score",
				failures: "404 unknown hotel, 403 forbidden role, 401 missing or invalid token",
			},
		],
	},
	{
		id: "public-hotels-controller",
		label: "PublicHotelsController",
		kind: "HTTP endpoints",
		layer: "api",
		status: "implemented",
		summary:
			"The anonymous, read-only catalog: list, detail and the images of the active hotels.",
		responsibilities: [
			"Lists the active hotels with the name filter, the minimum rating filter, the maximum nightly price filter and pagination, with the validation of the administrative listing.",
			"Returns the same hotel response as the administrative reads, with no extra fields.",
			"Serves the bytes of each image position with the detected content type, an entity tag, nosniff and a private no-cache policy; the image route is position 0.",
		],
		expectations: [
			"No token is required, and the administrative routes keep answering 401 without one.",
			"An inactive hotel is absent from the list and answers 404 on the detail and every image route.",
			"The controller exposes no write; every change stays behind the administrative policies.",
		],
		data: "Reads the hotels table and the image files through the hotel and image services.",
		endpoints: [
			{
				method: "GET",
				path: "/api/public/hotels",
				policy: "anonymous",
				success: "200 with a page of active hotels",
				failures: "400 invalid query",
			},
			{
				method: "GET",
				path: "/api/public/hotels/{id}",
				policy: "anonymous",
				success: "200 with the hotel",
				failures: "404 unknown or inactive hotel",
			},
			{
				method: "GET",
				path: "/api/public/hotels/{id}/image",
				policy: "anonymous",
				success: "200 with the bytes of position 0",
				failures: "404 unknown or inactive hotel, or no image",
			},
			{
				method: "GET",
				path: "/api/public/hotels/{id}/images/{position}",
				policy: "anonymous",
				success: "200 with the bytes of position 0, 1 or 2",
				failures: "404 unknown or inactive hotel, empty position or position outside 0 to 2",
			},
		],
	},
	{
		id: "hotel-images-controller",
		label: "HotelImagesController",
		kind: "HTTP endpoints",
		layer: "api",
		status: "implemented",
		summary:
			"Uploads, replaces, serves and removes the images of a hotel in positions 0, 1 and 2 behind the existing read and update policies.",
		responsibilities: [
			"Reads the multipart field image with a bounded buffer and hands the bytes to the image service.",
			"Maps each rejection to 400, 413, 415 or 422 and a missing hotel, an empty position or a position outside 0 to 2 to 404 with problem details.",
			"Keeps the image routes as position 0 with the same statuses, bodies and headers.",
			"Serves the stored bytes with the detected content type, an entity tag and nosniff.",
		],
		expectations: [
			"The image is never served from a static directory; every read goes through the read policy.",
			"A rejected request leaves every stored image, its files and the hotel row exactly as they were.",
		],
		data: "Reads and writes the hotel_images table and the image files through the image service.",
		endpoints: [
			{
				method: "PUT",
				path: "/api/hotels/{id}/image",
				policy: "hotels.update",
				success: "200 with the image metadata",
				failures:
					"400 empty or damaged image, 413 above 10 MiB, 415 unsupported or animated, 422 too large in pixels, in color space or not losslessly reducible to 400,000 bytes, 404 unknown hotel, 403 forbidden role, 401 missing or invalid token",
			},
			{
				method: "GET",
				path: "/api/hotels/{id}/image",
				policy: "hotels.read",
				success: "200 with the image bytes",
				failures: "404 unknown hotel or no image, 401 missing or invalid token",
			},
			{
				method: "DELETE",
				path: "/api/hotels/{id}/image",
				policy: "hotels.update",
				success: "204 with no body",
				failures: "404 unknown hotel or no image, 403 forbidden role, 401 missing or invalid token",
			},
			{
				method: "PUT",
				path: "/api/hotels/{id}/images/{position}",
				policy: "hotels.update",
				success: "200 with the image metadata of the position",
				failures:
					"400, 413, 415 or 422 like the image route, 404 unknown hotel or position outside 0 to 2, 403 forbidden role, 401 missing or invalid token",
			},
			{
				method: "GET",
				path: "/api/hotels/{id}/images/{position}",
				policy: "hotels.read",
				success: "200 with the bytes of the position",
				failures: "404 unknown hotel, empty position or position outside 0 to 2, 401 missing or invalid token",
			},
			{
				method: "DELETE",
				path: "/api/hotels/{id}/images/{position}",
				policy: "hotels.update",
				success: "204 with no body; the other positions keep their places",
				failures: "404 unknown hotel, empty position or position outside 0 to 2, 403 forbidden role, 401 missing or invalid token",
			},
		],
	},
	{
		id: "jwt-bearer",
		label: "JWT bearer validation",
		kind: "Authentication",
		layer: "api",
		status: "implemented",
		summary:
			"Validates every access token and confirms that the session behind it is still open.",
		responsibilities: [
			"Checks the signature, the issuer, the audience and the expiration.",
			"Reads the session identifier from the token and confirms it belongs to the same account.",
			"Rejects a revoked session on the request that follows the sign out.",
		],
		expectations: [
			"An access token lives 15 minutes by default.",
			"A valid token for a revoked session is worth nothing.",
		],
		data: "Reads the sessions table on every authenticated request.",
	},
	{
		id: "policies",
		label: "Authorization policies",
		kind: "Authorization",
		layer: "api",
		status: "implemented",
		summary:
			"Five static policies that decide, on the server, what each role may do.",
		responsibilities: [
			"hotels.read and hotels.rate admit both roles.",
			"hotels.create, hotels.update and hotels.delete admit the Administrator only.",
			"The image endpoints reuse hotels.read for the download and hotels.update for the upload and the removal.",
		],
		expectations: [
			"Without a valid token the answer is 401; with a valid token and no policy it is 403.",
			"There is no dynamic permission management; the policies are fixed.",
		],
		data: "The role travels in the token claims and comes from the account store.",
	},
	{
		id: "health",
		label: "Health endpoint",
		kind: "Operational endpoint",
		layer: "api",
		status: "implemented",
		summary: "Answers 200 with the body Healthy. It is the readiness gate of the test harness.",
		responsibilities: [
			"Answers without a token.",
			"Does not touch the database, so it reports the process, not the data.",
		],
		expectations: [
			"The body is exactly Healthy.",
			"Orchestration and the end-to-end suite wait for this answer before they call the API.",
		],
		data: "None.",
	},
	{
		id: "authentication-service",
		label: "AuthenticationService",
		kind: "Application service",
		layer: "application",
		status: "implemented",
		summary:
			"Owns the account use cases: register, sign in, read the signed-in account and sign out.",
		responsibilities: [
			"Validates the account rules before any store is called.",
			"Creates the session and the access token after a correct sign in.",
			"Revokes the session on sign out.",
		],
		expectations: [
			"A duplicate account is classified by the uniqueness constraint, not by a guess.",
			"The account name is the email and the password is stored hashed.",
		],
		data: "Accounts and sessions through the account and session ports.",
	},
	{
		id: "hotel-service",
		label: "HotelService",
		kind: "Application service",
		layer: "application",
		status: "implemented",
		summary:
			"Owns the hotel use cases: list with filters, read, create, update, delete, rate and read the own score.",
		responsibilities: [
			"Translates the query into the filters the store understands.",
			"Computes the rating summary from the stored votes.",
			"Refuses an invalid input before it reaches the database.",
			"Releases the image file of every position of a deleted hotel after the row is gone.",
			"Restricts the public reads to active hotels through the active-only query flag and the active lookups.",
			"Changes the active state through the hotel rule, writing only when the state differs, and reports an unknown hotel as missing.",
		],
		expectations: [
			"The minimum rating filter keeps the hotels whose average is at least the value.",
			"Hotels without votes never match a minimum rating filter.",
			"The maximum price must be greater than 0; hotels without a price never match it.",
			"A price or discount error names the failing field, checked after the name.",
			"A failed file cleanup never turns a deleted hotel into an error.",
		],
		data: "Hotels and ratings through the hotel and rating ports.",
	},
	{
		id: "hotel-image-service",
		label: "HotelImageService",
		kind: "Application service",
		layer: "application",
		status: "implemented",
		summary:
			"Orchestrates the image lifecycle across PostgreSQL and the filesystem, which cannot share a transaction.",
		responsibilities: [
			"Reports a position outside 0 to 2 as not found before reading the content or touching any store.",
			"Rejects empty and oversized input, then asks the optimizer for a verified lossless result.",
			"Stages the new file under a generated key, swaps the database reference of that position, then deletes the file it displaced.",
			"Removes the staged file if the swap fails or the hotel is gone, unless that position already points at it.",
			"Opens the image of a position of an active hotel only for the public read, reporting an inactive hotel as not found.",
		],
		expectations: [
			"The previous file is deleted only after the new reference is stored, and only the key that was displaced; positions are independent.",
			"A cleanup failure leaves an orphan file and a successful answer; it is never claimed as a transaction.",
		],
		data: "Image metadata through the hotel port and image bytes through the file storage port.",
	},
	{
		id: "token-issuer",
		label: "JwtAccessTokenIssuer",
		kind: "Token service",
		layer: "application",
		status: "implemented",
		summary:
			"Builds the access token with the account, the role and the session identifier as claims.",
		responsibilities: [
			"Signs the token with the configured key.",
			"Carries the subject, the email, the role and the session identifier.",
		],
		expectations: [
			"The token is a standard signed token, not an opaque proprietary one.",
			"The signature, the issuer, the audience and the expiration are validated on every request.",
		],
		data: "None. It only reads the signing key from the configuration.",
	},
	{
		id: "ports",
		label: "Ports",
		kind: "Contracts",
		layer: "application",
		status: "implemented",
		summary:
			"The interfaces the infrastructure must satisfy: hotel store, rating store, session store, account store, token issuer, image optimizer and file storage.",
		responsibilities: [
			"Keep the use cases free of any persistence technology.",
			"Give the infrastructure a single place to change.",
		],
		expectations: [
			"The domain and the application never reference EF Core or Npgsql.",
			"The API and the application never reference the persistence types.",
		],
		data: "None. A port describes a contract, not a storage.",
	},
	{
		id: "hotel-domain",
		label: "Hotel, HotelDetails and HotelPricing",
		kind: "Domain model",
		layer: "domain",
		status: "implemented",
		summary:
			"The hotel aggregate with its descriptive details, its contact data, its optional pricing and its active state.",
		responsibilities: [
			"Requires a name and normalizes the optional texts.",
			"Validates the email, the phone and the website formats.",
			"Validates the optional nightly price in USD (greater than 0, at most 100000, at most two decimals) and the optional discount (an integer from 1 to 90, only with a price).",
			"Computes the discounted nightly rate as price * (100 - discount) / 100, rounded to cents away from zero.",
			"Keeps the creation timestamp and moves the update timestamp.",
		],
		expectations: [
			"Two hotels may share a name; the name is not a key.",
			"The details are bounded; an oversized text is rejected, not truncated.",
			"The currency is always USD and the discounted rate is computed, never stored.",
		],
		data: "Mapped to the hotels table; the pricing uses two nullable columns.",
	},
	{
		id: "hotel-image-domain",
		label: "HotelImage and HotelImageSlot",
		kind: "Domain model",
		layer: "domain",
		status: "implemented",
		summary:
			"The descriptive record of one hotel image and the slot that places it in position 0, 1 or 2 of the hotel.",
		responsibilities: [
			"Accepts only image/png, image/jpeg and image/webp.",
			"Requires positive dimensions and a size between 1 and 400,000 bytes.",
			"Gives a hotel at most one image per position and never one file in two positions; position 0 is the primary image.",
		],
		expectations: [
			"The record describes the stored bytes; it never contains them.",
			"A hotel without images is valid; removing a position never shifts the others.",
		],
		data: "Mapped to one row of the hotel_images table per filled position.",
	},
	{
		id: "rating-domain",
		label: "Rating rules",
		kind: "Domain model",
		layer: "domain",
		status: "implemented",
		summary:
			"The rating score, the rating collection of one hotel and the summary the API returns.",
		responsibilities: [
			"Accepts a decimal between 1 and 5, both included.",
			"Counts one vote per account and hotel.",
			"Reports a count of zero and a null average when there are no votes.",
		],
		expectations: [
			"The average is computed from the stored votes; no counter is kept.",
			"Rating again replaces the previous value.",
		],
		data: "Mapped to the hotel_ratings table.",
	},
	{
		id: "identity-domain",
		label: "Account rules and roles",
		kind: "Domain model",
		layer: "domain",
		status: "implemented",
		summary:
			"The rules of the accounts and the two roles the system knows.",
		responsibilities: [
			"Validates the email and the password of a registration.",
			"Names the roles Administrator and User and the five hotel permissions.",
		],
		expectations: [
			"Public registration never grants the Administrator role.",
			"The permissions are static; there is no dynamic role management.",
		],
		data: "Mapped to the Identity tables.",
	},
	{
		id: "db-context",
		label: "HotelDbContext",
		kind: "EF Core context",
		layer: "infrastructure",
		status: "implemented",
		summary:
			"The mapping of the domain to PostgreSQL, with the migrations that create and evolve the schema.",
		responsibilities: [
			"Maps the hotels, hotel_images and hotel_ratings tables with their constraints.",
			"Owns the migrations and the model snapshot.",
		],
		expectations: [
			"The schema is created by the migrations, never by an ad hoc script.",
			"The database enforces the rating range and the one vote per account.",
			"The database keys the images by hotel and position, accepts positions 0 to 2 only, caps the size at 400,000 bytes, allows one row per stored file and deletes the rows with their hotel.",
			"The gallery migration copies every existing image to position 0 before it drops the old image columns, and it is forward-only.",
			"The database checks the nightly price (greater than 0, at most 100000), the discount (1 to 90) and that a discount always has a price; the pricing migration adds nullable columns, keeps existing hotels without pricing and is forward-only.",
		],
		data: "The hotels, hotel_images, hotel_ratings and auth_sessions tables.",
	},
	{
		id: "stores",
		label: "PostgreSQL stores",
		kind: "Store implementations",
		layer: "infrastructure",
		status: "implemented",
		summary:
			"The implementations of the hotel and rating ports on top of EF Core and Npgsql.",
		responsibilities: [
			"Escape the wildcard characters of the name filter.",
			"Compute the average and the count of votes in one aggregate query.",
			"Write a rating with an atomic upsert on the account and hotel pair.",
			"Read the score of one account for one hotel by its key, without tracking.",
			"Swap and clear the image of one position, and delete a hotel with every image, under the hotel row lock, reporting what was displaced.",
			"Filter the listing by the effective nightly price (the discounted rate when there is a discount) inside the SQL query, before the count and the page.",
			"Set the active state with one UPDATE of is_active and updated_at_utc, without loading the hotel or its images.",
		],
		expectations: [
			"The listing never issues one query per hotel; the images of a page load with the page.",
			"The page offset is computed in 64 bits and bounded before it reaches the driver.",
			"A descriptive update never writes the hotel_images table, so it cannot erase a concurrent replacement.",
		],
		data: "The hotels, hotel_images and hotel_ratings tables.",
	},
	{
		id: "image-optimizer",
		label: "MagickImageOptimizationService",
		kind: "Image processing",
		layer: "infrastructure",
		status: "implemented",
		summary:
			"Decodes untrusted JPEG, PNG and WebP with Magick.NET and returns only a result that reproduces the exact decoded pixels within 400,000 bytes.",
		responsibilities: [
			"Detects the real format from the content and checks dimensions from the header before decoding.",
			"Rejects animation, damaged files (a PNG needs valid chunk checksums), other color spaces and anything outside the coder policy.",
			"Keeps an original that already fits, or verifies lossless PNG and WebP candidates by decoded comparison.",
		],
		expectations: [
			"Sixteen-bit samples, alpha, the hidden color under transparency, the color profile, the orientation and the PNG color declarations are never silently degraded.",
			"At most two images are processed at a time; limits are installed once at startup.",
		],
		data: "None. Bytes live in memory only while a request is processed.",
	},
	{
		id: "file-storage",
		label: "LocalFileStorageService",
		kind: "File storage",
		layer: "infrastructure",
		status: "implemented",
		summary:
			"Stores image files under generated keys in a configured directory outside the application folder.",
		responsibilities: [
			"Accepts only generated keys, so no request value becomes a path.",
			"Writes to a staging name, flushes and moves the file into place without overwriting.",
			"Deletes best effort and logs a failure by key without the path.",
		],
		expectations: [
			"A reader never sees a partial file.",
			"The directory is created and probed for writing at startup; the API refuses to start otherwise.",
		],
		data: "Files in the image directory, a Docker volume in Compose.",
	},
	{
		id: "identity-store",
		label: "Identity and session store",
		kind: "Store implementations",
		layer: "infrastructure",
		status: "implemented",
		summary:
			"The accounts, the hashed passwords and the revocable sessions of ASP.NET Core Identity.",
		responsibilities: [
			"Hash the password with the Identity hasher.",
			"Persist the session with its expiration and its revocation.",
			"Classify a duplicate account by the uniqueness constraint.",
		],
		expectations: [
			"A session belongs to one account; the token and the session must agree.",
			"The session lookup happens on every authenticated request.",
		],
		data: "The Identity tables and the auth_sessions table.",
	},
	{
		id: "bootstrap",
		label: "Administrator bootstrap",
		kind: "Startup service",
		layer: "infrastructure",
		status: "implemented",
		summary:
			"Provisions the first administrator from the environment when the API starts.",
		responsibilities: [
			"Create the account and the Administrator role when they are missing.",
			"Repair the role of the administrator on every start.",
		],
		expectations: [
			"An email without a password, or a password without an email, stops the start.",
			"No default credential exists in the repository or in the image.",
		],
		data: "The Identity tables.",
	},
	{
		id: "image-volume",
		label: "Image volume",
		kind: "Filesystem volume",
		layer: "data",
		status: "implemented",
		summary:
			"The persistent directory that holds the optimized hotel images. PostgreSQL holds only their metadata.",
		responsibilities: [
			"Keep the image files across restarts of the API.",
			"Stay writable by the non-root runtime user and outside any served directory.",
		],
		expectations: [
			"A file is either referenced by one hotel_images row or an orphan left by a failed cleanup.",
			"It suits a single API instance; a shared store would need a different implementation of the port.",
		],
		data: "Files named by generated keys, plus a staging folder.",
	},
	{
		id: "postgres",
		label: "PostgreSQL 17",
		kind: "Database",
		layer: "data",
		status: "implemented",
		summary:
			"The system of record. It owns the hotels, the ratings, the accounts and the sessions.",
		responsibilities: [
			"Enforce the composite key of the ratings, the score range and the foreign keys.",
			"Apply the atomic upsert of a replaced rating.",
			"Serialize image changes of one hotel with a row lock.",
			"Survive the restart of the API with all the state intact.",
		],
		expectations: [
			"The rating range and the uniqueness of the vote are constraints, not application checks.",
			"The database port is not published in production.",
		],
		data: "hotels (with the optional price_per_night and discount_percent), hotel_images (up to three image rows per hotel), hotel_ratings, auth_sessions and the Identity tables.",
	},
	{
		id: "public-web-routes",
		label: "Public web routes",
		kind: "Angular routes",
		layer: "delivery",
		status: "implemented",
		summary:
			"The public screens of apps/web: the catalog at /, the hotel detail at /hotels/:id and the visitor account pages under /account, lazy loaded inside the public layout.",
		responsibilities: [
			"Show the catalog with a hero for the first hotel that has an image, a sticky name search, the minimum rating thresholds All, 3.0+, 3.5+, 4.0+, 4.5+ and 4.9+ (a valid minRating from the address outside that list is kept exactly and shown as an extra selected threshold) and the pagination, all reflected in the query string.",
			"Show the nightly price in USD on every card that has pricing: the rate and per night, or the struck-through original rate, the discounted rate and a percentage badge when the hotel has a discount. The hero shows no price.",
			"Offer a maximum price per night slider (50 to 1000 in steps of 50, debounced 300 ms) in the advanced filters; 1000 means any price and sends no maxPrice. Destination, property type, categories and amenities stay inert and marked Not available yet.",
			"Show the detail of one hotel with a back link and a breadcrumb to its country, its city and region, the rating summary when it has ratings, a three-tile photo mosaic, the real facts, address and description, and a column that is sticky from lg with the stay estimate, the contact card limited to the contact values the API returned and a sample manager card.",
			"Show loading, empty, error and not found states, and a placeholder when a hotel has no image.",
			"Show a footer whose Destinations area lists the distinct, sorted city and country pairs of the hotels returned by one GET /api/public/hotels request made by the public layout, and is omitted when there are none.",
			"Show the account state in the public header: a Sign in link that carries the current address as a validated returnUrl for an anonymous visitor, and for a signed-in account a button with the truncated email that opens a menu with the full email, Sign out and, for an Administrator, an Administration link to /admin. Sign out clears the session and stays on the page.",
			"Show a Rate this hotel panel below the title block of the detail: an anonymous visitor sees Sign in to rate this hotel. with Sign in and Create an account links back to the detail; a signed-in User or Administrator sees the rating control with the own score, a loading state and a retryable error that never breaks the page.",
			"After a rating is saved, show Thanks, your rating was saved. and update the rating summary from the POST answer without reloading the hotel, so the summary appears after the first rating of a hotel that had none; a 400, 401, 403, 404 or network failure shows its own message in an alert and keeps the previous vote.",
		],
		expectations: [
			"Hotel facts, prices and images come only from the public API. The quote, the suites, the amenities, the perks and the manager card on the detail are typed sample constants with no remote asset, and nothing on the detail makes a booking or claims availability.",
			"Components never call HTTP directly; they read hotels through the catalog service.",
			"A changed filter resets the page to 1; an unset rating or price limit is never sent, and a maxPrice in the address that is not a positive number is ignored.",
			"Reset clears the name, the rating and the price limit together.",
		],
		data: "Local view state in Signals and the query string only. Nothing is persisted in the browser.",
	},
	{
		id: "hotel-detail-components",
		label: "Hotel detail components",
		kind: "Angular components",
		layer: "delivery",
		status: "implemented",
		summary:
			"The presentation pieces composed by the detail page: HotelGallery, ReservationCard, SuitesShowcase, HotelRatingPanel and the reusable OwnRatingField and RatingControl, which the admin edit sheet reuses.",
		responsibilities: [
			"HotelGallery places the image of positions 0, 1 and 2 by their explicit position in a mosaic, keeps the placeholder for an empty position, and opens the existing images in a native modal dialog that closes with its button, Escape or a backdrop click and returns focus to the opener.",
			"ReservationCard shows the nightly price block or Price on request, a nights stepper from 1 to 14, a sample guests select and an estimated total of the effective nightly price times the nights, announced politely.",
			"SuitesShowcase shows three sample suites in an accessible tablist with roving focus and the arrow, Home and End keys.",
			"RatingControl shows five inline SVG stars as a radiogroup labelled Your rating with one radio per integer score, aria-checked on the current score, a roving tab stop, arrow, Home and End keys that move the focus and preview, Space and Enter that select, a hover preview, the value as text such as 4 of 5, read only, disabled and saving states, 44 px targets and motion only when the visitor allows it. It emits the chosen integer score.",
			"createOwnRating is the one own rating state shared by the detail panel and the admin edit sheet: once the session is settled it reads the own score through HotelRatingService, saves a selection, ignores a second selection while saving, maps the failures to their messages and hands the new summary to its host. A rating in flight is never cancelled when the host closes.",
			"OwnRatingField renders that state: loading, a load error with Try again, the RatingControl, the saved message in a status region and the failure in an alert region.",
			"HotelRatingPanel invites an anonymous visitor to sign in or register, shows the OwnRatingField to a signed-in account and reports the new summary to the page.",
		],
		expectations: [
			"The request and concierge buttons are inert: they only show Demo only: nothing was sent. and make no request.",
			"No component calls HTTP; image addresses come from the catalog service and the browser loads them, and the own rating state reaches the API only through HotelRatingService.",
			"The panel never shows the account email and never presents a vote as public identity data.",
		],
		data: "Local view state in Signals only: the open dialog, the nights, the selected suite, the own score, the saving state and the last rating message.",
	},
	{
		id: "hotel-catalog-service",
		label: "HotelCatalogService",
		kind: "Angular HTTP service",
		layer: "delivery",
		status: "implemented",
		summary:
			"The typed HttpClient service of the public catalog, with explicit contracts for the hotel, its pricing block and the page of hotels.",
		responsibilities: [
			"Build the list request with name, minRating, maxPrice, page and pageSize, omitting the name, the rating and the price limit when unset.",
			"Request one hotel by identifier, with its images by position, and build the public image address of position 0 for the cards and of any position for the detail gallery.",
			"Reach the API through the same-origin /api path, proxied to the API in development.",
		],
		expectations: [
			"A 404 on the detail reaches the screen as a not found state, other failures as a retryable error.",
			"The service only uses the anonymous public routes; while any account is signed in the interceptor attaches the token, which those routes ignore.",
		],
		data: "Stateless. It holds no cache and no copy of the hotels.",
	},
	{
		id: "hotel-rating-service",
		label: "HotelRatingService",
		kind: "Angular HTTP service",
		layer: "delivery",
		status: "implemented",
		summary:
			"The typed HttpClient service of the ratings of the signed-in account, separate from the public catalog service and from the administration service.",
		responsibilities: [
			"Send an integer score from 1 to 5 to POST /api/hotels/{id}/ratings and return the rating summary of the answer.",
			"Read the score of the caller from GET /api/hotels/{id}/ratings/me, or null when the caller has not rated the hotel.",
		],
		expectations: [
			"Every request carries the bearer token added by the interceptor; a 401 clears the session there without leaving the public page.",
			"Failures reach the caller unchanged and the shared own rating state maps them to its messages for the detail panel and the admin edit sheet.",
		],
		data: "Stateless. It holds no cache and no copy of the scores.",
	},
	{
		id: "account-web-routes",
		label: "Visitor account pages",
		kind: "Angular routes",
		layer: "delivery",
		status: "implemented",
		summary:
			"The visitor sign in at /account/sign-in and registration at /account/register, lazy loaded inside the public layout and open only to visitors without a session.",
		responsibilities: [
			"Show the sign in card with labelled email and password fields, a show or hide password button, field validation, a loading state and an alert region; 401 shows Invalid email or password., 400 maps the API field errors and network or server failures show a generic message.",
			"Keep the session of any role after a sign in, never revoking it, and go to the validated returnUrl or /.",
			"Show the registration card with email, password and confirm password, the email and password rules of the API mirrored with clear messages, a check that both passwords match, focus on the first invalid field, the 400 field errors mapped and a 409 shown as This email address is already registered. Sign in instead.",
			"After a 201, sign in with the same credentials and go to the validated returnUrl or /; when that sign in fails, ask the visitor to sign in.",
		],
		expectations: [
			"Pages never call HTTP directly; they use AuthService.",
			"The token and the password are never rendered or logged.",
			"The API stays the authority for every rule mirrored in the forms, and registration always yields the User role.",
		],
		data: "Local form state in Signals only; the session in AuthState.",
	},
	{
		id: "admin-web-routes",
		label: "Admin web routes",
		kind: "Angular routes",
		layer: "delivery",
		status: "implemented",
		summary:
			"The administration screens of apps/web: the login at /admin/login, the hotel directory at /admin and the bottom sheet routes /admin/hotels/new and /admin/hotels/:id/edit, all lazy loaded and guarded.",
		responsibilities: [
			"Show a login card with labelled email and password fields, a show or hide password button, field validation, a loading state and an alert region; 401 shows Invalid email or password., 400 maps the API field errors, and network or server failures show a generic message.",
			"Go to a validated returnUrl or /admin after a sign in, and refuse an account without the Administrator role, revoking its session.",
			"Render the admin shell: a left sidebar from lg and a top bar below it with the brand, the Hotels link, View public site, the signed-in email and Sign out.",
			"Show the hotel directory at /admin: a name search debounced 300 ms, a minimum rating select, a maximum price input debounced 300 ms, Reset and the pagination, all kept in the query string as name, minRating, maxPrice and page, so reload and back restore the view.",
			"List ten hotels per page, active and inactive, in a table from md and in stacked cards below it, with the thumbnail of position 0, the name, the city and country, the rating, the nightly price with its discount and the Active or Inactive status, plus loading, empty, error and retry states; the previous rows stay visible while the next page loads and the page never jumps to the top.",
			"Delete a hotel after a native modal confirmation that names it: success or a 404 announces Hotel deleted., reloads the page and steps back one page when the removed hotel was the only one of the last page; any other failure keeps the dialog open with an error.",
			"Open /admin/hotels/new and /admin/hotels/:id/edit as child routes over the mounted directory, in the bottom sheet, and return to /admin with the same query string when the sheet closes.",
			"Create a hotel at /admin/hotels/new with POST /api/hotels, then upload the images chosen per slot in position order; when every upload succeeds close the sheet, otherwise open /admin/hotels/{id}/edit of the created hotel with a message naming the failed slots, so a retry never posts a second hotel.",
			"Edit a hotel at /admin/hotels/:id/edit: show a loading state, pre-fill the form from GET /api/hotels/{id}, send the full replacement with PUT /api/hotels/{id} with empty optional fields as null, show a not found state with a link back on 404 and a retryable error otherwise, and show the rating summary with the own vote of the administrator.",
			"In the Guest ratings section of the edit sheet, read the own vote of the administrator from GET /api/hotels/{id}/ratings/me and save a selection with POST /api/hotels/{id}/ratings through the shared own rating state; the summary of the answer replaces the one in the sheet without reloading the hotel, touching the form values or marking the form dirty, a failed own vote load offers Try again without blocking the form, and the create sheet shows no rating control.",
			"After a create or a save, close the sheet without the discard question and announce Hotel created. or Hotel saved. in the directory, which reloads the current page through AdminDirectoryRefresh without a full page reload; after a rating, announce a quiet change that reloads the page with the new average and leaves the status message as it was.",
			"In the Visibility section of the edit sheet, show a Visible on the public site switch with role switch and the loaded state, save a toggle at once with PUT /api/hotels/{id}/status independent of Save and without marking the form dirty, show Saving… and then Visibility saved., ignore a second toggle while saving, revert the switch with an alert on failure (Try again for network and server failures), and announce a quiet AdminDirectoryRefresh change; the create sheet shows no switch.",
			"Mark an inactive hotel in the directory with a muted Inactive badge titled Hidden from the public site.",
			"Upload, replace and remove the image of each of the three positions at once from the edit sheet with PUT and DELETE /api/hotels/{id}/images/{position}, independent of Save and without marking the form dirty; each slot shows its own progress, the API message of a 400, 413, 415 or 422 in an alert, and the new image through a versioned public address.",
		],
		expectations: [
			"Screens never call HTTP directly; they use AuthService, AuthState, AdminHotelsService and, for the own vote, HotelRatingService through the shared own rating state.",
			"The token and the password are never rendered or logged.",
			"The thumbnails and the image slots use the public image address because an image element cannot send the bearer token, so an inactive hotel shows the placeholder.",
			"Server messages are rendered as text, never as HTML; a 401 is left to the interceptor and a 403 shows You do not have permission to do this.",
		],
		data: "Local form and view state in Signals and the query string only; the latest directory change in AdminDirectoryRefresh.",
	},
	{
		id: "admin-hotels-service",
		label: "AdminHotelsService",
		kind: "Angular HTTP service",
		layer: "delivery",
		status: "implemented",
		summary:
			"The typed HttpClient service of the administration area over the administrative hotel routes, reusing the public hotel contracts.",
		responsibilities: [
			"List hotels from GET /api/hotels with name, minRating, maxPrice, page and pageSize, omitting the name, the rating and the price limit when unset, with the same parameter builder as the catalog service.",
			"Read one hotel from GET /api/hotels/{id}, create one with POST /api/hotels, replace one with PUT /api/hotels/{id} and delete one with DELETE /api/hotels/{id}, always sending the full request body.",
			"Upload an image as the multipart field image with PUT /api/hotels/{id}/images/{position} and remove it with DELETE /api/hotels/{id}/images/{position}.",
			"Set the visibility with PUT /api/hotels/{id}/status and the body { isActive }.",
		],
		expectations: [
			"Every request carries the bearer token added by the interceptor; a 401 ends the session there.",
			"Failures reach the caller unchanged; the directory treats a 404 on delete as already deleted and the sheet treats a 404 on an image removal as already removed.",
		],
		data: "Stateless. It holds no cache and no copy of the hotels.",
	},
	{
		id: "admin-sheet",
		label: "AdminSheet",
		kind: "Angular component",
		layer: "delivery",
		status: "implemented",
		summary:
			"The reusable bottom sheet of the administration area: a native modal dialog that slides up from the bottom and hosts projected content.",
		responsibilities: [
			"Open with showModal, slide up unless the visitor prefers reduced motion, limit the height to 92vh with rounded top corners, a drag handle bar, a sticky header with the title and a close button, and a scrollable body; full width on mobile and centered up to max-w-3xl from md.",
			"Close with Escape, the close button or a backdrop click, lock the page scroll while open and return the focus to the opener.",
			"When its dirty input is set, ask Discard your changes? with Keep editing and Discard instead of closing.",
		],
		expectations: [
			"It knows nothing about hotels; it emits closed and the host route decides where to go.",
		],
		data: "Local view state in Signals only: the discard confirmation.",
	},
	{
		id: "admin-hotel-form",
		label: "AdminHotelForm, AdminImageSlots and AdminVisibilitySwitch",
		kind: "Angular components",
		layer: "delivery",
		status: "implemented",
		summary:
			"The typed reactive hotel form used for create and edit inside the sheet, with the three image slots and the visibility switch projected into it.",
		responsibilities: [
			"Build the Identity, Location, Contact and Pricing sections from the hotel request contract, with the maximum lengths, the required name, the email rule and the http or https website rule of the domain, character counters for the name and the description, errors on blur or submit linked by aria-describedby, and focus on the first invalid field.",
			"Disable and clear the discount while the price is empty, accept a price above 0 up to 100000 with two decimals and a whole discount from 1 to 90, and preview Guests pay $X per night in USD with the effective price helper shared with the public pages.",
			"Place the API field errors of a 400 on their controls, show the other messages in an alert region with a retry for network failures, block double submits while saving and report the dirty state to the sheet.",
			"Render the visibility switch as a button with role switch, aria-checked, a label and a help text, and emit a toggle only when it is not saving.",
			"Show the main image and images 2 and 3 with Upload or Replace and Remove behind an inline confirmation, or let a new hotel pick files that are uploaded after it is created; accept JPEG, PNG and WebP up to 10 MB as client hints.",
		],
		expectations: [
			"No component calls HTTP; the sheet route coordinates AdminHotelsService.",
			"The API stays the authority for every rule mirrored in the form.",
		],
		data: "The form state and the inline confirmation only.",
	},
	{
		id: "web-auth-session",
		label: "AuthService, AuthApi and AuthState",
		kind: "Angular auth services",
		layer: "delivery",
		status: "implemented",
		summary:
			"Registers visitor accounts, signs in, restores and signs out the session of any role and holds it in Signals mirrored to sessionStorage under one key.",
		responsibilities: [
			"Post a new account to /api/auth/register without storing anything.",
			"Post the credentials to /api/auth/login and keep the token, email, roles array and expiry; the role check of the admin login lives in that page, so visitor sessions are never revoked.",
			"Restore a stored session on startup without blocking the first render: discard a malformed or expired value, validate a plausible one with GET /api/auth/me and discard it silently on any failure.",
			"Call POST /api/auth/logout best effort and always clear the local session.",
		],
		expectations: [
			"The register, restore, login and logout requests never trigger the 401 handling of the interceptor.",
			"A closed tab drops the session; there is no refresh.",
		],
		data: "The session in Signals and in sessionStorage under aurea.admin.session.",
	},
	{
		id: "web-auth-interceptor",
		label: "authInterceptor",
		kind: "Angular HTTP interceptor",
		layer: "delivery",
		status: "implemented",
		summary:
			"Adds the bearer token to same-origin /api requests and ends the session on a 401.",
		responsibilities: [
			"Attach Authorization: Bearer only when a session exists and the request targets the same origin with a path of /api or below.",
			"On a 401 from such a request, clear the session; when the router is in or entering /admin, also open /admin/login with the attempted address as a validated returnUrl, and elsewhere stay on the page so the visitor sees the signed-out state.",
		],
		expectations: [
			"Other origins, protocol-relative addresses and non-API paths never receive the token.",
			"No refresh and no retry.",
		],
		data: "Reads the token from AuthState; stores nothing.",
	},
	{
		id: "web-auth-guards",
		label: "Access guards",
		kind: "Angular route guards",
		layer: "delivery",
		status: "implemented",
		summary:
			"The authenticated, Administrator, guest and visitor guest guards that steer navigation once the session restoration has ended.",
		responsibilities: [
			"Send a signed-in account of any role away from /account/sign-in and /account/register to the validated returnUrl or /.",
			"Send an anonymous visitor of /admin to the login with the attempted address.",
			"Send a signed-in account without the Administrator role to the login with an explanation.",
			"Send a signed-in administrator from the login to /admin.",
		],
		expectations: [
			"Guards only steer navigation; the API policies stay the authority.",
			"An expired session is discarded before deciding.",
		],
		data: "Reads AuthState only.",
	},
];

export const edges: ArchitectureEdge[] = [
	{ from: "compose", to: "composition-root", label: "docker compose", protocol: "container" },
	{ from: "composition-root", to: "auth-controller", label: "maps routes", protocol: "in-process" },
	{ from: "composition-root", to: "hotels-controller", label: "maps routes", protocol: "in-process" },
	{ from: "composition-root", to: "ratings-controller", label: "maps routes", protocol: "in-process" },
	{ from: "composition-root", to: "hotel-images-controller", label: "maps routes", protocol: "in-process" },
	{ from: "composition-root", to: "public-hotels-controller", label: "maps routes", protocol: "in-process" },
	{ from: "composition-root", to: "jwt-bearer", label: "adds the middleware", protocol: "in-process" },
	{ from: "composition-root", to: "policies", label: "declares the policies", protocol: "in-process" },
	{ from: "composition-root", to: "health", label: "maps the endpoint", protocol: "in-process" },
	{ from: "auth-controller", to: "authentication-service", label: "use case", protocol: "in-process" },
	{ from: "hotels-controller", to: "hotel-service", label: "use case", protocol: "in-process" },
	{ from: "ratings-controller", to: "hotel-service", label: "use case", protocol: "in-process" },
	{ from: "hotel-images-controller", to: "hotel-image-service", label: "use case", protocol: "in-process" },
	{ from: "public-hotels-controller", to: "hotel-service", label: "active hotels", protocol: "in-process" },
	{ from: "public-hotels-controller", to: "hotel-image-service", label: "active hotel image", protocol: "in-process" },
	{ from: "public-web-routes", to: "hotel-catalog-service", label: "reads hotels", protocol: "in-process" },
	{ from: "public-web-routes", to: "hotel-detail-components", label: "composes the detail", protocol: "in-process" },
	{ from: "hotel-detail-components", to: "hotel-catalog-service", label: "image addresses by position", protocol: "in-process" },
	{ from: "hotel-catalog-service", to: "public-hotels-controller", label: "GET list, detail, image and image positions", protocol: "https" },
	{ from: "public-web-routes", to: "web-auth-session", label: "header state and sign out", protocol: "in-process" },
	{ from: "hotel-detail-components", to: "hotel-rating-service", label: "own score and rating", protocol: "in-process" },
	{ from: "hotel-rating-service", to: "web-auth-interceptor", label: "requests through HttpClient", protocol: "in-process" },
	{ from: "web-auth-interceptor", to: "ratings-controller", label: "POST rating and GET own rating with the bearer token", protocol: "https" },
	{ from: "account-web-routes", to: "web-auth-guards", label: "guest only navigation", protocol: "in-process" },
	{ from: "account-web-routes", to: "web-auth-session", label: "register and sign in", protocol: "in-process" },
	{ from: "admin-web-routes", to: "web-auth-guards", label: "guards navigation", protocol: "in-process" },
	{ from: "admin-web-routes", to: "web-auth-session", label: "sign in and sign out", protocol: "in-process" },
	{ from: "admin-web-routes", to: "admin-hotels-service", label: "lists, reads, writes, shows or hides and deletes hotels and images", protocol: "in-process" },
	{ from: "admin-web-routes", to: "admin-sheet", label: "opens create and edit", protocol: "in-process" },
	{ from: "admin-web-routes", to: "hotel-detail-components", label: "reuses OwnRatingField and RatingControl", protocol: "in-process" },
	{ from: "admin-web-routes", to: "hotel-rating-service", label: "own vote of the administrator", protocol: "in-process" },
	{ from: "admin-web-routes", to: "admin-hotel-form", label: "hosts the hotel form", protocol: "in-process" },
	{ from: "admin-hotel-form", to: "hotel-catalog-service", label: "image addresses by position", protocol: "in-process" },
	{ from: "admin-web-routes", to: "hotel-catalog-service", label: "thumbnail image addresses", protocol: "in-process" },
	{ from: "admin-hotels-service", to: "web-auth-interceptor", label: "requests through HttpClient", protocol: "in-process" },
	{ from: "web-auth-interceptor", to: "hotels-controller", label: "GET list, GET by id, POST, PUT, PUT status, DELETE with the bearer token", protocol: "https" },
	{ from: "web-auth-interceptor", to: "hotel-images-controller", label: "PUT and DELETE images by position with the bearer token", protocol: "https" },
	{ from: "web-auth-guards", to: "web-auth-session", label: "waits for the restore", protocol: "in-process" },
	{ from: "web-auth-session", to: "web-auth-interceptor", label: "requests through HttpClient", protocol: "in-process" },
	{ from: "web-auth-interceptor", to: "auth-controller", label: "POST register, POST login, GET me, POST logout", protocol: "https" },
	{ from: "jwt-bearer", to: "ports", label: "session lookup", protocol: "identity" },
	{ from: "policies", to: "ports", label: "role claim", protocol: "identity" },
	{ from: "authentication-service", to: "token-issuer", label: "issues the token", protocol: "in-process" },
	{ from: "authentication-service", to: "identity-domain", label: "account rules", protocol: "in-process" },
	{ from: "authentication-service", to: "ports", label: "accounts and sessions", protocol: "in-process" },
	{ from: "hotel-service", to: "hotel-domain", label: "hotel rules", protocol: "in-process" },
	{ from: "hotel-service", to: "rating-domain", label: "rating rules", protocol: "in-process" },
	{ from: "hotel-service", to: "ports", label: "hotels, ratings and file cleanup", protocol: "in-process" },
	{ from: "hotel-image-service", to: "hotel-image-domain", label: "image rules", protocol: "in-process" },
	{ from: "hotel-image-service", to: "ports", label: "optimizer, storage and hotels", protocol: "in-process" },
	{ from: "ports", to: "stores", label: "implements", protocol: "in-process" },
	{ from: "ports", to: "identity-store", label: "implements", protocol: "in-process" },
	{ from: "ports", to: "image-optimizer", label: "implements", protocol: "in-process" },
	{ from: "ports", to: "file-storage", label: "implements", protocol: "in-process" },
	{ from: "stores", to: "db-context", label: "EF Core", protocol: "in-process" },
	{ from: "identity-store", to: "db-context", label: "EF Core", protocol: "in-process" },
	{ from: "bootstrap", to: "db-context", label: "EF Core", protocol: "in-process" },
	{ from: "file-storage", to: "image-volume", label: "reads and writes files", protocol: "in-process" },
	{ from: "compose", to: "image-volume", label: "mounts the volume", protocol: "container" },
	{ from: "db-context", to: "postgres", label: "SQL over Npgsql", protocol: "sql" },
];

export const requestFlow: RequestFlowStep[] = [
	{
		title: "The client signs in",
		detail:
			"POST /api/auth/login carries the email and the password. The answer is an access token with the subject, the role and the session identifier.",
	},
	{
		title: "The client calls the API",
		detail:
			"Protected hotel calls carry the token in the Authorization header, while the public catalogue calls do not need one: they are anonymous, and the interceptor adds the token to them only when an account is signed in, where the public routes ignore it. The body never identifies the account.",
	},
	{
		title: "The token is validated",
		detail:
			"The bearer middleware checks the signature, the issuer, the audience and the expiration, then confirms that the session is still open.",
	},
	{
		title: "The policy is evaluated",
		detail:
			"The policy of the route decides with the role of the token: both roles read and rate, only the Administrator writes.",
	},
	{
		title: "A visitor reads the public catalog",
		detail:
			"GET /api/public/hotels, /api/public/hotels/{id}, /api/public/hotels/{id}/image and /api/public/hotels/{id}/images/{position} need no token and skip the token and policy steps. The controller asks the services for active hotels only, so an inactive hotel is absent from the list and answers 404 elsewhere. An optional maxPrice keeps the hotels whose effective nightly price is at most the value, evaluated in the SQL query.",
	},
	{
		title: "The Angular client reads the catalog",
		detail:
			"The public web routes ask the catalog service for a page or a hotel. The service calls the public routes over same-origin /api, with minRating and maxPrice omitted when unset, and the screen renders loading, empty, error or not found states from the answer. The detail page loads the image of each stored position from /api/public/hotels/{id}/images/{position} and, for a signed-in account, reads the own rating from /api/hotels/{id}/ratings/me. The public layout makes its own request for up to 100 hotels to derive the footer destinations, and shows none when it fails.",
	},
	{
		title: "The administrator signs in to the web panel",
		detail:
			"The login page posts to /api/auth/login and AuthState keeps the token, email, roles and expiry in sessionStorage. On reload the session is validated with GET /api/auth/me before the guards decide. The interceptor attaches the token only to same-origin /api requests, and a 401 while in the admin area clears the session and returns to /admin/login with a validated returnUrl. Sign out calls /api/auth/logout best effort and always clears the session.",
	},
	{
		title: "A visitor creates an account and rates a hotel",
		detail:
			"The register page posts to /api/auth/register, which always yields the User role, then signs in with the same credentials through /api/auth/login and returns to the validated returnUrl. The session is kept for any role in the same sessionStorage key. On the detail, the rating panel reads GET /api/hotels/{id}/ratings/me and sends an integer score to POST /api/hotels/{id}/ratings with the bearer token; the summary of the answer replaces the one on screen without reloading the hotel. A 401 outside /admin clears the session and leaves the visitor on the page.",
	},
	{
		title: "The administrator manages the hotel directory",
		detail:
			"The directory reads name, minRating, maxPrice and page from the query string and asks AdminHotelsService for GET /api/hotels with a page size of 10; the interceptor adds the token. Delete calls DELETE /api/hotels/{id} after a confirmation and treats 204 and 404 as deleted. /admin/hotels/new and /admin/hotels/:id/edit open a bottom sheet over the same directory and closing it returns to /admin with the same query string.",
	},
	{
		title: "The administrator creates or edits a hotel in the sheet",
		detail:
			"The new sheet posts the full request to POST /api/hotels and then uploads each chosen image to PUT /api/hotels/{id}/images/{position} as the multipart field image, in position order; a failed upload opens the edit sheet of the created hotel instead of posting again. The edit sheet reads GET /api/hotels/{id}, sends the full replacement to PUT /api/hotels/{id} and changes images at once with PUT and DELETE /api/hotels/{id}/images/{position}. A 400 maps the field errors to the form. After a create or a save the sheet closes and the directory reloads its current page and announces the result. In the edit sheet the administrator also reads GET /api/hotels/{id}/ratings/me and rates with POST /api/hotels/{id}/ratings; the answer updates the summary in the sheet and a quiet AdminDirectoryRefresh change reloads the directory behind it without a message, while PUT /api/hotels/{id} never changes ratings. The Visibility switch sends PUT /api/hotels/{id}/status with only isActive and announces the same quiet change; PUT /api/hotels/{id} never changes the active state.",
	},
	{
		title: "The controller calls the use case",
		detail:
			"The controller translates the request into a command of the application service and back into an answer.",
	},
	{
		title: "The domain validates",
		detail:
			"The domain rules reject an invalid input before any store is called, so a rejected write never reaches the database.",
	},
	{
		title: "The store writes",
		detail:
			"The store applies the change in PostgreSQL. A replaced rating is one atomic upsert on the account and hotel pair.",
	},
	{
		title: "An image is verified before it is kept",
		detail:
			"PUT /api/hotels/{id}/images/{position}, or /image for position 0, decodes the upload with Magick.NET. An original within 400,000 bytes is kept as is; otherwise only a lossless candidate that decodes to the same pixels, profile and orientation is accepted, and anything else is rejected with no change.",
	},
	{
		title: "The file is staged, then the reference swaps",
		detail:
			"The new file is written under a generated key, PostgreSQL swaps the reference of that position under the hotel row lock, and only then is the displaced file deleted. If the swap fails the staged file is removed and every current image stays. Deleting a hotel deletes the files of all its positions.",
	},
	{
		title: "The answer returns",
		detail:
			"The summary comes from the aggregate of the stored votes. A hotel without votes answers a count of zero and a null average. The pricing block carries the USD currency, the nightly rate, the discount and the discounted rate computed by the domain, or is null when the hotel has no price.",
	},
];

export const layerById = new Map(layers.map((layer) => [layer.id, layer]));

export const nodeById = new Map(nodes.map((node) => [node.id, node]));
