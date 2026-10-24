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
			{ label: "Authentication", href: "/authentication/" },
			{ label: "ADR-004 RBAC through policies", href: "/decisions/adr-004-rbac-through-policies/" },
			{ label: "ADR-013 Hotel HTTP contract", href: "/decisions/adr-013-hotel-http-contract/" },
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
		],
	},
	{
		id: "infrastructure",
		title: "Infrastructure",
		responsibility: "Implements the ports with PostgreSQL and ASP.NET Core Identity.",
		accent: "cyan",
		badges: ["EF Core", "Npgsql", "Identity"],
		docs: [
			{ label: "ADR-011 PostgreSQL persistence", href: "/decisions/adr-011-postgresql-persistence/" },
			{ label: "ADR-012 Identity, JWT and sessions", href: "/decisions/adr-012-identity-jwt-and-revocable-sessions/" },
		],
	},
	{
		id: "data",
		title: "Data",
		responsibility: "Stores the state the system owns, with the constraints the domain requires.",
		accent: "emerald",
		badges: ["PostgreSQL 17"],
		docs: [
			{ label: "ADR-002 PostgreSQL", href: "/decisions/adr-002-postgresql-over-sql-server-and-sqlite/" },
			{ label: "ADR-011 PostgreSQL persistence", href: "/decisions/adr-011-postgresql-persistence/" },
		],
	},
	{
		id: "delivery",
		title: "Delivery",
		responsibility: "Runs the API and the database with the same definition in every environment.",
		accent: "violet",
		badges: ["Docker Compose"],
		docs: [
			{ label: "Development", href: "/development/" },
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
			"Applies the migrations with a one-shot migrator before the API starts.",
			"Keeps the PostgreSQL port unpublished in production.",
		],
		expectations: [
			"Development binds the database to loopback; production publishes only the API.",
			"Secrets arrive from the environment; no credential is written in the repository.",
		],
		data: "Volumes and environment variables only. It stores no domain state.",
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
			"Configures the JWT bearer authentication and the five authorization policies.",
			"Publishes the controllers and the health endpoint.",
		],
		expectations: [
			"The API refuses to start in production without a signing key of at least 32 characters.",
			"The first administrator is provisioned from the environment, never from a request.",
		],
		data: "Reads the connection string, the signing key and the administrator pair from the environment.",
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
			"Answers the listing with the items, the page and the totals.",
		],
		expectations: [
			"A rejected write leaves the stored hotel exactly as it was.",
			"The listing order is the creation timestamp and then the identifier.",
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
		],
		expectations: [
			"The minimum rating filter keeps the hotels whose average is at least the value.",
			"Hotels without votes never match a minimum rating filter.",
		],
		data: "Hotels and ratings through the hotel and rating ports.",
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
			"The interfaces the infrastructure must satisfy: hotel store, rating store, session store, account store and token issuer.",
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
		label: "Hotel and HotelDetails",
		kind: "Domain model",
		layer: "domain",
		status: "implemented",
		summary:
			"The hotel aggregate with its descriptive details, its contact data and its active state.",
		responsibilities: [
			"Requires a name and normalizes the optional texts.",
			"Validates the email, the phone and the website formats.",
			"Keeps the creation timestamp and moves the update timestamp.",
		],
		expectations: [
			"Two hotels may share a name; the name is not a key.",
			"The details are bounded; an oversized text is rejected, not truncated.",
		],
		data: "Mapped to the hotels table.",
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
			"Maps the hotels and the hotel_ratings tables with their constraints.",
			"Owns the migrations and the model snapshot.",
		],
		expectations: [
			"The schema is created by the migrations, never by an ad hoc script.",
			"The database enforces the rating range and the one vote per account.",
		],
		data: "The hotels, hotel_ratings and auth_sessions tables.",
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
		],
		expectations: [
			"The listing never issues one query per hotel.",
			"The page offset is computed in 64 bits and bounded before it reaches the driver.",
		],
		data: "The hotels and hotel_ratings tables.",
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
			"Survive the restart of the API with all the state intact.",
		],
		expectations: [
			"The rating range and the uniqueness of the vote are constraints, not application checks.",
			"The database port is not published in production.",
		],
		data: "hotels, hotel_ratings, auth_sessions and the Identity tables.",
	},
];

export const edges: ArchitectureEdge[] = [
	{ from: "compose", to: "composition-root", label: "docker compose", protocol: "container" },
	{ from: "composition-root", to: "auth-controller", label: "maps routes", protocol: "in-process" },
	{ from: "composition-root", to: "hotels-controller", label: "maps routes", protocol: "in-process" },
	{ from: "composition-root", to: "ratings-controller", label: "maps routes", protocol: "in-process" },
	{ from: "composition-root", to: "jwt-bearer", label: "adds the middleware", protocol: "in-process" },
	{ from: "composition-root", to: "policies", label: "declares the policies", protocol: "in-process" },
	{ from: "composition-root", to: "health", label: "maps the endpoint", protocol: "in-process" },
	{ from: "auth-controller", to: "authentication-service", label: "use case", protocol: "in-process" },
	{ from: "hotels-controller", to: "hotel-service", label: "use case", protocol: "in-process" },
	{ from: "ratings-controller", to: "hotel-service", label: "use case", protocol: "in-process" },
	{ from: "jwt-bearer", to: "ports", label: "session lookup", protocol: "identity" },
	{ from: "policies", to: "ports", label: "role claim", protocol: "identity" },
	{ from: "authentication-service", to: "token-issuer", label: "issues the token", protocol: "in-process" },
	{ from: "authentication-service", to: "identity-domain", label: "account rules", protocol: "in-process" },
	{ from: "authentication-service", to: "ports", label: "accounts and sessions", protocol: "in-process" },
	{ from: "hotel-service", to: "hotel-domain", label: "hotel rules", protocol: "in-process" },
	{ from: "hotel-service", to: "rating-domain", label: "rating rules", protocol: "in-process" },
	{ from: "hotel-service", to: "ports", label: "hotels and ratings", protocol: "in-process" },
	{ from: "ports", to: "stores", label: "implements", protocol: "in-process" },
	{ from: "ports", to: "identity-store", label: "implements", protocol: "in-process" },
	{ from: "stores", to: "db-context", label: "EF Core", protocol: "in-process" },
	{ from: "identity-store", to: "db-context", label: "EF Core", protocol: "in-process" },
	{ from: "bootstrap", to: "db-context", label: "EF Core", protocol: "in-process" },
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
			"Every hotel call carries the token in the Authorization header. The body never identifies the account.",
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
		title: "The answer returns",
		detail:
			"The summary comes from the aggregate of the stored votes. A hotel without votes answers a count of zero and a null average.",
	},
];

export const layerById = new Map(layers.map((layer) => [layer.id, layer]));

export const nodeById = new Map(nodes.map((node) => [node.id, node]));
