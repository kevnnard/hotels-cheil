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
		responsibility: "Runs the API and the database with the same definition in every environment, and holds the public Angular client that reads the catalog.",
		accent: "violet",
		badges: ["Docker Compose", "Angular"],
		docs: [
			{ label: "Development", href: "/development/" },
			{ label: "ADR-016 Angular frontend stack", href: "/decisions/adr-016-angular-frontend-stack/" },
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
			"Answers the listing with the items, the page and the totals, filtered by name, minimum rating and maximum nightly price.",
			"Includes the primary image metadata, or null, and the images of every position in every hotel it returns.",
			"Accepts the optional pricePerNight and discountPercent on create and update, and returns a pricing block in USD, or null, in every hotel.",
		],
		expectations: [
			"A rejected write leaves the stored hotel exactly as it was.",
			"The listing order is the creation timestamp and then the identifier.",
			"Updating the descriptive details never changes the images of the hotel.",
			"An update replaces the whole details, so an update without the pricing fields clears the pricing.",
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
			"Records the rating of the signed-in account for one hotel and returns the summary after the write.",
		responsibilities: [
			"Reads the account from the validated token, never from the request body.",
			"Replaces the previous rating of the same account for the same hotel.",
		],
		expectations: [
			"The score is a decimal between 1 and 5, both included.",
			"Rating again moves the average and never grows the number of votes.",
		],
		data: "Writes the hotel_ratings table through the hotel service.",
		endpoints: [
			{
				method: "POST",
				path: "/api/hotels/{id}/ratings",
				policy: "hotels.rate",
				success: "200 with the rating summary",
				failures: "400 score outside 1 to 5, 404 unknown hotel, 401 missing or invalid token",
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
			"Owns the hotel use cases: list with filters, read, create, update, delete and rate.",
		responsibilities: [
			"Translates the query into the filters the store understands.",
			"Computes the rating summary from the stored votes.",
			"Refuses an invalid input before it reaches the database.",
			"Releases the image file of every position of a deleted hotel after the row is gone.",
			"Restricts the public reads to active hotels through the active-only query flag and the active lookups.",
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
			"Swap and clear the image of one position, and delete a hotel with every image, under the hotel row lock, reporting what was displaced.",
			"Filter the listing by the effective nightly price (the discounted rate when there is a discount) inside the SQL query, before the count and the page.",
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
			"The anonymous screens of apps/web: the catalog at / and the hotel detail at /hotels/:id, lazy loaded inside the public layout.",
		responsibilities: [
			"Show the catalog with a hero for the first hotel that has an image, a sticky name search, the minimum rating thresholds All, 4.90+, 4.95+ and 5.0 (decimals kept exactly) and the pagination, all reflected in the query string.",
			"Show the nightly price in USD on every card that has pricing: the rate and per night, or the struck-through original rate, the discounted rate and a percentage badge when the hotel has a discount. The hero shows no price.",
			"Offer a maximum price per night slider (50 to 1000 in steps of 50, debounced 300 ms) in the advanced filters; 1000 means any price and sends no maxPrice. Destination, property type, categories and amenities stay inert and marked Not available yet.",
			"Show the detail of one hotel with a back link and a breadcrumb to its country, its city and region, the rating summary when it has ratings, a three-tile photo mosaic, the real facts, address and description, and a column that is sticky from lg with the stay estimate, the contact card limited to the contact values the API returned and a sample manager card.",
			"Show loading, empty, error and not found states, and a placeholder when a hotel has no image.",
			"Show a footer whose Destinations area lists the distinct, sorted city and country pairs of the hotels returned by one GET /api/public/hotels request made by the public layout, and is omitted when there are none.",
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
			"The presentation pieces composed by the detail page: HotelGallery, ReservationCard and SuitesShowcase.",
		responsibilities: [
			"HotelGallery places the image of positions 0, 1 and 2 by their explicit position in a mosaic, keeps the placeholder for an empty position, and opens the existing images in a native modal dialog that closes with its button, Escape or a backdrop click and returns focus to the opener.",
			"ReservationCard shows the nightly price block or Price on request, a nights stepper from 1 to 14, a sample guests select and an estimated total of the effective nightly price times the nights, announced politely.",
			"SuitesShowcase shows three sample suites in an accessible tablist with roving focus and the arrow, Home and End keys.",
		],
		expectations: [
			"The request and concierge buttons are inert: they only show Demo only: nothing was sent. and make no request.",
			"No component calls HTTP; image addresses come from the catalog service and the browser loads them.",
		],
		data: "Local view state in Signals only: the open dialog, the nights and the selected suite.",
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
			"No token is sent; the service only uses the anonymous public routes.",
		],
		data: "Stateless. It holds no cache and no copy of the hotels.",
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
			"Protected hotel calls carry the token in the Authorization header, while the public catalogue calls are anonymous and send no token. The body never identifies the account.",
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
			"The public web routes ask the catalog service for a page or a hotel. The service calls the public routes over same-origin /api, with minRating and maxPrice omitted when unset, and the screen renders loading, empty, error or not found states from the answer. The detail page loads the image of each stored position from /api/public/hotels/{id}/images/{position} and requests nothing else. The public layout makes its own request for up to 100 hotels to derive the footer destinations, and shows none when it fails.",
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
