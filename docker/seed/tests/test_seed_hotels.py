import contextlib
import io
import json
from decimal import Decimal
import tempfile
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import seed_hotels

EMAIL = "admin@example.test"
PASSWORD = "Sup3rSecretValue"
TOKEN = "token-value-123"
GUEST_PASSWORD = "Gu3stSecretValue"
GUEST_EMAILS = ["seed-guest-{}@aurea.example".format(number) for number in range(1, 7)]
MINIMUM_IMAGE_BYTES = 20 * 1024
MAXIMUM_IMAGE_BYTES = 400 * 1024

HOTELS = [
    {"name": "Alpha", "description": "First", "street": "1 Main St", "city": "Lima", "region": "Lima", "country": "Peru", "postalCode": "15001", "phone": "+51 1 555 0100", "email": "alpha@example.test", "website": "https://alpha.example.com", "image": "alpha.jpg"},
    {"name": "Beta", "description": "Second", "street": "2 Main St", "city": "Cusco", "region": "Cusco", "country": "Peru", "postalCode": "08001", "phone": "+51 84 555 0101", "email": "beta@example.test", "website": "https://beta.example.com", "image": "beta.jpg"},
]

RATED_HOTELS = [
    dict(HOTELS[0], ratings=[5, 4, 5]),
    HOTELS[1],
]

GUEST_ENV = {"SEED_GUEST_PASSWORD": GUEST_PASSWORD}

PRICED_HOTELS = [
    dict(HOTELS[0], pricePerNight=240, discountPercent=15),
    dict(HOTELS[1], pricePerNight=185.5),
]


class FakeApi:
    def __init__(self, existing=(), unhealthy_checks=0, always_down=False, login_status=200, with_image=(), upload_status=200, priced=(), update_status=200, inactive=(), registered=(), register_status=None, guest_login_status=200, rating_status=200, scores=None, status_status=200, with_slots=()):
        self.calls = []
        self.inactive = set(inactive)
        self.registered = set(registered)
        self.register_status = register_status
        self.registrations = []
        self.guest_login_status = guest_login_status
        self.rating_status = rating_status
        self.scores = dict(scores or {})
        self.ratings = []
        self.status_status = status_status
        self.status_changes = []
        self.with_slots = set(with_slots)
        self.created = []
        self.posted = []
        self.updates = []
        self.uploads = []
        self.priced = set(priced)
        self.update_status = update_status
        self.existing = list(existing)
        self.with_image = set(with_image)
        self.upload_status = upload_status
        self.unhealthy_checks = unhealthy_checks
        self.always_down = always_down
        self.login_status = login_status

    def __call__(self, method, path, body=None, token=None, upload=None):
        self.calls.append((method, path, token))
        if self.always_down:
            raise ConnectionRefusedError("down")
        parsed = urlparse(path)
        if parsed.path == "/health":
            if self.unhealthy_checks > 0:
                self.unhealthy_checks -= 1
                raise ConnectionRefusedError("starting")
            return 200, None
        if parsed.path == "/api/auth/register":
            self.registrations.append(body["email"])
            if self.register_status is not None:
                return self.register_status, None
            if body["email"] in self.registered:
                return 409, None
            self.registered.add(body["email"])
            return 201, {"userId": "user-" + body["email"], "email": body["email"]}
        if parsed.path == "/api/auth/login":
            if body["email"] != EMAIL:
                if self.guest_login_status != 200 or body["email"] not in self.registered:
                    return self.guest_login_status if self.guest_login_status != 200 else 401, None
                return 200, {"accessToken": guest_token(body["email"])}
            if self.login_status != 200:
                return self.login_status, None
            return 200, {"accessToken": TOKEN}
        if parsed.path.endswith("/ratings/me") and method == "GET":
            name = parsed.path.split("/")[3].removeprefix("id-")
            return 200, {"score": self.scores.get((name, token))}
        if parsed.path.endswith("/ratings") and method == "POST":
            name = parsed.path.split("/")[3].removeprefix("id-")
            self.ratings.append((name, token, body["score"]))
            if self.rating_status != 200:
                return self.rating_status, None
            self.scores[(name, token)] = body["score"]
            return 200, {"sum": body["score"], "count": 1, "average": body["score"]}
        if parsed.path.endswith("/status") and method == "PUT":
            name = parsed.path.split("/")[3].removeprefix("id-")
            self.status_changes.append((name, body, token))
            if self.status_status != 200:
                return self.status_status, None
            if body["isActive"]:
                self.inactive.discard(name)
            else:
                self.inactive.add(name)
            return 200, self.item(name)
        if parsed.path == "/api/hotels" and method == "GET":
            name = parse_qs(parsed.query)["name"][0]
            items = [self.item(n) for n in self.existing if name.lower() in n.lower()]
            return 200, {"items": items, "page": 1, "pageSize": 100, "totalItems": len(items), "totalPages": 1}
        if parsed.path == "/api/hotels" and method == "POST":
            self.posted.append(body)
            if body.get("pricePerNight") is not None:
                self.priced.add(body["name"])
            self.created.append(body["name"])
            self.existing.append(body["name"])
            return 201, self.item(body["name"])
        if parsed.path.startswith("/api/hotels/id-") and parsed.path.count("/") == 3 and method == "PUT":
            self.updates.append((parsed.path, body))
            if self.update_status != 200:
                return self.update_status, None
            name = parsed.path.split("/")[3].removeprefix("id-")
            if body.get("pricePerNight") is not None:
                self.priced.add(name)
            else:
                self.priced.discard(name)
            return 200, self.item(name)
        if (parsed.path.endswith("/image") or "/images/" in parsed.path) and method == "PUT":
            field, filename, content_type, content = upload
            self.uploads.append((parsed.path, field, filename, content_type, content))
            if self.upload_status != 200:
                return self.upload_status, None
            name = parsed.path.split("/")[3].removeprefix("id-")
            if parsed.path.endswith("/image"):
                self.with_image.add(name)
            else:
                self.with_slots.add((name, int(parsed.path.rsplit("/", 1)[1])))
            return 200, {"contentType": "image/jpeg"}
        return 404, None

    def item(self, name):
        image = {"contentType": "image/jpeg"} if name in self.with_image else None
        pricing = {"currency": "USD", "nightlyRate": 100, "discountPercent": None, "discountedNightlyRate": None} if name in self.priced else None
        slots = [{"position": 0, "contentType": "image/jpeg"}] if image is not None else []
        slots += [{"position": position, "contentType": "image/jpeg"} for slot_name, position in sorted(self.with_slots) if slot_name == name]
        return {"id": "id-" + name, "name": name, "isActive": name not in self.inactive, "image": image, "images": slots, "pricing": pricing}


def guest_token(email):
    return "guest-token-" + email.split("@")[0].rsplit("-", 1)[1]


def run_main(api, env=None, hotels=HOTELS, extra_env=None):
    with tempfile.TemporaryDirectory() as images_dir:
        for name in ("alpha.jpg", "beta.jpg", "alpha-2.jpg", "alpha-3.jpg"):
            Path(images_dir, name).write_bytes(b"jpeg-" + name.encode())
        environment = {"ADMINISTRATOR_EMAIL": EMAIL, "ADMINISTRATOR_PASSWORD": PASSWORD, "SEED_IMAGES_DIR": images_dir}
        if env is not None:
            environment = env
        environment = dict(environment, **(extra_env or {}))
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = seed_hotels.main(environment, api, sleep=lambda _: None, hotels=hotels, attempts=3)
        return code, out.getvalue() + err.getvalue()


def load_data_file(**options):
    return json.loads(Path(seed_hotels.__file__).with_name("hotels.json").read_text(encoding="utf-8"), **options)


class SeedHotelsTests(unittest.TestCase):
    def test_creates_only_the_missing_hotels(self):
        api = FakeApi(existing=["Alpha"])

        code, _ = run_main(api)

        self.assertEqual(0, code)
        self.assertEqual(["Beta"], api.created)

    def test_does_not_duplicate_when_run_twice(self):
        api = FakeApi()

        run_main(api)
        run_main(api)

        self.assertEqual(["Alpha", "Beta"], api.created)

    def test_a_partial_name_match_does_not_count_as_existing(self):
        api = FakeApi(existing=["Alpha Grand"])

        run_main(api)

        self.assertEqual(["Alpha", "Beta"], api.created)

    def test_never_prints_credentials(self):
        for api in (FakeApi(), FakeApi(login_status=401), FakeApi(always_down=True)):
            _, output = run_main(api)
            self.assertNotIn(PASSWORD, output)
            self.assertNotIn(EMAIL, output)
            self.assertNotIn(TOKEN, output)

    def test_waits_for_health_before_login(self):
        api = FakeApi(unhealthy_checks=2)

        code, _ = run_main(api)

        self.assertEqual(0, code)
        paths = [urlparse(path).path for _, path, _ in api.calls]
        self.assertEqual(["/health"] * 3, paths[:3])
        self.assertEqual("/api/auth/login", paths[3])

    def test_fails_when_the_api_stays_unavailable(self):
        api = FakeApi(always_down=True)

        code, _ = run_main(api)

        self.assertNotEqual(0, code)
        self.assertEqual([], api.created)
        self.assertEqual(3, len(api.calls))

    def test_fails_when_login_is_rejected(self):
        api = FakeApi(login_status=401)

        code, _ = run_main(api)

        self.assertNotEqual(0, code)
        self.assertEqual([], api.created)

    def test_fails_when_credentials_are_missing(self):
        api = FakeApi()

        code, _ = run_main(api, env={})

        self.assertNotEqual(0, code)
        self.assertEqual([], api.calls)

    def test_authenticates_hotel_requests_with_the_token(self):
        api = FakeApi()

        run_main(api)

        hotel_calls = [call for call in api.calls if urlparse(call[1]).path == "/api/hotels"]
        self.assertTrue(hotel_calls)
        self.assertTrue(all(token == TOKEN for _, _, token in hotel_calls))


class SeedImageTests(unittest.TestCase):
    def test_uploads_an_image_for_a_hotel_without_one(self):
        api = FakeApi(existing=["Alpha", "Beta"], with_image=["Beta"])

        code, _ = run_main(api)

        self.assertEqual(0, code)
        self.assertEqual([("/api/hotels/id-Alpha/image", "image", "alpha.jpg", "image/jpeg", b"jpeg-alpha.jpg")], api.uploads)

    def test_uploads_an_image_for_each_newly_created_hotel(self):
        api = FakeApi()

        code, _ = run_main(api)

        self.assertEqual(0, code)
        self.assertEqual(["/api/hotels/id-Alpha/image", "/api/hotels/id-Beta/image"], [upload[0] for upload in api.uploads])

    def test_does_not_upload_again_when_the_hotel_already_has_an_image(self):
        api = FakeApi(existing=["Alpha", "Beta"], with_image=["Alpha", "Beta"])

        code, _ = run_main(api)

        self.assertEqual(0, code)
        self.assertEqual([], api.uploads)

    def test_does_not_upload_twice_when_run_twice(self):
        api = FakeApi()

        run_main(api)
        run_main(api)

        self.assertEqual(2, len(api.uploads))

    def test_authenticates_the_upload_with_the_token(self):
        api = FakeApi()

        run_main(api)

        upload_calls = [call for call in api.calls if call[0] == "PUT"]
        self.assertEqual(2, len(upload_calls))
        self.assertTrue(all(token == TOKEN for _, _, token in upload_calls))

    def test_fails_without_leaking_credentials_when_the_upload_is_rejected(self):
        api = FakeApi(upload_status=422)

        code, output = run_main(api)

        self.assertNotEqual(0, code)
        self.assertIn("422", output)
        for secret in (PASSWORD, EMAIL, TOKEN):
            self.assertNotIn(secret, output)

    def test_fails_when_the_image_file_is_missing(self):
        api = FakeApi()
        env = {"ADMINISTRATOR_EMAIL": EMAIL, "ADMINISTRATOR_PASSWORD": PASSWORD, "SEED_IMAGES_DIR": "/nonexistent-seed-images"}

        code, output = run_main(api, env=env)

        self.assertNotEqual(0, code)
        self.assertEqual([], api.uploads)
        self.assertNotIn(PASSWORD, output)


class SeedRatingTests(unittest.TestCase):
    def test_registers_the_six_guests_once_with_the_guest_password(self):
        api = FakeApi()

        code, _ = run_main(api, hotels=RATED_HOTELS, extra_env=GUEST_ENV)

        self.assertEqual(0, code)
        self.assertEqual(GUEST_EMAILS, api.registrations)
        self.assertEqual(set(GUEST_EMAILS), api.registered)

    def test_accepts_a_registration_conflict_as_an_existing_guest(self):
        api = FakeApi(registered=GUEST_EMAILS)

        code, _ = run_main(api, hotels=RATED_HOTELS, extra_env=GUEST_ENV)

        self.assertEqual(0, code)
        self.assertEqual(GUEST_EMAILS, api.registrations)
        self.assertEqual(3, len(api.ratings))

    def test_signs_in_every_guest_with_the_guest_password(self):
        api = FakeApi()
        bodies = []
        original = api.__call__

        def recording(method, path, body=None, token=None, upload=None):
            if path == "/api/auth/login":
                bodies.append(body)
            return original(method, path, body=body, token=token, upload=upload)

        code, _ = run_main(recording, hotels=RATED_HOTELS, extra_env=GUEST_ENV)

        self.assertEqual(0, code)
        guest_logins = [body for body in bodies if body["email"] != EMAIL]
        self.assertEqual(GUEST_EMAILS, [body["email"] for body in guest_logins])
        self.assertTrue(all(body["password"] == GUEST_PASSWORD for body in guest_logins))

    def test_sends_the_ratings_in_order_with_each_guest_token(self):
        api = FakeApi()

        code, _ = run_main(api, hotels=RATED_HOTELS, extra_env=GUEST_ENV)

        self.assertEqual(0, code)
        self.assertEqual(
            [("Alpha", "guest-token-1", 5), ("Alpha", "guest-token-2", 4), ("Alpha", "guest-token-3", 5)],
            api.ratings,
        )

    def test_reads_the_own_rating_before_rating(self):
        api = FakeApi()

        run_main(api, hotels=RATED_HOTELS, extra_env=GUEST_ENV)

        rating_calls = [(method, path, token) for method, path, token in api.calls if "/ratings" in path]
        self.assertEqual(("GET", "/api/hotels/id-Alpha/ratings/me", "guest-token-1"), rating_calls[0])
        self.assertEqual(("POST", "/api/hotels/id-Alpha/ratings", "guest-token-1"), rating_calls[1])

    def test_skips_a_rating_that_already_matches(self):
        api = FakeApi(scores={("Alpha", "guest-token-1"): 5.0, ("Alpha", "guest-token-2"): 2})

        code, output = run_main(api, hotels=RATED_HOTELS, extra_env=GUEST_ENV)

        self.assertEqual(0, code)
        self.assertEqual([("Alpha", "guest-token-2", 4), ("Alpha", "guest-token-3", 5)], api.ratings)
        self.assertIn("1 ratings unchanged", output)

    def test_a_second_run_sends_no_rating(self):
        api = FakeApi()

        run_main(api, hotels=RATED_HOTELS, extra_env=GUEST_ENV)
        run_main(api, hotels=RATED_HOTELS, extra_env=GUEST_ENV)

        self.assertEqual(3, len(api.ratings))
        self.assertEqual(GUEST_EMAILS * 2, api.registrations)

    def test_hotels_without_ratings_send_nothing(self):
        api = FakeApi()

        code, _ = run_main(api, extra_env=GUEST_ENV)

        self.assertEqual(0, code)
        self.assertEqual([], api.ratings)
        self.assertFalse([path for _, path, _ in api.calls if "/ratings" in path])

    def test_reports_guests_and_rating_counts_in_the_summary(self):
        api = FakeApi(scores={("Alpha", "guest-token-3"): 5})

        _, output = run_main(api, hotels=RATED_HOTELS, extra_env=GUEST_ENV)

        self.assertIn("6 guests, 2 ratings sent, 1 ratings unchanged", output)

    def test_skips_ratings_with_one_line_without_the_guest_password(self):
        api = FakeApi()

        code, output = run_main(api, hotels=RATED_HOTELS)

        self.assertEqual(0, code)
        self.assertEqual([], api.registrations)
        self.assertEqual([], api.ratings)
        self.assertEqual(1, output.count("SEED_GUEST_PASSWORD"))
        self.assertEqual(["Alpha", "Beta"], api.created)
        self.assertIn("0 guests, 0 ratings sent, 0 ratings unchanged", output)

    def test_fails_without_leaking_the_password_when_a_registration_is_rejected(self):
        api = FakeApi(register_status=400)

        code, output = run_main(api, hotels=RATED_HOTELS, extra_env=GUEST_ENV)

        self.assertNotEqual(0, code)
        self.assertIn("seed-guest-1@aurea.example", output)
        self.assertIn("400", output)
        self.assertEqual([], api.ratings)
        for secret in (PASSWORD, GUEST_PASSWORD, TOKEN):
            self.assertNotIn(secret, output)

    def test_fails_without_leaking_the_password_when_a_guest_sign_in_is_rejected(self):
        api = FakeApi(guest_login_status=401)

        code, output = run_main(api, hotels=RATED_HOTELS, extra_env=GUEST_ENV)

        self.assertNotEqual(0, code)
        self.assertIn("401", output)
        self.assertNotIn(GUEST_PASSWORD, output)

    def test_fails_without_leaking_secrets_when_a_rating_is_rejected(self):
        api = FakeApi(rating_status=400)

        code, output = run_main(api, hotels=RATED_HOTELS, extra_env=GUEST_ENV)

        self.assertNotEqual(0, code)
        self.assertIn("Alpha", output)
        self.assertIn("400", output)
        for secret in (PASSWORD, GUEST_PASSWORD, TOKEN, "guest-token-1"):
            self.assertNotIn(secret, output)

    def test_ratings_run_after_hotels_and_images(self):
        api = FakeApi()

        run_main(api, hotels=RATED_HOTELS, extra_env=GUEST_ENV)

        paths = [path for _, path, _ in api.calls]
        last_upload = max(index for index, path in enumerate(paths) if path.endswith("/image"))
        first_register = paths.index("/api/auth/register")
        self.assertLess(last_upload, first_register)


class SeedStatusTests(unittest.TestCase):
    INACTIVE_HOTELS = [HOTELS[0], dict(HOTELS[1], isActive=False)]

    def test_deactivates_a_hotel_declared_inactive_as_the_last_step(self):
        api = FakeApi()

        code, _ = run_main(api, hotels=[dict(HOTELS[0], ratings=[4]), dict(HOTELS[1], isActive=False)], extra_env=GUEST_ENV)

        self.assertEqual(0, code)
        self.assertEqual([("Beta", {"isActive": False}, TOKEN)], api.status_changes)
        self.assertEqual("/api/hotels/id-Beta/status", api.calls[-1][1])
        self.assertEqual("PUT", api.calls[-1][0])

    def test_finds_hotels_through_the_admin_list_only(self):
        api = FakeApi()

        run_main(api, hotels=self.INACTIVE_HOTELS)

        self.assertFalse([path for _, path, _ in api.calls if path.startswith("/api/public")])

    def test_a_second_run_with_an_inactive_hotel_creates_no_duplicate_and_sends_nothing(self):
        api = FakeApi()
        run_main(api, hotels=self.INACTIVE_HOTELS, extra_env=GUEST_ENV)
        before = (list(api.created), list(api.status_changes), list(api.ratings), list(api.uploads))

        code, _ = run_main(api, hotels=self.INACTIVE_HOTELS, extra_env=GUEST_ENV)

        self.assertEqual(0, code)
        self.assertEqual(before, (api.created, api.status_changes, api.ratings, api.uploads))
        self.assertEqual(["Alpha", "Beta"], api.created)
        self.assertEqual(1, len(api.status_changes))

    def test_sends_no_status_call_when_the_hotel_is_already_inactive(self):
        api = FakeApi(existing=["Alpha", "Beta"], with_image=["Alpha", "Beta"], inactive=["Beta"])

        code, _ = run_main(api, hotels=self.INACTIVE_HOTELS)

        self.assertEqual(0, code)
        self.assertEqual([], api.created)
        self.assertEqual([], api.status_changes)

    def test_does_not_reactivate_a_hotel_without_an_explicit_state(self):
        api = FakeApi(existing=["Alpha", "Beta"], with_image=["Alpha", "Beta"], inactive=["Alpha"])

        code, _ = run_main(api, hotels=self.INACTIVE_HOTELS)

        self.assertEqual(0, code)
        self.assertEqual([("Beta", {"isActive": False}, TOKEN)], api.status_changes)
        self.assertIn("Alpha", api.inactive)

    def test_reactivates_a_hotel_declared_active_explicitly(self):
        api = FakeApi(existing=["Alpha", "Beta"], with_image=["Alpha", "Beta"], inactive=["Alpha"])

        code, _ = run_main(api, hotels=[dict(HOTELS[0], isActive=True), HOTELS[1]])

        self.assertEqual(0, code)
        self.assertEqual([("Alpha", {"isActive": True}, TOKEN)], api.status_changes)

    def test_never_sends_the_state_or_seed_only_fields_in_hotel_details(self):
        api = FakeApi()

        run_main(api, hotels=[dict(PRICED_HOTELS[0], isActive=False, ratings=[3], images=["alpha-2.jpg"])], extra_env=GUEST_ENV)

        self.assertEqual(1, len(api.posted))
        self.assertFalse({"isActive", "ratings", "image", "images"} & set(api.posted[0]))

    def test_fails_without_leaking_secrets_when_the_status_change_is_rejected(self):
        api = FakeApi(status_status=404)

        code, output = run_main(api, hotels=self.INACTIVE_HOTELS)

        self.assertNotEqual(0, code)
        self.assertIn("Beta", output)
        self.assertIn("404", output)
        for secret in (PASSWORD, EMAIL, TOKEN):
            self.assertNotIn(secret, output)


class SeedGalleryTests(unittest.TestCase):
    GALLERY_HOTELS = [dict(HOTELS[0], images=["alpha-2.jpg", "alpha-3.jpg"]), HOTELS[1]]

    def test_uploads_the_extra_images_to_positions_one_and_two(self):
        api = FakeApi()

        code, _ = run_main(api, hotels=self.GALLERY_HOTELS)

        self.assertEqual(0, code)
        self.assertEqual(
            [
                ("/api/hotels/id-Alpha/image", "alpha.jpg"),
                ("/api/hotels/id-Alpha/images/1", "alpha-2.jpg"),
                ("/api/hotels/id-Alpha/images/2", "alpha-3.jpg"),
                ("/api/hotels/id-Beta/image", "beta.jpg"),
            ],
            [(upload[0], upload[2]) for upload in api.uploads],
        )

    def test_does_not_upload_an_extra_image_to_an_occupied_position(self):
        api = FakeApi(existing=["Alpha", "Beta"], with_image=["Alpha", "Beta"], with_slots=[("Alpha", 1)])

        code, _ = run_main(api, hotels=self.GALLERY_HOTELS)

        self.assertEqual(0, code)
        self.assertEqual(["/api/hotels/id-Alpha/images/2"], [upload[0] for upload in api.uploads])

    def test_a_second_run_uploads_no_extra_image(self):
        api = FakeApi()

        run_main(api, hotels=self.GALLERY_HOTELS)
        run_main(api, hotels=self.GALLERY_HOTELS)

        self.assertEqual(4, len(api.uploads))

    def test_fails_before_contacting_the_api_when_a_referenced_image_is_missing(self):
        api = FakeApi()

        code, output = run_main(api, hotels=[dict(HOTELS[0], images=["missing.jpg"])])

        self.assertNotEqual(0, code)
        self.assertIn("missing.jpg", output)
        self.assertEqual([], api.calls)


class SeedPricingTests(unittest.TestCase):
    def test_creates_hotels_with_their_pricing(self):
        api = FakeApi()

        code, _ = run_main(api, hotels=PRICED_HOTELS)

        self.assertEqual(0, code)
        self.assertEqual([(240, 15), (185.5, None)], [(body["pricePerNight"], body.get("discountPercent")) for body in api.posted])
        self.assertTrue(all("image" not in body for body in api.posted))
        self.assertEqual([], api.updates)

    def test_updates_an_existing_hotel_without_pricing_with_every_field_of_the_data_file(self):
        api = FakeApi(existing=["Alpha", "Beta"], with_image=["Alpha", "Beta"], priced=["Beta"])

        code, output = run_main(api, hotels=PRICED_HOTELS)

        self.assertEqual(0, code)
        expected = {key: value for key, value in PRICED_HOTELS[0].items() if key != "image"}
        self.assertEqual([("/api/hotels/id-Alpha", expected)], api.updates)
        self.assertIn("priced Alpha", output)
        self.assertEqual([], api.created)

    def test_never_touches_an_existing_hotel_that_already_has_pricing(self):
        api = FakeApi(existing=["Alpha", "Beta"], with_image=["Alpha", "Beta"], priced=["Alpha", "Beta"])

        code, _ = run_main(api, hotels=PRICED_HOTELS)

        self.assertEqual(0, code)
        self.assertEqual([], api.updates)
        self.assertEqual([], api.uploads)

    def test_does_not_update_an_existing_hotel_when_the_data_file_has_no_price(self):
        api = FakeApi(existing=["Alpha", "Beta"], with_image=["Alpha", "Beta"])

        code, _ = run_main(api)

        self.assertEqual(0, code)
        self.assertEqual([], api.updates)

    def test_a_second_run_changes_nothing(self):
        api = FakeApi(existing=["Alpha"], with_image=["Alpha"])

        run_main(api, hotels=PRICED_HOTELS)
        calls_after_first = (list(api.created), list(api.updates), list(api.uploads))
        run_main(api, hotels=PRICED_HOTELS)

        self.assertEqual(calls_after_first, (api.created, api.updates, api.uploads))
        self.assertEqual(["Beta"], api.created)
        self.assertEqual(["/api/hotels/id-Alpha"], [path for path, _ in api.updates])

    def test_authenticates_the_pricing_update_with_the_token(self):
        api = FakeApi(existing=["Alpha"], with_image=["Alpha"])

        run_main(api, hotels=PRICED_HOTELS[:1])

        update_calls = [call for call in api.calls if call[0] == "PUT" and call[1] == "/api/hotels/id-Alpha"]
        self.assertEqual([("PUT", "/api/hotels/id-Alpha", TOKEN)], update_calls)

    def test_fails_without_leaking_credentials_when_the_pricing_update_is_rejected(self):
        api = FakeApi(existing=["Alpha"], with_image=["Alpha"], update_status=400)

        code, output = run_main(api, hotels=PRICED_HOTELS[:1])

        self.assertNotEqual(0, code)
        self.assertIn("400", output)
        for secret in (PASSWORD, EMAIL, TOKEN):
            self.assertNotIn(secret, output)


class SeedDataTests(unittest.TestCase):
    def test_the_data_file_holds_thirty_valid_hotels(self):
        hotels = load_data_file()

        self.assertEqual(30, len(hotels))
        self.assertEqual(30, len({hotel["name"] for hotel in hotels}))
        self.assertGreaterEqual(len({hotel["country"] for hotel in hotels}), 15)
        self.assertGreaterEqual(len({hotel["city"] for hotel in hotels}), 25)
        required = {"name", "description", "street", "city", "region", "country", "postalCode", "phone", "email", "website", "pricePerNight"}
        optional = {"image", "images", "discountPercent", "ratings", "isActive"}
        limits = {"name": 200, "description": 2000, "street": 200, "city": 100, "region": 100, "country": 100, "postalCode": 20, "phone": 30, "email": 254, "website": 2048}
        for hotel in hotels:
            self.assertEqual(required, set(hotel) - optional)
            self.assertTrue(hotel["name"].startswith("Aurea "))
            self.assertTrue(hotel["email"].endswith("@example.test"))
            website = urlparse(hotel["website"])
            self.assertEqual("https", website.scheme, hotel["name"])
            self.assertTrue(website.hostname == "example.com" or website.hostname.endswith(".example.com"), hotel["name"])
            for key, limit in limits.items():
                if key not in hotel:
                    continue
                self.assertTrue(0 < len(hotel[key]) <= limit, key)

    def test_every_referenced_image_exists_within_the_upload_size_range(self):
        images = Path(seed_hotels.__file__).with_name("images")
        hotels = load_data_file()

        referenced = [name for hotel in hotels for name in [hotel.get("image")] + hotel.get("images", []) if name is not None]
        self.assertGreaterEqual(len([hotel for hotel in hotels if "image" in hotel]), 9)
        self.assertEqual(len(referenced), len(set(referenced)))
        for name in referenced:
            path = images.joinpath(name)
            self.assertTrue(path.is_file(), name)
            self.assertTrue(MINIMUM_IMAGE_BYTES <= path.stat().st_size <= MAXIMUM_IMAGE_BYTES, name)
        for hotel in hotels:
            self.assertLessEqual(len(hotel.get("images", [])), 2, hotel["name"])
            if "images" in hotel:
                self.assertIn("image", hotel, hotel["name"])

    def test_the_named_photos_are_linked_to_their_hotels(self):
        hotels = {hotel["name"]: hotel for hotel in load_data_file()}

        for name in ("Aurea Alpine Chalet", "Aurea Bali Rice Villa", "Aurea Kyoto Garden House", "Aurea Sydney Harbour Loft", "Aurea Tulum Cenote Retreat"):
            expected = name.lower().replace(" ", "-") + ".jpg"
            self.assertEqual(expected, hotels[name].get("image"), name)

    def test_about_twenty_hotels_carry_ratings_with_distinct_averages(self):
        hotels = load_data_file()

        rated = [hotel for hotel in hotels if "ratings" in hotel]
        self.assertTrue(18 <= len(rated) <= 22, len(rated))
        for hotel in rated:
            scores = hotel["ratings"]
            self.assertTrue(2 <= len(scores) <= 6, hotel["name"])
            self.assertTrue(all(type(score) is int and 1 <= score <= 5 for score in scores), hotel["name"])
            self.assertNotIn("isActive", hotel, hotel["name"])
        averages = [sum(hotel["ratings"]) / len(hotel["ratings"]) for hotel in rated]
        self.assertTrue(any(average >= 4.5 for average in averages))
        self.assertTrue(any(2.5 <= average <= 3.5 for average in averages))
        self.assertGreaterEqual(len([average for average in averages if average < 2.5]), 2)

    def test_exactly_three_hotels_are_inactive_unrated_and_in_different_countries(self):
        hotels = load_data_file()

        declared = [hotel for hotel in hotels if "isActive" in hotel]
        inactive = [hotel for hotel in declared if hotel["isActive"] is False]
        self.assertEqual(3, len(inactive))
        self.assertEqual(declared, inactive)
        self.assertEqual(3, len({hotel["country"] for hotel in inactive}))
        self.assertTrue(all("ratings" not in hotel for hotel in inactive))

    def test_every_hotel_has_a_valid_price_and_about_a_third_a_discount(self):
        hotels = load_data_file(parse_float=Decimal)

        discounted = [hotel for hotel in hotels if "discountPercent" in hotel]
        self.assertEqual(30, len(hotels))
        self.assertTrue(8 <= len(discounted) <= 12, len(discounted))
        for hotel in hotels:
            price = Decimal(hotel["pricePerNight"])
            self.assertTrue(Decimal(120) <= price <= Decimal(950), hotel["name"])
            self.assertIn(price % 1, (Decimal(0), Decimal("0.5")), hotel["name"])
            self.assertNotIsInstance(hotel["pricePerNight"], bool)
        for hotel in discounted:
            self.assertIsInstance(hotel["discountPercent"], int, hotel["name"])
            self.assertTrue(10 <= hotel["discountPercent"] <= 30, hotel["name"])
            self.assertTrue(1 <= hotel["discountPercent"] <= 90, hotel["name"])
            self.assertIn("pricePerNight", hotel)


if __name__ == "__main__":
    unittest.main()
